import { useEffect, useMemo, useState } from "react";

const ROOM = (label, items) => ({ label, items });

const TEMPLATES = {
  "Standard Maintenance": [
    ROOM("Arrival / Safety", [
      "Park legally; respect quiet hours",
      "Announce arrival if occupied; lock-up on exit",
      "Photos: before (3 angles per room)"
    ]),
    ROOM("Kitchen", [
      "Sink/faucet clean & dry",
      "Counters wiped",
      "Exterior appliances wiped",
      "Microwave inside/out",
      "Trash out / new liner",
      "Floor vacuum/mop"
    ]),
    ROOM("Bathrooms", [
      "Toilet, sink, mirror",
      "Shower/tub walls, hardware",
      "Trash out / new liner",
      "Floor vacuum/mop"
    ]),
    ROOM("Bedrooms", [
      "Make beds (if linens provided)",
      "Dust surfaces",
      "Tidy items",
      "Floors: vacuum/mop"
    ]),
    ROOM("Common Areas", [
      "Dust reachable surfaces",
      "Glass/TV spot-free",
      "Floors vacuum/mop"
    ]),
    ROOM("Wrap-up", [
      "After photos (3 angles per room)",
      "Lights off, doors/windows locked"
    ])
  ],

  "Airbnb Turnover": [
    ROOM("Arrival / Safety", [
      "Park legally; respect quiet hours",
      "Photos: before (3 angles per room)",
      "Note damage/issues"
    ]),
    ROOM("Bedrooms", [
      "Strip beds; bag dirty linens",
      "Inspect mattress/protectors",
      "Make beds with fresh set (tight corners)",
      "Wipe nightstands/lamps/handles",
      "Vacuum/mop floors"
    ]),
    ROOM("Bathrooms", [
      "Disinfect toilet/sink/tub/shower & fixtures",
      "Restock TP (2+), soap, toiletries (per host list)",
      "Polish mirrors/chrome",
      "Empty trash; new liner",
      "Vacuum/mop floors"
    ]),
    ROOM("Kitchen", [
      "Dishes run & put away",
      "Wipe counters/splash",
      "Microwave inside/out",
      "Fridge inside spot check; remove left-overs",
      "Oven/stove top wipe; inside if required",
      "Restock coffee/tea/consumables (per host list)",
      "Trash/recycle out; new liners",
      "Vacuum/mop floors"
    ]),
    ROOM("Living / Dining", [
      "Reset furniture & décor per photos",
      "Dust surfaces & electronics",
      "Glass/TV spot-free",
      "Vacuum/mop floors"
    ]),
    ROOM("Laundry / Supplies", [
      "Wash/dry linens & towels (host settings)",
      "Re-stock paper goods/soaps",
      "Inventory check (low → note in job)"
    ]),
    ROOM("Final Walk-through", [
      "After photos (3 angles per room)",
      "Thermostat per host rules",
      "Doors/windows locked, lights off"
    ])
  ],

  "Deep Clean": [
    ROOM("Deep Tasks", [
      "Baseboards & trim detailed",
      "Cabinet faces & pulls",
      "Inside oven + fridge (if required)",
      "Vents, fans, high dusting",
      "Doors, frames, switch plates"
    ])
  ],

  "Move-in / Move-out": [
    ROOM("Move Clean", [
      "Inside cabinets & drawers",
      "Inside oven, fridge, microwave",
      "Windows/ledges (reachable)",
      "Closets/shelves",
      "Baseboards, trim, doors"
    ])
  ],

  "Small Office / Commercial": [
    ROOM("Office", [
      "Desks wiped (clear areas)",
      "Trash/recycle out",
      "Kitchenette/breakroom clean",
      "Restrooms sanitized",
      "Floors vacuum/mop"
    ])
  ],

  "One-time Cleaning": [
    ROOM("One-time", [
      "Tailored list per notes",
      "Before & after photos (3 angles/room)"
    ])
  ],

  "Real Estate Listing Prep": [
    ROOM("Listing Prep", [
      "Staging reset per agent",
      "Detail dusting",
      "Smudge glass/mirrors",
      "Floors perfect",
      "Photoset after"
    ])
  ],
};

function normalizeType(s) {
  const t = (s || "").toLowerCase();
  if (t.includes("airbnb") || t.includes("turnover") || t.includes("bnb"))
    return "Airbnb Turnover";
  if (t.includes("move-in") || t.includes("move out"))
    return "Move-in / Move-out";
  if (t.includes("construction"))
    return "Post Construction";
  if (t.includes("listing") || t.includes("real estate"))
    return "Real Estate Listing Prep";
  if (t.includes("office") || t.includes("commercial"))
    return "Small Office / Commercial";
  if (t.includes("one time"))
    return "One-time Cleaning";
  if (t.includes("deep"))
    return "Deep Clean";
  return "Standard Maintenance";
}

function Collapser({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button className="w-full flex items-center justify-between p-3"
              onClick={() => setOpen(o => !o)}>
        <span className="font-medium">{title}</span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Checklist({ type }) {
  const key = normalizeType(type);
  const rooms = TEMPLATES[key] || TEMPLATES["Standard Maintenance"];
  return (
    <div className="space-y-3">
      {rooms.map((r, idx) => (
        <Collapser key={idx} title={r.label}>
          <ul className="space-y-2">
            {r.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </Collapser>
      ))}
    </div>
  );
}

function JobCard({ job }) {
  const svc = normalizeType(job.service_type || job.title);
  return (
    <div className="rounded-2xl bg-white shadow p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{job.date} • {job.start}{job.end ? `–${job.end}` : ""}</div>
          <div className="text-lg font-semibold">{job.client || "Unassigned"}</div>
          <div className="text-slate-600">{job.address || "No address on file"}</div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700">
          {svc}
        </span>
      </div>

      {job.notes && (
        <div className="text-sm text-slate-700 border-l-4 border-slate-200 pl-3">
          {job.notes}
        </div>
      )}

      <Checklist type={svc} />
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("today"); // default Today

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/jobs");
      const j = await r.json();
      setJobs(j.events || []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0,10);
    const weekFrom = new Date(now); weekFrom.setDate(weekFrom.getDate() + 7);
    const weekStr = weekFrom.toISOString().slice(0,10);

    let arr = jobs;
    if (tab === "today") arr = arr.filter(e => e.date === todayStr);
    else if (tab === "week") arr = arr.filter(e => e.date >= todayStr && e.date <= weekStr);

    const term = q.trim().toLowerCase();
    if (term) {
      arr = arr.filter(e =>
        (e.client||"").toLowerCase().includes(term) ||
        (e.address||"").toLowerCase().includes(term) ||
        (e.notes||"").toLowerCase().includes(term)
      );
    }
    return arr;
  }, [jobs, q, tab]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="MOR" className="h-8 w-8 rounded-full"/>
          <div>
            <div className="font-semibold">M.O.R. Clean Daytona</div>
            <div className="text-xs text-slate-500">Women-owned • Family-operated</div>
          </div>
        </div>
        <nav className="flex gap-2">
          <button onClick={() => setTab("today")} className={`px-3 py-1 rounded-full ${tab==='today'?'bg-emerald-600 text-white':'bg-slate-100'}`}>Today</button>
          <button onClick={() => setTab("week")} className={`px-3 py-1 rounded-full ${tab==='week'?'bg-emerald-600 text-white':'bg-slate-100'}`}>This Week</button>
          <button onClick={() => setTab("all")} className={`px-3 py-1 rounded-full ${tab==='all'?'bg-emerald-600 text-white':'bg-slate-100'}`}>All</button>
        </nav>
      </header>

      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
          placeholder="Search client, address, notes…"
          value={q} onChange={e => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-slate-500 text-sm">No jobs found.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((j, i) => <JobCard key={i} job={j} />)}
        </div>
      )}
    </div>
  );
}
