function getEnv(name) {
  return (
    globalThis.Netlify?.env?.get?.(name) ||
    globalThis.process?.env?.[name] ||
    ""
  );
}

const NEXUSPAG_API_KEY = getEnv("NEXUSPAG_API_KEY");

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

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return json(405, { message: "Method not allowed" });
  }

  const id = context.params.id;
  if (!id) {
    return json(400, { message: "ID ausente." });
  }

  try {
    if (!NEXUSPAG_API_KEY) {
      return json(500, {
        message:
          "NEXUSPAG_API_KEY nao configurada no deploy da Netlify.",
      });
    }

    const response = await fetch(
      `https://nexuspag.com/api/pix/${encodeURIComponent(id)}`,
      {
        headers: {
          "x-api-key": NEXUSPAG_API_KEY,
        },
      }
    );

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
  path: "/api/pix/:id",
};
