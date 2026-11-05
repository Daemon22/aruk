# Supabase Auth and PostgreSQL setup

Aruk keeps SQLite support for local and offline installs. When DATABASE_URL is a PostgreSQL URL, the app uses the Postgres Prisma client and stores Aruk records in Supabase Postgres. Supabase Auth owns account credentials and sessions.

## 1. Create the Supabase project

Create a project in the Supabase organization you want to own Aruk data. Choose its region and billing plan before creating it: the region is where primary database data is stored. Review the current Supabase plan terms; Free projects can pause after a week of low activity, while paid projects are not paused for inactivity.

The project creation needs an owner decision because region and billing are persistent choices. The project should not be created on a paid plan without explicit approval of the price.

## 2. Configure authentication

In Supabase Authentication settings:

- Enable email sign-up and require email confirmation for public accounts.
- Configure a production SMTP sender for confirmation and recovery messages.
- Add the deployed Aruk callback URL: https://YOUR-ARUK-DOMAIN/auth/callback.
- Add local callback URLs for development: http://localhost:3000/auth/callback and http://127.0.0.1:3000/auth/callback.
- Enable Google and GitHub providers and add the OAuth client credentials from those provider consoles.
- Add https://YOUR-ARUK-DOMAIN/reset-password and the local reset route to the allowed redirect URLs.
- Enable Passkey authentication only after setting its WebAuthn relying-party domain and allowed origin. Supabase currently marks passkey support experimental.

Google and GitHub provider credentials are created in their respective developer consoles. Aruk does not need provider client secrets in browser code.

## 3. Configure the application environment

Copy the project environment template into the deployment's private environment settings. Set:

- NEXT_PUBLIC_SUPABASE_URL to the project URL.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the project's publishable key. The legacy anon key is also accepted.
- SUPABASE_SECRET_KEY to the project secret key. This stays server-side and is used only for complete account deletion.
- DATABASE_URL to the Postgres connection string from the project Connect panel.
- ARUK_TRUSTED_ORIGINS to the exact browser origins for this deployment, comma-separated.
- ARUK_ENCRYPTION_KEY to a stable secret and store a protected backup separately from the database.
- ARUK_SESSION_SECRET for local fallback sessions.

For a persistent Node server, use the connection method recommended by Supabase for that runtime. For a serverless deployment, use the Supabase pooler mode appropriate for Prisma and the deployment's connection limits. Do not put a database password or Supabase secret key in a NEXT_PUBLIC_ variable.

## 4. Apply the schema

From the project directory, run:

    npm run db:postgres:migrate:deploy

This creates Aruk's application tables and links each Aruk user record to auth.users with ON DELETE CASCADE. Use migrations for the hosted database; do not run Prisma db push against the Supabase project.

## 5. Preserve existing local data

Before moving an existing SQLite install, make a backup of its database file. Set ARUK_SQLITE_SOURCE_URL to that file and DATABASE_URL to the empty Supabase Postgres database, then run:

    npm run db:sqlite-to-postgres

The migration refuses a target that already has Aruk users. It copies the application records, clears local password hashes, and skips old local AuthSession tokens. A user can then create or verify the matching email account through Supabase Auth; Aruk links that verified identity to the existing data by email. Keep the original SQLite backup until the account and its files are verified in the hosted app.

## 6. Account behavior

Email and password sign-up requires a confirmed email. Google and GitHub sign-in use Supabase OAuth. Users can connect more than one identity to a single Aruk account and remove an individual sign-in method without deleting that account's data. Deleting the Aruk account removes the Supabase Auth user and its owned Aruk rows. Account deletion requires a recent sign-in and the server-only Supabase secret key.

The app supports TOTP authenticator MFA. Passkey sign-in and management require Supabase's experimental passkey option and the project's WebAuthn settings. Review Supabase's current passkey support status before enabling it for a public launch.
