type AuthEmail = { to: string; subject: string; message: string; url: string };

export async function sendAuthEmail({ to, subject, message, url }: AuthEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[aruk auth email: development] " + subject + ": " + url);
      return;
    }
    throw new Error("Account email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }

  const from = process.env.EMAIL_FROM?.trim();
  if (process.env.NODE_ENV === "production" && !from) {
    throw new Error("Account email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || "Aruk <onboarding@resend.dev>",
      to: [to],
      subject,
      text: message + "\n\n" + url,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("The account email could not be delivered. Check the email provider settings.");
  }
}
