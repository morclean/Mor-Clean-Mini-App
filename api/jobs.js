// pages/api/jobs.js
// Feeds the app with jobs from your Google Sheet CSV (Publish to web → CSV).
// Normalizes headers and tolerates empty cells.

export default async function handler(req, res) {
  try {
    // ------------- PASTE YOUR CSV LINK HERE (Publish to web → CSV) -------------
    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTaf89EtB8skSN30S9c0CuVMVqqrHhQ2OhHlxWuDmLDCO8hB9w10yMz8Us11ZstNug3PP_58R4uq1zX/pub?gid=1976931574&single=true&output=csv';

    const url = CSV_URL;
    if (!url || url.includes('PASTE_YOUR_GOOGLE_SHEET_CSV_LINK_HERE')) {
      return res.status(500).json({ error: 'CSV not configured' });
    }

    // Never serve a cached copy during debugging
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
      return res.status(500).json({ error: `Failed to fetch CSV (${r.status})` });
    }

    const csv = await r.text();

    // ---- Parse CSV (very forgiving) ----
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return res.status(200).json({ events: [] });

    const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());

    // Header normalizer: map whatever is in the sheet to the keys our app expects
    const mapHeader = (h) => {
      if (/^date$/i.test(h)) return 'date';
      if (/^start$/i.test(h)) return 'start';
      if (/^end$/i.test(h)) return 'end';
      if (/^client$/i.test(h)) return 'client';
      if (/^address$/i.test(h)) return 'address';
      if (/^notes?$/i.test(h)) return 'notes';
      if (/^client[_\s-]*phone$/i.test(h)) return 'client_phone';
      if (/^service[_\s-]*type$/i.test(h)) return 'title';
      if (/^assigned[_\s-]*clean(er)?$/i.test(h)) return 'assigned_cleaner';
      if (/^status$/i.test(h)) return 'status';
      if (/^price$/i.test(h)) return 'price';
      if (/^paid?$/i.test(h)) return 'paid';
      // allow your old “title” to pass through too
      if (/^title$/i.test(h)) return 'title';
      return h;
    };
    const headers = rawHeaders.map(mapHeader);

    const idx = (name) => headers.indexOf(name);

    const events = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim());
      if (!row.length) continue;

      const date  = row[idx('date')] || '';
      const start = row[idx('start')] || '';
      const end   = row[idx('end')] || '';
      const client = row[idx('client')] || '';
      const address = row[idx('address')] || '';
      const notes = row[idx('notes')] || '';
      const client_phone = (row[idx('client_phone')] || '').replace(/\D/g, ''); // digits only
      const title = row[idx('title')] || 'Standard Clean'; // service type

      // Skip hopelessly empty lines
      if (!date && !client) continue;

      // Build an id that’s human-ish if possible
      const safeClient = client
        ? client.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
        : 'Client';

      const safeTitle = title.replace(/[^\p{L}\p{N}]+/gu, '_');

      events.push({
        id: `${date || 'NA'}-${safeClient}-${safeTitle}`,
        date, start, end, client, title, address, notes, client_phone,
        job_id: '' // optional future field
      });
    }

    return res.status(200).json({ events });
  } catch (e) {
    console.error('jobs API error:', e);
    return res.status(500).json({ error: 'API crashed' });
  }
}
