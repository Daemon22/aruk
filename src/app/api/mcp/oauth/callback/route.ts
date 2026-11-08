import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { secretVault } from "@/lib/api-bank";
import { finishMcpOAuth, type McpConnectionCredentials } from "@/lib/mcp-connectors";

export const runtime = "nodejs";

function returnToConnectors(request: NextRequest, status: string) {
  const target = new URL("/", request.nextUrl.origin);
  target.searchParams.set("tab", "connectors");
  target.searchParams.set("oauth", status);
  return NextResponse.redirect(target);
}

export async function GET(request: NextRequest) {
  const user = await getSession(request);
  if (!user) return returnToConnectors(request, "signin-required");

  const id = request.nextUrl.searchParams.get("id") || "";
  const secret = id ? await secretVault.get(id, user.id) : null;
  if (!secret || secret.provider !== "MCP") return returnToConnectors(request, "failed");
  if (request.nextUrl.searchParams.has("error")) return returnToConnectors(request, "cancelled");

  const credentials = secret.credentials as unknown as McpConnectionCredentials;
  const expectedRedirect = new URL(`/api/mcp/oauth/callback?id=${encodeURIComponent(id)}`, request.nextUrl.origin).toString();
  if (credentials.oauthRedirectUrl !== expectedRedirect) return returnToConnectors(request, "failed");

  const persistCredentials = async (next: McpConnectionCredentials) => {
    const latest = await secretVault.get(id, user.id);
    if (!latest || latest.provider !== "MCP") throw new Error("MCP connection not found.");
    await secretVault.update(id, user.id, { credentials: { ...latest.credentials, ...next } });
  };

  try {
    await finishMcpOAuth(credentials, request.nextUrl.searchParams, persistCredentials);
    return returnToConnectors(request, "connected");
  } catch {
    return returnToConnectors(request, "failed");
  }
}
