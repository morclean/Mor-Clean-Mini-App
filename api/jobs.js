// api/jobs.js
// Feeds the app from your Google Sheet CSV ("Publish to web" -> CSV).

export default async function handler(req, res) {
  try {
    const url = process.env.SHEET_CSV_URL || process.env.JOBS_CSV;
    if (!url) return res.status(500).json({ error: "CSV link not configured." });

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return res.status(401).json({ error: `Failed to fetch CSV (${r.status})` });

    const csv = await r.text();

    // --- CSV parse (tiny, resilient) ---
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return res.json({ events: [] });

    // Normalize headers: "Client Phone" -> "client_phone"
    const rawHeaders = splitCSVLine(lines[0]);
    const headers = rawHeaders.map(h => slug(h));

    const rows = lines.slice(1).map(line => {
      const cells = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (cells[i] || "").trim(); });
      return obj;
    });

    // Map to event objects the app expects
    const events = rows.map((r) => {
      const digits = (v) => (v || "").replace(/[^\d]/g, "");
      return {
        id: buildId(r),
        date: r.date || r.start_date || "",
        start: r.start || r.start_time || "",
        end: r.end || r.end_time || "",
        client: r.client || r.customer || "",
        title: r.title || r.service_type || "",
        address: r.address || "",
        notes: r.notes || "",
        client_phone: digits(r.client_phone || r["phone"] || r["client_phone_number"] || ""),
        service_type: r.service_type || r.title || "",
        assigned_cleaner: r.assigned_cleaner || r.cleaner || "",
        status: r.status || "",
        price: r.price || "",
        paid: r.paid || "",
      };
    });

    return res.json({ events });
  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

// --- helpers ---

function splitCSVLine(line) {
  // Handles commas inside quotes
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'; i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildId(r) {
  const safe = (v) => String(v || "").trim().replace(/\s+/g, "_");
  return `${r.date || ""}-${safe(r.client || r.address || "Client")}-${safe(r.service_type || r.title || "Service")}`;
}
