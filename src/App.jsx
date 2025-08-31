// src/App.jsx
import { useEffect, useMemo, useState } from "react";

function classNames(...a) { return a.filter(Boolean).join(" "); }

const tabs = ["Today", "This Week", "All"];

function isSameDay(a, b) { return a.toISOString().slice(0,10) === b.toISOString().slice(0,10); }
function startOfWeek(d) {
  const x = new Date(d); const day = x.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Mon-based
  x.setDate(x.getDate() - diff);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}

function withinThisWeek(dateStr) {
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00");
  return d >= startOfWeek(today) && d <= endOfWeek(today);
}

function JobCard({ ev }) {
  const time = [ev.start, ev.end].filter(Boolean).join(" — ");
  const badge = ev.title || "Job";
  const assigned = ev.assigned_clean ? ev.assigned_clean : "Unassigned";
  const subline = ev.address ? ev.address : "No address on file";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
          {badge}
        </span>
        {time && <span className="text-xs text-slate-500">{time}</span>}
      </div>

      <div className="text-lg font-semibold">{ev.client || "Client"}</div>
      <div className="text-sm text-slate-600">{subline}</div>

      <div className="mt-2 text-xs text-slate-500">
        {assigned ? `Assigned: ${assigned}` : "Unassigned"}
        {ev.status ? ` • Status: ${ev.status}` : ""}
        {ev.price ? ` • Price: ${ev.price}` : ""}
        {ev.paid ? ` • Paid: ${ev.paid}` : ""}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("Today");      // default Today
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    async function go() {
      setLoading(true);
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        setEvents(Array.isArray(j.events) ? j.events : []);
      } catch (e) {
        setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    go();
    return () => { alive = false; };
  }, []);

  // filter by tab + search
  const todayStr = new Date().toISOString().slice(0,10);

  const filtered = useMemo(() => {
    let arr = events;

    if (tab === "Today") {
      arr = arr.filter(ev => ev.date === todayStr);
    } else if (tab === "This Week") {
      arr = arr.filter(ev => withinThisWeek(ev.date));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(ev =>
        (ev.client || "").toLowerCase().includes(q) ||
        (ev.address || "").toLowerCase().includes(q) ||
        (ev.notes || "").toLowerCase().includes(q) ||
        (ev.title || "").toLowerCase().includes(q) ||
        (ev.assigned_clean || "").toLowerCase().includes(q)
      );
    }
    // sort date → start time
    arr.sort((a,b) => {
      const d = (a.date || "").localeCompare(b.date || "");
      if (d !== 0) return d;
      return (a.start || "").localeCompare(b.start || "");
    });
    return arr;
  }, [events, tab, query, todayStr]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 mb-4 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean Daytona" className="h-8 w-8 rounded-full border" />
            <div>
              <div className="text-lg font-semibold">M.O.R. Clean Daytona</div>
              <div className="text-xs text-slate-500">Women-owned • Family-operated</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={classNames(
                  "rounded-full border px-3 py-1 text-sm",
                  tab === t ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-emerald-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search client, address, notes…"
              className="w-64 rounded-xl border px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="md:hidden mb-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search client, address, notes…"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-slate-500">Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-slate-500">
            No jobs found for <b>{tab}</b>.
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(ev => <JobCard key={ev.id} ev={ev} />)}
          </div>
        )}

        <div className="mt-6 text-right text-xs text-slate-400">v11 • {todayStr}</div>
      </main>
    </div>
  );
}
