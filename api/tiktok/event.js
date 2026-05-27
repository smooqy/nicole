const crypto = require("crypto");

const PIXEL_ID = process.env.TIKTOK_PIXEL_ID || "D8BNOO3C77U6KT5BR3B0";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

function sha256(value) {
  value = String(value || "").trim().toLowerCase();
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim())
    return forwarded.split(",")[0].trim();
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    ""
  );
}

function buildPayload(input, req) {
  const event = String(input.event || "");
  if (!event) throw new Error("Evento ausente.");

  const eventId =
    input.event_id ||
    `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const props =
    input.properties && typeof input.properties === "object"
      ? input.properties
      : {};
  const u = input.user && typeof input.user === "object" ? input.user : {};
  const p = input.page && typeof input.page === "object" ? input.page : {};

  const user = compact({
    ttclid: u.ttclid,
    ttp: u.ttp,
    email: sha256(u.email),
    phone: sha256(String(u.phone || "").replace(/\D+/g, "")),
    external_id: sha256(u.external_id),
    ip: clientIp(req),
    user_agent: req.headers["user-agent"] || "",
  });
  const page = compact({ url: p.url, referrer: p.referrer });

  const payload = {
    event_source: "web",
    event_source_id: PIXEL_ID,
    data: [
      {
        event,
        event_time: Number(input.event_time) || Math.floor(Date.now() / 1000),
        event_id: eventId,
        user,
        properties: props,
        ...(Object.keys(page).length ? { page } : {}),
      },
    ],
  };
  if (process.env.TIKTOK_TEST_EVENT_CODE)
    payload.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;
  return payload;
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

  const token = process.env.TIKTOK_EVENTS_API_TOKEN;
  if (!token)
    return res
      .status(500)
      .json({ message: "TIKTOK_EVENTS_API_TOKEN nao configurado." });

  let input;
  try {
    input = await readJson(req);
  } catch {
    return res.status(400).json({ message: "JSON invalido." });
  }

  try {
    const payload = buildPayload(input, req);
    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      {
        method: "POST",
        headers: {
          "Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const text = await response.text();
    let tiktok = text;
    try {
      tiktok = text ? JSON.parse(text) : {};
    } catch {}
    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      event_id: payload.data[0].event_id,
      tiktok,
    });
  } catch (error) {
    return res.status(500).json({
      message: error?.message || "Falha ao enviar evento TikTok.",
    });
  }
};
