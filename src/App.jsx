import { useEffect, useMemo, useState } from "react";

/** -------------------- helpers -------------------- */
function parseISO(d) {
  // d: "YYYY-MM-DD"
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}
function fmtTime(t) {
  // "11:00" -> "11:00 AM"
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function inThisWeek(date) {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const start = new Date(now);
  start.setDate(now.getDate() - day); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // next Sunday
  return date >= start && date < end;
}
function cls(...c) {
  return c.filter(Boolean).join(" ");
}

/** -------------------- service type mapping -------------------- */
/**
 * We normalize whatever comes from the sheet (title / service_type)
 * to your 7 categories.
 */
const SERVICE_KEYS = {
  STANDARD: "Standard Maintenance",
  AIRBNB: "Airbnb Turnover",
  OFFICE: "Small Office / Commercial",
  ONE_TIME: "One-time Cleaning",
  LISTING: "Real Estate Listing Prep",
  POST_CONSTRUCTION: "Post-construction Clean",
  DEEP: "Deep Clean",
  MOVE: "Move-in / Move-out",
};

function normalizeServiceType(raw = "") {
  const s = (raw || "").toLowerCase();

  if (s.includes("airbnb") || s.includes("turnover") || s.includes("bnb"))
    return SERVICE_KEYS.AIRBNB;

  if (s.includes("office") || s.includes("commercial"))
    return SERVICE_KEYS.OFFICE;

  if (s.includes("one time") || s.includes("one-time")) return SERVICE_KEYS.ONE_TIME;

  if (s.includes("listing") || s.includes("real estate"))
    return SERVICE_KEYS.LISTING;

  if (s.includes("post construction") || s.includes("post-construction") || s.includes("construction"))
    return SERVICE_KEYS.POST_CONSTRUCTION;

  if (s.includes("deep")) return SERVICE_KEYS.DEEP;

  if (s.includes("move-in") || s.includes("move out") || s.includes("move-out"))
    return SERVICE_KEYS.MOVE;

  if (s.includes("standard") || s.includes("maintenance") || s.includes("basic"))
    return SERVICE_KEYS.STANDARD;

  // fallback
  return SERVICE_KEYS.STANDARD;
}

/** -------------------- checklists per service -------------------- */
const CL = {
  [SERVICE_KEYS.STANDARD]: [
    "Arrival: park legally, announce arrival if required",
    "Bedrooms: make beds, tidy surfaces, wipe nightstands",
    "Bathrooms: disinfect sinks, toilets, tubs/showers; mirrors; restock TP",
    "Kitchen: wipe counters, sink, exterior appliances; microwave in/out",
    "Dust: reachable surfaces, baseboards (spot)",
    "Floors: vacuum + mop hard floors",
    "Trash: collect and take out",
    "Thermostat: leave as noted",
    "3 angles of each room (Before & After)",
  ],
  [SERVICE_KEYS.AIRBNB]: [
    "Arrival: code/lockbox noted; report damages",
    "Laundry: start linens/towels immediately; finish & stage",
    "Beds: strip, wash, dry, remake to host standards",
    "Kitchen: dishes done; wipe; inside microwave; inside fridge (spot); restock",
    "Bathrooms: disinfect everything; restock amenities",
    "Trash & Recycle: empty bins; take to curb if pickup day",
    "Supplies & Inventory: count & restock (soap, pods, paper goods)",
    "Inside appliances (full): fridge, oven if soiled, microwave",
    "Dusting incl. baseboards & high touch points",
    "Floors: vacuum + mop",
    "Thermostat to host setpoint",
    "3 angles per room — BEFORE and AFTER folders",
  ],
  [SERVICE_KEYS.OFFICE]: [
    "Entry & common: dust horizontal surfaces",
    "Desks: wipe clear areas (no paper stacks moved)",
    "Kitchen/breakroom: counters, sink, appliances exterior",
    "Bathrooms: disinfect & restock",
    "Trash & recycle to dumpster",
    "Floors: vacuum + mop",
    "Glass: spot clean doors/partitions",
    "Photos (optional) for QC",
  ],
  [SERVICE_KEYS.ONE_TIME]: [
    "High dust & cobwebs",
    "Detailed kitchen surfaces, exterior appliances, microwave inside",
    "Bathrooms detail clean",
    "Baseboards & doors wipe-down (visible)",
    "Floors vacuum + mop",
    "3 angles per room (after)",
  ],
  [SERVICE_KEYS.LISTING]: [
    "Entry & curb touchups",
    "Windows & glass (spot/polish handles)",
    "Kitchen full shine, stainless polish",
    "Bathrooms sparkle pass",
    "Baseboards & doors wiped",
    "Floors detailed",
    "Staging reset as notes",
    "3 angles per room (after)",
  ],
  [SERVICE_KEYS.POST_CONSTRUCTION]: [
    "High-to-low dusting (vents, fans, lights)",
    "Detail baseboards, doors, trim",
    "Windows & tracks (as noted)",
    "Kitchen & bath construction residue removal",
    "Vacuum + mop twice (fine dust)",
    "Bag and remove construction debris (if allowed)",
    "After photos",
  ],
  [SERVICE_KEYS.DEEP]: [
    "Kitchen: behind small appliances; cabinet fronts; inside microwave; oven (as noted)",
    "Bathrooms: detail tile, grout edges, fixtures",
    "Baseboards, doors, door frames, switch plates",
    "Window sills & tracks (accessible)",
    "Furniture edges & under reachable areas",
    "Floors: edge vacuum + mop",
    "Before/After photos",
  ],
  [SERVICE_KEYS.MOVE]: [
    "Empty home: inside ALL cabinets & drawers (kitchen/bath)",
    "Inside fridge & oven",
    "Wipe all doors, baseboards, light switches, outlets (exterior)",
    "Bathrooms: full detail",
    "Floors: vacuum & mop thoroughly",
    "Garage/patio sweep (as noted)",
    "Before/After photos",
  ],
};

/** -------------------- components -------------------- */
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        "px-4 py-2 rounded-full border transition",
        active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function ChecklistItem({ id, label, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 p-3 md:p-4 rounded-xl border bg-white/70 hover:bg-white transition"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 h-6 w-6 md:h-7 md:w-7 accent-emerald-600"
      />
      <span className="text-[18px] md:text-[19px]">{label}</span>
    </label>
  );
}

function PhotoSection({ value, onChange, label }) {
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    if (!value?.length) {
      setPreviews([]);
      return;
    }
    const urls = Array.from(value).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u.url));
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="font-semibold text-[18px]">{label}</div>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onChange(e.target.files)}
        className="block w-full text-sm file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
      />
      {!!previews.length && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {previews.map((p) => (
            <img
              key={p.url}
              src={p.url}
              alt={p.name}
              className="h-24 w-full object-cover rounded-lg border"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }) {
  const [open, setOpen] = useState(false);
  const [beforeFiles, setBeforeFiles] = useState(null);
  const [afterFiles, setAfterFiles] = useState(null);

  const service = normalizeServiceType(job.service_type || job.title);
  const items = CL[service] || CL[SERVICE_KEYS.STANDARD];

  const [checked, setChecked] = useState(() =>
    Object.fromEntries(items.map((t, i) => [i, false]))
  );

  function toggle(i) {
    setChecked((c) => ({ ...c, [i]: !c[i] }));
  }

  return (
    <div className="rounded-2xl border bg-white/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 p-4 md:p-5 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {service}
            </span>
            <span className="text-sm text-slate-500">
              {job.date} • {fmtTime(job.start)}
              {job.end ? `–${fmtTime(job.end)}` : ""}
            </span>
          </div>
          <div className="font-semibold text-[18px] md:text-[20px]">
            {job.client || "Unassigned Client"}
          </div>
          <div className="text-[14px] md:text-[15px] text-slate-600">
            {job.address || "No address on file"}
          </div>
        </div>
        <div className="text-xl md:text-2xl opacity-60">{open ? "▾" : "▸"}</div>
      </button>

      {open && (
        <div className="p-4 md:p-6 border-t bg-white">
          {/* Notes */}
          {job.notes && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900">
              <div className="font-semibold mb-1">Notes</div>
              <div className="whitespace-pre-wrap text-[15px]">{job.notes}</div>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-3 md:space-y-4 mb-6">
            {items.map((label, i) => (
              <ChecklistItem
                key={i}
                id={`${job.id}-${i}`}
                label={label}
                checked={!!checked[i]}
                onChange={() => toggle(i)}
              />
            ))}
          </div>

          {/* Photos */}
          <div className="grid md:grid-cols-2 gap-6">
            <PhotoSection
              label="Before Photos (3 angles / room)"
              value={beforeFiles}
              onChange={setBeforeFiles}
            />
            <PhotoSection
              label="After Photos (3 angles / room)"
              value={afterFiles}
              onChange={setAfterFiles}
            />
          </div>

          {/* Complete button (no backend yet) */}
          <div className="mt-6 flex justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => alert("Marked complete (photos remain local until storage is connected).")}
            >
              Mark Job Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** -------------------- main app -------------------- */
export default function App() {
  const [tab, setTab] = useState("today"); // today | week | all
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState([]);
  const [meta, setMeta] = useState({ apiCount: 0, normalized: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const data = await r.json();
        if (cancelled) return;
        const events = Array.isArray(data?.events) ? data.events : [];

        const normalized = events.map((e) => ({
          id: e.id || `${e.date}-${e.client || e.title || "job"}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          client: e.client || "",
          title: e.title || "",
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          service_type: e.service_type || e.title || "",
        }));

        setJobs(normalized);
        setMeta({ apiCount: events.length, normalized: normalized.length });
      } catch (err) {
        console.error(err);
        setJobs([]);
        setMeta({ apiCount: 0, normalized: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();

  const visible = useMemo(() => {
    let list = jobs.slice();

    // filter by tab
    if (tab === "today") {
      list = list.filter((j) => isSameDay(parseISO(j.date), today));
    } else if (tab === "week") {
      list = list.filter((j) => inThisWeek(parseISO(j.date)));
    }

    // text search
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((j) =>
        [j.client, j.address, j.notes, j.title, j.service_type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    // sort by date, then time
    list.sort((a, b) => {
      const ad = parseISO(a.date) - parseISO(b.date);
      if (ad !== 0) return ad;
      return (a.start || "").localeCompare(b.start || "");
    });

    return list;
  }, [jobs, tab, query]);

  return (
    <div className="min-h-screen bg-emerald-50/30 text-[17px] md:text-[18px]">
      {/* header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean" className="h-8 w-8 rounded-full border" />
            <div className="font-semibold">M.O.R. Clean Daytona</div>
          </div>
          <div className="text-xs text-slate-500">
            API events: {meta.apiCount} • normalized: {meta.normalized} • today:{" "}
            {
              jobs.filter((j) => isSameDay(parseISO(j.date), new Date()))
                .length
            }
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 md:py-6 space-y-4">
        {/* filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Pill active={tab === "today"} onClick={() => setTab("today")}>
            Today
          </Pill>
          <Pill active={tab === "week"} onClick={() => setTab("week")}>
            This Week
          </Pill>
          <Pill active={tab === "all"} onClick={() => setTab("all")}>
            All
          </Pill>

          <div className="flex-1" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client, address, notes…"
            className="w-full md:w-80 px-3 py-2 rounded-lg border bg-white"
          />
        </div>

        {/* job list */}
        {visible.length === 0 ? (
          <div className="text-slate-500 text-center py-10">No jobs found.</div>
        ) : (
          <div className="space-y-4">
            {visible.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        v10 • {new Date().toISOString().slice(0, 10)}
      </footer>
    </div>
  );
}
