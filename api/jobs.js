// api/jobs.js
// Reads the Google Sheet CSV URL from the Vercel env var SHEET_CSV_URL.
// Returns normalized events JSON for the app.

export default async function handler(req, res) {
  try {
    const CSV_URL = process.env.JOBS_CSV_URL;

    if (!CSV_URL || !/^https:\/\/docs\.google\.com\/spreadsheets\/.*output=csv/.test(CSV_URL)) {
      return res.status(500).json({
        error:
          "SHEET_CSV_URL is missing/invalid. In Vercel → Project Settings → Environment Variables, add SHEET_CSV_URL with your 'Publish to web → CSV' link (must end with output=csv).",
      });
    }

    const r = await fetch(CSV_URL, { cache: "no-store" });
    if (!r.ok) return res.status(502).json({ error: `Failed to fetch CSV (${r.status})` });

    const csv = await r.text();
    const rows = parseCSV(csv);
    if (!rows.length) return res.status(200).json({ events: [] });

    const head = rows[0].map((h) => (h || "").toString().trim().toLowerCase());
    const idx = (name) => head.indexOf(name);
    const col = {
      date: idx("date"),
      start: idx("start"),
      end: idx("end"),
      client: idx("client"),
      title: idx("title"),
      address: idx("address"),
      notes: idx("notes"),
      client_phone: idx("client_phone"),
      service_type: idx("service_type"),
      status: idx("status"),
      assigned_cleaner: idx("assigned_cleaner"),
      job_id: idx("job_id"),
    };

    const events = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r.some((v) => (v || "").toString().trim())) continue;

      const status = grab(r, col.status).toUpperCase();
      if (status.includes("CANCELLED")) continue;

      const rawTitle = grab(r, col.title);
      const svc = normalizeServiceType(grab(r, col.service_type) || rawTitle);

      events.push({
        id: makeId(grab(r, col.date), grab(r, col.client), svc || rawTitle || "Job"),
        date: grab(r, col.date),
        start: grab(r, col.start),
        end: grab(r, col.end),
        client: grab(r, col.client),
        title: svc || rawTitle || "",
        address: grab(r, col.address),
        notes: grab(r, col.notes),
        client_phone: grab(r, col.client_phone),
        assigned_cleaner: grab(r, col.assigned_cleaner),
        job_id: grab(r, col.job_id) || "",
      });
    }

    events.sort((a, b) => (a.date + " " + a.start).localeCompare(b.date + " " + b.start));
    return res.status(200).json({ events });
  } catch (err) {
    console.error("jobs.js error:", err);
    return res.status(500).json({ error: "Server error in /api/jobs", detail: String(err) });
  }
}

/* helpers */
function grab(row, idx) { return idx === -1 || idx == null ? "" : (row[idx] || "").toString().trim(); }
function makeId(date, client, title) {
  const slug = (s) => (s || "").toString().trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
  return `${slug(date)}-${slug(client)}-${slug(title)}`.slice(0, 120);
}
function normalizeServiceType(s) {
  if (!s) return "";
  const t = s.toLowerCase();
  if (t.includes("air") && t.includes("bnb")) return "Airbnb";
  if (t.includes("deep")) return "Deep Clean";
  if (t.includes("move") && t.includes("out")) return "Move-Out";
  if (t.includes("move") && t.includes("in")) return "Move-In";
  if (t.includes("maintenance") || t.includes("standard")) return "Standard Clean";
  return s;
}
// Tiny CSV parser (handles quoted commas)
function parseCSV(text) {
  const rows = []; let row = []; let cur = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; } }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
  }
  row.push(cur); rows.push(row); return rows;
}
