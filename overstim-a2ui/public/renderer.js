"use strict";
// Draws an agent screen using only the components below. All text goes in via textContent.
const NS = "http://www.w3.org/2000/svg";
const BAND_VAR = { calm: "--calm", steady: "--steady", loaded: "--loaded", frayed: "--frayed" };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const svg = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function dataTable(rows, cols) {
  const d = el("details"); d.appendChild(el("summary", null, "View as table"));
  const t = el("table"), h = el("tr");
  cols.forEach((c) => h.appendChild(el("th", null, c)));
  t.appendChild(h);
  rows.slice(0, 60).forEach((r) => { const tr = el("tr"); cols.forEach((c) => tr.appendChild(el("td", null, r[c] ?? ""))); t.appendChild(tr); });
  d.appendChild(t); return d;
}

function chart(c, rows, kind) {
  const card = el("div", "card"); card.appendChild(el("h3", null, c.label || ""));
  if (!rows.length) { card.appendChild(el("p", "hint", "No data for this range yet.")); return card; }
  const W = 640, H = 220, L = 34, B = 26, T = 8, R = 8, max = Math.max(1, ...rows.map((r) => num(r[c.y])));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${c.label}: ${kind} chart of ${c.y} by ${c.x}, ${rows.length} points, highest ${max}` });
  const X = (i) => L + (rows.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (rows.length - 1));
  const Y = (v) => T + (H - T - B) * (1 - num(v) / max);
  [0, 0.5, 1].forEach((f) => { const y = T + (H - T - B) * (1 - f); s.appendChild(svg("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: "var(--line)" })); const t = svg("text", { x: L - 6, y: y + 4, "text-anchor": "end" }); t.textContent = Math.round(max * f); s.appendChild(t); });
  const step = Math.ceil(rows.length / 7);
  if (kind === "line") {
    s.appendChild(svg("polyline", { fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, points: rows.map((r, i) => `${X(i)},${Y(r[c.y])}`).join(" ") }));
    rows.forEach((r, i) => s.appendChild(svg("circle", { cx: X(i), cy: Y(r[c.y]), r: 3.5, fill: "var(--accent)" })));
  } else {
    const bw = (W - L - R) / rows.length;
    rows.forEach((r, i) => {
      const y = Y(r[c.y]), fill = BAND_VAR[r[c.x]] ? `var(${BAND_VAR[r[c.x]]})` : "var(--accent)";
      s.appendChild(svg("rect", { x: L + i * bw + bw * 0.15, y, width: bw * 0.7, height: H - B - y, rx: 3, fill }));
    });
  }
  rows.forEach((r, i) => { if (i % step) return; const t = svg("text", { x: kind === "line" ? X(i) : L + i * ((W - L - R) / rows.length) + (W - L - R) / rows.length / 2, y: H - 8, "text-anchor": "middle" }); t.textContent = String(r[c.x]).slice(-5); s.appendChild(t); });
  card.appendChild(s); card.appendChild(dataTable(rows, [c.x, c.y])); return card;
}

function render(screen, data, ctx) {
  const byId = Object.fromEntries(screen.components.map((c) => [c.id, c]));
  const seen = new Set();
  const build = (id) => {
    const c = byId[id]; if (!c || seen.has(id)) return el("span");
    seen.add(id);
    const rows = data[c.data] || [];
    const kids = () => (c.children || []).map(build);
    switch (c.type) {
      case "Column": { const e = el("div", "col"); kids().forEach((k) => e.appendChild(k)); return e; }
      case "Row": { const e = el("div", "row"); kids().forEach((k) => e.appendChild(k)); return e; }
      case "Heading": return el(c.level === 1 ? "h2" : "h3", null, c.text || "");
      case "Text": return el("p", null, c.text || "");
      case "Callout": return el("div", "callout", c.text || "");
      case "Stat": { const e = el("div", "card stat"); const v = rows[0] ? rows[0][c.field] : null; e.appendChild(el("div", "v", v == null ? "—" : String(v) + (c.unit ? " " + c.unit : ""))); e.appendChild(el("div", "l", c.label || "")); return e; }
      case "LineChart": return chart(c, rows, "line");
      case "BarChart": return chart(c, rows, "bar");
      case "Table": { const card = el("div", "card"); card.appendChild(el("h3", null, c.label || "")); const cols = (c.columns || []).slice(0, 6); const t = el("table"), h = el("tr"); cols.forEach((k) => h.appendChild(el("th", null, k.label || k.key))); t.appendChild(h); rows.slice(0, 20).forEach((r) => { const tr = el("tr"); cols.forEach((k) => tr.appendChild(el("td", null, r[k.key] ?? ""))); t.appendChild(tr); }); card.appendChild(t); return card; }
      case "Picker": {
        const e = el("div", "chips"); e.setAttribute("role", "group"); e.setAttribute("aria-label", c.label || "Choose");
        e.appendChild(el("span", null, c.label || ""));
        const param = c.param === "user" ? "user" : "days";
        (c.options || []).slice(0, 8).forEach((o) => { const b = el("button", null, o.label); b.type = "button"; b.setAttribute("aria-pressed", String(String(ctx.params[param]) === String(o.value))); b.onclick = () => ctx.onParam(param, o.value); e.appendChild(b); });
        return e;
      }
      case "ApprovalCard": {
        const e = el("div", "card"); e.appendChild(el("h2", null, c.title || "")); e.appendChild(el("p", null, c.body || ""));
        const key = "approval:" + (c.title || c.id), prev = ctx.recall(key);
        if (prev) { e.appendChild(el("p", "done", prev === "yes" ? "You approved this (demo only; nothing was changed)." : "You chose not now.")); return e; }
        const row = el("div", "chips"); const yes = el("button", "primary", c.approveLabel || "Approve"), no = el("button", null, c.declineLabel || "Not now");
        yes.type = no.type = "button"; yes.onclick = () => ctx.remember(key, "yes"); no.onclick = () => ctx.remember(key, "no");
        row.appendChild(yes); row.appendChild(no); e.appendChild(row); return e;
      }
      default: return el("span");
    }
  };
  return build(screen.root);
}
if (typeof module !== "undefined") module.exports = { render };
