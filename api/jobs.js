// /api/jobs.js — fetch Google Sheet CSV and return JSON { events: [...] }
export const config = { runtime: "edge" };

// CSV parser that handles quoted fields and commas inside quotes
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  const headers = rows[0].map(h => h.trim());
  const data = rows.slice(1).filter(r => r.some(x => x && x.trim()));
  return data.map(cols => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || "").trim(); });
    return obj;
  });
}

export default async function handler() {
  const url = process.env.JOBS_CSV_URL;
  if (!url) {
    return new Response(JSON.stringify({ error: "JOBS_CSV_URL not set" }), { status: 500 });
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);

    // map to events array expected by the app
    const events = rows.map(r => ({
      date: r.date,
      start: r.start || "",
      end: r.end || "",
      title: r.title || "Clean",
      client: r.client || "",
      address: r.address || "",
      notes: r.notes || "",
      tasks: r.tasks ? r.tasks.split("|").filter(Boolean) : []
    }));

    return new Response(JSON.stringify({ events }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
}
