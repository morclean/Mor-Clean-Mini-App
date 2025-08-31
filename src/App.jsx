// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* ---------- helpers ---------- */
const isUglyId = (s) => typeof s === "string" && /^[A-Z0-9_-]{20,}$/.test(s || "");
const fmtTime = (t) => (t ? t.replace(/^0?(\d+):(\d\d)$/, "$1:$2") : "");
const prettyService = (raw) => {
  const s = (raw || "").toString().trim().toLowerCase();
  if (!s || isUglyId(raw)) return "Standard Clean";
  if (s.includes("air") && s.includes("bnb")) return "Airbnb Turnover";
  if (s.includes("turnover")) return "Airbnb Turnover";
  if (s.includes("move") && s.includes("out")) return "Move-Out Clean";
  if (s.includes("move") && s.includes("in")) return "Move-In Clean";
  if (s.includes("deep")) return "Deep Clean";
  if (s.includes("office") || s.includes("commercial")) return "Commercial";
  if (s.includes("post") && s.includes("construction")) return "Post-Construction";
  if (s.includes("listing") || s.includes("real estate")) return "Listing Prep";
  if (s.includes("one time") || s.includes("one-time")) return "One-time Clean";
  if (s.includes("standard") || s.includes("maintenance")) return "Standard Clean";
  return raw; // last resort
};
const dayKey = (d) => (d || "").slice(0, 10);

/* ---------- tiny UI bits ---------- */
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${active ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}
    >
      {children}
    </button>
  );
}

/* ---------- Job Card (accordion) ---------- */
function JobCard({ job }) {
  const [open, setOpen] = useState(false);

  const service = prettyService(job.service_type || job.title);
  const titleLine = // ---- choose a human-looking name, avoid Square IDs ----
const looksLikeId = (s) =>
  !!s && /^[A-Z0-9]{12,}$/.test(s.replace(/\s|[-_/]/g, ""));  // long all-caps+digits

const candidates = [
  (job.client || "").trim(),
  (job.title || "").trim(),
  (job.notes || "").trim(),
].filter(Boolean);

const name =
  candidates.find(v => !looksLikeId(v)) || "Scheduled Clean";

// service badge (from service_type, fallback to title keywords)
const service = prettyService(job.service_type || job.title || "");

// main heading shown on the card
const titleLine = name;


  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <button
        className="w-full text-left p-4 sm:p-5 flex items-start gap-3"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="mt-1"><Badge>{service}</Badge></div>
        <div className="flex-1">
          <div className="font-semibold text-slate-900">
            {titleLine || "Scheduled Clean"}
          </div>
          <div className="text-slate-600 text-sm mt-0.5">
            {job.address ? job.address : "No address on file"}
          </div>
          <div className="text-slate-500 text-xs mt-0.5">
            {job.date} • {fmtTime(job.start)}{job.end ? `–${fmtTime(job.end)}` : ""}
            {job.assigned_cleaner ? ` • Assigned: ${job.assigned_cleaner}` : ""}
          </div>
        </div>
        <div className="ml-2 text-slate-400">{open ? "▴" : "▾"}</div>
      </button>

      {open && (
        <div className="border-t px-4 sm:px-5 pb-4 sm:pb-5">
          {/* Checklist sections – minimal placeholders to keep this file focused.
             (You can expand the lists later.) */}
          <Section title="Arrival / Safety">
            <Check>Park legally and safely</Check>
            <Check>Announce arrival if required</Check>
            <Check>Note issues in app notes</Check>
          </Section>

          <Section title="Kitchen">
            <Check>Surfaces wiped</Check>
            <Check>Sinks & faucets cleaned</Check>
            <Check>Appliance fronts wiped</Check>
            {service === "Airbnb Turnover" && (
              <>
                <Check>Inside fridge (quick check)</Check>
                <Check>Inside microwave</Check>
                <Check>Trash out, new liner</Check>
                <Check>Restock paper goods / soaps</Check>
              </>
            )}
          </Section>

          <Section title="Bathrooms">
            <Check>Toilets, sinks, tub/shower cleaned</Check>
            <Check>Mirrors & chrome shined</Check>
            {service === "Airbnb Turnover" && (
              <Check>Set fresh towels & supplies</Check>
            )}
          </Section>

          <Section title="Bedrooms">
            <Check>Make beds</Check>
            <Check>Dust surfaces & nightstands</Check>
            <Check>Floors vacuumed / mopped</Check>
            {service === "Airbnb Turnover" && (
              <Check>Change linens • 3 after-photos</Check>
            )}
          </Section>

          {service === "Deep Clean" && (
            <Section title="Deep-Clean Add-Ons">
              <Check>Baseboards/detail dust</Check>
              <Check>Cabinet fronts & handles</Check>
              <Check>High/low dust (fans, vents)</Check>
              <Check>Spot doors, trim, switches</Check>
            </Section>
          )}

          <Section title="Notes">
            <div className="text-sm text-slate-600 whitespace-pre-wrap">
              {job.notes || "—"}
            </div>
          </Section>

          {/* Photo placeholders — wire to storage later */}
          <Section title="Photos (Before & After)">
            <div className="text-xs text-slate-500">
              Take <b>3 angles per room</b>. Before when you arrive, After when you finish.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="rounded-lg border px-3 py-1.5 text-sm">Upload Before</button>
              <button className="rounded-lg border px-3 py-1.5 text-sm">Upload After</button>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <details className="group mt-3 rounded-lg border bg-slate-50 open:bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-800 flex items-center justify-between">
        {title}
        <span className="text-slate-400 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}
function Check({ children }) {
  return (
    <label className="flex items-start gap-2 py-1 text-sm">
      <input type="checkbox" className="mt-0.5" />
      <span>{children}</span>
    </label>
  );
}

/* ---------- Page ---------- */
export default function App() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("today"); // today | week | all
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        const r = await fetch("/api/jobs?ts=" + Date.now(), { cache: "no-store" });
        if (!r.ok) throw new Error("API " + r.status);
        const data = await r.json();
        if (!alive) return;
        setJobs(Array.isArray(data.events) ? data.events : []);
      } catch (e) {
        setError(String(e.message || e));
        setJobs([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const todayKey = dayKey(new Date().toISOString());
  const weekKeys = useMemo(() => {
    const start = new Date();
    const out = new Set();
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      out.add(dayKey(d.toISOString()));
    }
    return out;
  }, []);

  const view = useMemo(() => {
    let list = jobs;
    if (tab === "today") list = list.filter(j => dayKey(j.date) === todayKey);
    else if (tab === "week") list = list.filter(j => weekKeys.has(dayKey(j.date)));

    if (q.trim()) {
      const k = q.trim().toLowerCase();
      list = list.filter(j =>
        [j.client, j.address, j.notes, j.title, j.service_type]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(k))
      );
    }
    // order by date/time
    return list.slice().sort((a, b) => (a.date + (a.start||"")).localeCompare(b.date + (b.start||"")));
  }, [jobs, tab, q, todayKey, weekKeys]);

  return (
    <div className="min-h-screen bg-emerald-50/40">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean Daytona" className="h-8 w-8 rounded-full border" />
            <div>
              <div className="font-semibold">M.O.R. Clean Daytona</div>
              <div className="text-xs text-slate-500">Cleaner Portal</div>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-2">
            <Pill active={tab==="today"} onClick={()=>setTab("today")}>Today</Pill>
            <Pill active={tab==="week"} onClick={()=>setTab("week")}>This Week</Pill>
            <Pill active={tab==="all"} onClick={()=>setTab("all")}>All</Pill>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        {/* mobile pills */}
        <div className="sm:hidden mb-3 flex gap-2">
          <Pill active={tab==="today"} onClick={()=>setTab("today")}>Today</Pill>
          <Pill active={tab==="week"} onClick={()=>setTab("week")}>This Week</Pill>
          <Pill active={tab==="all"} onClick={()=>setTab("all")}>All</Pill>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search client, address, notes…"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>

        <div className="text-xs text-slate-500 mb-3">
          API events: {jobs.length} • normalized: {jobs.length} • today: {jobs.filter(j=>dayKey(j.date)===todayKey).length}
          {error ? <> • <span className="text-rose-600">error: {error}</span></> : null}
        </div>

        {view.length === 0 ? (
          <div className="text-slate-500 text-sm">No jobs found.</div>
        ) : (
          <div className="space-y-3">
            {view.map((job) => (
              <JobCard key={job.id || job.date + job.client} job={job} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
