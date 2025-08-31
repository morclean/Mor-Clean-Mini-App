// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* --------- Checklist definitions --------- */
const CHECKLISTS = {
  standard: [
    { section: "Arrival / Safety", items: ["Park safely; respect quiet hours", "Announce arrival if occupied", "Confirm access / lock code"] },
    { section: "Kitchen", items: ["Counters & backsplash cleaned", "Sinks & faucet polished", "Microwave exterior & interior", "Stovetop & knobs wiped", "Fridge exterior handles & face", "Small appliances wiped", "Trash out; new liner", "Floors vacuumed then mopped"] },
    { section: "Bathrooms", items: ["Mirror & fixtures polished", "Sink & counter cleaned", "Toilet (top-to-bottom) disinfected", "Tub/shower scrubbed", "Trash out; new liner", "Floors vacuumed then mopped"] },
    { section: "Bedrooms", items: ["Make beds (straighten sheets)", "Dust surfaces (tops → bottoms)", "Tidy visible items", "Floors vacuumed / mopped as needed"] },
    { section: "Common Areas", items: ["Dust surfaces & baseboards (eye-level)", "Glass/doors spot cleaned", "Cushions fluffed, throws folded", "Floors vacuumed / mopped as needed"] },
  ],
  airbnb: [
    { section: "Turnover Prep", items: ["Verify guest checkout", "Collect & bag trash throughout", "Start laundry (linens/towels)", "Restock basics (paper goods, soaps)", "Refill coffee/tea & condiments"] },
    { section: "Kitchen (Bnb)", items: [
      "Wash/put away dishes; empty dishwasher",
      "Wipe counters, backsplash & sink",
      "Inside microwave cleaned",
      "Inside fridge: remove leftovers; wipe shelves",
      "Inside oven (spot clean) & exterior shine",
      "Stovetop/hood wiped; knobs cleaned",
      "Trash out; new liner; bin cleaned if needed",
      "Floors vacuumed then mopped"
    ]},
    { section: "Bathrooms (Bnb)", items: [
      "Mirror & chrome polished", "Sink/vanity wiped",
      "Toilet + base disinfected", "Tub/shower scrubbed",
      "Set towel presentation", "Restock soaps, TP, tissue",
      "Trash out; new liner", "Floors vacuumed/mopped"
    ]},
    { section: "Bedrooms (Bnb)", items: [
      "Strip beds; fresh linens on", "Make beds hotel-style",
      "Dust all surfaces (lamps, frames)", "Check under beds",
      "Floors vacuumed/mopped", "Staging: pillows & throws"
    ]},
    { section: "Common Areas (Bnb)", items: [
      "Dust surfaces/baseboards", "Glass & sliding doors",
      "Cushions fluffed; throws folded", "Check remotes & lamps",
      "Floors vacuumed/mopped", "Thermostat reset per rules"
    ]},
    { section: "Final QA", items: [
      "Supplies & inventory counted", "Trash/recycle to curb (if day)",
      "Photos: **BEFORE & AFTER** (3 angles/room)", "Lockup & message ops"
    ]},
  ],
  deep: [
    { section: "Deep Add-On", items: [
      "Detail baseboards & door frames", "Detail blinds & window sills",
      "Detail light switches & door handles", "Inside oven deep clean",
      "Inside fridge full clean", "Cabinet fronts detailed",
      "Vents/returns dusted", "Furniture edges & legs wiped"
    ]},
  ],
};

/* --------- Helpers --------- */
const fmt = (d) => new Date(d + "T00:00:00");
const isSameDay = (a, b = new Date()) =>
  fmt(a).toDateString() === new Date(b).toDateString();
const inThisWeek = (d) => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // Sun
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // next Sun
  const when = fmt(d);
  return when >= start && when < end;
};
const svcBadge = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("air") && t.includes("bnb")) return { label: "Airbnb", color: "bg-amber-100 text-amber-800" };
  if (t.includes("deep")) return { label: "Deep Clean", color: "bg-red-100 text-red-700" };
  if (t.includes("move") && t.includes("out")) return { label: "Move-Out", color: "bg-purple-100 text-purple-700" };
  if (t.includes("move") && t.includes("in")) return { label: "Move-In", color: "bg-indigo-100 text-indigo-700" };
  return { label: "Standard Clean", color: "bg-emerald-100 text-emerald-700" };
};
const pickChecklistKey = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("air") && t.includes("bnb")) return "airbnb";
  if (t.includes("deep")) return "deep";
  return "standard";
};

/* --------- UI --------- */
function Pill({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm border ${
        active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100"
      >
        <span className="font-medium text-slate-800">{title}</span>
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function Checklist({ typeKey }) {
  const data = CHECKLISTS[typeKey] || [];
  return (
    <div className="space-y-4">
      {data.map((group, i) => (
        <div key={i} className="space-y-2">
          <div className="font-semibold text-slate-800">{group.section}</div>
          <ul className="grid gap-2">
            {group.items.map((it, j) => (
              <li key={j} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 accent-emerald-600" />
                <span className="text-slate-700">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job }) {
  const badge = svcBadge(job.title);
  const typeKey = pickChecklistKey(job.title);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        className="w-full text-left p-4 md:p-5 flex flex-col gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-slate-900 font-semibold">{job.client}</span>
          </div>
          <div className="text-sm text-slate-500">{job.date} • {job.start}{job.end ? `–${job.end}` : ""}</div>
        </div>

        <div className="text-sm text-slate-600">
          {job.address ? job.address : <span className="italic text-slate-400">No address on file</span>}
        </div>

        <div className="text-xs text-slate-500">
          {job.assigned_cleaner ? `Assigned: ${job.assigned_cleaner}` : "Unassigned"}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 md:px-5 md:pb-5">
          <div className="space-y-4">
            <Section title="Checklist" defaultOpen>
              <Checklist typeKey={typeKey} />
            </Section>

            <Section title="Notes">
              <textarea
                className="w-full border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500"
                rows={4}
                placeholder="Any job-specific notes…"
                defaultValue={job.notes || ""}
              />
            </Section>

            <Section title="Photos (Before / After)">
              <div className="text-sm text-slate-600 mb-2">
                Please take **three angles of each room** for both before and after.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button className="border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 text-slate-700">
                  Upload Before Photos
                </button>
                <button className="border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 text-slate-700">
                  Upload After Photos
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-2">
                (Photo storage wiring can be added to Supabase or Google Drive next.)
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------- App --------- */
export default function App() {
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState("today"); // today | week | all
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const data = await r.json();
        if (!alive) return;
        setJobs(Array.isArray(data.events) ? data.events : []);
      } catch (e) {
        console.error("Failed to load jobs:", e);
        setJobs([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    let list = jobs;
    if (tab === "today") list = list.filter((j) => isSameDay(j.date));
    else if (tab === "week") list = list.filter((j) => inThisWeek(j.date));

    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((j) =>
        [j.client, j.address, j.title, j.notes]
          .map((x) => (x || "").toLowerCase())
          .some((s) => s.includes(t))
      );
    }
    return list;
  }, [jobs, tab, q]);

  return (
    <div className="min-h-screen bg-emerald-50/40">
      {/* Header */}
      <header className="bg-white border-b border-emerald-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="M.O.R. Clean Daytona" className="w-9 h-9 rounded-full" />
          <div className="font-semibold text-emerald-900">M.O.R. Clean Daytona</div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/" className="px-3 py-1.5 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100/60">
              Cleaner Portal
            </a>
            <a href="/customer" className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
              Customer Portal
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Pill active={tab === "today"} onClick={() => setTab("today")}>Today</Pill>
          <Pill active={tab === "week"} onClick={() => setTab("week")}>This Week</Pill>
          <Pill active={tab === "all"} onClick={() => setTab("all")}>All</Pill>

          <div className="ml-auto">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search client, address, notes…"
              className="w-72 max-w-[85vw] border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>

        {/* Jobs */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="text-slate-500 text-sm">No jobs found.</div>
          )}
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </main>

      {/* footer tiny version */}
      <footer className="text-center text-xs text-slate-400 py-6">
        v10 • {new Date().toISOString().slice(0, 10)}
      </footer>
    </div>
  );
}
