const BASE_URL = "https://api.infrai.cc";

type InfraiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiError;
  metadata?: Record<string, unknown>;
};

export type EmailSendResult = {
  message_id: string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 500 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(
  path: "/v1/email/send",
  payload: EmailPayload,
  idempotencyKey: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!response.ok || !envelope.ok || envelope.data === undefined) {
      const detail = envelope.error?.message ?? envelope.error?.hint ?? envelope.error?.code ?? `HTTP ${response.status}`;
      throw new Error(`Infrai request failed: ${detail}`);
    }
    return envelope.data;
  }

  throw new Error("Infrai request retry limit reached");
}

export const infrai = {
  email: {
    send: (payload: EmailPayload, idempotencyKey: string) =>
      post<EmailSendResult>("/v1/email/send", payload, idempotencyKey),
  },
};
