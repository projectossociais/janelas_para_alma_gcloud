// Calls a Supabase Edge Function via direct fetch.
// Avoids issues seen on some mobile WebViews (Instagram/Facebook/TikTok in-app browsers,
// older Android Chrome) where supabase.functions.invoke triggers a CORS preflight
// that gets blocked. Functions used here have verify_jwt = false so no auth header
// is required. Always returns parsed JSON or throws an Error with a readable message.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function sendToEdgeFunction<T = unknown>(
  name: string,
  body: unknown,
): Promise<T & { error?: string }> {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error(`[${name}] network error:`, networkErr);
    throw new Error(
      "Falha de ligação. Verifique a sua internet (Wi-Fi/dados móveis) e tente novamente.",
    );
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `Erro ${res.status} ao contactar o servidor. Tente novamente.`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data as T & { error?: string };
}
