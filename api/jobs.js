// api/jobs.js
export default async function handler(req, res) {
  try {
    // quick health ping: /api/jobs?ping=1
    if (req.query.ping) {
      return res.status(200).json({ ok: true, env: !!process.env.JOBS_CSV_URL });
    }

    const csvUrl = process.env.JOBS_CSV_URL; // <-- set this in Vercel (Step 2)
    if (!csvUrl) {
      return res.status(500).json({ error: "Missing env JOBS_CSV_URL" });
    }

    // fetch the published CSV (File ▸ Share ▸ Publish to web ▸ CSV link)
    const r = await fetch(csvUrl, { cache: "no-store" });
    if (!r.ok) {
      return res.status(500).json({ error: `Failed to fetch CSV (${r.status})` });
    }
    const text = await r.text();

    // minimal CSV parser that handles quoted commas
    const rows = parseCSV(text);
    if (!rows.length) return res.status(200).json({ events: [] });

    // header row -> keys
    const [headers, ...dataRows] = rows;
    const key = (name) => {
      const idx = headers.findIndex(
        (h) => String(h || "").trim().toLowerCase() === name.toLowerCase()
      );
      return idx >= 0 ? idx : -1;
    };

    // expected sheet columns (case-insensitive):
    // date, start, end, client, address, notes, service, client_phone, job_id
    const iDate = key("date");
    const iStart = key("start");
    const iEnd = key("end");
    const iClient = key("client");
    const iAddress = key("address");
    const iNotes = key("notes");
    const iService = key("service");
    const iPhone = key("client_phone");
    const iJobId = key("job_id");

    const events = dataRows
      .map((cols, i) => {
        const date = get(cols, iDate);
        const client = get(cols, iClient);
        // Build a stable id
        const safeClient = (client || "").trim().replace(/\s+/g, "_");
        const serviceRaw = get(cols, iService);
        const service = labelServiceType(serviceRaw);
        return {
          id: `${date || "no-date"}-${safeClient || "no-client"}-${service.replace(/\s+/g, "_")}`,
          date,
          start: get(cols, iStart),
          end: get(cols, iEnd),
          client,
          title: service, // for compatibility with the frontend that reads e.title -> labelServiceType
          service,        // explicit
          address: get(cols, iAddress),
          notes: get(cols, iNotes),
          client_phone: get(cols, iPhone),
          job_id: get(cols, iJobId),
        };
      })
      // keep only rows that have a date and client
      .filter((e) => e.date && e.client);

    return res.status(200).json({ events });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

/* ---------- helpers ---------- */
function get(arr, idx) {
  if (idx < 0) return "";
  return (arr[idx] ?? "").toString().trim();
}

function labelServiceType(raw) {
  const t = (raw || "").toLowerCase();
  if (t.includes("air") || t.includes("turn")) return "Airbnb Turnover";
  if (t.includes("deep")) return "Deep Clean";
  if (t.includes("move")) return "Move-In/Out";
  if (t.includes("post") || t.includes("reno")) return "Post-Renovation";
  if (!t) return "Standard Clean";
  return capitalizeWords(raw);
}

function capitalizeWords(s) {
  return String(s)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let val = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      // escaped quote
      val += '"';
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (c === "," && !inQuotes) {
      row.push(val);
      val = "";
      continue;
    }

    if ((c === "\n" || c === "\r") && !inQuotes) {
      // finalize row if we hit a line break
      if (val.length || row.length) {
        row.push(val);
        rows.push(row);
      }
      row = [];
      val = "";

      // swallow \r\n pairs
      if (c === "\r" && next === "\n") i++;
      continue;
    }

    val += c;
  }

  // push last cell
  if (val.length || row.length) {
    row.push(val);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 0);
}
