// api/jobs.js
// Serverless API route that fetches your published Google Sheet (CSV) and returns normalized JSON.

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv"; // <-- replace this with your real CSV link

// Small CSV parser (no external deps)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        cur += '"'; // escaped quote
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
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
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function safeVal(v) {
  return typeof v === "string" ? v.trim() : v ?? "";
}

function buildId(date, client, title) {
  const d = safeVal(date);
  const c = safeVal(client).replace(/\s+/g, "_");
  const t = safeVal(title).replace(/\s+/g, "_");
  return `${d}-${c}-${t}`;
}

// Map likely header names to our canonical fields
function mapRowToEvent(rowObj) {
  const date =
    rowObj.date ||
    rowObj.service_date ||
    rowObj.clean_date ||
    rowObj.when ||
    "";

  const start =
    rowObj.start ||
    rowObj.start_time ||
    rowObj.window_start ||
    "";

  const end =
    rowObj.end ||
    rowObj.end_time ||
    rowObj.window_end ||
    "";

  const client =
    rowObj.client ||
    rowObj.customer ||
    rowObj.client_name ||
    rowObj.customer_name ||
    "";

  const title =
    rowObj.title ||
    rowObj.service ||
    rowObj.type ||
    rowObj.clean_type ||
    "Clean";

  const address =
    rowObj.address ||
    rowObj.location ||
    rowObj.service_address ||
    "";

  const notes =
    rowObj.notes ||
    rowObj.comment ||
    rowObj.details ||
    "";

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
    date: safeVal(date),
    start: safeVal(start),
    end: safeVal(end),
    client: safeVal(client),
    title: safeVal(title),
    address: safeVal(address),
    notes: safeVal(notes),
    client_phone: safeVal(client_phone),
    job_id: safeVal(job_id),
  };
}

export default async function handler(req, res) {
  try {
    if (!CSV_URL || !CSV_URL.startsWith("https://docs.google.com/spreadsheets/d/e/")) {
      return res.status(400).json({ error: "CSV_URL is missing or not a published CSV link." });
    }

    const r = await fetch(CSV_URL, { method: "GET", cache: "no-store" });
    if (!r.ok) {
      return res.status(401).json({ error: `Failed to fetch CSV (${r.status})` });
    }
    const text = await r.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      return res.status(200).json({ events: [] });
    }

    const headers = rows[0].map(normalizeHeader);
    const events = rows.slice(1).map((cells) => {
      const obj = {};
      headers.forEach((h, i) => (obj[h] = safeVal(cells[i])));
      return mapRowToEvent(obj);
    });

    // Only keep today → +60 days (your app also filters, but this keeps the payload smaller)
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const upcoming = events
      .filter((e) => e.date && e.date >= today && e.date <= in60)
      .sort((a, b) => a.date.localeCompare(b.date));

    // CORS & cache headers (optional)
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json({ events: upcoming });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error reading CSV" });
  }
}
