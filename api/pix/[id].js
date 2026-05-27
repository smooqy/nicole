const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400",
};

function applyCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

module.exports = async (req, res) => {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ message: "Method not allowed" });

  const apiKey = process.env.NEXUSPAG_API_KEY;
  if (!apiKey)
    return res.status(500).json({ message: "NEXUSPAG_API_KEY nao configurada." });

  const id = req.query?.id;
  if (!id) return res.status(400).json({ message: "ID ausente." });

  try {
    const response = await fetch(
      `https://nexuspag.com/api/pix/${encodeURIComponent(String(id))}`,
      { headers: { "x-api-key": apiKey } }
    );
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
