const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const url = new URL(req.url);
  const data = url.searchParams.get("data") || "";
  if (!data) {
    return json(400, { message: "Codigo PIX ausente." });
  }

  try {
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=" +
      encodeURIComponent(data.slice(0, 4096));
    const response = await fetch(qrUrl);

    if (!response.ok || !response.body) {
      return json(502, { message: "Falha ao gerar QR Code." });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json(500, { message: "Falha ao gerar QR Code." });
  }
};

export const config = {
  path: "/api/qr",
};
