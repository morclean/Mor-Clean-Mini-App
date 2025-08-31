// src/App.jsx
import { useEffect, useMemo, useState } from "react";

/* -------------------------- date/time helpers -------------------------- */
const now = () => new Date();
const ymd = (d) => d.toISOString().slice(0, 10);

function parseTime(hhmm, baseDate) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(baseDate);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
function sameDay(a, b) {
  return ymd(a) === ymd(b);
}
function inThisWeek(d, base = now()) {
  const b = new Date(base);
  const dow = b.getDay(); // 0 Sun..6 Sat
  const start = new Date(b);
  start.setDate(b.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}
function labelServiceType(raw) {
  const t = (raw || "").toLowerCase();
  if (t.includes("air") || t.includes("turn")) return "Airbnb Turnover";
  if (t.includes("deep")) return "Deep Clean";
  if (t.includes("move")) return "Move-In/Out";
  if (t.includes("post") || t.includes("reno")) return "Post-Renovation";
  return "Standard Clean";
}

/* ------------------------------- App ----------------------------------- */
export default function App() {
  const [mode, setMode] = useState("cleaner"); // "cleaner" | "customer"
  const [tab, setTab] = useState("today");     // "today" | "week" | "all"
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");

  // Customer sign-in
  const [phone, setPhone] = useState("");
  const phoneDigits = phone.replace(/\D/g, "");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/jobs?ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        const events = Array.isArray(data?.events) ? data.events : [];

        const normalized = events.map((e, i) => {
          const dateObj = e.date ? new Date(e.date) : now();
          return {
            id: e.id || `row-${i}`,
            date: e.date || ymd(dateObj),
            start: e.start || "",
            end: e.end || "",
            client: (e.client || "").trim(),
            address: (e.address || "").trim(),
            notes: e.notes || "",
            client_phone: (e.client_phone || "").trim(),
            service: labelServiceType(e.title || e.service_type || ""),
            startDateTime: parseTime(e.start, dateObj) || dateObj,
          };
        });

        // sort by datetime
        normalized.sort((a, b) => a.startDateTime - b.startDateTime);

        setJobs(normalized);
        setLoading(false);

        // If "Today" would be empty, auto-fallback to "All" (first load)
        const todayCount = normalized.filter((j) => sameDay(new Date(j.date), now())).length;
        if (todayCount === 0) setTab("all");
      } catch (err) {
        console.error(err);
        setJobs([]);
        setLoading(false);
      }
    };
    load();
  }, []);

  /* -------------------- CLEANER: filter + search -------------------- */
  const cleanerList = useMemo(() => {
    let pool = jobs;
    if (tab === "today") {
      pool = pool.filter((j) => sameDay(new Date(j.date), now()));
    } else if (tab === "week") {
      pool = pool.filter((j) => inThisWeek(new Date(j.date)));
    }
    const term = query.trim().toLowerCase();
    if (!term) return pool;
    return pool.filter((j) =>
      `${j.client} ${j.address} ${j.service} ${j.notes}`.toLowerCase().includes(term)
    );
  }, [jobs, tab, query]);

  /* -------------------- CUSTOMER: phone filter ---------------------- */
  const customerList = useMemo(() => {
    if (!phoneDigits) return [];
    return jobs.filter((j) => (j.client_phone || "").replace(/\D/g, "").includes(phoneDigits));
  }, [jobs, phoneDigits]);

  /* ------------------------------- UI -------------------------------- */
  return (
    <div className="min-h-screen bg-emerald-50">
      {/* header with portal toggle */}
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

      <main className="mx-auto max-w-5xl px-4 py-6">
        {mode === "cleaner" ? (
          <CleanerView
            loading={loading}
            tab={tab}
            setTab={setTab}
            query={query}
            setQuery={setQuery}
            items={cleanerList}
          />
        ) : (
          <CustomerView
            loading={loading}
            phone={phone}
            setPhone={setPhone}
            items={customerList}
          />
        )}
        <div className="mt-8 text-xs text-slate-400">v10 • {ymd(now())}</div>
      </main>
    </div>
  );
}

/* --------------------------- Cleaner View --------------------------- */
function CleanerView({ loading, tab, setTab, query, setQuery, items }) {
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
      ) : items.length === 0 ? (
        <div className="text-slate-500">No jobs found for this view.</div>
      ) : (
        <ul className="space-y-4">
          {items.map((j) => (
            <li key={j.id} className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {j.service}
                </span>
                <span className="text-sm text-slate-500">
                  {j.date} {j.start && `• ${j.start}`}{j.end && `–${j.end}`}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{j.client || "Unassigned"}</div>
              <div className="mt-1 text-slate-600">{j.address || "No address on file"}</div>
              {j.notes && <div className="mt-2 text-sm text-slate-500">Notes: {j.notes}</div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -------------------------- Customer View -------------------------- */
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
                  {j.date} {j.start && `• ${j.start}`}{j.end && `–${j.end}`}
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold">{j.client}</div>
              <div className="mt-1 text-slate-600">{j.address || "No address on file"}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

