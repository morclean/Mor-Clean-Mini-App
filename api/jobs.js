// pages/api/jobs.js
// Reads your Google Sheet (published as CSV) and normalizes rows for the app.
// Put the published CSV link in a Vercel env var named JOBS_CSV_URL.

export const config = { runtime: "edge" }; // works on Vercel Edge

// VERY small CSV parser that handles quoted commas/newlines.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let val = "";
  let q = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];

    if (c === '"') {
      if (q && n === '"') { val += '"'; i++; }
      else { q = !q; }
    } else if (c === ',' && !q) {
      row.push(val); val = "";
    } else if ((c === '\n' || c === '\r') && !q) {
      if (val !== "" || row.length) { row.push(val); rows.push(row); row = []; val = ""; }
      // swallow \r\n pairs
      if (c === '\r' && n === '\n') i++;
    } else {
      val += c;
    }
  }
  if (val !== "" || row.length) { row.push(val); rows.push(row); }
  return rows;
}

function firstNonEmpty(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return fallback;
}

function makeId(date, client, title) {
  const clean = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  return `${clean(date)}-${clean(client)}-${clean(title)}`;
}

export default async function handler(req) {
  try {
    const url = process.env.JOBS_CSV_URL;
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing JOBS_CSV_URL env var" }), { status: 500 });
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch CSV (${res.status})` }), { status: 500 });
    }

    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) return new Response(JSON.stringify({ events: [] }), { status: 200 });

    // Build header map (case-insensitive)
    const header = rows[0].map(h => String(h || "").trim());
    const idx = Object.fromEntries(header.map((h, i) => [h.toLowerCase(), i]));

    // Helper to read a cell by any of several possible header names
    const getCell = (r, names = []) => {
      for (const name of names) {
        const i = idx[name.toLowerCase()];
        if (i !== undefined) {
          const v = r[i];
          if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
        }
      }
      return "";
    };

    // Accepted header variants
    const DATE_KEYS       = ["date", "start_date"];
    const START_KEYS      = ["start", "start_time", "window_start"];
    const END_KEYS        = ["end", "end_time", "window_end"];
    const CLIENT_KEYS     = ["client", "customer", "customer_name", "name"];
    const TITLE_KEYS      = ["title", "job", "service", "service_type", "type"];
    const ADDRESS_KEYS    = ["address", "customer_address", "addr", "location_address"];
    const NOTES_KEYS      = ["notes", "note", "memo", "details"];
    const PHONE_KEYS      = ["client_phone", "phone", "customer_phone"];
    const TASKS_KEYS      = ["tasks"]; // pipe-separated optional

    const events = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];

      const date = getCell(row, DATE_KEYS);
      if (!date) continue; // skip empty row

      const start   = getCell(row, START_KEYS);
      const end     = getCell(row, END_KEYS);
      const client  = getCell(row, CLIENT_KEYS);
      const rawTitle= getCell(row, TITLE_KEYS);
      const address = getCell(row, ADDRESS_KEYS);
      const notes   = getCell(row, NOTES_KEYS);
      const phone   = getCell(row, PHONE_KEYS);
      const tasksRaw= getCell(row, TASKS_KEYS);

      // Service: prefer dedicated service/service_type, otherwise title, fallback "Clean"
      const service = firstNonEmpty(
        { service: getCell(row, ["service"]), service_type: getCell(row, ["service_type"]), type: getCell(row, ["type"]), title: rawTitle },
        ["service", "service_type", "type", "title"],
        "Clean"
      );

      const title   = firstNonEmpty({ title: rawTitle, service }, ["title", "service"], "Clean");

      const id = makeId(date, client, title);

      events.push({
        id,
        date,
        start,
        end,
        title,           // what shows as the job name
        service,         // more explicit service type
        client,
        address,
        notes,
        client_phone: phone,
        tasks: tasksRaw ? String(tasksRaw).split("|").map(s => s.trim()).filter(Boolean) : [],
      });
    }

    return new Response(JSON.stringify({ events }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
