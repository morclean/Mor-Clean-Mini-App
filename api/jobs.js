// api/jobs.js
// Feeds the app from your Google Sheet (Publish to web → CSV) and returns normalized JSON.

export default async function handler(req, res) {
  // —— EDIT JUST THIS ONE LINE ——
  const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv";
  // Example format:
  // "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv"

  try {
    if (!CSV_URL || !/^https:\/\/docs\.google\.com\/spreadsheets\/.*output=csv/.test(CSV_URL)) {
      return res.status(500).json({
        error:
          "CSV link not configured. Paste your Google Sheet 'Publish to web → CSV' link into api/jobs.js (CSV_URL). It must end with output=csv.",
      });
    }

    // Don’t cache; always read latest sheet
    const r = await fetch(CSV_URL, { cache: "no-store" });
    if (!r.ok) {
      return res.status(502).json({ error: `Failed to fetch CSV (${r.status})` });
    }
    const csv = await r.text();

    const rows = parseCSV(csv);
    if (!rows.length) return res.status(200).json({ events: [] });

    // Find headers (case-insensitive)
    const head = rows[0].map((h) => (h || "").toString().trim().toLowerCase());
    const idx = (name) => head.indexOf(name);

    // Expected columns (add more if you need)
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

      // Skip completely empty lines
      if (!r.some((v) => (v || "").toString().trim())) continue;

      const status = pick(r, col.status).toUpperCase();
      // If your sheet includes canceled rows, skip them
      if (status.includes("CANCELLED")) continue;

      const rawTitle = pick(r, col.title);
      const svc = cleanServiceType(pick(r, col.service_type) || rawTitle);

      const evt = {
        id: makeId(
          pick(r, col.date),
          pick(r, col.client),
          svc || rawTitle || "Job"
        ),
        date: pick(r, col.date),
        start: pick(r, col.start),
        end: pick(r, col.end),
        client: pick(r, col.client),
        title: svc || rawTitle || "",
        address: pick(r, col.address),        // <- will be empty if the sheet cell is empty
        notes: pick(r, col.notes),
        client_phone: pick(r, col.client_phone),
        assigned_cleaner: pick(r, col.assigned_cleaner),
        job_id: pick(r, col.job_id) || "",
      };

      events.push(evt);
    }

    // Sort by date + start time
    events.sort((a, b) => (a.date + " " + a.start).localeCompare(b.date + " " + b.start));

    return res.status(200).json({ events });
  } catch (err) {
    console.error("jobs.js error:", err);
    return res.status(500).json({ error: "Server error in /api/jobs", detail: String(err) });
  }
}

/* ---------- helpers ---------- */

function pick(row, idx) {
  if (idx === -1 || idx === undefined) return "";
  return (row[idx] || "").toString().trim();
}

function makeId(date, client, title) {
  const slug = (s) => (s || "").toString().trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
  return `${slug(date)}-${slug(client)}-${slug(title)}`.substring(0, 120);
}

function cleanServiceType(s) {
  if (!s) return "";
  const t = s.toLowerCase();
  if (t.includes("air") && t.includes("bnb")) return "Airbnb";
  if (t.includes("deep")) return "Deep Clean";
  if (t.includes("move") && t.includes("out")) return "Move-Out";
  if (t.includes("move") && t.includes("in")) return "Move-In";
  if (t.includes("standard")) return "Standard Clean";
  if (t.includes("maintenance")) return "Standard Clean";
  return s; // as-is
}

// Tiny CSV parser: handles quotes and commas
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQ = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // ignore
      } else {
        cur += c;
      }
    }
  }
  // last cell
  row.push(cur);
  rows.push(row);
  return rows;
}
