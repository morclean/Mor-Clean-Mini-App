// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* ==============================
   Small helpers (2 NEW LINES ADDED)
   ============================== */

// Hide long all-caps ID strings (Square service variation IDs etc.)
const looksLikeId = (s = "") => /^[A-Z0-9]{12,}$/.test((s || "").trim());

// Prefer a human name; if it's an ID, swap to a friendly fallback
const displayName = (s = "", fallback = "Client") =>
  s && !looksLikeId(s) ? s : fallback;

/* ==============================
   Date / time helpers
   ============================== */
const TZ = "America/New_York";
const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const addDaysISO = (d, days) =>
  new Date(new Date(d).getTime() + days * 864e5).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
const fmtTime = (s) => (s ? s : "—");

/* ==============================
   Checklist definitions (kept same)
   ============================== */
const ROOMS = [
  {
    key: "arrival",
    title: "Arrival / Safety",
    tasks: [
      "Park legally; avoid blocking driveways/walkways",
      "Announce arrival (if requested)",
      "Arm/Disarm alarm correctly",
      "Confirm pet notes; secure doors & windows",
    ],
  },
  {
    key: "kitchen",
    title: "Kitchen",
    tasks: [
      "Sink & fixtures cleaned",
      "Counters & backsplash wiped",
      "Exterior appliances wiped",
      "Microwave inside wiped",
      "Stove top & control knobs",
      "Cabinet pulls wiped",
      "Floor vacuumed & mopped",
      "Trash removed / bag replaced",
    ],
  },
  {
    key: "bath",
    title: "Bathrooms",
    tasks: [
      "Toilet (base/seat/handle) sanitized",
      "Shower/tub scrubbed & rinsed",
      "Mirror & vanity wiped",
      "Restock paper/soap (if Airbnb)",
      "Floor vacuumed & mopped",
    ],
  },
  {
    key: "bed",
    title: "Bedrooms",
    tasks: [
      "Make beds (tight corners)",
      "Dust nightstands & surfaces",
      "Tidy items",
      "Vacuum or damp-mop floors",
    ],
  },
  {
    key: "common",
    title: "Common Areas",
    tasks: [
      "Dust reachable surfaces",
      "Glass & mirrors spot-free",
      "Baseboards spot wipe",
      "Floors vacuumed / mopped",
    ],
  },
];

/* Airbnb extras shown when type === 'Airbnb Turnover' */
const AIRBNB_EXTRAS = [
  {
    key: "airbnb",
    title: "Airbnb Turnover",
    tasks: [
      "Inventory linens & towels",
      "Laundry started (as applicable)",
      "Restock consumables",
      "Check inside fridge/freezer, oven & microwave",
      "Check inside cabinets (crumbs/spills)",
      "Patio/balcony tidy",
      "Thermostat reset, lights off",
      "Trash & recycle out, bins returned",
      "3 angles BEFORE + AFTER photos each room",
    ],
  },
];

/* Deep clean adds a deeper list */
const DEEP_EXTRAS = [
  {
    key: "deep",
    title: "Deep Clean",
    tasks: [
      "Detail baseboards & door trim",
      "Cabinet fronts scrubbed",
      "Behind/under small appliances",
      "Vents/returns dusted",
      "Spot walls/doors/handles",
    ],
  },
];

/* A tiny type pretty-printer. We keep your previous behavior:
   If service_type is clearly an ID, try to infer from notes; else use service_type. */
const prettyService = (rawTitle = "", notes = "") => {
  const t = (rawTitle || "").trim();
  const n = (notes || "").toLowerCase();

  // If the raw title is a long ID, infer
  if (looksLikeId(t)) {
    if (/air\s?bnb|turnover/.test(n)) return "Airbnb Turnover";
    if (/deep(?:\s|-)clean/.test(n)) return "Deep Clean";
    if (/post.*construction/.test(n)) return "Post-Construction Clean";
    if (/move-?in|move-?out/.test(n)) return "Move-In/Move-Out Clean";
    if (/office|commercial/.test(n)) return "Small Office / Commercial";
    if (/listing|realtor|real\s?estate/.test(n)) return "Real Estate Listing Prep";
    if (/one[-\s]?time/.test(n)) return "One-Time Cleaning Service";
    return "Standard Maintenance";
  }

  // Otherwise the title already looks like a human label
  return t;
};

/* ==============================
   API
   ============================== */
async function fetchJobs() {
  const r = await fetch("/api/jobs", { cache: "no-store" });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`API ${r.status} ${text}`);
  }
  const data = await r.json();
  return Array.isArray(data?.events) ? data.events : [];
}

/* Normalize rows from /api/jobs to what UI expects */
function normalize(events = []) {
  return events.map((e, i) => ({
    id: e.id || `row-${i}`,
    date: e.date || "",
    start: e.start || "",
    end: e.end || "",
    client: e.client || "",
    title: e.title || "",
    address: e.address || "",
    notes: e.notes || "",
    client_phone: e.client_phone || "",
    service_type: prettyService(e.title, e.notes),
    assigned: e.assigned_cleaner || e.assigned || "",
    status: e.status || "",
    price: e.price || "",
    paid: e.paid || "",
  }));
}

/* Filter logic for tabs */
function inThisWeek(dISO) {
  if (!dISO) return false;
  const start = todayISO();
  const end = addDaysISO(start, 7);
  return dISO >= start && dISO < end;
}

/* ==============================
   Uploader stub (kept simple)
   ============================== */
function FileDrop({ label, onFiles }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-sm font-medium mb-2">{label}</div>
      <input
        type="file"
        multiple
        onChange={(e) => onFiles?.(Array.from(e.target.files || []))}
        className="block w-full text-sm"
      />
    </div>
  );
}

/* ==============================
   Job Card
   ============================== */
function JobCard({ job, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const svc = job.service_type;
  const extras =
    svc === "Airbnb Turnover" ? AIRBNB_EXTRAS : svc === "Deep Clean" ? DEEP_EXTRAS : [];

  // FINAL: use displayName helper so IDs never show in header.
  const titleName = displayName(job.client) || displayName(job.title) || "Client";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-4 flex items-center justify-between"
      >
        <div>
          <div className="inline-flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
              {svc}
            </span>
            <span className="text-slate-500 text-sm">
              {job.date} • {fmtTime(job.start)}–{fmtTime(job.end)}
            </span>
          </div>
          <div className="mt-1 font-semibold text-slate-900">{titleName}</div>
          <div className="text-slate-600 text-sm">{job.address || "No address on file"}</div>
        </div>
        <span className="text-slate-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4">
          {[...ROOMS, ...extras].map((grp) => (
            <details key={grp.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-slate-800 font-medium">{grp.title}</summary>
              <ul className="mt-2 space-y-2">
                {grp.tasks.map((t, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-5 w-5 rounded-md" />
                    <span className="text-slate-700 text-[15px] leading-6">{t}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}

          <div className="grid md:grid-cols-2 gap-3">
            <FileDrop label="Before Photos" />
            <FileDrop label="After Photos" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ==============================
   Cleaner Portal
   ============================== */
function CleanerPortal({ items, apiInfo }) {
  const [tab, setTab] = useState("today");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const base =
      tab === "today"
        ? items.filter((j) => j.date === todayISO())
        : tab === "week"
        ? items.filter((j) => inThisWeek(j.date))
        : items;

    if (!q.trim()) return base;
    const qq = q.toLowerCase();
    return base.filter(
      (j) =>
        (j.client || "").toLowerCase().includes(qq) ||
        (j.address || "").toLowerCase().includes(qq) ||
        (j.notes || "").toLowerCase().includes(qq)
    );
  }, [items, tab, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          API events: {apiInfo.apiCount} • normalized: {apiInfo.normCount} • today:{" "}
          {filtered.filter((j) => j.date === todayISO()).length}
          {apiInfo.error ? (
            <span className="text-rose-600"> • error: {apiInfo.error}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {[
            { key: "today", label: "Today" },
            { key: "week", label: "This Week" },
            { key: "all", label: "All" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-full border ${
                tab === t.key
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, address, notes…"
            className="ml-2 w-64 rounded-full border border-slate-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-slate-500">No jobs found.</div>
        ) : (
          filtered.map((j, i) => (
            <JobCard key={j.id || i} job={j} defaultOpen={filtered.length === 1} />
          ))
        )}
      </div>
    </div>
  );
}

/* ==============================
   Customer Portal
   ============================== */
function CustomerPortal({ items }) {
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);

  const mine = useMemo(() => {
    const p = phone.replace(/\D/g, "");
    if (!p) return [];
    return items.filter((j) => (j.client_phone || "").replace(/\D/g, "") === p);
  }, [items, phone]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-slate-800 font-semibold mb-2">Customer Portal</div>
        <div className="flex items-center gap-2">
          <input
            inputMode="tel"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-64 rounded-xl border border-slate-300 px-3 py-2 text-base"
          />
          <button
            onClick={() => setShow(true)}
            className="rounded-xl bg-emerald-600 text-white px-4 py-2"
          >
            View my schedule & photos
          </button>
        </div>
      </div>

      {show && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="text-slate-700">
            Showing {mine.length} clean(s) for <b>{phone}</b>
          </div>
          {mine.length === 0 ? (
            <div className="text-slate-500">No matching cleans found.</div>
          ) : (
            mine.map((j) => (
              <div key={j.id} className="border border-slate-200 rounded-xl p-3">
                <div className="font-medium text-slate-900">
                  {displayName(j.client) || displayName(j.title)}
                </div>
                <div className="text-slate-600 text-sm">
                  {j.date} • {fmtTime(j.start)}–{fmtTime(j.end)}
                </div>
                <div className="text-slate-600 text-sm">{j.address || "No address on file"}</div>
                <div className="mt-2 text-xs text-slate-500">
                  (Photos wiring uses your existing storage; this section will show uploaded BEFORE /
                  AFTER once present.)
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ==============================
   App Root
   ============================== */
export default function App() {
  const [eventsRaw, setEventsRaw] = useState([]);
  const [events, setEvents] = useState([]);
  const [apiErr, setApiErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ev = await fetchJobs();
        if (!alive) return;
        setEventsRaw(ev);
        setEvents(normalize(ev));
        setApiErr("");
      } catch (e) {
        if (!alive) return;
        setApiErr(String(e.message || e));
        setEventsRaw([]);
        setEvents([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-emerald-50/30">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean Daytona" className="h-8 w-8 rounded-full" />
            <div>
              <div className="font-semibold text-slate-900">M.O.R. Clean Daytona</div>
              <div className="text-xs text-slate-500">Women-owned • Family-operated</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#cleaner" className="px-3 py-1 rounded-full bg-emerald-600 text-white">
              Cleaner Portal
            </a>
            <a href="#customer" className="px-3 py-1 rounded-full border border-slate-200">
              Customer Portal
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-10">
        <section id="cleaner" className="space-y-3">
          <CleanerPortal
            items={events}
            apiInfo={{
              apiCount: eventsRaw.length,
              normCount: events.length,
              error: apiErr,
            }}
          />
        </section>

        <section id="customer">
          <CustomerPortal items={events} />
        </section>
      </main>

      <footer className="py-8 text-center text-xs text-slate-500">
        v10 • {todayISO()}
      </footer>
    </div>
  );
}
