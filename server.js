const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;

loadLocalEnv();

const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY || "";
const NEXUSPAG_WEBHOOK_URL = process.env.NEXUSPAG_WEBHOOK_URL || "";
const TIKTOK_PIXEL_ID =
  process.env.TIKTOK_PIXEL_ID || "D8BNOO3C77U6KT5BR3B0";
const TIKTOK_EVENTS_API_TOKEN = process.env.TIKTOK_EVENTS_API_TOKEN || "";
const TIKTOK_TEST_EVENT_CODE = process.env.TIKTOK_TEST_EVENT_CODE || "";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mp4": "video/mp4",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

function loadLocalEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) {
      process.env[key] = value;
    }
  }
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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

function proxyNexusPag(method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const req = https.request(
      {
        hostname: "nexuspag.com",
        path: pathname,
        method,
        headers: {
          "x-api-key": NEXUSPAG_API_KEY,
          "Content-Type": "application/json",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { message: raw };
          }
          resolve({ statusCode: res.statusCode || 500, data });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function sha256(value) {
  value = String(value || "").trim().toLowerCase();
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compactObject(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => {
      return value !== "" && value !== null && value !== undefined;
    })
  );
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  );
}

function tiktokPayload(input, req) {
  const event = String(input.event || "");
  if (!event) {
    throw new Error("Evento ausente.");
  }

  const eventId =
    input.event_id ||
    `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const properties =
    input.properties && typeof input.properties === "object"
      ? input.properties
      : {};
  const userInput =
    input.user && typeof input.user === "object" ? input.user : {};
  const pageInput =
    input.page && typeof input.page === "object" ? input.page : {};

  const user = compactObject({
    ttclid: userInput.ttclid,
    ttp: userInput.ttp,
    email: sha256(userInput.email),
    phone: sha256(String(userInput.phone || "").replace(/\D+/g, "")),
    external_id: sha256(userInput.external_id),
    ip: clientIp(req),
    user_agent: req.headers["user-agent"] || "",
  });

  const page = compactObject({
    url: pageInput.url,
    referrer: pageInput.referrer,
  });

  const payload = {
    event_source: "web",
    event_source_id: TIKTOK_PIXEL_ID,
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

  if (TIKTOK_TEST_EVENT_CODE) {
    payload.test_event_code = TIKTOK_TEST_EVENT_CODE;
  }

  return payload;
}

function sendTikTokEvent(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: "business-api.tiktok.com",
        path: "/open_api/v1.3/event/track/",
        method: "POST",
        headers: {
          "Access-Token": TIKTOK_EVENTS_API_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { message: raw };
          }
          resolve({ statusCode: res.statusCode || 500, data });
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function proxyQrCode(data, res) {
  const qrUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=" +
    encodeURIComponent(data.slice(0, 4096));

  https
    .get(qrUrl, (qrRes) => {
      if ((qrRes.statusCode || 500) >= 400) {
        sendJson(res, 502, { message: "Falha ao gerar QR Code." });
        qrRes.resume();
        return;
      }

      res.writeHead(200, {
        ...CORS_HEADERS,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      });
      qrRes.pipe(res);
    })
    .on("error", () => {
      sendJson(res, 500, { message: "Falha ao gerar QR Code." });
    });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.resolve(ROOT, "." + pathname);
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { message: "Forbidden" });
    return;
  }

  try {
    let stat = await fsp.stat(filePath);
    let finalPath = filePath;
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      try {
        stat = await fsp.stat(indexPath);
        finalPath = indexPath;
      } catch {
        sendJson(res, 404, { message: "Not found" });
        return;
      }
    }

    res.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES[path.extname(finalPath).toLowerCase()] ||
        "application/octet-stream",
      "Content-Length": stat.size,
    });
    fs.createReadStream(finalPath).pipe(res);
  } catch {
    sendJson(res, 404, { message: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/qr") {
      const data = url.searchParams.get("data") || "";
      if (!data) {
        sendJson(res, 400, { message: "Codigo PIX ausente." });
        return;
      }
      proxyQrCode(data, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tiktok/event") {
      if (!TIKTOK_EVENTS_API_TOKEN) {
        sendJson(res, 500, {
          message: "TIKTOK_EVENTS_API_TOKEN nao configurado.",
        });
        return;
      }

      const rawBody = await readRequestBody(req);
      let input = {};
      try {
        input = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        sendJson(res, 400, { message: "JSON invalido." });
        return;
      }

      const payload = tiktokPayload(input, req);
      const result = await sendTikTokEvent(payload);
      sendJson(res, result.statusCode >= 200 && result.statusCode < 300 ? 200 : 502, {
        ok: result.statusCode >= 200 && result.statusCode < 300,
        event_id: payload.data[0].event_id,
        tiktok: result.data,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/pix/create") {
      if (!NEXUSPAG_API_KEY) {
        sendJson(res, 500, { message: "NEXUSPAG_API_KEY nao configurada." });
        return;
      }

      const rawBody = await readRequestBody(req);
      let payload = {};
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        sendJson(res, 400, { message: "JSON invalido." });
        return;
      }

      const proxied = await proxyNexusPag(
        "POST",
        "/api/pix/create",
        nexusPayload(payload)
      );
      sendJson(res, proxied.statusCode, proxied.data);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/pix/")) {
      if (!NEXUSPAG_API_KEY) {
        sendJson(res, 500, { message: "NEXUSPAG_API_KEY nao configurada." });
        return;
      }

      const id = url.pathname.slice("/api/pix/".length);
      const proxied = await proxyNexusPag(
        "GET",
        `/api/pix/${encodeURIComponent(id)}`,
        null
      );
      sendJson(res, proxied.statusCode, proxied.data);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, {
      message:
        error && error.message
          ? error.message
          : "Falha ao processar a requisicao.",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
