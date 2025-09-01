// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";

/* ==================== CONFIG ==================== */
const TZ = "America/New_York"; // your local timezone

/* ==================== DATE/TIME HELPERS ==================== */
const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

const addDaysISO = (d) =>
  new Date(Date.now() + d * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });

const fmtTime = (hhmm) => {
  if (!hhmm) return "";
  const [hh, mm] = String(hhmm).split(":").map(Number);
  const d = new Date();
  d.setHours(hh ?? 0, mm ?? 0, 0, 0);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
};

const normalizePhone = (v = "") => v.replace(/[^\d]/g, "");

/* ==================== SERVICE TYPE DETECTOR ==================== */
/** Hide Square-ish IDs & classify by keywords or explicit names. */
function prettyService(rawTitle = "", notes = "", incoming = "") {
  // If service_type already looks human, prefer it
  const incomingClean = (incoming || "").trim();
  const looksLikeId = (s = "") => /^[A-Z0-9]{12,}$/.test((s || "").trim());
  const base = looksLikeId(rawTitle) ? "" : (rawTitle || "").trim();

  const CANON = [
    "Standard Clean",
    "Airbnb Turnover",
    "Small Office / Commercial",
    "One-Time Cleaning",
    "Real Estate Listing Prep",
    "Post-Construction Clean",
    "Deep Clean",
    "Move-In / Move-Out Clean",
  ];

  if (incomingClean && CANON.includes(incomingClean)) return incomingClean;
  if (base && CANON.includes(base)) return base;

  const hay = (base + " " + (notes || "") + " " + incomingClean).toLowerCase();

  const RULES = [
    { label: "Airbnb Turnover", test: /(airbnb|turnover|bnb)/ },
    { label: "Move-In / Move-Out Clean", test: /(move[-\s]?in|move[-\s]?out)/ },
    { label: "Post-Construction Clean", test: /(post[-\s]?construction|punch\s?list)/ },
    { label: "Deep Clean", test: /(deep\s?clean|spring\s?clean)/ },
    { label: "Small Office / Commercial", test: /(office|commercial)/ },
    { label: "One-Time Cleaning", test: /(one[-\s]?time|single\s?visit)/ },
    { label: "Real Estate Listing Prep", test: /(listing|realtor|staging|open\s?house)/ },
    { label: "Standard Clean", test: /(standard|maintenance|regular)/ },
  ];
  for (const r of RULES) if (r.test.test(hay)) return r.label;

  return "Standard Clean";
}

/* ==================== CHECKLISTS ==================== */
const CHECKLISTS = {
  "Standard Clean": {
    "Arrival / Safety": [
      "Park legally; avoid blocking driveways",
      "Announce arrival (if required) & respect quiet hours",
      "Report any safety hazards",
    ],
    Kitchen: [
      "Dishes washed or loaded",
      "Sinks & faucets cleaned",
      "Counters wiped",
      "Appliance exteriors wiped",
      "Microwave inside/out",
      "Floors swept & mopped",
      "Trash out / liner replaced",
    ],
    Bathrooms: [
      "Toilet cleaned & sanitized",
      "Sink & faucet cleaned",
      "Mirror streak-free",
      "Shower/tub scrubbed",
      "Floors vacuumed/mopped",
      "Trash out / liner replaced",
    ],
    Bedrooms: [
      "Make beds (straighten/replace linens if provided)",
      "Dust surfaces",
      "Nightstands wiped",
      "Floors vacuumed/mopped",
      "Tidy surfaces",
    ],
    Common: [
      "Dust flat surfaces",
      "Vacuum/mop floors",
      "Windows/doors spot-clean",
    ],
  },

  "Airbnb Turnover": {
    "Arrival / Safety": [
      "Document entry condition (photos)",
      "Check thermostat per host prefs",
      "Report damage/issues immediately",
    ],
    Kitchen: [
      "Dishes washed or loaded",
      "Counters & sinks sanitized",
      "Microwave inside/out",
      "Fridge exterior; spot-check shelves",
      "Stove/oven exterior",
      "Replace coffee/tea & supplies (if provided)",
      "Floors swept & mopped",
      "Trash out / liner replaced",
    ],
    Bathrooms: [
      "Toilet, sink, shower/tub fully sanitized",
      "Mirrors streak-free",
      "Restock TP/soap/shampoo (if provided)",
      "Replace towels per host setup",
      "Floors vacuumed/mopped",
      "Trash out / liner replaced",
    ],
    Bedrooms: [
      "Strip & replace linens per host setup",
      "Make beds hotel-style",
      "Dust furniture",
      "Check under beds/closets",
      "Floors vacuumed/mopped",
    ],
    Common: [
      "Dust/wipe surfaces & high-touch areas",
      "Stage pillows/throws as per photos",
      "Check patios/balconies (sweep if needed)",
      "Take out all trash to designated bin",
    ],
    "Deep Turnover (as requested)": [
      "Inside fridge",
      "Inside oven",
      "Inside cabinets/drawers",
      "Baseboards & door frames",
    ],
  },

  "Deep Clean": {
    "Arrival / Safety": [
      "Walkthrough & note problem areas",
      "Before photos (3 angles/room)",
    ],
    Kitchen: [
      "All standard tasks",
      "Inside microwave, oven (if requested), and fridge (if requested)",
      "Cabinet fronts wiped",
      "Baseboards & door frames",
    ],
    Bathrooms: [
      "All standard tasks",
      "Detail scrub grout & corners",
      "Baseboards & vents",
    ],
    Bedrooms: [
      "All standard tasks",
      "Ceiling fans & vents dusted",
      "Baseboards & door frames",
    ],
    Common: [
      "All standard tasks",
      "Window sills & tracks",
      "Baseboards & door frames",
    ],
  },

  "Move-In / Move-Out Clean": {
    "Arrival / Safety": [
      "Walkthrough for damages",
      "Before photos (3 angles/room)",
    ],
    Kitchen: [
      "Inside/outside cabinets & drawers",
      "Inside fridge & oven",
      "Appliance exteriors",
      "Sinks/counters sanitized",
      "Floors swept & mopped",
    ],
    Bathrooms: [
      "Toilet/sink/tub/shower scrubbed & sanitized",
      "Mirrors & fixtures polished",
      "Inside cabinets & drawers",
      "Floors vacuumed/mopped",
    ],
    Bedrooms: [
      "Closets shelves wiped",
      "Floors vacuumed/mopped",
      "Baseboards & door frames",
    ],
    Common: [
      "All surfaces dusted/wiped",
      "Baseboards & door frames",
      "Floors vacuumed/mopped",
    ],
  },

  "Post-Construction Clean": {
    "Arrival / Safety": [
      "PPE as needed; check hazards",
      "Before photos",
    ],
    WholeHome: [
      "Heavy dust removal from all surfaces",
      "Vacuum debris; mop floors",
      "Detail clean fixtures & vents",
      "Windows/frames & sills (spot clean)",
      "Final after photos (3 angles/room)",
    ],
  },

  "Small Office / Commercial": {
    "Arrival / Safety": [
      "Check alarm/lockup instructions",
      "Before photos (shared spaces)",
    ],
    WorkAreas: [
      "Desk surfaces (as allowed)",
      "Trash out / liners replaced",
      "Floors vacuumed/mopped",
      "High-touch disinfection",
    ],
    Restrooms: [
      "Toilets/urinals/sinks sanitized",
      "Mirrors cleaned",
      "Consumables restocked (if provided)",
    ],
    Breakroom: [
      "Counters/sinks wiped",
      "Appliance exteriors",
      "Floors vacuumed/mopped",
      "Trash out",
    ],
  },
};

/* ==================== UI HELPERS ==================== */
const Section = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
    <div>{children}</div>
  </div>
);

const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full border ${
      active
        ? "bg-emerald-600 text-white border-emerald-600"
        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
    }`}
  >
    {children}
  </button>
);

/* ==================== MAIN APP ==================== */
export default function App() {
  const [tab, setTab] = useState("cleaner"); // "cleaner" | "customer"
  const [events, setEvents] = useState([]);
  const [apiInfo, setApiInfo] = useState({ total: 0, normalized: 0, error: "" });
  const [range, setRange] = useState("today"); // today | week | all
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({}); // { jobId: boolean }
  const [beforeFiles, setBeforeFiles] = useState({}); // { jobId: File[] }
  const [afterFiles, setAfterFiles] = useState({}); // { jobId: File[] }

  // Customer portal
  const [phone, setPhone] = useState("");
  const [customerReady, setCustomerReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const data = await r.json();
        if (cancelled) return;

        const rows = Array.isArray(data?.events) ? data.events : [];
        const norm = rows.map((row) => {
          const service = prettyService(row.title, row.notes, row.service_type);
          return {
            ...row,
            service,
            client_phone: normalizePhone(row.client_phone || ""),
            startLabel: fmtTime(row.start),
            endLabel: fmtTime(row.end),
          };
        });

        setEvents(norm);
        setApiInfo({
          total: rows.length,
          normalized: norm.length,
          error: data?.error ? String(data.error) : "",
        });
      } catch (e) {
        setApiInfo((p) => ({ ...p, error: "API 500" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const t0 = todayISO();
    const t7 = addDaysISO(7);

    return events
      .filter((e) => {
        if (range === "today") return e.date === t0;
        if (range === "week") return e.date >= t0 && e.date <= t7;
        return true;
      })
      .filter((e) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          (e.client || "").toLowerCase().includes(q) ||
          (e.address || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q) ||
          (e.service || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, [events, range, query]);

  const customerFiltered = useMemo(() => {
    if (!customerReady) return [];
    const needle = normalizePhone(phone);
    if (!needle) return [];
    return events.filter((e) => normalizePhone(e.client_phone) === needle);
  }, [events, customerReady, phone]);

  const toggle = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));
  const setBefore = (id, list) =>
    setBeforeFiles((m) => ({ ...m, [id]: Array.from(list || []) }));
  const setAfter = (id, list) =>
    setAfterFiles((m) => ({ ...m, [id]: Array.from(list || []) }));

  /* =============== RENDER =============== */
  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-full" />
            <div>
              <div className="text-slate-900 font-semibold">M.O.R. Clean Daytona</div>
              <div className="text-xs text-slate-500">Women-owned • Family-operated</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded-md ${
                tab === "cleaner"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700"
              }`}
              onClick={() => setTab("cleaner")}
            >
              Cleaner Portal
            </button>
            <button
              className={`px-3 py-1 rounded-md ${
                tab === "customer"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700"
              }`}
              onClick={() => setTab("customer")}
            >
              Customer Portal
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === "cleaner" ? (
          <>
            <div className="mb-4 text-xs text-slate-500">
              API events: {apiInfo.total} • normalized: {apiInfo.normalized} •{" "}
              today: {filtered.filter((e) => e.date === todayISO()).length}{" "}
              {apiInfo.error && (
                <span className="text-red-600">• error: {apiInfo.error}</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip active={range === "today"} onClick={() => setRange("today")}>
                Today
              </Chip>
              <Chip active={range === "week"} onClick={() => setRange("week")}>
                This Week
              </Chip>
              <Chip active={range === "all"} onClick={() => setRange("all")}>
                All
              </Chip>

              <input
                className="ml-auto w-full sm:w-80 border border-slate-300 rounded-md px-3 py-2"
                placeholder="Search client, address, notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-slate-500">No jobs found.</div>
            ) : (
              <div className="space-y-3">
                {filtered.map((job) => {
                  const id = job.id || `${job.date}-${job.client}-${job.start}`;
                  const isOpen = !!expanded[id];
                  const list =
                    CHECKLISTS[job.service] || CHECKLISTS["Standard Clean"];

                  return (
                    <div key={id} className="bg-white border border-slate-200 rounded-xl">
                      <button
                        onClick={() => toggle(id)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3"
                      >
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800">
                          {job.service}
                        </span>
                        <div className="font-medium text-slate-900">{job.client || "Client"}</div>
                        <div className="ml-auto text-sm text-slate-500">
                          {job.date} • {job.startLabel || job.start}
                          {job.endLabel ? ` — ${job.endLabel}` : ""}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4">
                          {job.address && (
                            <div className="text-sm text-slate-600 mb-2">
                              {job.address}
                            </div>
                          )}
                          {job.notes && (
                            <div className="text-sm text-slate-600 mb-4">
                              <span className="font-medium">Notes: </span>
                              {job.notes}
                            </div>
                          )}

                          {/* Checklists */}
                          {Object.entries(list).map(([room, tasks]) => (
                            <details key={room} className="mb-3" open={false}>
                              <summary className="cursor-pointer select-none bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-800 font-medium">
                                {room}
                              </summary>
                              <div className="p-3 border border-t-0 border-slate-200 rounded-b-md">
                                <ul className="space-y-2">
                                  {tasks.map((t) => (
                                    <li key={t} className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        className="mt-1 scale-125 accent-emerald-600"
                                      />
                                      <span className="text-[15px] text-slate-800">{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </details>
                          ))}

                          {/* Photos */}
                          <Section title="Photos">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm font-medium mb-1">
                                  Before (3 angles per room)
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => setBefore(id, e.target.files)}
                                />
                                {beforeFiles[id]?.length > 0 && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    {beforeFiles[id].length} file(s) selected
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium mb-1">
                                  After (3 angles per room)
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(e) => setAfter(id, e.target.files)}
                                />
                                {afterFiles[id]?.length > 0 && (
                                  <div className="mt-2 text-xs text-slate-500">
                                    {afterFiles[id].length} file(s) selected
                                  </div>
                                )}
                              </div>
                            </div>
                          </Section>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          // ======== CUSTOMER PORTAL ========
          <div className="max-w-xl">
            {!customerReady ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h2 className="text-lg font-semibold mb-2">Customer Portal</h2>
                <p className="text-sm text-slate-600 mb-3">
                  Enter the phone number we have on file to view your schedule and
                  photos.
                </p>
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="(###) ###-####"
                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-lg"
                  />
                  <button
                    onClick={() => setCustomerReady(true)}
                    className="px-4 py-2 rounded-md bg-emerald-600 text-white"
                  >
                    View
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-slate-600">
                  Showing results for phone ending{" "}
                  <span className="font-medium">
                    {normalizePhone(phone).slice(-4)}
                  </span>
                  . <button
                    className="text-emerald-700 underline ml-1"
                    onClick={() => setCustomerReady(false)}
                  >
                    change
                  </button>
                </div>

                <Section title="Upcoming Cleans">
                  {customerFiltered.length === 0 ? (
                    <div className="text-slate-500">No upcoming cleans.</div>
                  ) : (
                    <ul className="space-y-2">
                      {customerFiltered
                        .filter((e) => e.date >= todayISO())
                        .map((e) => (
                          <li
                            key={e.id}
                            className="bg-white border border-slate-200 rounded-md px-3 py-2"
                          >
                            <div className="text-sm text-slate-900">
                              {e.date} — {e.service}
                            </div>
                            <div className="text-xs text-slate-600">
                              {e.client} • {e.address}
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </Section>

                <Section title="Past Photos">
                  <div className="text-slate-500 text-sm">
                    Past visit photos will appear here after your clean is
                    completed and uploaded. (Your cleaners attach “Before” and
                    “After” photos separately for clarity.)
                  </div>
                </Section>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-500 py-10">
        v10 • {new Date().toISOString().slice(0, 10)}
      </footer>
    </div>
  );
}
