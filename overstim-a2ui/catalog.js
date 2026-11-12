"use strict";
// The only building blocks the agent may use. Anything else is dropped before it reaches the screen.
const CATALOG = {
  Column: { desc: "Vertical stack. children: [ids]" },
  Row: { desc: "Horizontal group that wraps on small screens. children: [ids]" },
  Heading: { desc: "Title. text: string, level: 1|2" },
  Text: { desc: "Short paragraph. text: string (no numbers about the data: you cannot see it)" },
  Callout: { desc: "Soft highlighted note. text: string, tone: 'calm'|'note'" },
  Stat: { desc: "One big number. label: string, data: queryId, field: column name, unit?: string" },
  LineChart: { desc: "Line over time. label: string, data: queryId, x: column, y: column" },
  BarChart: { desc: "Bars per category. label: string, data: queryId, x: column (category), y: column (number)" },
  Table: { desc: "Small table. label: string, data: queryId, columns: [{key,label}]" },
  Picker: { desc: "Choice chips that re-fetch live data. label: string, param: 'days'|'user', options: [{label,value}]" },
  ApprovalCard: { desc: "Ask the person to approve a suggested change. title, body, approveLabel, declineLabel" },
};

// Server-side data tools. The model names them; the server runs them. Row values never go to the model.
const TOOLS = {
  users: { desc: "One row per tester.", fields: "user_id, launches, active_days, feels, avg_feel_gap" },
  summary: { desc: "One row of totals.", fields: "launches, active_days, breaks, avg_relief, feels, avg_feel_gap, nudges" },
  daily_levels: { desc: "One row per day.", fields: "date, peak, average, launches" },
  hourly_load: { desc: "One row per hour of day (0-23).", fields: "hour, average_level, launches" },
  band_mix: { desc: "One row per band (calm, steady, loaded, frayed).", fields: "band, events, share_percent" },
  top_apps: { desc: "Most-used apps, up to 8 rows.", fields: "app, launches, average_level_after" },
  nudges: { desc: "One row per nudge reason and outcome.", fields: "reason, outcome, count" },
  feel_vs_computed: { desc: "One row per day comparing felt vs computed level.", fields: "date, felt, computed, gap" },
};

const ARG_RULE = "args: { user: '$user' | 'all' | a tester id, days: '$days' | number }";

function validate(msg) {
  if (!msg || typeof msg !== "object") throw new Error("Agent returned no screen");
  const comps = Array.isArray(msg.components) ? msg.components : [];
  const ids = new Set();
  const clean = [];
  for (const c of comps) {
    if (!c || typeof c.id !== "string" || !CATALOG[c.type] || ids.has(c.id)) continue;
    ids.add(c.id);
    clean.push(c);
  }
  const queries = (Array.isArray(msg.queries) ? msg.queries : []).filter((q) => q && q.id && TOOLS[q.tool]).slice(0, 8);
  const root = ids.has(msg.root) ? msg.root : clean[0] && clean[0].id;
  if (!root) throw new Error("Agent screen had no usable components");
  const params = { user: "all", days: 14, ...(msg.params || {}) };
  return { title: String(msg.title || "Analytics").slice(0, 80), params, queries, root, components: clean };
}

module.exports = { CATALOG, TOOLS, ARG_RULE, validate };
