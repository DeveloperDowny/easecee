"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { CATALOG, TOOLS, ARG_RULE, validate } = require("./catalog");
const { fill, run } = require("./data");

const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MOCK = process.env.MOCK_AGENT === "1"; // dev-only: canned screen so the UI can be tried without a key

const systemPrompt = (users) => `You are the screen designer for an analytics view of an "overstimulation launcher" study.
You never see the data. You describe a screen; the server fills it in. So never write numbers, names of apps or conclusions about the data in text.
Reply with ONE JSON object and nothing else:
{ "title": string,
  "params": { "user": "all" | one of ${JSON.stringify(users)}, "days": 7|14|30 },
  "queries": [ { "id": string, "tool": <tool>, "args": {...} } ],
  "root": <component id>,
  "components": [ { "id": string, "type": <component type>, ...props } ] }
${ARG_RULE}
Tools (data you can request):
${Object.entries(TOOLS).map(([k, v]) => `- ${k}: ${v.desc} Fields: ${v.fields}`).join("\n")}
Components (use only these; parents list child ids in "children"):
${Object.entries(CATALOG).map(([k, v]) => `- ${k}: ${v.desc}`).join("\n")}
Style: calm and small. Prefer 4 to 8 components. Start with a Heading, add one Picker for days, a few Stats and one or two charts. Use an ApprovalCard only when proposing a change. Every chart, Stat and Table needs a "data" query id you declared.`;

async function askGemini(prompt, history, users) {
  if (MOCK) return require("./test/mock-screen.json");
  if (!GEMINI_KEY) throw Object.assign(new Error("No Gemini key set. Start the server with GEMINI_API_KEY=your_key."), { status: 503 });
  const contents = [...(history || []).slice(-6).map((h) => ({ role: h.role === "agent" ? "model" : "user", parts: [{ text: String(h.text).slice(0, 2000) }] })),
    { role: "user", parts: [{ text: String(prompt).slice(0, 1000) }] }];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(users) }] },
      contents,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
  });
  if (!r.ok) throw Object.assign(new Error(`Gemini answered ${r.status}`), { status: 502 });
  const j = await r.json();
  const text = j.candidates && j.candidates[0] && j.candidates[0].content.parts.map((p) => p.text || "").join("");
  if (!text) throw Object.assign(new Error("Gemini returned an empty answer"), { status: 502 });
  return JSON.parse(text);
}

const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readJson = (req) => new Promise((ok, no) => {
  let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e5) req.destroy(); });
  req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { no(e); } });
});
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/meta") {
      const users = await run.users().catch(() => []);
      return send(res, 200, { users: users.map((u) => u.user_id), model: MOCK ? "mock" : MODEL, ready: MOCK || !!GEMINI_KEY });
    }
    if (req.method === "POST" && req.url === "/api/ask") {
      const { prompt, history } = await readJson(req);
      if (!prompt) return send(res, 400, { error: "Ask something first." });
      const users = (await run.users().catch(() => [])).map((u) => u.user_id);
      const screen = validate(await askGemini(prompt, history, users));
      return send(res, 200, { screen, data: await fill(screen.queries, screen.params) });
    }
    if (req.method === "POST" && req.url === "/api/query") {
      const { queries, params } = await readJson(req);
      const valid = (Array.isArray(queries) ? queries : []).filter((q) => q && q.id && TOOLS[q.tool]).slice(0, 8);
      return send(res, 200, { data: await fill(valid, params || {}) });
    }
    if (req.method === "GET") {
      const f = req.url === "/" ? "/index.html" : req.url.split("?")[0];
      const p = path.join(__dirname, "public", path.normalize(f));
      if (p.startsWith(path.join(__dirname, "public")) && fs.existsSync(p) && fs.statSync(p).isFile()) {
        res.writeHead(200, { "content-type": MIME[path.extname(p)] || "text/plain" });
        return fs.createReadStream(p).pipe(res);
      }
    }
    send(res, 404, { error: "Not found" });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
}).listen(PORT, () => console.log(`Overstimulation analytics on http://localhost:${PORT}  (${MOCK ? "MOCK agent" : GEMINI_KEY ? "Gemini " + MODEL : "no Gemini key yet"})`));
