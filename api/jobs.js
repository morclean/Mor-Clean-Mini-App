// pages/api/jobs.js
// Feeds the cleaner app from your Google Sheet CSV (Publish to web → CSV).
// Accepts dates in ISO (YYYY-MM-DD) or US (M/D/YYYY), tolerates empty cells,
// and returns normalized JSON the app expects.

export default async function handler(req, res) {
  // PASTE your "Publish to web → CSV" link here
  const JOBS_CSV = "PASTE_YOUR_GOOGLE_SHEET_CSV_LINK_HERE";

  const url = process.env.SHEET_CSV_URL || JOBS_CSV;
  if (!url || url.includes("PASTE_YOUR_GOOGLE_SHEET_CSV_LINK_HERE")) {
    return res.status(500).json({ error: "CSV link not configured." });
  }

  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return res.status(401).json({ error: `Failed to fetch CSV (${r.status})` });
    }
    const csv = await r.text();

    const rows = csv
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(splitCSVLine);

    if (rows.length < 2) {
      return res.status(200).json({ events: [] });
    }

    const headers = rows[0].map((h) => normalizeHeader(h));
    const dataRows = rows.slice(1);

    const events = [];
    for (const row of dataRows) {
      const obj = {};
      row.forEach((val, i) => {
        const key = headers[i] || `col_${i}`;
        obj[key] = (val || "").trim();
      });

      // Read the columns you actually have. These names should match your sheet headers:
      // Date | Start | End | Client | Title | Address | Notes | Client Phone | Job ID
      const rawDate = obj.date || obj["start date"] || obj["event date"] || "";
      const isoDate = toISODate(rawDate); // normalize date or null

      if (!isoDate) continue;                // skip rows without a valid date
      if (!obj.client) continue;             // must have a Client
      const start = (obj.start || "").trim();
      const end = (obj.end || "").trim();

      // "Title" (service type) fallback to "Standard clean" if blank
      const title = (obj.title || "").trim() || "Standard clean";
      const address = (obj.address || "").trim();
      const notes = (obj.notes || "").trim();
      const client_phone = (obj["client phone"] || obj.phone || "").trim();
      const job_id = (obj["job id"] || "").trim();

      const id = [
        isoDate,
        slug(obj.client),
        slug(title || "clean")
      ].join("-");

      events.push({
        id,
        date: isoDate,
        start,
        end,
        client: obj.client,
        title,
        address,
        notes,
        client_phone,
        job_id
      });
    }

    // Sort by date then start time
    events.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.start || "").localeCompare(b.start || "");
    });

    return res.status(200).json({ events });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error parsing CSV." });
  }
}

/* ---------- helpers ---------- */

// Split a CSV line respecting quotes
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' ) {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'; // escaped quote
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Convert many date shapes to ISO YYYY-MM-DD (or return null if invalid)
function toISODate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try MM/DD/YYYY or M/D/YYYY
  const mdyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyyyy) {
    const m = mdyyyy[1].padStart(2, "0");
    const d = mdyyyy[2].padStart(2, "0");
    const y = mdyyyy[3];
    return `${y}-${m}-${d}`;
  }

  // Try YYYY/MM/DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, "0");
    const d = ymd[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Last resort: Date parse
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    const y = d2.getFullYear();
    const m = String(d2.getMonth() + 1).padStart(2, "0");
    const d = String(d2.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function slug(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\-]+/g, "");
}
