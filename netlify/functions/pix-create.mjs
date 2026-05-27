function getEnv(name) {
  return (
    globalThis.Netlify?.env?.get?.(name) ||
    globalThis.process?.env?.[name] ||
    ""
  );
}

const NEXUSPAG_API_KEY = getEnv("NEXUSPAG_API_KEY");
const NEXUSPAG_WEBHOOK_URL = getEnv("NEXUSPAG_WEBHOOK_URL");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function nexusPayload(payload) {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor do PIX invalido.");
  }

  const body = {
    amount: Number(amount.toFixed(2)),
    description: String(payload.description || "Nicole Rodrigues").slice(0, 120),
    external_id:
      String(payload.external_id || `nicole-${Date.now()}`).slice(0, 80),
  };

  const webhookUrl = payload.webhook_url || NEXUSPAG_WEBHOOK_URL;
  if (webhookUrl) {
    body.webhook_url = String(webhookUrl);
  }

  return body;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { message: "JSON invalido." });
  }

  try {
    if (!NEXUSPAG_API_KEY) {
      return json(500, {
        message:
          "NEXUSPAG_API_KEY nao configurada no deploy da Netlify.",
      });
    }

    const response = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: {
        "x-api-key": NEXUSPAG_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nexusPayload(payload)),
    });

    const text = await response.text();
    return new Response(text || "{}", {
      status: response.status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          response.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return json(500, {
      message:
        error instanceof Error ? error.message : "Falha ao processar a requisicao.",
    });
  }
};

export const config = {
  path: "/api/pix/create",
};
