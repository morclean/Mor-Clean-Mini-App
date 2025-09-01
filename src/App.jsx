// src/app.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "./lib/supabase";
import { MASTER_CHECKLIST } from "./lib/checklist";
import {
  Check,
  Clock,
  Camera,
  Calendar,
  MapPin,
  LogIn,
  LogOut,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Filter,
  Search,
} from "lucide-react";

// ---------- helpers ----------
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const toId = (j) =>
  `${j.date || ""}-${String(j.client || "").replace(/\s+/g, "_")}-${String(j.service_type || j.title || "Clean").replace(/\s+/g, "_")}`;

// Normalize/pretty service names
function prettyService(raw) {
  if (!raw) return "Standard clean";
  const s = String(raw).toLowerCase();
  if (s.includes("air") || s.includes("turnover")) return "Airbnb turnover";
  if (s.includes("deep")) return "Deep clean";
  if (s.includes("post") && s.includes("construct")) return "Post-construction clean";
  if (s.includes("move") && (s.includes("out") || s.includes("in"))) return "Move-in/Move-out";
  if (s.includes("office") || s.includes("commercial")) return "Small office / Commercial";
  if (s.includes("real estate") || s.includes("listing")) return "Real estate listing prep";
  if (s.includes("one") && s.includes("time")) return "One-time cleaning";
  if (s.includes("standard") || s.includes("maint")) return "Standard maintenance";
  return raw; // fallback to whatever it is
}

// Return which checklist to use based on service type
function checklistFor(serviceType) {
  // You gave a single MASTER_CHECKLIST with all rooms (great).
  // For now we show ALL rooms for any clean so nothing is missing.
  // If you later want “service-specific rooms only”, we can filter here.
  return MASTER_CHECKLIST;
}

// ---------- CleanerView ----------
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [scope, setScope] = useState("today"); // today | week | all
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState({}); // { [jobId]: { [room]: { [task]: true } } }
  const [openCard, setOpenCard] = useState(null); // which job panel is open
  const [openRooms, setOpenRooms] = useState({}); // { [jobId]: { [room]: bool } }
  const [clockIn, setClockIn] = useState(null);
  const [files, setFiles] = useState({}); // { [jobId]: { before: FileList, after: FileList } }
  const [done, setDone] = useState({});   // { [jobId]: true }

  // Load jobs from published Google Sheet via /api/jobs
  // (must have NEXT_PUBLIC_JOBS_CSV_URL set inside pages/api/jobs.js if you use the CSV path)
  const [loadInfo, setLoadInfo] = useState({ apiCount: 0, normalizedCount: 0, todayCount: 0, error: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();

        const ev = Array.isArray(data?.events) ? data.events : [];

        // normalize to what we need
        const normalized = ev.map((e) => {
          const obj = {
            id: toId(e),
            date: e.date || "",
            start: e.start || "",
            end: e.end || "",
            client: e.client || "",
            service_type: e.service_type || e.title || "Standard clean",
            address: e.address || "",
            notes: e.notes || "",
            client_phone: e.client_phone || "",
            job_id: e.job_id || "",
          };
          return obj;
        });

        const today = todayISO();
        const thisMonday = new Date();
        const day = thisMonday.getDay(); // 0 Sun..6 Sat
        const diff = (day + 6) % 7; // days since Monday
        thisMonday.setDate(thisMonday.getDate() - diff);
        const mondayISO = thisMonday.toISOString().slice(0, 10);
        const sunday = new Date(thisMonday);
        sunday.setDate(thisMonday.getDate() + 6);
        const sundayISO = sunday.toISOString().slice(0, 10);

        const scoped = normalized.filter((j) => {
          if (scope === "today") return j.date === today;
          if (scope === "week") return j.date >= mondayISO && j.date <= sundayISO;
          return true; // all
        });

        // filter by search
        const q = query.trim().toLowerCase();
        const searched = q
          ? scoped.filter((j) =>
              [j.client, j.address, j.notes, j.service_type, j.client_phone]
                .join(" ")
                .toLowerCase()
                .includes(q)
            )
          : scoped;

        // sort by date/time
        searched.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

        // Show them
        setJobs(searched);

        // default open the first card for convenience
        setOpenCard((prev) => prev ?? (searched[0]?.id || null));

        // initialize all rooms to CLOSED for each job
        const openInit = {};
        for (const j of searched) {
          const rooms = {};
          Object.keys(checklistFor(j.service_type)).forEach((room) => {
            rooms[room] = false; // collapsed by default
          });
          openInit[j.id] = rooms;
        }
        setOpenRooms(openInit);

        setLoadInfo({
          apiCount: ev.length,
          normalizedCount: normalized.length,
          todayCount: normalized.filter((j) => j.date === today).length,
          error: "",
        });
      } catch (err) {
        setJobs([]);
        setLoadInfo((x) => ({ ...x, error: String(err.message || err) }));
      }
    })();
  }, [scope, query]);

  const toggleRoom = (jobId, room) => {
    setOpenRooms((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], [room]: !prev[jobId]?.[room] },
    }));
  };

  const onFiles = (jobId, lane, list) => {
    setFiles((prev) => ({
      ...prev,
      [jobId]: { ...(prev[jobId] || {}), [lane]: list },
    }));
  };

  const toggleTask = (jobId, room, task) => {
    setChecked((prev) => {
      const next = structuredClone(prev);
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

  async function completeJob(job) {
    const uploaded = { before: [], after: [] };
    const lanes = ["before", "after"];
    for (const lane of lanes) {
      const list = files[job.id]?.[lane] || [];
      for (const file of list) {
        const key = `${job.id}/${lane}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
        if (!upErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from("photos").getPublicUrl(key);
          uploaded[lane].push(publicUrl);
        }
      }
    }

    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      client: job.client,
      service_type: prettyService(job.service_type),
      address: job.address,
      checklist: checked[job.id] || {},
      photos_before: uploaded.before,
      photos_after: uploaded.after,
      cleaner_name: "MOR Cleaner",
      client_phone: job.client_phone || "",
    });
    if (insErr) {
      console.error(insErr);
      alert("Error saving completion");
      return;
    }

    setDone((d) => ({ ...d, [job.id]: true }));
    alert("Job marked complete ✅");
  }

  return (
    <div className="space-y-6">
      {/* tiny debug strip so you can see API status if something breaks */}
      <div className="text-[11px] text-slate-500">
        API events: {loadInfo.apiCount} • normalized: {loadInfo.normalizedCount} • today: {loadInfo.todayCount} •
        {loadInfo.error ? ` error: ${loadInfo.error}` : " ok"}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-white border rounded-xl overflow-hidden flex items-center">
          {[
            { k: "today", label: "Today" },
            { k: "week", label: "This Week" },
            { k: "all", label: "All" },
          ].map((o) => (
            <button
              key={o.k}
              onClick={() => setScope(o.k)}
              className={`px-3 py-2 text-sm ${scope === o.k ? "bg-emerald-600 text-white" : "text-slate-700"}`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            className="pl-7 pr-3 py-2 text-sm border rounded-xl"
            placeholder="Search client, address, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!clockIn ? (
            <button
              onClick={() => setClockIn(Date.now())}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Clock In
            </button>
          ) : (
            <>
              <span className="text-sm text-slate-600">
                Clocked in at <strong>{fmtTime(clockIn)}</strong>
              </span>
              <button
                onClick={() => setClockIn(null)}
                className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Clock Out
              </button>
            </>
          )}
        </div>
      </div>

      {/* Jobs list */}
      {!jobs.length ? (
        <p className="text-sm text-slate-500">No jobs found.</p>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const open = openCard === job.id;
            const service = prettyService(job.service_type);
            const list = checklistFor(service);
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0.85, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border ${done[job.id] ? "bg-emerald-50" : "bg-white"} overflow-hidden`}
              >
                {/* Card header (click to expand) */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
                  onClick={() => setOpenCard(open ? null : job.id)}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {service}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {job.date} {job.start ? `• ${job.start}${job.end ? `–${job.end}` : ""}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 truncate">
                      {/* Show CLIENT NAME here – no more ugly code */}
                      {job.client || "Unnamed client"}
                    </div>
                    <div className="text-sm text-slate-600 mt-0.5 flex items-center gap-2 truncate">
                      <MapPin className="w-4 h-4" />
                      {job.address ? job.address : "No address on file"}
                    </div>
                  </div>
                  <div className="pt-1">
                    {open ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                  </div>
                </button>

                {/* Card body */}
                {open && (
                  <div className="px-4 pb-4">
                    {job.notes ? (
                      <p className="text-sm text-slate-700 mb-3">
                        <span className="font-medium">Notes: </span>
                        {job.notes}
                      </p>
                    ) : null}

                    {/* Rooms */}
                    <div className="space-y-3">
                      {Object.entries(list).map(([room, tasks]) => {
                        const rOpen = !!openRooms[job.id]?.[room];
                        return (
                          <div key={room} className="border rounded-xl">
                            <button
                              type="button"
                              onClick={() => toggleRoom(job.id, room)}
                              className="w-full flex items-center justify-between px-4 py-3"
                            >
                              <span className="font-semibold">{room}</span>
                              {rOpen ? (
                                <ChevronDown className="w-5 h-5 text-slate-500" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-slate-500" />
                              )}
                            </button>

                            {rOpen && (
                              <div className="px-4 pb-3">
                                <ul className="space-y-2">
                                  {tasks.map((t) => (
                                    <li key={t} className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4"
                                        checked={!!checked[job.id]?.[room]?.[t]}
                                        onChange={() => toggleTask(job.id, room, t)}
                                      />
                                      <span className={checked[job.id]?.[room]?.[t] ? "line-through text-slate-400" : ""}>{t}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Photos */}
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <div className="text-sm font-medium mb-1">Before photos (3 angles / room)</div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                          <span>Upload before</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => onFiles(job.id, "before", e.target.files)}
                          />
                        </label>
                      </div>
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <div className="text-sm font-medium mb-1">After photos (3 angles / room)</div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <ImageIcon className="w-4 h-4 text-slate-600" />
                          <span>Upload after</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => onFiles(job.id, "after", e.target.files)}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Complete */}
                    <div className="mt-4 flex items-center justify-end">
                      {!done[job.id] && (
                        <button
                          onClick={() => completeJob(job)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- CustomerView (unchanged behavior you liked) ----------
function CustomerView() {
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        setUpcoming(data?.events || []);
      } catch (e) {
        console.error(e);
      }

      const { data: comps } = await supabase.from("completions").select("*").order("created_at", { ascending: false });
      setHistory(comps || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Upcoming Cleans</h3>
        {upcoming.map((j) => (
          <div key={`${j.date}-${j.client}-${j.title}`} className="border-b py-2">
            <strong>{j.date}</strong> – {j.client} ({prettyService(j.service_type || j.title)})
            {j.address ? <> • {j.address}</> : null}
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Past Cleans (photos)</h3>
        {history.map((c) => (
          <div key={c.id} className="border-b py-3">
            <div className="text-sm text-slate-600">
              {c.client} • {prettyService(c.service_type)} • {c.address || "No address"}
            </div>
            <div className="mt-2">
              <div className="text-xs font-medium text-slate-500 mb-1">Before</div>
              <div className="flex flex-wrap gap-2">
                {(c.photos_before || []).map((url) => (
                  <img key={url} src={url} alt="before" className="w-20 h-20 rounded object-cover" />
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs font-medium text-slate-500 mb-1">After</div>
              <div className="flex flex-wrap gap-2">
                {(c.photos_after || []).map((url) => (
                  <img key={url} src={url} alt="after" className="w-20 h-20 rounded object-cover" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- App shell ----------
export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MOR" className="w-10 h-10 rounded-2xl bg-emerald-600 object-cover" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">M.O.R. Clean Daytona</h1>
              <p className="text-xs text-emerald-800/70">Women-owned • Family-operated</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 bg-white border rounded-2xl p-1 shadow-sm">
            {[
              { k: "cleaner", label: "Cleaner Portal" },
              { k: "customer", label: "Customer Portal" },
            ].map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  tab === k ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-5 pb-16">
        <div className="max-w-5xl mx-auto grid gap-6">
          <section className="rounded-3xl bg-white border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{tab === "cleaner" ? "Cleaner Portal" : "Customer Portal"}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {tab === "cleaner"
                ? "Clock in, view jobs, open room-by-room checklist, and attach before/after photos."
                : "View upcoming cleans and photos from completed visits."}
            </p>
            {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
          </section>

          <section className="rounded-3xl border p-6 bg-emerald-50/60">
            <h3 className="font-semibold text-emerald-900">Add it to your phone like an app</h3>
            <ul className="list-disc ml-5 mt-2 text-sm text-emerald-900/90 space-y-1">
              <li>
                <strong>iPhone:</strong> Share ▸ Add to Home Screen.
              </li>
              <li>
                <strong>Android/Chrome:</strong> ⋮ menu ▸ Add to Home Screen.
              </li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">© {new Date().getFullYear()} MOR – A Clean Living Company</footer>
    </div>
  );
}
