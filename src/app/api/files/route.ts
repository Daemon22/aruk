import { createHash } from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import { getSession, hasTrustedOrigin } from "@/lib/auth";
import { decryptBytes, encryptBytes } from "@/lib/crypto";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function safeName(name: string): string {
  return name.replace(/[\r\n"]/g, "_").slice(0, 180) || "download";
}

export async function GET(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in to access your files." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    const files = await db.vaultFile.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, mimeType: true, sizeBytes: true, encrypted: true, compressed: true, sha256: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: files }, { headers: { "Cache-Control": "no-store" } });
  }

  const file = await db.vaultFile.findFirst({ where: { id, userId: user.id } });
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  try {
    let bytes: Buffer;
    if (file.encrypted) {
      bytes = decryptBytes(file.payload);
    } else if (file.payload.startsWith("plainbin:v1:")) {
      bytes = Buffer.from(file.payload.slice("plainbin:v1:".length), "base64");
    } else {
      return NextResponse.json({ error: "Stored file format is not supported." }, { status: 500 });
    }
    if (file.compressed) bytes = gunzipSync(bytes, { maxOutputLength: MAX_FILE_BYTES });
    if (bytes.byteLength !== file.sizeBytes || sha256(bytes) !== file.sha256) {
      return NextResponse.json({ error: "File integrity check failed. The stored file was not returned." }, { status: 500 });
    }

    const filename = safeName(file.name);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "attachment; filename=\"download\"; filename*=UTF-8''" + encodeURIComponent(filename),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to decrypt or verify this file. Check that the configured encryption key is unchanged." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!hasTrustedOrigin(req)) return NextResponse.json({ error: "Untrusted origin." }, { status: 403 });
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in to store files." }, { status: 401 });

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Files must be 8 MB or smaller." }, { status: 413 });
  }

  let form: FormData;
  try {
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Missing body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_REQUEST_BYTES) {
          await reader.cancel();
          return NextResponse.json({ error: "Files must be 8 MB or smaller." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": req.headers.get("content-type") || "" } }).formData();
  } catch {
    return NextResponse.json({ error: "Choose a valid file to store." }, { status: 400 });
  }
  const input = form.get("file");
  if (!(input instanceof File)) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
  if (input.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Files must be 8 MB or smaller." }, { status: 413 });

  const encryptionValues = form.getAll("encrypt");
  if (encryptionValues.length > 1 || encryptionValues.some((value) => value !== "true" && value !== "false")) {
    return NextResponse.json({ error: "Encryption must be true or false." }, { status: 400 });
  }
  const encrypted = form.get("encrypt") !== "false";
  const compressed = form.get("compress") === "true";
  const original = Buffer.from(await input.arrayBuffer());
  const packed = compressed ? gzipSync(original) : original;
  const payload = encrypted ? encryptBytes(packed) : "plainbin:v1:" + packed.toString("base64");
  const mimeType = input.type && /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(input.type)
    ? input.type
    : "application/octet-stream";

  const file = await db.vaultFile.create({
    data: {
      userId: user.id,
      name: safeName(input.name),
      mimeType,
      sizeBytes: original.byteLength,
      payload,
      encrypted,
      compressed,
      sha256: sha256(original),
    },
    select: { id: true, name: true, mimeType: true, sizeBytes: true, encrypted: true, compressed: true, sha256: true, createdAt: true },
  });
  return NextResponse.json({ data: file }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const user = await getSession(req);
  if (!user) return NextResponse.json({ error: "Sign in to delete files." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "File id is required." }, { status: 400 });
  const result = await db.vaultFile.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
