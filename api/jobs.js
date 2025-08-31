// api/jobs.js
// Fetch your published Google Sheet CSV and return normalized, human-readable JSON for the app.

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv"; // keep your existing link here

// --- tiny CSV parser (no deps) ---
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* ignore */ }
      else { cur += c; }
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

const norm = (h) => String(h || "").toLowerCase().trim().replace(/\s+/g, "_");
const sv = (v) => (typeof v === "string" ? v.trim() : (v ?? ""));
const looksLikeBookingCode = (s) => /^[A-Z0-9]{10,}$/.test(s || "");

// Build a clean ID (don’t let booking codes pollute it)
function buildId(date, client, title) {
  const d = sv(date);
  const c = sv(client).replace(/\s+/g, "_");
  let t = sv(title);
  if (looksLikeBookingCode(t)) t = "Clean";
  t = t.replace(/\s+/g, "_");
  return `${d}-${c}-${t}`;
}

// Map row -> event fields we use in the app.
// We check multiple header variants so your sheet can have different names.
function mapRow(rowObj) {
  const date =
    rowObj.date || rowObj.service_date || rowObj.clean_date || rowObj.when || "";

  const start =
    rowObj.start || rowObj.start_time || rowObj.window_start || "";

  const end =
    rowObj.end || rowObj.end_time || rowObj.window_end || "";

  const client =
    rowObj.client || rowObj.customer || rowObj.client_name || rowObj.customer_name || "";

  // Prefer a human label; if the “title” looks like a code, downgrade to "Standard clean".
  let title =
    rowObj.title || rowObj.service || rowObj.type || rowObj.clean_type || "Clean";
  if (looksLikeBookingCode(title)) title = "Standard clean";

  // Try several possibilities for address/phone/booking id:
  const address =
    rowObj.address ||
    rowObj.service_address ||
    rowObj.location ||
    rowObj.street ||
    "";

  const notes =
    rowObj.notes || rowObj.comment || rowObj.details || "";

  const client_phone =
    rowObj.client_phone ||
    rowObj.phone ||
    rowObj.customer_phone ||
    "";

  const job_id =
    rowObj.job_id ||
    rowObj.square_booking_id ||
    rowObj.booking_id ||
    "";

  return {
    id: buildId(date, client, title),
    date: sv(date),
    start: sv(start),
    end: sv(end),
    client: sv(client),
    title: sv(title),
    address: sv(address),
    notes: sv(notes),
    client_phone: sv(client_phone),
    job_id: sv(job_id),
  };
}

export default async function handler(req, res) {
  try {
    if (!CSV_URL || !CSV_URL.startsWith("https://docs.google.com/spreadsheets/d/e/")) {
      return res.status(400).json({ error: "CSV_URL missing or not a published CSV link." });
    }

    const r = await fetch(CSV_URL, { method: "GET", cache: "no-store" });
    if (!r.ok) return res.status(401).json({ error: `Failed to fetch CSV (${r.status})` });

    const text = await r.text();
    const rows = parseCSV(text);
    if (!rows.length) return res.status(200).json({ events: [] });

    const headers = rows[0].map(norm);
    const events = rows.slice(1).map((cells) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = sv(cells[i])));
      return mapRow(obj);
    });

    // Only keep today → +60 days
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const upcoming = events
      .filter((e) => e.date && e.date >= today && e.date <= in60)
      .sort((a, b) => a.date.localeCompare(b.date));

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ events: upcoming });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error reading CSV" });
  }
}
