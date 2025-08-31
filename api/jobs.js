// pages/api/jobs.js
// Feeds the cleaner app from your Google Sheet CSV (Publish to web + CSV).
// Maps sheet headers correctly -> JSON fields.

import csv from "csvtojson";

export default async function handler(req, res) {
  try {
    const JOBS_CSV = process.env.SHEET_CSV_URL || "PASTE_YOUR_GOOGLE_SHEET_CSV_LINK_HERE";

    if (!JOBS_CSV || JOBS_CSV.includes("https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv")) {
      return res.status(500).json({ error: "CSV link not configured." });
    }

    const r = await fetch(JOBS_CSV);
    const text = await r.text();

    const rows = await csv().fromString(text);

    // Normalize events
    const events = rows
      .filter(r => r.date && r.client) // only valid rows
      .map(r => ({
        id: `${r.date}-${r.client}-${r.title || ""}`,
        date: r.date,
        start: r.start,
        end: r.end,
        client: r.client,
        title: r.service_type || r.title || "Standard clean",
        address: r.address || "",
        notes: r.notes || "",
        client_phone: r.client_phone || "",
        assigned_cleaner: r.assigned_cleaner || "",
        status: r.status || "",
        price: r.price || "",
        paid: r.paid || ""
      }));

    return res.status(200).json({ events });
  } catch (err) {
    console.error("Error parsing CSV", err);
    return res.status(500).json({ error: "Failed to fetch jobs" });
  }
}

