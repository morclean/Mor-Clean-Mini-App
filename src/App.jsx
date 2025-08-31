import React, { useEffect, useMemo, useState } from "react";

// with Vite, files in /public are available at the root url:
const logoUrl = "/logo.png";

// tiny helpers
const toLocalTime = (t) =>
  t ? new Date(`1970-01-01T${t}:00`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockIn, setClockIn] = useState(null);
  const [expanded, setExpanded] = useState({}); // jobId -> boolean
  const [filter, setFilter] = useState("today"); // "today" | "week" | "all"
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        // Normalize a bit so UI is stable
        const normalized = (Array.isArray(data) ? data : data?.events || []).map((j, i) => ({
          id:
            j.id ||
            `${j.date || ""}_${(j.client || "").replace(/\s+/g, "_")}_${(j.title || "Clean").replace(/\s+/g, "_")}_${i}`,
          date: j.date || "",
          start: j.start || "",
          end: j.end || "",
          title: j.title || "Clean",
          client: j.client || "",
          address: j.address || "",
          notes: j.notes || "",
          service_type: j.service_type || j.title || "Clean",
        }));
        setJobs(normalized);
      } catch (e) {
        console.error(e);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // filters
  const filtered = useMemo(() => {
    const t = todayISO();
    const weekFromToday = new Date();
    weekFromToday.setDate(weekFromToday.getDate() + 7);
    const weekMax = weekFromToday.toISOString().slice(0, 10);

    return jobs
      .filter((j) => {
        if (filter === "today") return j.date === t;
        if (filter === "week") return j.date >= t && j.date <= weekMax;
        return true; // all
      })
      .filter((j) => {
        const hay = `${j.client} ${j.title} ${j.address} ${j.notes}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
  }, [jobs, filter, q]);

  const toggle = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between bg-white shadow p-4">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="MOR Clean Logo" className="h-10 w-10 rounded-full" />
          <h1 className="text-xl font-bold text-gray-800">M.O.R. Clean Daytona</h1>
        </div>
        <div className="flex items-center gap-4">
          {!clockIn ? (
            <button
              className="px-3 py-1 bg-emerald-600 text-white rounded"
              onClick={() => setClockIn(Date.now())}
            >
              Clock In
            </button>
          ) : (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded">
              Clocked in at{" "}
              {new Date(clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <span className="text-gray-600">Today: {new Date().toLocaleDateString()}</span>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {["today", "week", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full border text-sm ${
                filter === f ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700"
              }`}
            >
              {f === "today" ? "Today" : f === "week" ? "This Week" : "All"}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, address, notes…"
            className="ml-auto w-full sm:w-72 px-3 py-2 border rounded"
          />
        </div>
      </div>

      {/* Job list */}
      <main className="max-w-5xl mx-auto px-4 pb-10">
        <h2 className="text-lg font-semibold mt-6 mb-3">Assigned Jobs</h2>

        {loading ? (
          <p className="text-gray-500">Loading jobs…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No jobs found for this view.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((j) => {
              const open = !!expanded[j.id];
              return (
                <li key={j.id} className="bg-white border rounded-lg shadow-sm">
                  {/* Card header (always visible) */}
                  <button
                    onClick={() => toggle(j.id)}
                    className="w-full flex items-start justify-between gap-3 p-4 text-left"
                  >
                    <div>
                      <div className="text-sm text-gray-500">
                        {j.date || "—"} • {toLocalTime(j.start)}{j.end ? `–${toLocalTime(j.end)}` : ""}
                      </div>
                      <div className="font-semibold text-gray-900">
                        {j.title || j.service_type || "Clean"} • {j.client || "Unnamed"}
                      </div>
                      {/* subtle service line under title */}
                      <div className="text-xs text-gray-500 truncate">
                        {j.service_type || ""}
                      </div>
                    </div>
                    <span className="text-gray-400 text-xl leading-none">{open ? "▾" : "▸"}</span>
                  </button>

                  {/* Collapsible details */}
                  {open && (
                    <div className="px-4 pb-4">
                      {j.address && <div className="text-sm text-gray-700 mb-1">{j.address}</div>}
                      {j.notes && <div className="text-sm text-gray-600 mb-3">{j.notes}</div>}

                      {/* Room-by-room checklist would render here if you want; keeping this lean */}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                        <span className="px-2 py-1 rounded bg-gray-100">Client: {j.client || "—"}</span>
                        <span className="px-2 py-1 rounded bg-gray-100">
                          Time: {toLocalTime(j.start)}
                          {j.end ? `–${toLocalTime(j.end)}` : ""}
                        </span>
                        {j.service_type && (
                          <span className="px-2 py-1 rounded bg-gray-100">Type: {j.service_type}</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
