// src/app.jsx
import React from "react";
import { motion } from "framer-motion";
import { supabase } from "./lib/supabase";
import { MASTER_CHECKLIST } from "./lib/checklist";
import {
  Check, Clock, Camera, Calendar, MapPin, LogIn, LogOut,
  ChevronDown, ChevronRight, Building2, Filter, Image as ImageIcon, Users
} from "lucide-react";

// helpers
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const inDaysISO = (n) => new Date(Date.now() + n*24*60*60*1000).toISOString().slice(0,10);

function useJobs() {
  const [all, setAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        // normalize & sort future first
        const events = (data?.events || []).map(e => ({
          id: e.id,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || e.service || "Clean",
          service: e.service || "",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          tasks: Array.isArray(e.tasks) ? e.tasks : String(e.tasks||"").split("|").filter(Boolean),
        }));
        const today = todayISO();
        const upcoming = events
          .filter(j => j.date >= today)
          .sort((a,b)=>a.date.localeCompare(b.date));
        setAll(upcoming);
      } catch (err) {
        console.error(err);
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { all, loading };
}

function CleanerView() {
  const { all: allJobs, loading } = useJobs();
  const [view, setView] = React.useState("today"); // today | week | all
  const [clockIn, setClockIn] = React.useState(null);
  const [expandedJob, setExpandedJob] = React.useState(null); // job.id or null
  const [openRooms, setOpenRooms] = React.useState({}); // { [jobId]: { [room]: true } }
  const [checked, setChecked] = React.useState({}); // { [jobId]: { [room]: { [task]: true } } }
  const [files, setFiles] = React.useState({}); // { [jobId]: FileList }
  const [done, setDone] = React.useState({}); // { [jobId]: true }

  // filter jobs by view
  const jobs = React.useMemo(() => {
    const t = todayISO();
    if (view === "today") return allJobs.filter(j => j.date === t);
    if (view === "week")  return allJobs.filter(j => j.date >= t && j.date <= inDaysISO(7));
    return allJobs;
  }, [allJobs, view]);

  const toggleRoom = (jobId, room) => {
    setOpenRooms(prev => ({ ...prev, [jobId]: { ...(prev[jobId]||{}), [room]: !prev[jobId]?.[room] }}));
  };

  const onFiles = (jobId, list) => setFiles(prev => ({ ...prev, [jobId]: list }));

  const toggleTask = (jobId, room, task) => {
    setChecked(prev => {
      const next = structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev || {}));
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

  async function completeJob(job) {
    const uploaded = [];
    const list = files[job.id] || [];
    for (const file of list) {
      const key = `${job.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(key);
        uploaded.push(publicUrl);
      }
    }
    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      photos: uploaded,
      cleaner_name: "MOR Cleaner",
      created_at: new Date().toISOString(),
    });
    if (insErr) {
      console.error(insErr);
      alert("Error saving completion");
      return;
    }
    setDone(d => ({ ...d, [job.id]: true }));
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 border">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700"/>
            <h3 className="font-semibold text-emerald-900">Shift</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {!clockIn ? (
              <button onClick={() => setClockIn(Date.now())}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
                <LogIn className="w-4 h-4"/> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm text-emerald-900/80">
                  Clocked in at <strong>{fmtTime(clockIn)}</strong>
                </span>
                <button onClick={() => setClockIn(null)}
                        className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2">
                  <LogOut className="w-4 h-4"/> Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700"/>
              <h3 className="font-semibold">Jobs</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setView("today")}
                      className={`px-3 py-1.5 rounded-xl text-sm border ${view==="today"?"bg-emerald-600 text-white border-emerald-600":"bg-white"}`}>Today</button>
              <button onClick={()=>setView("week")}
                      className={`px-3 py-1.5 rounded-xl text-sm border ${view==="week" ?"bg-emerald-600 text-white border-emerald-600":"bg-white"}`}>Week</button>
              <button onClick={()=>setView("all")}
                      className={`px-3 py-1.5 rounded-xl text-sm border ${view==="all"  ?"bg-emerald-600 text-white border-emerald-600":"bg-white"}`}>All</button>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">{todayISO()}</p>
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-slate-500">No jobs found for this filter.</p>
      ) : (
        <div className="grid gap-5">
          {jobs.map((job) => {
            const isOpen = expandedJob === job.id;
            return (
              <motion.div key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-5 shadow-sm ${done[job.id] ? "bg-emerald-50" : "bg-white"}`}>
                {/* summary row (click to expand) */}
                <button type="button" onClick={()=>setExpandedJob(isOpen ? null : job.id)}
                        className="w-full text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-800">{job.title || "Clean"}</h4>
                      <p className="text-emerald-900 font-medium">{job.client}</p>
                      <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-3">
                        {job.address ? (<span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4"/>{job.address}</span>) : null}
                        {(job.start || job.end) ? (<span className="inline-flex items-center gap-1"><Clock className="w-4 h-4"/>{job.start}{job.end?`–${job.end}`:""}</span>) : null}
                        {job.service && (<span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{job.service}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs ${done[job.id] ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {done[job.id] ? "Completed" : "In progress"}
                      </span>
                      {isOpen ? <ChevronDown className="w-5 h-5 text-slate-500"/> : <ChevronRight className="w-5 h-5 text-slate-500"/>}
                    </div>
                  </div>
                </button>

                {/* expanded content */}
                {isOpen && (
                  <div className="mt-4 space-y-5">
                    {/* Room groups (collapsed per room) */}
                    <div className="space-y-3">
                      {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
                        const roomOpen = !!openRooms[job.id]?.[room];
                        return (
                          <div key={room} className="border rounded-xl">
                            <button type="button"
                              onClick={() => {
                                setOpenRooms(prev => ({ ...prev, [job.id]: { ...(prev[job.id]||{}), [room]: !prev[job.id]?.[room] }}));
                              }}
                              className="w-full flex items-center justify-between px-4 py-3">
                              <span className="font-semibold">{room}</span>
                              {roomOpen ? <ChevronDown className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                            </button>
                            {roomOpen && (
                              <div className="px-4 pb-4">
                                <ul className="space-y-2">
                                  {tasks.map((t) => (
                                    <li key={t} className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={!!checked[job.id]?.[room]?.[t]}
                                        onChange={() => toggleTask(job.id, room, t)}
                                      />
                                      <span className={checked[job.id]?.[room]?.[t] ? "line-through text-slate-400" : "text-slate-700"}>{t}</span>
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
                    <div className="p-3 border rounded-xl bg-slate-50">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <ImageIcon className="w-4 h-4 text-slate-600"/>
                        <span>Upload images (before/after)</span>
                        <input type="file" accept="image/*" multiple className="hidden"
                               onChange={(e)=>onFiles(job.id, e.target.files)}/>
                      </label>
                    </div>

                    {/* Complete button */}
                    {!done[job.id] && (
                      <div className="flex justify-end">
                        <button onClick={()=>completeJob(job)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
                          <Check className="w-4 h-4"/> Mark Complete
                        </button>
                      </div>
                    )}
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

function CustomerView() {
  const [upcoming, setUpcoming] = React.useState([]);
  const [history, setHistory]   = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        const today = todayISO();
        const in60  = inDaysISO(60);
        const future = (data?.events || [])
          .filter(e => e.date >= today && e.date <= in60)
          .sort((a,b)=>a.date.localeCompare(b.date));
        setUpcoming(future);
      } catch (e) {
        console.error(e);
      }

      try {
        const { data: comps } = await supabase
          .from("completions")
          .select("*")
          .order("created_at", { ascending: false });
        setHistory(comps || []);
      } catch (e) {
        console.error(e);
        setHistory([]);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold mb-3">Upcoming Cleans</h3>
        {upcoming.length === 0 && <p className="text-sm text-slate-500">No future cleans found yet.</p>}
        {upcoming.map((j) => (
          <div key={j.id} className="border-b py-2 text-sm">
            <div className="font-medium">{j.date} — {j.title || j.service || "Clean"}</div>
            <div className="text-slate-600">
              {j.client}{j.address ? ` • ${j.address}` : ""}{(j.start || j.end) ? ` • ${j.start}${j.end?`–${j.end}`:""}` : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold mb-3">Past Cleans & Photos</h3>
        {history.length === 0 && <p className="text-sm text-slate-500">No completions saved yet.</p>}
        {history.map((c) => (
          <div key={c.id} className="border-b py-3">
            <div className="text-sm font-medium">{c.job_key}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(c.photos || []).map(url => (
                <img key={url} src={url} alt="clean" className="w-20 h-20 rounded object-cover"/>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = React.useState("cleaner"); // "cleaner" | "customer"

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6 border-b bg-white/80 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Swap the blob with your logo.png if present */}
            <img src="/logo.png" alt="MOR Logo" className="w-10 h-10 rounded-xl object-cover" onError={(e)=>{ e.currentTarget.src="/favicon.ico"; }}/>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">M.O.R. Clean Daytona</h1>
              <p className="text-xs text-emerald-800/70">Women-owned • Family-operated</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 bg-white border rounded-2xl p-1 shadow-sm">
            <button onClick={()=>setTab("cleaner")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab==="cleaner"?"bg-emerald-600 text-white":"text-slate-700 hover:bg-slate-50"}`}>
              Cleaner Portal
            </button>
            <button onClick={()=>setTab("customer")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab==="customer"?"bg-emerald-600 text-white":"text-slate-700 hover:bg-slate-50"}`}>
              Customer Portal
            </button>
          </nav>
        </div>
      </header>

      <main className="px-5 pb-16">
        <div className="max-w-5xl mx-auto grid gap-6">
          <section className="rounded-3xl bg-white border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{tab === "cleaner" ? "Cleaner Portal" : "Customer Portal"}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {tab === "cleaner"
                ? "Clock in, view jobs, check off tasks, and attach photos."
                : "See upcoming cleans and photos from past visits."}
            </p>
            {tab === "cleaner" ? <CleanerView/> : <CustomerView/>}
          </section>

          <section className="rounded-3xl border p-6 bg-emerald-50/60">
            <h3 className="font-semibold text-emerald-900">Add it to your phone like an app</h3>
            <ul className="list-disc ml-5 mt-2 text-sm text-emerald-900/90 space-y-1">
              <li><strong>iPhone:</strong> Share ▸ Add to Home Screen.</li>
              <li><strong>Android/Chrome:</strong> ⋮ menu ▸ Add to Home Screen.</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">© {new Date().getFullYear()} MOR – A Clean Living Company</footer>
    </div>
  );
}
