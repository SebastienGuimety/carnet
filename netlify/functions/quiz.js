const https = require("https");

function callOpenAI(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: body.model || "gpt-4o-mini",
      max_tokens: body.max_tokens || 4000,
      messages: body.messages
    });
    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error("Bad JSON: " + data.substring(0, 200))); }
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
  if (!process.env.OPENAI_API_KEY) return { statusCode: 500, headers: h, body: '{"error":"OPENAI_API_KEY not set"}' };

  try {
    const body = JSON.parse(event.body);
    const result = await callOpenAI(body);
    const text = result.body.choices?.[0]?.message?.content || "";
    return { statusCode: 200, headers: h, body: JSON.stringify({ content: [{ type: "text", text }] }) };
  } catch (err) {
    return { statusCode: 500, headers: h, body: JSON.stringify({ error: err.message }) };
  }
};
