import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hasTrustedOrigin } from "@/lib/auth";
import { secretVault } from "@/lib/api-bank";
import { assertSafeMcpUrl, callMcpTool, finishMcpOAuth, listMcpTools, startMcpOAuth, type McpConnectionCredentials } from "@/lib/mcp-connectors";

export const runtime = "nodejs";

function cleanConnection(secret: Awaited<ReturnType<typeof secretVault.list>>[number]) {
  return {
    id: secret.id,
    name: secret.name,
    endpoint: secret.credentials.endpoint || "",
    registryName: secret.credentials.registryName || null,
    authHeader: secret.credentials.authHeader || "Authorization",
    hasCredential: Boolean(secret.credentials.token),
    hasOAuthAccount: Boolean(secret.credentials.oauthTokens),
    status: secret.status,
    createdAt: secret.createdAt,
    lastUsedAt: secret.lastUsedAt,
  };
}

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Sign in to Aruk to use connectors." }, { status: 401 });

  const search = new URL(request.url).searchParams.get("search")?.trim() || "";
  if (search) {
    if (search.length < 3) return NextResponse.json({ servers: [] });
    const registryUrl = new URL("https://registry.modelcontextprotocol.io/v0.1/servers");
    registryUrl.searchParams.set("search", search.slice(0, 100));
    registryUrl.searchParams.set("version", "latest");
    registryUrl.searchParams.set("limit", "30");
    const response = await fetch(registryUrl, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return NextResponse.json({ error: "The MCP Registry is temporarily unavailable." }, { status: 502 });
    const payload = await response.json();
    const servers = (Array.isArray(payload.servers) ? payload.servers : []).flatMap((entry: any) => {
      const server = entry.server || entry;
      const remotes = Array.isArray(server.remotes) ? server.remotes
        .filter((remote: any) => remote?.type === "streamable-http" && typeof remote.url === "string")
        .map((remote: any) => ({ url: remote.url, type: remote.type })) : [];
      if (!remotes.length) return [];
      return [{
        name: String(server.name || "Unknown MCP server").slice(0, 200),
        title: String(server.title || server.name || "MCP server").slice(0, 200),
        description: String(server.description || "").slice(0, 700),
        version: String(server.version || "").slice(0, 80),
        remotes,
      }];
    });
    return NextResponse.json({ servers });
  }

  const connections = await secretVault.list({ userId: user.id, provider: "MCP" });
  return NextResponse.json({ connections: connections.map(cleanConnection) });
}

export async function POST(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Sign in to Aruk to use connectors." }, { status: 401 });
  if (!request.headers.get("origin") || !hasTrustedOrigin(request)) return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const action = String(body.action || "");

  if (action === "add") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim().slice(0, 2048) : "";
    const token = typeof body.token === "string" ? body.token.trim().slice(0, 8192) : "";
    const authHeader = body.authHeader === "X-API-Key" ? "X-API-Key" : "Authorization";
    if (!name || !endpoint) return NextResponse.json({ error: "A connection name and MCP server URL are required." }, { status: 400 });
    if (/[\u0000-\u001f\u007f]/.test(token)) return NextResponse.json({ error: "Credentials cannot contain control characters." }, { status: 400 });
    try {
      await assertSafeMcpUrl(endpoint);
      const secret = await secretVault.add({
        userId: user.id,
        name,
        type: token ? "token" : "other",
        provider: "MCP",
        purpose: "other",
        credentials: { endpoint, token, authHeader, registryName: String(body.registryName || "").slice(0, 200) },
        notes: "Encrypted MCP server connection. Credentials are scoped to this Aruk account.",
      });
      return NextResponse.json({ connection: cleanConnection(secret) }, { status: 201 });
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not save this connection." }, { status: 400 });
    }
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Connection id is required." }, { status: 400 });
  const secret = await secretVault.get(id, user.id);
  if (!secret || secret.provider !== "MCP") return NextResponse.json({ error: "MCP connection not found." }, { status: 404 });
  const credentials = secret.credentials as unknown as McpConnectionCredentials;
  const persistCredentials = async (next: McpConnectionCredentials) => {
    const latest = await secretVault.get(id, user.id);
    if (!latest || latest.provider !== "MCP") throw new Error("MCP connection not found.");
    await secretVault.update(id, user.id, { credentials: { ...latest.credentials, ...next } });
  };

  if (action === "oauth-start") {
    try {
      const callback = new URL(`/api/mcp/oauth/callback?id=${encodeURIComponent(id)}`, request.nextUrl.origin).toString();
      const authorizationUrl = await startMcpOAuth(credentials, callback, persistCredentials);
      return NextResponse.json({ authorizationUrl });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not start MCP sign-in.";
      return NextResponse.json({ error: message.slice(0, 500) }, { status: 502 });
    }
  }

  if (action === "tools") {
    try {
      const tools = await listMcpTools(credentials, persistCredentials);
      await secretVault.touch(id, user.id);
      return NextResponse.json({ tools });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not reach the MCP server.";
      return NextResponse.json({ error: message.slice(0, 500) }, { status: 502 });
    }
  }

  if (action === "call") {
    const name = typeof body.name === "string" ? body.name.slice(0, 150) : "";
    const args = body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments) ? body.arguments : {};
    if (!name || JSON.stringify(args).length > 65_536) return NextResponse.json({ error: "Tool name or arguments are invalid or too large." }, { status: 400 });
    let outcome = "denied";
    try {
      const result = await callMcpTool(credentials, name, args, persistCredentials);
      outcome = result.isError ? "denied" : "allowed";
      return NextResponse.json(result);
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message.slice(0, 500) : "The MCP tool call failed." }, { status: 502 });
    } finally {
      await db.auditEvent.create({
        data: {
          userId: user.id,
          actorName: user.name || "Aruk user",
          action: "mcp.tool.call",
          resourceType: "mcp_tool",
          resourceId: id,
          outcome,
          details: JSON.stringify({ connection: secret.name, tool: name }),
        },
      }).catch(() => undefined);
      await secretVault.touch(id, user.id).catch(() => undefined);
    }
  }

  return NextResponse.json({ error: "Unknown connector action." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return NextResponse.json({ error: "Sign in to Aruk to use connectors." }, { status: 401 });
  if (!request.headers.get("origin") || !hasTrustedOrigin(request)) return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Connection id is required." }, { status: 400 });
  const secret = await secretVault.get(id, user.id);
  if (!secret || secret.provider !== "MCP") return NextResponse.json({ error: "MCP connection not found." }, { status: 404 });
  await secretVault.delete(id, user.id);
  return NextResponse.json({ ok: true });
}
