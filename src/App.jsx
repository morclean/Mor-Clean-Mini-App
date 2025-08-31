// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* ---------------- helpers ---------------- */
const ymd = (d) => d.toISOString().slice(0, 10);
const todayStr = ymd(new Date());
const sameDay = (d) => (d || "").slice(0, 10) === todayStr;
const inThisWeek = (dateStr) => {
  if (!dateStr) return false;
  const base = new Date();
  const dow = base.getDay();
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  const d = new Date(dateStr);
  return d >= weekStart && d < weekEnd;
};
const labelServiceType = (raw) => {
  const t = (raw || "").toLowerCase();
  if (t.includes("air") || t.includes("turn")) return "Airbnb Turnover";
  if (t.includes("deep")) return "Deep Clean";
  if (t.includes("move")) return "Move-In/Out";
  if (t.includes("post") || t.includes("reno")) return "Post-Renovation";
  return "Standard Clean";
};

/* ---------------- app ---------------- */
export default function App() {
  const [mode, setMode] = useState("cleaner"); // cleaner | customer
  const [tab, setTab] = useState("today");     // today | week | all
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // raw from API + normalized
  const [raw, setRaw] = useState([]);          // raw events array
  const [jobs, setJobs] = useState([]);        // normalized events
  const [error, setError] = useState("");

  // customer phone filter
  const [phone, setPhone] = useState("");
  const phoneDigits = phone.replace(/\D/g, "");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/jobs?ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();

        const events = Array.isArray(data?.events) ? data.events : [];
        setRaw(events);

        // normalize gently; keep everything even if fields are missing
        const normalized = events.map((e, i) => {
          const date = e.date || ""; // expected "YYYY-MM-DD"
          return {
            id: e.id || `row-${i}`,
            date,
            start: e.start || "",
            end: e.end || "",
            client: (e.client || "").trim(),
            address: (e.address || "").trim(),
            notes: e.notes || "",
            client_phone: (e.client_phone || "").trim(),
            service: labelServiceType(e.title || e.service_type || ""),
          };
        });

        // If normalization produced zero but raw had items, fall back to raw passthrough view
        setJobs(normalized);
        setLoading(false);

        // If "Today" would be empty but there are jobs overall, auto-switch to "all"
        if (normalized.length && !normalized.some((j) => sameDay(j.date))) {
          setTab("all");
        }
      } catch (err) {
        setLoading(false);
        setError(err.message || String(err));
        setRaw([]);
        setJobs([]);
      }
    })();
  }, []);

  /* cleaner filters */
  const filteredCleaner = useMemo(() => {
    let pool = jobs;
    if (tab === "today") pool = pool.filter((j) => sameDay(j.date));
    if (tab === "week") pool = pool.filter((j) => inThisWeek(j.date));
    const term = query.trim().toLowerCase();
    if (!term) return pool;
    return pool.filter((j) =>
      `${j.client} ${j.address} ${j.service} ${j.notes}`.toLowerCase().includes(term)
    );
  }, [jobs, tab, query]);

  /* customer filter */
  const filteredCustomer = useMemo(() => {
    if (!phoneDigits) return [];
    return jobs.filter((j) =>
      (j.client_phone || "").replace(/\D/g, "").includes(phoneDigits)
    );
  }, [jobs, phoneDigits]);

  return (
    <div className="min-h-screen bg-emerald-50">
      {/* header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-emerald-50/80 border-b">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="MOR" className="h-7 w-7 rounded-full ring-2 ring-emerald-200" />
          <div className="font-semibold">M.O.R. Clean Daytona</div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setMode("cleaner")}
              className={`px-3 py-1 rounded-full text-sm ${mode === "cleaner" ? "bg-emerald-600 text-white" : "bg-white"}`}
            >
              Cleaner Portal
            </button>
            <button
              onClick={() => setMode("customer")}
              className={`px-3 py-1 rounded-full text-sm ${mode === "customer" ? "bg-emerald-600 text-white" : "bg-white"}`}
            >
              Customer Portal
            </button>
          </div>
        </div>
      </header>

      {/* debug strip so we SEE what's happening */}
      <div className="mx-auto max-w-5xl px-4 py-2 text-xs text-slate-500">
        {loading ? "Loading…" : (
          <>
            API events: <b>{raw.length}</b> • normalized: <b>{jobs.length}</b> • today: <b>{jobs.filter(j=>sameDay(j.date)).length}</b> {error && <>• error: <span className="text-rose-600">{error}</span></>}
          </>
        )}
      </div>

      <main className="mx-auto max-w-5xl px-4 pb-12">
        {mode === "cleaner" ? (
          <CleanerView
            loading={loading}
            tab={tab}
            setTab={setTab}
            query={query}
            setQuery={setQuery}
            items={filteredCleaner}
            raw={raw}
            hasNormalized={jobs.length > 0}
          />
        ) : (
          <CustomerView
            loading={loading}
            phone={phone}
            setPhone={setPhone}
            items={filteredCustomer}
          />
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">v11 • {todayStr}</footer>
    </div>
  );
}

/* -------------- Cleaner View (with raw fallback renderer) -------------- */
function CleanerView({ loading, tab, setTab, query, setQuery, items, raw, hasNormalized }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab("today")}
          className={`px-3 py-1 rounded-full text-sm ${tab === "today" ? "bg-emerald-600 text-white" : "bg-white"}`}
        >
          Today
        </button>
        <button
          onClick={() => setTab("week")}
          className={`px-3 py-1 rounded-full text-sm ${tab === "week" ? "bg-emerald-600 text-white" : "bg-white"}`}
        >
          This Week
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-1 rounded-full text-sm ${tab === "all" ? "bg-emerald-600 text-white" : "bg-white"}`}
        >
          All
        </button>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search client, address, notes…"
          className="ml-3 text-sm bg-white rounded-md px-3 py-1.5 border w-64"
        />
      </div>

      {loading ? (
        <div className="text-slate-500">Loading jobs…</div>
      ) : items.length > 0 ? (
        <ul className="space-y-4">
          {items.map((j) => (
            <li key={j.id} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {j.service}
                </span>
                <span className="text-sm text-slate-500">
                  {j.date || "No date"} {j.start && `• ${j.start}`}{j.end && `–${j.end}`}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{j.client || "Unassigned"}</div>
              <div className="mt-1 text-slate-600">{j.address || "No address on file"}</div>
              {j.notes && <div className="mt-2 text-sm text-slate-500">Notes: {j.notes}</div>}
            </li>
          ))}
        </ul>
      ) : hasNormalized ? (
        <div className="text-slate-500">No jobs match this filter.</div>
      ) : raw.length > 0 ? (
        // RAW FALLBACK: show whatever fields exist so something appears even if parsing changes
        <>
          <div className="text-amber-700 text-sm mb-2">
            Showing RAW data (parsing fallback). We’ll still see your jobs.
          </div>
          <ul className="space-y-3">
            {raw.map((r, i) => (
              <li key={r.id || i} className="bg-white rounded-xl border shadow-sm p-3">
                <pre className="text-xs overflow-auto">{JSON.stringify(r, null, 2)}</pre>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="text-slate-500">No jobs found.</div>
      )}
    </>
  );
}

/* ---------------------------- Customer View ---------------------------- */
function CustomerView({ loading, phone, setPhone, items }) {
  return (
    <>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Enter your phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g., last 4 digits"
          className="text-sm bg-white rounded-md px-3 py-2 border w-64"
          inputMode="numeric"
        />
        <div className="text-xs text-slate-500 mt-1">
          We’ll show the cleans linked to that phone number.
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : !phone.replace(/\D/g, "") ? (
        <div className="text-slate-500">Enter your phone number to view upcoming cleans.</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500">No upcoming cleans found for that phone.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((j) => (
            <li key={j.id} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {j.service}
                </span>
                <span className="text-sm text-slate-500">
                  {j.date || "No date"} {j.start && `• ${j.start}`}{j.end && `–${j.end}`}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{j.client || "Client"}</div>
              <div className="mt-1 text-slate-600">{j.address || "No address on file"}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
