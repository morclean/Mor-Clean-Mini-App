// pages/api/jobs.js
// Feeds the app with normalized JSON from your published-to-web Google Sheet CSV.

export default async function handler(req, res) {
  // 1) Try env var first; fallback to hard-coded string (leave empty if using only env var).
  const JOBS_CSV = process.env.SHEET_CSV_URL || "";

  if (!JOBS_CSV || JOBS_CSV.includes("https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv")) {
    return res.status(500).json({ error: "CSV link not configured." });
  }

  try {
    // no-store avoids Vercel/edge caching old CSV
    const r = await fetch(JOBS_CSV, { cache: "no-store" });
    if (!r.ok) return res.status(r.status).json({ error: `Failed to fetch CSV (${r.status})` });

    const text = await r.text();

    // --- CSV → rows ---------------------------------------------------------
    const lines = text.split(/\r?\n/).filter(Boolean);

    // header row
    const headerRaw = lines[0];
    const headers = headerRaw.split(",").map(h => h.trim().replace(/^"+|"+$/g, ""));

    // helper: unquote + unescape commas inside quotes
    const splitCSVLine = (line) => {
      const out = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          // toggle quoted section or treat double quote inside quotes as literal
          if (inQ && line[i + 1] === '"') {
            cur += '"'; i++;
          } else {
            inQ = !inQ;
          }
        } else if (ch === "," && !inQ) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(v => v.replace(/^"+|"+$/g, "").trim());
    };

    // parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      if (!cols.length) continue;
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (cols[idx] ?? "").trim();
      });
      rows.push(obj);
    }

    // --- Normalize & pass through all fields -------------------------------
    // Your sheet columns (case-sensitive): 
    // date, start, end, title, client, address, notes, client_phone, service_type, assigned_clean, status, price, paid, job_id
    // We’ll keep ALL fields and also create a few friendly ones used by the app.

    const toNice = (s) => {
      if (!s) return "";
      return s
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
    };

    const events = rows
      .filter(r => r.date) // ignore blank lines
      .map(r => {
        const typeRaw = r.service_type || r.title || ""; // prefer service_type if present
        const type = toNice(typeRaw);                   // “Standard Clean”, “Airbnb Turnover”, etc.

        // Build a stable id
        const id = `${r.date}-${(r.client || "Client").replace(/\W+/g, "_")}-${type.replace(/\W+/g, "_")}`;

        return {
          id,
          date: r.date,                 // YYYY-MM-DD (from App Script)
          start: r.start || "",
          end: r.end || "",
          client: r.client || "",
          title: type || "",            // UI uses this as the badge
          address: r.address || "",
          notes: r.notes || "",
          client_phone: r.client_phone || "",
          assigned_clean: r.assigned_clean || "",
          status: r.status || "",
          price: r.price || "",
          paid: r.paid || "",
          job_id: r.job_id || "",
          // also include the raw row in case we want more later
          _raw: r,
        };
      });

    return res.status(200).json({ events });

  } catch (err) {
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
