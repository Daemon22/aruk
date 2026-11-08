import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { randomBytes } from "node:crypto";
import { Client, StreamableHTTPClientTransport, type OAuthClientProvider } from "@modelcontextprotocol/client";

export type McpConnectionCredentials = {
  endpoint: string;
  token?: string;
  authHeader?: "Authorization" | "X-API-Key";
  registryName?: string;
  oauthRedirectUrl?: string;
  oauthState?: string;
  oauthCodeVerifier?: string;
  oauthTokens?: string;
  oauthClientInformation?: string;
};

function ipv4Number(address: string): number | null {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256) + parts[3];
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const ip = ipv4Number(address);
    if (ip === null) return false;
    const blocked: Array<[number, number]> = [
      [0x00000000, 0x00ffffff], [0x0a000000, 0x0affffff], [0x64400000, 0x647fffff],
      [0x7f000000, 0x7fffffff], [0xa9fe0000, 0xa9feffff], [0xac100000, 0xac1fffff],
      [0xc0000000, 0xc00000ff], [0xc0000200, 0xc00002ff], [0xc0586300, 0xc05863ff],
      [0xc0a80000, 0xc0a8ffff], [0xc6120000, 0xc613ffff], [0xc6336400, 0xc63364ff],
      [0xcb007100, 0xcb0071ff], [0xe0000000, 0xffffffff],
    ];
    return !blocked.some(([start, end]) => ip >= start && ip <= end);
  }
  if (version === 6) {
    const value = address.toLowerCase();
    const first = Number.parseInt(value.split(":")[0] || "0", 16);
    return first >= 0x2000 && first <= 0x3fff && !/^2001:0*db8:/i.test(value) && !value.startsWith("2001:0:") && !value.startsWith("2002:");
  }
  return false;
}

export async function assertSafeMcpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Enter a valid MCP server URL."); }
  if (url.username || url.password || url.hash) throw new Error("The MCP server URL cannot contain a username, password, or fragment.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const local = process.env.NODE_ENV !== "production" && (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "::1" || /^127\./.test(hostname));
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("MCP server URLs must use HTTPS. Local HTTP is allowed only during development.");
  if (local) return url;
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("That MCP server host is not publicly reachable.");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true }).catch(() => [] as Array<{ address: string }>);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("The MCP server must resolve only to public network addresses.");
  return url;
}

async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const target = input instanceof Request ? input.url : String(input);
  await assertSafeMcpUrl(target);
  const timeout = AbortSignal.timeout(20_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal, redirect: "error", cache: "no-store" });
}

type PersistOAuthCredentials = (credentials: McpConnectionCredentials) => Promise<void>;

function makeOAuthProvider(credentials: McpConnectionCredentials, persist: PersistOAuthCredentials, onAuthorization: (url: URL) => void): OAuthClientProvider {
  const redirectUrl = credentials.oauthRedirectUrl;
  if (!redirectUrl) throw new Error("Start the MCP OAuth flow before connecting this account.");
  return {
    get redirectUrl() { return redirectUrl; },
    get clientMetadata() {
      return {
        client_name: "Aruk",
        redirect_uris: [redirectUrl],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      } as any;
    },
    async state() {
      if (!credentials.oauthState) {
        credentials.oauthState = randomBytes(32).toString("base64url");
        await persist(credentials);
      }
      return credentials.oauthState;
    },
    clientInformation() { return credentials.oauthClientInformation ? JSON.parse(credentials.oauthClientInformation) : undefined; },
    async saveClientInformation(value: any) { credentials.oauthClientInformation = JSON.stringify(value); await persist(credentials); },
    tokens() { return credentials.oauthTokens ? JSON.parse(credentials.oauthTokens) : undefined; },
    async saveTokens(value: any) { credentials.oauthTokens = JSON.stringify(value); await persist(credentials); },
    redirectToAuthorization(url) { onAuthorization(url); },
    async saveCodeVerifier(value) { credentials.oauthCodeVerifier = value; await persist(credentials); },
    codeVerifier() { return credentials.oauthCodeVerifier || ""; },
  };
}

function makeClient(credentials: McpConnectionCredentials, oauthProvider?: OAuthClientProvider) {
  const headers: Record<string, string> = {};
  if (credentials.token) {
    const header = credentials.authHeader === "X-API-Key" ? "X-API-Key" : "Authorization";
    headers[header] = header === "Authorization" ? `Bearer ${credentials.token}` : credentials.token;
  }
  const transport = new StreamableHTTPClientTransport(new URL(credentials.endpoint), {
    requestInit: { headers }, fetch: safeFetch, redirectPolicy: "same-origin", onInsufficientScope: "throw", authProvider: oauthProvider,
  });
  const client = new Client({ name: "aruk", version: "0.2.1" }, { capabilities: {} });
  return { client, transport };
}

export async function listMcpTools(credentials: McpConnectionCredentials, persist?: PersistOAuthCredentials) {
  await assertSafeMcpUrl(credentials.endpoint);
  const provider = credentials.oauthRedirectUrl && persist ? makeOAuthProvider(credentials, persist, () => undefined) : undefined;
  const { client, transport } = makeClient(credentials, provider);
  try {
    await client.connect(transport);
    const result = await client.listTools();
    return result.tools.slice(0, 100).map((tool) => ({
      name: String(tool.name).slice(0, 150),
      description: String(tool.description || "No description provided by this server.").slice(0, 1500),
    }));
  } finally { await client.close().catch(() => undefined); }
}

export async function callMcpTool(credentials: McpConnectionCredentials, name: string, args: Record<string, unknown>, persist?: PersistOAuthCredentials) {
  await assertSafeMcpUrl(credentials.endpoint);
  const provider = credentials.oauthRedirectUrl && persist ? makeOAuthProvider(credentials, persist, () => undefined) : undefined;
  const { client, transport } = makeClient(credentials, provider);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name, arguments: args });
    let remainingText = 15_000;
    const content: Array<Record<string, string>> = [];
    for (const part of (result.content || []).slice(0, 50) as any[]) {
      if (part.type === "text") {
        if (remainingText <= 0) break;
        const text = String(part.text || "").slice(0, remainingText);
        content.push({ type: "text", text });
        remainingText -= text.length;
      } else if (part.type === "image") {
        content.push({ type: "image", mimeType: String(part.mimeType || "unknown").slice(0, 100), note: "Image output is not shown in this view." });
      } else {
        content.push({ type: String(part.type || "other").slice(0, 40), note: "Non-text output was returned by the MCP server." });
      }
    }
    let structuredText: string | undefined;
    try {
      if (result.structuredContent !== undefined) structuredText = JSON.stringify(result.structuredContent).slice(0, 5_000);
    } catch {
      structuredText = "[Structured output could not be displayed.]";
    }
    return {
      isError: Boolean(result.isError),
      content,
      ...(structuredText === undefined ? {} : { structuredContent: structuredText }),
    };
  } finally { await client.close().catch(() => undefined); }
}

export async function startMcpOAuth(credentials: McpConnectionCredentials, redirectUrl: string, persist: PersistOAuthCredentials): Promise<string> {
  await assertSafeMcpUrl(credentials.endpoint);
  credentials.oauthRedirectUrl = redirectUrl;
  credentials.oauthState = "";
  credentials.oauthCodeVerifier = "";
  await persist(credentials);
  let authorizationUrl: URL | undefined;
  const provider = makeOAuthProvider(credentials, persist, (url) => { authorizationUrl = url; });
  const { client, transport } = makeClient(credentials, provider);
  try {
    await client.connect(transport);
  } catch (cause) {
    if (!authorizationUrl) throw cause;
  } finally { await client.close().catch(() => undefined); }
  if (!authorizationUrl) throw new Error("This MCP server did not request OAuth sign-in. Add a token or API key if it requires one.");
  return authorizationUrl.toString();
}

export async function finishMcpOAuth(credentials: McpConnectionCredentials, callbackParams: URLSearchParams, persist: PersistOAuthCredentials): Promise<void> {
  if (!credentials.oauthRedirectUrl) throw new Error("No OAuth sign-in is pending for this connection.");
  const provider = makeOAuthProvider(credentials, persist, () => undefined);
  const { transport } = makeClient(credentials, provider);
  try {
    await transport.finishAuth(callbackParams);
    credentials.oauthState = "";
    credentials.oauthCodeVerifier = "";
    await persist(credentials);
  } finally { await transport.close().catch(() => undefined); }
}
