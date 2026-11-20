import { createCraftHttpAdapter } from "craft-engine/lib/craft/http-adapter";
import { getSession, hasTrustedOrigin } from "./auth";

export const CRAFT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = CRAFT_MAX_FILE_BYTES + 64 * 1024;

const craftAdapter = createCraftHttpAdapter({ maxFileSizeBytes: CRAFT_MAX_FILE_BYTES });

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, private");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Authenticated, bounded bridge from Aruk routes to Craft Engine's Fetch adapter. */
export async function handleCraftArchiveRequest(
  request: Request,
  operation: "archive" | "restore",
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse("Use POST for Craft archive operations.", 405);
  }
  if (!hasTrustedOrigin(request)) {
    return errorResponse("Untrusted request origin.", 403);
  }
  const user = await getSession(request);
  if (!user) {
    return errorResponse("Sign in to use Craft archive tools.", 401);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse("Craft files must be 8 MiB or smaller.", 413);
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_REQUEST_BYTES) {
          void reader.cancel().catch(() => {});
          return errorResponse("Craft request exceeds the 8 MiB file limit.", 413);
        }
        chunks.push(value);
      }
    } catch {
      return errorResponse("Choose a valid file to process.", 400);
    } finally {
      reader.releaseLock();
    }
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers(request.headers);
  // The original transport length may be absent or inconsistent after buffering.
  headers.delete("content-length");
  let boundedRequest: Request;
  try {
    boundedRequest = new Request(request.url, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    return errorResponse("Choose a valid multipart file to process.", 400);
  }

  try {
    const response = operation === "archive"
      ? await craftAdapter.create(boundedRequest)
      : await craftAdapter.restore(boundedRequest);
    return secureResponse(response);
  } catch {
    return errorResponse("Unable to process the Craft file. No file was stored.", 500);
  }
}
