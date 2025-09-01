import React, { useEffect, useMemo, useState } from "react";

/**
 * MOR Clean – Mini App
 * Single-file UI for Cleaners + Customers
 * - Fetches /api/jobs JSON (coming from your Sheet/Square pipeline)
 * - Big tap targets, larger checkboxes & fonts
 * - Jobs collapsed by default; per-room accordions
 * - Before/After photo sections are separate
 * - Customer portal filters by phone number (digits only)
 *
 * You can safely edit the CONFIG and MAPPINGS sections below without touching the rest.
 */

/* ===================== CONFIG ===================== */

const TZ = "America/New_York";               // change if you operate elsewhere
const SHOW_PAST_DAYS = 0;                    // how many days back to consider for "All"
const SHOW_AHEAD_DAYS = 60;                  // how many days ahead to consider for "All"
const DEFAULT_VIEW = "today";                // "today" | "week" | "all"

/**
 * Some Square service-variation names are cryptic (IDs like POWVHCWKB…).
 * Map those raw values to friendly names here. Add rows as you discover new ones.
 */
const SERVICE_ID_MAP = {
  // "POWVHCWKBLS5LNVIKAWQRQJM": "Standard Maintenance",
  // "DPMF5IVR654A73BPPHZFQIIM": "Standard Maintenance",
};

/**
 * Friendly names we want to use in the UI. `prettyService` will try to match to these.
 * Add or adjust labels freely—these are what cleaners & clients see.
 */
const SERVICE_CANON = [
  "Standard Maintenance",
  "Airbnb Turnover",
  "Small Office/Commercial",
  "One-Time Cleaning Service",
  "Real Estate Listing Prep",
  "Post Construction Clean",
  "Deep Clean",
  "Move-In/Move-Out Clean",
];

/* ===================== HELPERS ===================== */

const onlyDigits = (s = "") => (s || "").replace(/\D+/g, "");
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { timeZone: TZ, year: "numeric", month: "short", day: "2-digit" });
const fmtTime = (t) => t || ""; // times are already strings ("11:00"), keep simple

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

const addDays = (baseISO, days) =>
  new Date(new Date(baseISO).getTime() + days * 24 * 60 * 60 * 1000)
    .toLocaleDateString("en-CA", { timeZone: TZ });

const isToday = (iso) => iso === todayISO();

const isThisWeek = (iso) => {
  const start = startOfWeek(todayISO());
  const end = addDays(start, 6);
  return iso >= start && iso <= end;
};

const startOfWeek = (baseISO) => {
  // Monday-based
  const d = new Date(baseISO + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
};

const withinAllWindow = (iso) => {
  const start = addDays(todayISO(), -SHOW_PAST_DAYS);
  const end = addDays(todayISO(), SHOW_AHEAD_DAYS);
  return iso >= start && iso <= end;
};

/**
 * Convert Square/Sheet “title” into a friendly service label:
 * 1) direct map via SERVICE_ID_MAP
 * 2) strip all-caps ID-ish values (24–32 length, A-Z0-9) to ""
 * 3) try to match words against SERVICE_CANON
 * 4) fallback to "Standard Maintenance"
 */
function prettyService(rawTitle = "", notes = "") {
  const direct = SERVICE_ID_MAP[rawTitle];
  if (direct) return direct;

  const looksLikeId = /^[A-Z0-9]{20,36}$/.test(rawTitle.trim());
  const base = looksLikeId ? "" : rawTitle.trim();

  const hay = (base || notes || "").toLowerCase();

  for (const label of SERVICE_CANON) {
    const needle = label.toLowerCase().split(/[^\w]+/).filter(Boolean);
    const hit = needle.every((w) => hay.includes(w));
    if (hit) return label;
  }

  // weak keyword guesses
  if (/air\s*bnb|airbnb|turnover/.test(hay)) return "Airbnb Turnover";
  if (/move-?in|move-?out/.test(hay)) return "Move-In/Move-Out Clean";
  if (/post.+construction/.test(hay)) return "Post Construction Clean";
  if (/deep/.test(hay)) return "Deep Clean";
  if (/office|commercial/.test(hay)) return "Small Office/Commercial";
  if (/listing|real\s*estate/.test(hay)) return "Real Estate Listing Prep";
  if (/one[-\s]?time/.test(hay)) return "One-Time Cleaning Service";

  return "Standard Maintenance";
}

/**
 * Job title for the card: prefer client’s name; else address; else friendly service.
 */
function jobCardTitle(ev) {
  const name = (ev.client || "").trim();
  if (name) return name;
  const addr = (ev.address || "").trim();
  if (addr) return addr;
  return prettyService(ev.title, ev.notes);
}

/**
 * Checklist bundles by service type.
 * Each section -> array of items. (We use larger tap targets in UI)
 */
const CHECKLISTS = {
  "Standard Maintenance": {
    "Arrival / Safety": [
      "Park legally; avoid blocking driveways/walkways",
      "Announce arrival if occupied; respect quiet hours",
      "Disarm alarm (if needed) or notify lead if issue",
    ],
    Kitchen: [
      "Dishes washed/loaded; sink cleaned",
      "Counters & backsplash wiped",
      "Stove top & front wiped",
      "Microwave exterior & handle wiped",
      "Cabinet exteriors spot-wiped (high touch)",
      "Trash emptied & liner replaced",
      "Floors swept/vacuumed; quick mop",
    ],
    Bathrooms: [
      "Toilet (inside/outside, base) cleaned",
      "Sink & faucet polished",
      "Mirror streak-free",
      "Shower/tub & fixtures cleaned",
      "Trash emptied; liner replaced",
      "Floors swept/mopped",
      "Stock soap & tissue if provided",
    ],
    Bedrooms: [
      "Make bed (or tidy bedding)",
      "Dust reachable surfaces",
      "Nightstands wiped",
      "Floors vacuumed / quick mop",
    ],
    "Common Areas": [
      "Surfaces dusted (TV stand, shelves, tables)",
      "Glass doors / fingerprints spot-cleaned",
      "Couch cushions fluffed, throws folded",
      "Floors vacuumed / quick mop",
    ],
  },

  "Airbnb Turnover": {
    "Arrival / Safety": [
      "Announce arrival; photograph entry condition",
      "Check thermostat & set to standard",
      "Quick supply check (stock paper goods, soap if provided)",
    ],
    Kitchen: [
      "Dishes washed/loaded & put away",
      "Counters, backsplash, sink, faucet cleaned",
      "Stove top/front; microwave inside & outside",
      "Fridge exterior; spot wipe cabinets",
      "Empty all trash; replace liners",
      "Floors swept/mopped",
    ],
    Bathrooms: [
      "Toilet thorough clean (inside/outside/base)",
      "Sink/vanity & faucet polished",
      "Tubs/showers scrubbed; fixtures shined",
      "Mirror streak-free",
      "Replenish towels & toiletries (per host standards)",
      "Trash emptied; floors mopped",
    ],
    Bedrooms: [
      "Strip beds; launder sheets (if in scope); make beds hotel-style",
      "Dust reachable surfaces & wipe nightstands",
      "Closets: hangers tidy; check under bed",
      "Floors vacuumed/mopped",
    ],
    "Common Areas": [
      "Dust all surfaces & light switches",
      "Stage pillows/throws neatly",
      "Spot clean glass/doors",
      "Floors vacuumed/mopped",
    ],
    "Deep Extras (if requested)": [
      "Inside fridge",
      "Inside oven",
      "Inside cabinets",
      "Baseboards detailed",
      "Fans & vents dusted",
    ],
  },

  "Deep Clean": {
    "Arrival / Safety": [
      "Announce arrival; walk-through to identify focus areas",
      "Protect floors as needed",
    ],
    Kitchen: [
      "Appliance exteriors + tops detailed",
      "Inside microwave",
      "Cabinet faces washed (full)",
      "Counter edges & grout detailed",
      "Baseboards & toe-kicks",
      "Floors vacuumed & mopped thoroughly",
    ],
    Bathrooms: [
      "Hard water/soap scum removal (as possible)",
      "Crevices & baseboards detailed",
      "Cabinet faces washed",
      "Mirrors & glass detailed",
      "Floors scrubbed/mopped",
    ],
    Bedrooms: [
      "Detail dust (frames, lamps, vents, blinds as reachable)",
      "Beds made; under-bed vacuum if accessible",
      "Baseboards wiped",
      "Floors edges vacuumed/mopped",
    ],
    "Common Areas": [
      "Detail dust + baseboards",
      "Door frames/handles wiped",
      "High touch points sanitized",
      "Floors edges vacuumed/mopped",
    ],
  },

  "Move-In/Move-Out Clean": {
    "Arrival / Safety": [
      "Confirm electricity/water access",
      "Document pre-existing conditions",
    ],
    Kitchen: [
      "Inside/Outside of Fridge",
      "Inside/Outside of Oven",
      "Inside/Outside of Cabinets/Drawers",
      "Counters & sink detailed",
      "Floors vacuumed/mopped",
    ],
    Bathrooms: [
      "Inside cabinets/drawers",
      "Tubs/showers, toilets, sinks fully detailed",
      "Mirrors & fixtures polished",
      "Floors mopped",
    ],
    Bedrooms: [
      "Closets shelves & rods wiped",
      "Baseboards & doors wiped",
      "Floors vacuumed/mopped",
    ],
    "Common Areas": [
      "All surfaces dusted/wiped",
      "Baseboards & doors",
      "Floors vacuumed/mopped",
    ],
  },

  "Small Office/Commercial": {
    "Arrival / Safety": [
      "Check access, alarm instructions",
      "Place wet floor signs when mopping",
    ],
    Kitchen: [
      "Breakroom counters & sink",
      "Microwave inside/outside",
      "Trash & recycling removed",
      "Floors swept/mopped",
    ],
    Bathrooms: [
      "Toilets, sinks, mirrors cleaned",
      "Stock paper goods & soap",
      "Floors mopped",
    ],
    "Common Areas": [
      "Desks spot-dusted (clear surfaces only)",
      "Cubbies/light switches wiped",
      "Entry glass spot-cleaned",
      "Floors vacuumed/mopped",
    ],
  },

  "Real Estate Listing Prep": {
    "Arrival / Safety": ["Walk-through with checklist"],
    Kitchen: [
      "Counters staged & shined",
      "Sink/faucet polished",
      "Front of appliances streak-free",
      "Floors vacuumed/mopped",
    ],
    Bathrooms: [
      "Sinks/tub/toilet spotless",
      "Mirrors/glass streak-free",
      "Towels staged",
      "Floors mopped",
    ],
    Bedrooms: [
      "Beds made neatly",
      "Surfaces dusted",
      "Floors vacuumed/mopped",
    ],
    "Common Areas": [
      "Declutter & stage pillows/throws",
      "Dust media center/shelves",
      "Entry glass clean",
      "Floors vacuumed/mopped",
    ],
  },

  "Post Construction Clean": {
    "Arrival / Safety": [
      "PPE as needed; debris hazards noted",
      "Initial dusting pass (high to low)",
    ],
    Kitchen: [
      "Construction dust removal (multi-pass)",
      "Cabinet faces wiped",
      "Appliance exteriors cleaned",
      "Floors vacuumed/mopped (multi-pass)",
    ],
    Bathrooms: [
      "Dust & residue removal (multi-pass)",
      "Fixtures polished",
      "Floors mopped",
    ],
    Bedrooms: [
      "Blinds/vents dusted (as reachable)",
      "Baseboards & frames wiped",
      "Floors vacuumed/mopped",
    ],
    "Common Areas": [
      "All surfaces dusted (multi-pass)",
      "Glass & mirrors cleaned",
      "Floors vacuumed/mopped",
    ],
  },
};

/* ===================== UI PRIMITIVES ===================== */

function Badge({ children }) {
  return (
    <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1">
      {children}
    </span>
  );
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-xl overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-emerald-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-base font-semibold">{title}</span>
        <span className="text-xl">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="bg-emerald-50/40 px-4 py-3">{children}</div>}
    </div>
  );
}

function BigCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <input
        type="checkbox"
        className="h-6 w-6 accent-emerald-600 cursor-pointer mt-1"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[17px] leading-6 select-none">{label}</span>
    </label>
  );
}

/* ===================== MAIN APP ===================== */

export default function App() {
  const [tab, setTab] = useState("cleaner"); // "cleaner" | "customer"
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState("");
  const [filter, setFilter] = useState(DEFAULT_VIEW); // "today" | "week" | "all"
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchErr("");
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        if (!r.ok) throw new Error(`API ${r.status}`);
        const data = await r.json();
        const events = Array.isArray(data?.events) ? data.events : [];
        if (!cancelled) setJobs(events);
      } catch (e) {
        if (!cancelled) setFetchErr(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="sticky top-0 z-10 bg-emerald-50/80 backdrop-blur border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean Daytona" className="h-8 w-8 rounded-full ring-2 ring-emerald-600" />
            <div>
              <div className="font-extrabold tracking-wide">M.O.R. Clean Daytona</div>
              <div className="text-xs text-emerald-700">Women-owned • Family-operated</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("cleaner")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                tab === "cleaner" ? "bg-emerald-700 text-white" : "bg-white"
              }`}
            >
              Cleaner Portal
            </button>
            <button
              onClick={() => setTab("customer")}
              className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                tab === "customer" ? "bg-emerald-700 text-white" : "bg-white"
              }`}
            >
              Customer Portal
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {tab === "cleaner" ? (
          <CleanerView
            jobs={jobs}
            loading={loading}
            fetchErr={fetchErr}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
          />
        ) : (
          <CustomerView jobs={jobs} />
        )}

        <footer className="text-center text-xs text-emerald-700 mt-8">
          v10 • {todayISO()}
        </footer>
      </main>
    </div>
  );
}

/* ===================== CLEANER VIEW ===================== */

function CleanerView({ jobs, loading, fetchErr, filter, setFilter, query, setQuery }) {
  const filtered = useMemo(() => {
    const needle = (query || "").toLowerCase().trim();
    return (jobs || [])
      .map((ev) => ({
        ...ev,
        service: prettyService(ev.title, ev.notes),
        titleForCard: jobCardTitle(ev),
      }))
      .filter((ev) => {
        const dateOk =
          filter === "today"
            ? isToday(ev.date)
            : filter === "week"
            ? isThisWeek(ev.date)
            : withinAllWindow(ev.date);
        if (!dateOk) return false;
        if (!needle) return true;
        const hay =
          `${ev.client || ""} ${ev.address || ""} ${ev.notes || ""} ${ev.service || ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, [jobs, filter, query]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {["today", "week", "all"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              filter === k ? "bg-emerald-700 text-white" : "bg-white"
            }`}
          >
            {k === "today" ? "Today" : k === "week" ? "This Week" : "All"}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client, address, notes…"
          className="ml-auto w-full sm:w-72 px-4 py-2 rounded-lg bg-white outline-none border"
        />
      </div>

      {loading && <div className="text-emerald-700">Loading…</div>}
      {!!fetchErr && (
        <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          Error: {fetchErr}
        </div>
      )}
      {!loading && filtered.length === 0 && <div>No jobs found.</div>}

      <div className="space-y-4">
        {filtered.map((ev) => (
          <JobCard key={ev.id || ev.date + ev.client + ev.start} ev={ev} />
        ))}
      </div>
    </>
  );
}

function JobCard({ ev }) {
  const [open, setOpen] = useState(false);
  const svc = ev.service || prettyService(ev.title, ev.notes);

  // build checklist based on service
  const bundle = CHECKLISTS[svc] || CHECKLISTS["Standard Maintenance"];

  // check state
  const [checked, setChecked] = useState({});
  const mark = (room, label, v) =>
    setChecked((prev) => ({ ...prev, [room]: { ...(prev[room] || {}), [label]: v } }));

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Card header */}
      <button
        className="w-full text-left px-4 sm:px-6 py-4 flex flex-col gap-1 hover:bg-emerald-50"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 justify-between">
          <Badge>{svc}</Badge>
          <div className="text-sm text-emerald-700">{fmtDate(ev.date)} • {fmtTime(ev.start)}{ev.end ? `–${fmtTime(ev.end)}` : ""}</div>
        </div>
        <div className="text-xl font-semibold">{jobCardTitle(ev)}</div>
        {!!ev.address && <div className="text-emerald-700">{ev.address}</div>}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-4 sm:px-6 pb-5">
          {/* Notes */}
          {!!ev.notes && (
            <div className="mb-4 text-[15px] leading-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="font-semibold">Notes: </span>
              {ev.notes}
            </div>
          )}

          {/* Sections */}
          {Object.entries(bundle).map(([room, items]) => (
            <Section key={room} title={room} defaultOpen={false}>
              {items.map((label) => (
                <BigCheckbox
                  key={label}
                  label={label}
                  checked={checked[room]?.[label] || false}
                  onChange={(v) => mark(room, label, v)}
                />
              ))}
            </Section>
          ))}

          {/* Photos - separate Before / After */}
          <Section title="Upload Photos — BEFORE" defaultOpen={false}>
            <input type="file" multiple accept="image/*" className="block w-full text-sm" />
            <div className="text-xs text-emerald-700 mt-2">Reminder: capture <b>3 angles</b> per room.</div>
          </Section>

          <Section title="Upload Photos — AFTER" defaultOpen={false}>
            <input type="file" multiple accept="image/*" className="block w-full text-sm" />
            <div className="text-xs text-emerald-700 mt-2">Reminder: capture <b>3 angles</b> per room.</div>
          </Section>
        </div>
      )}
    </div>
  );
}

/* ===================== CUSTOMER VIEW ===================== */

function CustomerView({ jobs }) {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mine = useMemo(() => {
    const digits = onlyDigits(phone);
    if (!digits) return [];
    return (jobs || [])
      .filter((ev) => {
        const their = onlyDigits(ev.client_phone || "");
        return their && digits === their; // exact match
      })
      .map((ev) => ({ ...ev, service: prettyService(ev.title, ev.notes), titleForCard: jobCardTitle(ev) }))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, [jobs, phone, submitted]);

  return (
    <div className="bg-white rounded-2xl border p-5">
      {!submitted ? (
        <>
          <div className="text-lg font-semibold mb-2">View my schedule & photos</div>
          <label className="block text-sm mb-1">Phone number on file</label>
          <input
            inputMode="tel"
            placeholder="(###) ###-####"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full max-w-sm px-4 py-3 rounded-xl border text-lg"
          />
          <button
            onClick={() => setSubmitted(true)}
            className="mt-3 px-5 py-3 rounded-xl bg-emerald-700 text-white font-semibold"
          >
            View my schedule & photos
          </button>
          <div className="text-xs text-emerald-700 mt-2">
            We use your phone to show <b>only</b> your cleans and photos.
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setSubmitted(false)}
              className="px-3 py-2 rounded-lg bg-white border"
            >
              Change number
            </button>
            <div className="text-sm text-emerald-700">Showing results for: <b>{phone}</b></div>
          </div>

          {mine.length === 0 && <div>No cleans found for that phone number.</div>}

          <div className="space-y-4">
            {mine.map((ev) => (
              <div key={ev.id || ev.date + ev.client + ev.start} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge>{ev.service}</Badge>
                  <div className="text-sm text-emerald-700">
                    {fmtDate(ev.date)} • {fmtTime(ev.start)}{ev.end ? `–${fmtTime(ev.end)}` : ""}
                  </div>
                </div>
                <div className="text-lg font-semibold mt-1">{ev.titleForCard}</div>
                {!!ev.address && <div className="text-emerald-700">{ev.address}</div>}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-xl bg-emerald-50/50 p-3">
                    <div className="font-semibold mb-2">Before photos</div>
                    <div className="text-sm text-emerald-700">Your before photos will appear here after your clean.</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50/50 p-3">
                    <div className="font-semibold mb-2">After photos</div>
                    <div className="text-sm text-emerald-700">Your after photos will appear here after your clean.</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
