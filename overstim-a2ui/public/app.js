"use strict";
const screenEl = document.getElementById("screen"), statusEl = document.getElementById("status"), qEl = document.getElementById("q");
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let state = null, history = [];

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error || "Something went wrong"); return j;
}
function draw() {
  screenEl.replaceChildren();
  const ctx = {
    params: state.screen.params,
    recall: (k) => store.get(k),
    remember: (k, v) => { store.set(k, v); draw(); },
    onParam: async (k, v) => { state.screen.params[k] = k === "days" ? Number(v) : v; statusEl.textContent = "Updating…"; try { state.data = (await post("/api/query", { queries: state.screen.queries, params: state.screen.params })).data; statusEl.textContent = ""; } catch (e) { statusEl.textContent = e.message; } draw(); },
  };
  screenEl.appendChild(render(state.screen, state.data, ctx));
}
async function ask(text) {
  if (!text.trim()) return;
  statusEl.textContent = "Thinking… (a moment)";
  try {
    state = await post("/api/ask", { prompt: text, history });
    history.push({ role: "user", text }, { role: "agent", text: state.screen.title });
    statusEl.textContent = ""; draw(); screenEl.focus && screenEl.scrollIntoView({ block: "start" });
  } catch (e) { statusEl.textContent = e.message; }
}
document.getElementById("ask").onsubmit = (e) => { e.preventDefault(); ask(qEl.value); };
document.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { qEl.value = b.dataset.q; ask(b.dataset.q); }));
fetch("/api/meta").then((r) => r.json()).then((m) => { if (!m.ready) statusEl.textContent = "No Gemini key set yet. Start the server with GEMINI_API_KEY=…"; }).catch(() => {});
