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

  const data = req.query?.data || "";
  if (!data) return res.status(400).json({ message: "Codigo PIX ausente." });

  try {
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&data=" +
      encodeURIComponent(String(data).slice(0, 4096));
    const response = await fetch(qrUrl);
    if (!response.ok)
      return res.status(502).json({ message: "Falha ao gerar QR Code." });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch {
    return res.status(500).json({ message: "Falha ao gerar QR Code." });
  }
};
