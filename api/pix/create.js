const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
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
  const webhookUrl = payload.webhook_url || process.env.NEXUSPAG_WEBHOOK_URL;
  if (webhookUrl) body.webhook_url = String(webhookUrl);
  return body;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey)
    return res.status(500).json({ message: "NEXUSPAG_API_KEY nao configurada." });

  let payload;
  try {
    payload = await readJson(req);
  } catch {
    return res.status(400).json({ message: "JSON invalido." });
  }

  try {
    const response = await fetch("https://nexuspag.com/api/pix/create", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nexusPayload(payload)),
    });
    const text = await response.text();
    res.setHeader(
      "Content-Type",
      response.headers.get("Content-Type") || "application/json; charset=utf-8"
    );
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).send(text || "{}");
  } catch (error) {
    return res.status(500).json({
      message: error?.message || "Falha ao processar a requisicao.",
    });
  }
};
