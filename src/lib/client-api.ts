export async function requestJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : response.status === 401
          ? "Sign in to Aruk to continue."
          : "Aruk request failed (" + response.status + ").";
    throw new Error(message);
  }
  return payload as T;
}

export async function requestArray<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T[]> {
  const payload = await requestJson<unknown>(input, init);
  if (!Array.isArray(payload)) throw new Error("Aruk returned an invalid list response.");
  return payload as T[];
}

export async function requestObject<T extends Record<string, unknown> = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const payload = await requestJson<unknown>(input, init);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Aruk returned an invalid response.");
  }
  return payload as T;
}
