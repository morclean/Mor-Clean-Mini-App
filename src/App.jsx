// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* =====================  helpers  ===================== */

const TZ = "America/New_York";
const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (d, days) =>
  new Date(new Date(d).getTime() + days * 86400000).toLocaleDateString("en-CA", { timeZone: TZ });
const fmtTime = (t) => (t ? t : "");
const withinThisWeek = (iso) => {
  const start = todayISO();
  const end = addDays(start, 6);
  return iso >= start && iso <= end;
};

// map Square service-variation IDs (if you want) → human label
const SERVICE_ID_MAP = {
  POWVHCWKBLS5LNVIKAWQRQJM: "Standard clean",
  DPMF5IVR654A73BPPHZFQIIM: "Standard clean",
};

function prettyService(rawTitle = "", notes = "") {
  const direct = SERVICE_ID_MAP[rawTitle];
  if (direct) return direct;

  const looksLikeId = /^[A-Z0-9]{20,36}$/.test(rawTitle.trim());
  const base = looksLikeId ? "" : rawTitle.trim();

  const hay = (base || notes || "").toLowerCase();
  const hit = (xs) => xs.find((w) => hay.includes(w));

  if (hit(["airbnb", "turnover"])) return "Airbnb Turnover";
  if (hit(["move-in", "move out", "move-out"])) return "Move-in/Move-out Clean";
  if (hit(["post-construction", "post construction"])) return "Post-Construction Clean";
  if (hit(["deep clean", "deep"])) return "Deep Clean";
  if (hit(["listing", "realtor", "showing"])) return "Real Estate Listing Prep";
  if (hit(["office", "commercial"])) return "Small Office / Commercial";
  if (hit(["one time", "one-time"])) return "One-time Cleaning Service";

  return "Standard Clean";
}

// ⬇️ NEW: robust client display (ignores Square-ish IDs in BOTH client and title)
const displayClient = (e) => {
  const looksLikeId = (s) => /^[A-Z0-9]{20,36}$/.test((s || "").trim());
  const name = !looksLikeId(e.client) ? e.client : "";
  const title = !looksLikeId(e.title) ? e.title : "";
  const addrFirst = (e.address || "").split(",")[0];

  return (name || title || addrFirst || "Client").trim();
};

const Badge = ({ children }) => (
  <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1">
    {children}
  </span>
);

/* =====================  checklists  ===================== */

const CHECKLISTS = {
  Standard: {
    "Arrival / Safety": [
      "Park legally, avoid blocking driveways / walkways",
      "Announce arrival if occupied; respect quiet hours",
      "Disarm alarm (if provided)",
    ],
    Kitchen: [
      "Counters + backsplash wiped",
      "Sink scrubbed, fixtures polished",
      "Exterior appliances wiped",
      "Microwave interior wiped",
      "Floors vacuumed + mopped",
      "Trash out, new liner",
    ],
    Bathrooms: [
      "Toilet, tub/shower, sink + fixtures cleaned",
      "Mirrors + glass shined",
      "Counters wiped",
      "Floors vacuumed + mopped",
      "Trash out, new liner",
    ],
    Bedrooms: [
      "Make bed(s)",
      "Dust surfaces",
      "Tidy surfaces",
      "Floors vacuumed / mopped",
      "Empty small bins",
    ],
    "Living / Common": [
      "Dust surfaces + electronics (lightly)",
      "Tidy + reset furniture",
      "Glass / mirrors spot-free",
      "Floors vacuumed / mopped",
    ],
  },
  Airbnb: {
    "Arrival / Safety": [
      "Park legally and discreetly",
      "Photo check-in of front door",
      "Note visible damage/issues",
    ],
    Kitchen: [
      "Do dishes / run + empty dishwasher (if needed)",
      "Restock basics (owner-supplied)",
      "Counters, sink, exterior appliances cleaned",
      "Microwave interior wiped",
      "Floors vacuumed + mopped",
      "Trash out, new liner",
    ],
    Bathrooms: [
      "Toilet, tub/shower, sink + fixtures cleaned",
      "Restock toiletries (owner-supplied) + fold towels",
      "Mirrors + glass shined",
      "Floors vacuumed + mopped",
      "Trash out, new liner",
    ],
    Bedrooms: [
      "Strip + make bed(s) hotel-style",
      "Replace linens (owner-supplied) + stage pillows",
      "Dust reachable surfaces",
      "Floors vacuumed / mopped",
    ],
    "Living / Common": [
      "Tidy + reset furniture",
      "Dust reachable surfaces",
      "Spot clean glass/mirrors",
      "Floors vacuumed / mopped",
    ],
    "Turnover Tasks": [
      "Collect all trash + replace liners",
      "Check fridge for left items",
      "Laundry started/finished (if applicable)",
      "Thermostat reset per rules",
      "Supplies topped (owner-supplied)",
    ],
    "Inside Appliances (if requested)": [
      "Fridge interior wiped",
      "Oven interior wiped",
      "Cabinets interior spot-wiped",
    ],
  },
  Deep: {
    "Deep Detail (extra)": [
      "Baseboards + door frames wiped",
      "Cabinet fronts detailed",
      "Vents + light switch plates wiped",
      "Furniture edges detailed",
    ],
  },
};

/* =====================  UI bits  ===================== */

const Tabs = ({ value, setValue }) => {
  const base = "px-3 py-1 rounded-full border text-sm font-medium transition-colors";
  const on = "bg-emerald-600 text-white border-emerald-600";
  const off = "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";
  return (
    <div className="flex gap-2">
      {["Today", "This Week", "All"].map((t) => (
        <button key={t} className={`${base} ${value === t ? on : off}`} onClick={() => setValue(t)}>
          {t}
        </button>
      ))}
    </div>
  );
};

function Room({ title, items, checked, toggle }) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <span className="text-slate-400 text-sm">tap to open</span>
      </summary>
      <div className="px-4 pb-4">
        <ul className="space-y-3">
          {items.map((it, idx) => {
            const id = `${title}::${idx}`;
            const isOn = !!checked[id];
            return (
              <li key={id} className="flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="w-5 h-5 mt-0.5 accent-emerald-600"
                  checked={isOn}
                  onChange={() => toggle(id)}
                />
                <span className="text-base leading-snug">{it}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

function BeforeAfter({ onBefore, onAfter }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="font-semibold mb-2">Upload BEFORE photos</div>
        <input type="file" multiple accept="image/*" onChange={(e) => onBefore(Array.from(e.target.files || []))} />
        <p className="text-xs text-slate-500 mt-1">Tip: 3 angles per room (wide, mid, detail).</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="font-semibold mb-2">Upload AFTER photos</div>
        <input type="file" multiple accept="image/*" onChange={(e) => onAfter(Array.from(e.target.files || []))} />
        <p className="text-xs text-slate-500 mt-1">Tip: 3 angles per room (wide, mid, detail).</p>
      </div>
    </div>
  );
}

function JobCard({ job }) {
  const [checked, setChecked] = useState({});
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles, setAfterFiles] = useState([]);
  const toggle = (id) => setChecked((m) => ({ ...m, [id]: !m[id] }));

  const service = job.service_type || "Standard Clean";
  const isAirbnb = /airbnb|turnover/i.test(service);
  const isDeep = /deep/i.test(service);

  const checklist = useMemo(() => {
    const base = CHECKLISTS.Standard;
    const air = CHECKLISTS.Airbnb;
    const deep = CHECKLISTS.Deep;
    if (isAirbnb && isDeep) return { ...air, ...deep };
    if (isAirbnb) return air;
    if (isDeep) return { ...base, ...deep };
    return base;
  }, [service, isAirbnb, isDeep]);

  return (
    <details className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <summary className="list-none cursor-pointer">
        <div className="flex flex-col md:flex-row md:items-center gap-2 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge>{service}</Badge>
              <span className="text-lg font-semibold">{job.client}</span>
            </div>
            <div className="text-slate-600">{job.address || "No address on file"}</div>
          </div>
          <div className="text-sm text-slate-500 min-w-[150px] text-right">
            {job.date} {job.start && `• ${fmtTime(job.start)}`}
          </div>
        </div>
      </summary>

      <div className="px-4 pb-5 md:px-6 space-y-4">
        {job.notes ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900">
            <strong className="mr-1">Notes:</strong>
            {job.notes}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          {Object.entries(checklist).map(([room, items]) => (
            <Room key={room} title={room} items={items} checked={checked} toggle={toggle} />
          ))}
        </div>

        <BeforeAfter onBefore={setBeforeFiles} onAfter={setAfterFiles} />

        <div className="flex flex-wrap gap-3 pt-2">
          <button className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800">
            Save Progress
          </button>
          <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">
            Complete Job
          </button>
        </div>
      </div>
    </details>
  );
}

/* =====================  Cleaner Portal  ===================== */

function CleanerPortal() {
  const [tab, setTab] = useState("Today");
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState([]);
  const [apiStats, setApiStats] = useState({ api: 0, normalized: 0, today: 0, error: "" });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const j = await r.json();
        const raw = Array.isArray(j.events) ? j.events : [];
        setApiStats((s) => ({ ...s, api: raw.length }));

        const normalized = raw.map((e) => ({
          id:
            e.id ||
            `${e.date}-${(displayClient(e) || "Client").replace(/\s+/g, "_")}-${
              e.service_type || e.title || "Service"
            }`,
          date: e.date || "",
          start: e.start || "",
          end: e.end || "",
          client: displayClient(e),
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          service_type: e.service_type || prettyService(e.title, e.notes),
          title: e.title || "",
        }));

        const todayCount = normalized.filter((e) => e.date === todayISO()).length;
        setApiStats({ api: raw.length, normalized: normalized.length, today: todayCount, error: "" });
        setEvents(normalized);
      } catch (err) {
        setApiStats((s) => ({ ...s, error: "API 500" }));
        setEvents([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = [...events];
    if (tab === "Today") list = list.filter((e) => e.date === todayISO());
    if (tab === "This Week") list = list.filter((e) => withinThisWeek(e.date));

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [e.client, e.address, e.notes, e.service_type, e.title].join(" ").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
    return list;
  }, [events, tab, query]);

  return (
    <div className="space-y-4">
      {/* controls (moved stats here to avoid duplicate brand header) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Tabs value={tab} setValue={setTab} />
          <input
            className="flex-1 min-w-[220px] rounded-full border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search client, address, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-500">
          API events: {apiStats.api} • normalized: {apiStats.normalized} • today: {apiStats.today}
          {apiStats.error && ` • error: ${apiStats.error}`}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-slate-500">No jobs found.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <JobCard key={e.id} job={e} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================  Client Portal  ===================== */

function ClientPortal() {
  const [phone, setPhone] = useState("");
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const digits = (v) => (v || "").replace(/[^\d]/g, "");

  const load = async () => {
    setLoaded(false);
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      const j = await r.json();
      const raw = Array.isArray(j.events) ? j.events : [];
      const mine = raw
        .map((e) => ({
          id: e.id,
          date: e.date || "",
          start: e.start || "",
          end: e.end || "",
          client: displayClient(e),
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          service_type: e.service_type || prettyService(e.title, e.notes),
        }))
        .filter((e) => digits(e.client_phone) === digits(phone));
      mine.sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
      setEvents(mine);
    } catch {
      setEvents([]);
    } finally {
      setLoaded(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="M.O.R. Clean" className="h-8 w-8 rounded-full" />
        <div>
          <div className="font-bold text-xl">Client Portal</div>
          <div className="text-xs text-slate-500">View upcoming cleans & photos (by phone).</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          inputMode="tel"
          placeholder="Enter phone number"
          className="rounded-full border border-slate-300 px-4 py-3 text-base w-[260px]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <button
          className="px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          onClick={load}
        >
          View my schedule & photos
        </button>
      </div>

      {loaded &&
        (events.length === 0 ? (
          <div className="text-slate-500">No cleans found for that phone.</div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center gap-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge>{e.service_type}</Badge>
                    <span className="font-semibold">{e.client}</span>
                  </div>
                  <div className="text-slate-600">{e.address}</div>
                </div>
                <div className="text-sm text-slate-500 min-w-[150px] text-right">
                  {e.date} {e.start && `• ${fmtTime(e.start)}`}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

/* =====================  App shell  ===================== */

export default function App() {
  const [view, setView] = useState("cleaner");
  return (
    <div className="min-h-screen bg-emerald-50/40 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* single brand header (no duplicate) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="logo" className="h-8 w-8 rounded-full" />
            <div className="font-bold text-lg tracking-wide">M.O.R. Clean Daytona</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("cleaner")}
              className={`px-4 py-2 rounded-full ${
                view === "cleaner"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700"
              }`}
            >
              Cleaner Portal
            </button>
            <button
              onClick={() => setView("client")}
              className={`px-4 py-2 rounded-full ${
                view === "client"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-300 text-slate-700"
              }`}
            >
              Client Portal
            </button>
          </div>
        </div>

        {view === "cleaner" ? <CleanerPortal /> : <ClientPortal />}
      </div>
    </div>
  );
}
