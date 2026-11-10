import { getAuthEmailConfig, sendAuthEmail } from '../src/lib/auth-email';

const envKeys = [
  'NODE_ENV',
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'POSTMARK_SERVER_TOKEN',
  'POSTMARK_MESSAGE_STREAM',
  'EMAIL_FROM',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const originalInfo = console.info;

let failures = 0;
function check(name: string, condition: boolean) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${name}`);
  } else {
    console.log(`ok:   ${name}`);
  }
}

function setEnv(values: Record<string, string | undefined>) {
  for (const key of envKeys) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

type FetchCall = { url: string; init: RequestInit };
const calls: FetchCall[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url: String(input), init: init || {} });
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

const email = {
  to: 'user@example.com',
  subject: 'Verify your Aruk email',
  message: 'Verify your email address.',
  url: 'https://aruk.example.com/api/auth/verify-email?token=secret',
};

async function main() {
  try {
    setEnv({ NODE_ENV: 'development' });
  calls.length = 0;
  await sendAuthEmail(email);
  check('development without credentials logs instead of calling a provider', calls.length === 0);

  setEnv({ NODE_ENV: 'production', EMAIL_PROVIDER: 'resend' });
  let rejected = false;
  try {
    await sendAuthEmail(email);
  } catch {
    rejected = true;
  }
  check('production Resend configuration fails when required variables are missing', rejected);

  setEnv({
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'Aruk <no-reply@aruk.example.com>',
  });
  calls.length = 0;
  await sendAuthEmail(email);
  check('Resend transport calls the Resend API', calls[0]?.url === 'https://api.resend.com/emails');
  const resendHeaders = new Headers(calls[0]?.init.headers);
  check('Resend transport sends the API key', resendHeaders.get('authorization') === 'Bearer re_test_key');
  const resendBody = JSON.parse(String(calls[0]?.init.body));
  check('Resend transport includes text and HTML bodies', Boolean(resendBody.text?.includes(email.url) && resendBody.html?.includes(email.url)));

  setEnv({
    NODE_ENV: 'production',
    EMAIL_PROVIDER: 'postmark',
    POSTMARK_SERVER_TOKEN: 'postmark_test_key',
    POSTMARK_MESSAGE_STREAM: 'auth',
    EMAIL_FROM: 'Aruk <no-reply@aruk.example.com>',
  });
  calls.length = 0;
  await sendAuthEmail(email);
  check('Postmark transport calls the Postmark API', calls[0]?.url === 'https://api.postmarkapp.com/email');
  const postmarkHeaders = new Headers(calls[0]?.init.headers);
  check('Postmark transport sends the server token', postmarkHeaders.get('x-postmark-server-token') === 'postmark_test_key');
  const postmarkBody = JSON.parse(String(calls[0]?.init.body));
  check('Postmark transport uses the configured message stream', postmarkBody.MessageStream === 'auth');
  check('Postmark transport includes the verified sender', postmarkBody.From === 'Aruk <no-reply@aruk.example.com>');

  setEnv({
    NODE_ENV: 'production',
    POSTMARK_SERVER_TOKEN: 'postmark_test_key',
    EMAIL_FROM: 'Aruk <no-reply@aruk.example.com>',
  });
  check('Postmark is auto-selected when it is the only configured provider', getAuthEmailConfig().provider === 'postmark');
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

main().then(() => {
  console.log(failures === 0 ? '\nAll auth-email tests passed.' : `\n${failures} auth-email test(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
