/****************************************************
 *  MOR Clean — Square → Google Sheet sync (no Zapier)
 *  Single-file drop-in for Apps Script (Code.gs)
 ****************************************************/

const CONFIG = {
  // REQUIRED — your Square **Production** Personal Access Token (starts with EAAA…)
  ACCESS_TOKEN: 'EAAA...REPLACE_WITH_YOUR_PRODUCTION_TOKEN...',

  // REQUIRED — your Square Location ID (or "" to fetch all)
  LOCATION_ID: 'LE827SM5P9EGB',  // <-- replace with your real Location ID

  // Sheet / window
  SHEET_NAME: 'Jobs',            // tab name (must match your sheet)
  TIMEZONE: 'America/New_York',  // change if not Eastern
  DAYS_PAST: 0,                  // how many days back to include
  DAYS_AHEAD: 30,                // Square enforces ≤ 30 days

  // Square API version (keep recent)
  SQUARE_VERSION: '2025-08-20',

  // Logging
  DEBUG: false
};

/* ================= UI MENU (Run / Triggers) ================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MOR Sync')
    .addItem('Run now', 'syncSquareToSheet')
    .addSeparator()
    .addItem('Install hourly trigger', 'installHourlyTrigger')
    .addItem('Remove all triggers', 'removeAllTriggers')
    .addToUi();
}

function installHourlyTrigger() {
  // remove duplicates first
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncSquareToSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncSquareToSheet').timeBased().everyHours(1).create();
  toast('Installed hourly trigger.');
}

function removeAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(ScriptApp.deleteTrigger);
  toast('Removed all triggers.');
}

/* ================= MAIN SYNC ================= */

function syncSquareToSheet() {
  try {
    if (!CONFIG.ACCESS_TOKEN || CONFIG.ACCESS_TOKEN.indexOf('EAAA') !== 0) {
      throw new Error('Missing or invalid Square ACCESS_TOKEN (must be Production and start with EAAA…).');
    }

    const tz = CONFIG.TIMEZONE;
    const now = new Date();
    const min = shiftDays(startOfDay(now, tz), -CONFIG.DAYS_PAST);
    const max = shiftDays(endOfDay(now, tz), CONFIG.DAYS_AHEAD);

    const bookings = listBookings({
      location_id: CONFIG.LOCATION_ID || undefined,
      start_at_min: min.toISOString(),
      start_at_max: max.toISOString()
    });

    if (CONFIG.DEBUG) Logger.log(`Fetched ${bookings.length} bookings`);

    // Build rows
    const rows = [];
    for (const b of bookings) {
      // Customer
      const cust = (b.customer_id) ? fetchCustomer(b.customer_id) : null;
      const customerName = displayNameFromCustomer(cust);
      const phone = phoneFromCustomer(cust);

      // Service name (prefer human-readable)
      const seg = (b.appointment_segments && b.appointment_segments[0]) || null;
      const serviceName =
        (seg && seg.service_variation && seg.service_variation.name) ||
        (seg && seg.service_variation_id) || 'Clean';

      // Duration → end time (fallback 120 min)
      const durationMin = (seg && (seg.service_variation_version && seg.service_variation_version.duration_minutes)) ||
                          (seg && seg.duration_minutes) || 120;

      const startAt = new Date(b.start_at);
      const endAt = new Date(startAt.getTime() + durationMin * 60000);
      const dateISO = startAt.toISOString().slice(0, 10);
      const startHHMM = Utilities.formatDate(startAt, tz, 'HH:mm');
      const endHHMM   = Utilities.formatDate(endAt,   tz, 'HH:mm');

      // Address (single line)
      const addressStr = formatAddress(b.address);

      // Status
      const status = b.status || '';

      rows.push([
        dateISO,            // date
        startHHMM,          // start
        endHHMM,            // end
        serviceName,        // title
        customerName,       // client
        addressStr,         // address
        '',                 // notes (keep blank unless you map)
        phone,              // client_phone
        serviceName,        // service_type
        '',                 // assigned_cleaner
        status,             // status
        '',                 // price (optional if you map orders)
        ''                  // paid (optional)
      ]);
    }

    // Write to Sheet
    const headers = [
      'date','start','end','title','client','address','notes',
      'client_phone','service_type','assigned_cleaner','status','price','paid'
    ];
    const sheet = getSheet(CONFIG.SHEET_NAME);
    writeHeader(sheet, headers);
    clearData(sheet);

    if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

    toast(`Synced ${rows.length} booking(s) from Square.`, 5);
  } catch (err) {
    toast('Sync error: ' + err.message, 8);
    throw err;
  }
}

/* ================= SQUARE HELPERS ================= */

function listBookings(params) {
  // Build the query string with Square’s 30-day window limits
  const base = 'https://connect.squareup.com/v2/bookings';
  const q = toQuery(Object.assign({}, params, {
    limit: 200
  }));

  let url = `${base}?${q}`;
  let all = [];
  let cursor;

  do {
    const pageUrl = url + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
    const res = squareGET(pageUrl);
    if (CONFIG.DEBUG) Logger.log(JSON.stringify(res, null, 2));

    if (res.errors) {
      throw new Error('Square API error: ' + JSON.stringify(res.errors));
    }

    if (res.bookings && Array.isArray(res.bookings)) all = all.concat(res.bookings);
    cursor = res.cursor || null;
  } while (cursor);

  return all;
}

function fetchCustomer(customerId) {
  if (!customerId) return null;
  const url = `https://connect.squareup.com/v2/customers/${encodeURIComponent(customerId)}`;
  const res = squareGET(url);
  if (res && res.customer) return res.customer;
  return null;
}

function squareGET(url) {
  const options = {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
      'Square-Version': CONFIG.SQUARE_VERSION,
      'Content-Type': 'application/json'
    }
  };
  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  const text = resp.getContentText();

  if (CONFIG.DEBUG) Logger.log(`GET ${url} -> ${code}\n${text}`);

  if (code >= 200 && code < 300) {
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Square JSON parse error');
    }
  } else {
    // Try to surface Square error details
    let msg = `HTTP ${code}`;
    try {
      const body = JSON.parse(text);
      if (body && body.errors) msg = JSON.stringify(body.errors);
    } catch (_) { /* ignore */ }
    throw new Error('Square API error: ' + msg);
  }
}

/* ================= SHEET HELPERS ================= */

function getSheet(name) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function writeHeader(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
}

function clearData(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
}

function toast(msg, secs) {
  SpreadsheetApp.getActive().toast(msg, 'MOR Sync', secs || 3);
}

/* ================= DATA HELPERS ================= */

function displayNameFromCustomer(c) {
  if (!c) return '';
  const full = [c.given_name, c.family_name].filter(Boolean).join(' ').trim();
  return full || c.company_name || '';
}

function phoneFromCustomer(c) {
  if (!c || !Array.isArray(c.phone_numbers)) return '';
  const p = c.phone_numbers.find(Boolean);
  return (p && p.phone_number) ? p.phone_number : '';
}

function formatAddress(a) {
  // Booking may embed an address object
  if (!a) return '';
  const parts = [
    (a.address_line_1 || '').trim(),
    (a.address_line_2 || '').trim(),
    [a.locality, a.administrative_district_level_1].filter(Boolean).join(', '),
    (a.postal_code || '').trim()
  ].filter(Boolean);
  return parts.join(' • ');
}

function toQuery(params) {
  const esc = encodeURIComponent;
  return Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .map(k => `${esc(k)}=${esc(params[k])}`)
    .join('&');
}

/* ================= DATE HELPERS ================= */

function startOfDay(d, tz) {
  const s = new Date(d);
  const str = Utilities.formatDate(s, tz, 'yyyy-MM-dd') + 'T00:00:00';
  return new Date(str + getTZOffsetSuffix(tz, s));
}

function endOfDay(d, tz) {
  const s = new Date(d);
  const str = Utilities.formatDate(s, tz, 'yyyy-MM-dd') + 'T23:59:59';
  return new Date(str + getTZOffsetSuffix(tz, s));
}

function shiftDays(d, n) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

// crude but effective offset builder so our ISO has local tz suffix
function getTZOffsetSuffix(tz, date) {
  const offMin = -1 * (Utilities.formatDate(date, tz, 'Z') / 100) * 60; // "−0400" → minutes
  const sign = offMin <= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return sign + hh + ':' + mm;
}
