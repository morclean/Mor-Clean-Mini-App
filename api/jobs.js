// api/jobs.js
// Vercel Serverless Function that reads your published Google Sheet (CSV) and returns JSON for the app.

const PUBLISHED_CSV_URL = "https://docs.google.com/spreadsheets/d/1jms4Z8H1p9_FPcTL7kDnUsskqnflZ5gY5j3mSgzKxXo/edit?gid=1976931574#gid=1976931574"; // <= paste your Google Sheet "Publish to web" CSV link here
const DAYS_AHEAD = 60; // how far forward to show jobs
const DAYS_PAST  = 0;  // how far back to include (0 = only today+)

// --- tiny CSV parser that handles quotes ---
function parseCSV(csvText) {
  const rows = [];
  let i = 0, field = "", row = [], inQuotes = false;

  while (i < csvText.length) {
    const c = csvText[i];

    if (inQuotes) {
      if (c === '"') {
        if (csvText[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ""; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); field = ""; row = []; i++; continue; }

    field += c; i++;
  }
  row.push(field); rows.push(row);
  return rows;
}

// normalize header names like "Client Phone" -> "client_phone"
function normHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w_]+/g, "");
}

// expect headers like: Date, Start, End, Title, Client, Address, Notes, Client Phone, Service Type
function rowsToEvents(rows) {
  if (!rows || rows.length === 0) return [];
  const header = rows[0].map(normHeader);
  const idx = (name) => header.indexOf(name);

  const iDate   = idx("date");
  const iStart  = idx("start");
  const iEnd    = idx("end");
  const iTitle  = idx("title");
  const iClient = idx("client");
  const iAddr   = idx("address");
  const iNotes  = idx("notes");
  const iPhone  = idx("client_phone");
  const iSvc    = idx("service_type");

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const date  = (row[iDate]  || "").trim();
    if (!date) continue; // skip empty rows
    const start = (row[iStart] || "").trim();
    const end   = (row[iEnd]   || "").trim();
    const title = (row[iTitle] || "Clean").trim();
    const client= (row[iClient]|| "").trim();
    const addr  = (row[iAddr]  || "").trim();
    const notes = (row[iNotes] || "").trim();
    const phone = (row[iPhone] || "").trim();
    const svc   = (row[iSvc]   || "").trim();

    // build a stable id (date-client-title)
    const id = `${date}-${client.replace(/\s+/g,"_")}-${title.replace(/\s+/g,"_")}`;

    out.push({ id, date, start, end, title, client, address: addr, notes, client_phone: phone, service_type: svc });
  }
  return out;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoNDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  // allow GET only
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const resp = await fetch(PUBLISHED_CSV_URL, { cache: "no-store" });
    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(502).json({ error: "Failed to fetch CSV", status: resp.status, body: txt.slice(0, 500) });
    }

    const csv = await resp.text();
    const rows = parseCSV(csv);
    let events = rowsToEvents(rows);

    // date window
    const startISO = isoNDaysFromNow(-DAYS_PAST);   // usually today
    const endISO   = isoNDaysFromNow(DAYS_AHEAD);   // default 60 days
    events = events
      .filter(e => e.date >= startISO && e.date <= endISO)
      .sort((a, b) => a.date.localeCompare(b.date));

    // CORS headers (so your app can call from the browser)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    return res.status(200).json({ events, window: { startISO, endISO }, count: events.length });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
