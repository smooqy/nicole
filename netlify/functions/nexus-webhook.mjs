function getEnv(name) {
  return (
    globalThis.Netlify?.env?.get?.(name) ||
    globalThis.process?.env?.[name] ||
    ""
  );
}

const NEXUSPAG_WEBHOOK_SECRET = getEnv("NEXUSPAG_WEBHOOK_SECRET");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Nexuspag-Signature",
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

function parseSignature(header) {
  return String(header || "")
    .split(",")
    .reduce((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});
}

function timingSafeEqualHex(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function isValidNexusSignature(req, rawBody) {
  if (!NEXUSPAG_WEBHOOK_SECRET) return false;
  const parsed = parseSignature(req.headers.get("X-Nexuspag-Signature"));
  if (!parsed.t || !parsed.v1) return false;
  const expected = await hmacSha256Hex(
    NEXUSPAG_WEBHOOK_SECRET,
    `${parsed.t}.${rawBody}`
  );
  return timingSafeEqualHex(expected, parsed.v1);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json(405, { message: "Method not allowed" });
  }

  const rawBody = await req.text();
  if (!(await isValidNexusSignature(req, rawBody))) {
    return json(401, { message: "Assinatura invalida." });
  }

  let event = {};
  try {
    event = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json(400, { message: "JSON invalido." });
  }

  console.log("NexusPag webhook recebido", event);
  return json(200, { received: true });
};

export const config = {
  path: "/api/webhooks/nexuspag",
};
