-- Existing case variants are normalized before the expression index is added.
-- If two existing accounts differ only by email case, this migration intentionally
-- fails instead of merging identities or changing account ownership.
UPDATE "User" SET "email" = lower("email");

CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email"));

ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('ADMIN', 'USER'));
