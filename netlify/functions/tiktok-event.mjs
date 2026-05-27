function getEnv(name) {
  return (
    globalThis.Netlify?.env?.get?.(name) ||
    globalThis.process?.env?.[name] ||
    ""
  );
}

const PIXEL_ID = getEnv("TIKTOK_PIXEL_ID") || "D8BNOO3C77U6KT5BR3B0";
const EVENTS_API_TOKEN = getEnv("TIKTOK_EVENTS_API_TOKEN");
const TEST_EVENT_CODE = getEnv("TIKTOK_TEST_EVENT_CODE");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

async function sha256(value) {
  value = String(value || "").trim().toLowerCase();
  if (!value) return "";
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function compact(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

function clientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  return (
    req.headers.get("cf-connecting-ip") ||
    forwarded.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

async function buildPayload(input, req) {
  const event = String(input.event || "");
  if (!event) {
    throw new Error("Evento ausente.");
  }

  const eventId =
    input.event_id ||
    `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const properties = input.properties && typeof input.properties === "object" ? input.properties : {};
  const userInput = input.user && typeof input.user === "object" ? input.user : {};
  const pageInput = input.page && typeof input.page === "object" ? input.page : {};

  const user = compact({
    ttclid: userInput.ttclid,
    ttp: userInput.ttp,
    email: await sha256(userInput.email),
    phone: await sha256(String(userInput.phone || "").replace(/\D+/g, "")),
    external_id: await sha256(userInput.external_id),
    ip: clientIp(req),
    user_agent: req.headers.get("user-agent") || "",
  });

  const page = compact({
    url: pageInput.url,
    referrer: pageInput.referrer,
  });

  const payload = {
    event_source: "web",
    event_source_id: PIXEL_ID,
    data: [
      {
        event,
        event_time: Number(input.event_time) || Math.floor(Date.now() / 1000),
        event_id: eventId,
        user,
        properties,
        ...(Object.keys(page).length ? { page } : {}),
      },
    ],
  };

  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  return payload;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  if (!EVENTS_API_TOKEN) {
    return json(500, { message: "TIKTOK_EVENTS_API_TOKEN nao configurado." });
  }

  let input = {};
  try {
    input = await req.json();
  } catch {
    return json(400, { message: "JSON invalido." });
  }

  try {
    const payload = await buildPayload(input, req);
    const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Access-Token": EVENTS_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let tiktok = text;
    try {
      tiktok = text ? JSON.parse(text) : {};
    } catch {}

    return json(response.ok ? 200 : 502, {
      ok: response.ok,
      event_id: payload.data[0].event_id,
      tiktok,
    });
  } catch (error) {
    return json(500, {
      message: error instanceof Error ? error.message : "Falha ao enviar evento TikTok.",
    });
  }
};

export const config = {
  path: "/api/tiktok/event",
};
