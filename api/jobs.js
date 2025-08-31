// pages/api/jobs.js
// Simplest version: reads your Google Sheet "Publish to web (CSV)" directly,
// no environment variables needed.

export default async function handler(req, res) {
  // 👉👉👉 PASTE YOUR PUBLISHED CSV LINK BETWEEN THE QUOTES:
  const JOBS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv"; // PASTE HERE

  if (!JOBS_CSV || !JOBS_CSV.startsWith("http")) {
    return res.status(500).json({ error: "CSV link not configured." });
  }

  try {
    const r = await fetch(JOBS_CSV, { headers: { "cache-control": "no-store" } });
    if (!r.ok) {
      return res.status(r.status).json({ error: `Failed to fetch CSV (${r.status})` });
    }
    const csv = await r.text();
    const rows = parseCSV(csv);
    const events = rows.map(normalizeRow).filter(e => e.date && e.client);

    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ events });
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
}

/* ---------- helpers ---------- */

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return [];
  const headers = split(lines[0]).map(h => h.trim().toLowerCase());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = split(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = (cols[idx] || "").trim()));
    out.push(row);
  }
  return out;
}
function split(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else { q = !q; }
    } else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else { cur += ch; }
  }
  out.push(cur);
  return out;
}

function normalizeRow(r) {
  const get = (n) => r[n] ?? r[n?.toLowerCase?.()] ?? "";

  const date   = get("date");
  const start  = get("start");
  const end    = get("end");
  const client = get("client") || get("customer") || "";
  const title  = get("title");
  const addr   = get("address");
  const notes  = get("notes");
  const phone  = get("client_phone") || get("phone") || "";
  let service  = get("service_type");

  // If service_type empty, guess from title text
  if (!service) {
    const t = (title || "").toLowerCase();
    if (t.includes("air") && (t.includes("bnb") || t.includes("turn"))) service = "Airbnb";
    else if (t.includes("deep")) service = "Deep Clean";
    else service = "Standard";
  }

  const id = `${date || "no-date"}-${(client || "").replace(/\s+/g,"_")}-${service.replace(/\s+/g,"_")}`;

  return {
    id,
    date,
    start,
    end,
    client,
    title: service,    // what the UI shows as the type
    address: addr,     // will show if your Jobs sheet’s Address column has values
    notes,
    client_phone: phone,
    job_id: "",        // reserved for later
  };
}
