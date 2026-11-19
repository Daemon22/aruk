-- Existing case variants are normalized before the expression index is added.
-- If two existing accounts differ only by email case, this migration intentionally
-- fails instead of merging identities or changing account ownership.
UPDATE "User" SET "email" = lower("email");

CREATE UNIQUE INDEX "User_email_lower_key" ON "User"(lower("email"));

CREATE TRIGGER "User_email_lowercase_insert"
BEFORE INSERT ON "User"
WHEN NEW."email" != lower(NEW."email")
BEGIN
  SELECT RAISE(ABORT, 'User email must be lowercase');
END;

CREATE TRIGGER "User_email_lowercase_update"
BEFORE UPDATE OF "email" ON "User"
WHEN NEW."email" != lower(NEW."email")
BEGIN
  SELECT RAISE(ABORT, 'User email must be lowercase');
END;

ALTER TABLE "User"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER'
CHECK ("role" IN ('ADMIN', 'USER'));
