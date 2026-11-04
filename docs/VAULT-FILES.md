# Aruk private file vault

Aruk stores uploaded files in its own SQLite database. The Vault screen offers a per-file encryption choice and an independent compression choice.

## How storage works

- Encryption is on by default. Aruk compresses first when requested, then encrypts the file contents with AES-256-GCM before writing them to SQLite.
- Downloads are scoped to the signed-in account. Aruk decrypts and optionally decompresses the content, then checks the SHA-256 digest and original byte count before returning it.
- Files can be stored without encryption by explicitly turning the encryption option off. Treat that choice as a conscious exception.
- Compression is off by default. It can reduce some file sizes; already-compressed formats may not benefit.
- The current per-file limit is 8 MiB.

File contents are encrypted, but the database keeps the original filename, MIME type, size, digest, encryption/compression flags, and creation time as searchable metadata. The upload endpoint processes the file in memory, so this implementation is intended for small private files, not large object storage.

## Deploying safely

1. Set a stable, high-entropy `ARUK_ENCRYPTION_KEY` in the deployment's secret manager. Back it up separately from the SQLite database. If the key is lost or changed, encrypted files and credentials cannot be recovered.
2. Apply the checked-in Prisma migration before starting the application: `npm run db:migrate:deploy`.
3. Keep the database on persistent storage and back it up together with the matching encryption key.
4. Keep `ARUK_BYPASS_AUTH` disabled in production. Public account creation remains disabled unless the operator deliberately sets `ARUK_ALLOW_PUBLIC_SIGNUP=true`.
5. Use HTTPS in production. The app sets the session cookie as Secure when running in production.

Cloud destinations store encrypted provider credentials and destination metadata; adding one does not verify that provider or upload files. The Passage screen records transfer metadata as an append-only audit log; it does not move file bytes. Use the Vault's Private files panel for files stored directly by Aruk.
