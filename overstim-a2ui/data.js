"use strict";
// Reads the launcher's Supabase tables (read-only) and shapes rows for the screens.
const URL_ = process.env.SUPABASE_URL || "https://ptlqkgjscqgsywaksxox.supabase.co";
// Publishable (anon) key, the same one the launcher's public web app ships with.
const KEY = process.env.SUPABASE_KEY || "sb_publishable_UwFEUyJDZLwmBlnwmzT6JQ_L5ZTZFzI";
const COLS = "user_id,ts,date,hour,event,level_after,band_after,app,activity,felt,computed_level,break_minutes,relief,nudge_reason,nudge_outcome";

async function rest(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function events(user, days) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const u = user && user !== "all" ? `&user_id=eq.${encodeURIComponent(user)}` : "";
  let out = [];
  for (let from = 0; from < 20000; from += 1000) {
    const page = await rest(`events?select=${COLS}&ts=gte.${since}${u}&order=ts.asc&limit=1000&offset=${from}`);
    out = out.concat(page);
    if (page.length < 1000) break;
  }
  return out;
}

const r1 = (x) => Math.round(x * 10) / 10;
const avg = (a) => (a.length ? r1(a.reduce((s, x) => s + x, 0) / a.length) : 0);
const group = (rows, key) => rows.reduce((m, r) => ((m[key(r)] ||= []).push(r), m), {});
const withLevel = (ev) => ev.filter((e) => typeof e.level_after === "number");

const run = {
  async users() {
    return (await rest("tester_summary?select=*&order=user_id.asc")).map((r) => ({
      user_id: r.user_id, launches: r.launches, active_days: r.active_days, feels: r.feels, avg_feel_gap: r.avg_feel_gap ?? 0,
    }));
  },
  async summary(a) {
    const ev = await events(a.user, a.days);
    const breaks = ev.filter((e) => ["break_end", "auto_break"].includes(e.event) && e.relief != null);
    const feels = ev.filter((e) => e.event === "feel" && e.felt != null && e.computed_level != null);
    return [{
      launches: ev.filter((e) => e.event === "open").length,
      active_days: new Set(ev.map((e) => e.date).filter(Boolean)).size,
      breaks: breaks.length,
      avg_relief: avg(breaks.map((e) => Number(e.relief))),
      feels: feels.length,
      avg_feel_gap: avg(feels.map((e) => Math.abs(e.felt - e.computed_level))),
      nudges: ev.filter((e) => e.event === "nudge").length,
    }];
  },
  async daily_levels(a) {
    const g = group(withLevel(await events(a.user, a.days)).filter((e) => e.date), (e) => e.date);
    return Object.keys(g).sort().map((d) => ({
      date: d, peak: Math.max(...g[d].map((e) => e.level_after)), average: avg(g[d].map((e) => e.level_after)),
      launches: g[d].filter((e) => e.event === "open").length,
    }));
  },
  async hourly_load(a) {
    const g = group(withLevel(await events(a.user, a.days)).filter((e) => e.hour != null), (e) => e.hour);
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, average_level: avg((g[h] || []).map((e) => e.level_after)), launches: (g[h] || []).filter((e) => e.event === "open").length }));
  },
  async band_mix(a) {
    const ev = withLevel(await events(a.user, a.days)).filter((e) => e.band_after);
    const g = group(ev, (e) => e.band_after);
    return ["calm", "steady", "loaded", "frayed"].map((b) => ({ band: b, events: (g[b] || []).length, share_percent: ev.length ? r1(((g[b] || []).length / ev.length) * 100) : 0 }));
  },
  async top_apps(a) {
    const ev = (await events(a.user, a.days)).filter((e) => e.event === "open" && e.app);
    const g = group(ev, (e) => e.app);
    return Object.entries(g).map(([app, rows]) => ({ app, launches: rows.length, average_level_after: avg(withLevel(rows).map((e) => e.level_after)) }))
      .sort((x, y) => y.launches - x.launches).slice(0, 8);
  },
  async nudges(a) {
    const ev = (await events(a.user, a.days)).filter((e) => e.event === "nudge_outcome");
    const g = group(ev, (e) => `${e.nudge_reason || "unknown"}|${e.nudge_outcome || "none"}`);
    return Object.entries(g).map(([k, rows]) => { const [reason, outcome] = k.split("|"); return { reason, outcome, count: rows.length }; })
      .sort((x, y) => y.count - x.count);
  },
  async feel_vs_computed(a) {
    const g = group((await events(a.user, a.days)).filter((e) => e.event === "feel" && e.felt != null && e.date), (e) => e.date);
    return Object.keys(g).sort().map((d) => {
      const felt = avg(g[d].map((e) => Number(e.felt))), computed = avg(g[d].map((e) => Number(e.computed_level)));
      return { date: d, felt, computed, gap: r1(felt - computed) };
    });
  },
};

function resolveArgs(args, params) {
  const sub = (v) => (v === "$user" ? params.user : v === "$days" ? params.days : v);
  const user = String(sub((args || {}).user) ?? "all");
  const days = Math.min(90, Math.max(1, Number(sub((args || {}).days)) || 14));
  return { user: /^[A-Za-z0-9_-]{1,40}$/.test(user) || user === "all" ? user : "all", days };
}

async function fill(queries, params) {
  const data = {};
  await Promise.all(queries.map(async (q) => {
    try { data[q.id] = await run[q.tool](resolveArgs(q.args, params)); }
    catch (e) { data[q.id] = []; data[`${q.id}__error`] = e.message; }
  }));
  return data;
}

module.exports = { fill, run };
