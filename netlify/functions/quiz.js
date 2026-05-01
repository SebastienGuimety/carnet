const https = require("https");

function callGemini(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: body.messages.map(m => m.content).join("\n\n") }] }],
      generationConfig: { maxOutputTokens: 4000 }
    });
    const req = https.request({
      hostname: "generativelanguage.googleapis.com",
      path: "/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error("Bad JSON: " + data.substring(0, 500))); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: h, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: h, body: '{"error":"Method not allowed"}' };
  if (!process.env.GEMINI_API_KEY) return { statusCode: 500, headers: h, body: JSON.stringify({ error: "GEMINI_API_KEY not set" }) };

  try {
    const body = JSON.parse(event.body);
    const result = await callGemini(body);

    if (result.status !== 200 || result.body.error) {
      const errMsg = result.body.error?.message || JSON.stringify(result.body);
      return { statusCode: 500, headers: h, body: JSON.stringify({ error: "Gemini: " + errMsg }) };
    }

    const text = result.body.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) return { statusCode: 500, headers: h, body: JSON.stringify({ error: "Gemini returned empty response" }) };

    return { statusCode: 200, headers: h, body: JSON.stringify({ content: [{ type: "text", text }] }) };
  } catch (err) {
    return { statusCode: 500, headers: h, body: JSON.stringify({ error: err.message }) };
  }
};
