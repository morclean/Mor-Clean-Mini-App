import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check, Clock, Camera, Calendar, MapPin, LogIn, LogOut,
  ChevronDown, ChevronRight, Search
} from "lucide-react";
import { MASTER_CHECKLIST } from "./lib/checklist";

// ---------- tiny helpers ----------
const isoToday = () => new Date().toISOString().slice(0,10);
const startOfWeek = () => {
  const d = new Date(); const day = d.getDay(); const diff = d.getDate()-day+(day===0?-6:1);
  return new Date(d.setDate(diff)).toISOString().slice(0,10);
};
const endOfWeek = () => { const d = new Date(startOfWeek()); d.setDate(d.getDate()+6); return d.toISOString().slice(0,10); };
const fmtDate = (iso) => new Date(iso).toLocaleDateString([], {month:"short", day:"numeric", year:"numeric"});

const jobId = (j) => `${j.date}-${(j.client||"").slice(0,40)}-${(j.title||"Clean").slice(0,40)}`;

// ---------- CLEANER ----------
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [jobOpen, setJobOpen] = useState({});       // <— job-level accordion
  const [roomOpen, setRoomOpen] = useState({});
  const [checked, setChecked] = useState({});
  const [files, setFiles] = useState({});
  const [done, setDone] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [filter, setFilter] = useState("today");
  const [query, setQuery] = useState("");

  // load jobs from /api/jobs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const { events = [] } = await res.json();

        const mapped = events.map((e) => ({
          id: jobId(e),
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
        }));

        const today = isoToday();
        const in30 = new Date(Date.now() + 30*86400000).toISOString().slice(0,10);

        const upcoming = mapped
          .filter(j => j.date >= today && j.date <= in30)
          .sort((a,b) => a.date.localeCompare(b.date) || (a.start||"").localeCompare(b.start||""));

        // defaults: job collapsed, rooms collapsed
        const jo = {}; const ro = {};
        for (const j of upcoming) {
          jo[j.id] = false;
          ro[j.id] = Object.fromEntries(Object.keys(MASTER_CHECKLIST).map(r => [r, false]));
        }

        setJobs(upcoming);
        setJobOpen(jo);
        setRoomOpen(ro);
      } catch (e) {
        console.error(e);
        setJobs([]);
      }
    })();
  }, []);

  const visible = useMemo(() => {
    let list = [...jobs];
    if (filter === "today") list = list.filter(j => j.date === isoToday());
    if (filter === "week")  list = list.filter(j => j.date >= startOfWeek() && j.date <= endOfWeek());
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(j =>
        (j.title||"").toLowerCase().includes(q) ||
        (j.client||"").toLowerCase().includes(q) ||
        (j.address||"").toLowerCase().includes(q) ||
        (j.notes||"").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, query]);

  const toggleJob = (id) =>
    setJobOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleRoom = (jid, room) =>
    setRoomOpen(prev => ({ ...prev, [jid]: { ...prev[jid], [room]: !prev[jid]?.[room] } }));

  const toggleTask = (jid, room, task) =>
    setChecked(prev => {
      const next = structuredClone(prev);
      if (!next[jid]) next[jid] = {};
      if (!next[jid][room]) next[jid][room] = {};
      next[jid][room][task] = !next[jid][room][task];
      return next;
    });

  const onFiles = (jid, list) => setFiles(p => ({ ...p, [jid]: list }));

  const completeJob = async (job) => {
    // Placeholder; wire to Supabase later
    console.log("Complete job", job, checked[job.id], files[job.id]);
    setDone(d => ({ ...d, [job.id]: true }));
  };

  return (
    <div className="space-y-6">
      {/* Filters + search */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 border">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold">Shift</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {!clockIn ? (
              <button onClick={() => setClockIn(Date.now())} className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm">
                  Clocked in at{" "}
                  <strong>{new Date(clockIn).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</strong>
                </span>
                <button onClick={() => setClockIn(null)} className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {["today","week","all"].map(k => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${filter===k ? "bg-emerald-600 text-white border-emerald-600":"bg-white"}`}>
                  {k==="today"?"Today":k==="week"?"This Week":"All"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search client, address, notes…"
                     className="pl-8 pr-3 py-2 rounded-lg border text-sm w-56" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">v9 • {isoToday()}</p>
        </div>
      </div>

      {/* Jobs */}
      <div className="grid gap-5">
        {visible.length === 0 && <p className="text-sm text-slate-500">No jobs.</p>}

        {visible.map(job => {
          const open = !!jobOpen[job.id];
          const rooms = roomOpen[job.id] || {};
          return (
            <motion.div key={job.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              className={`rounded-2xl border p-5 shadow-sm ${done[job.id]?"bg-emerald-50":"bg-white"}`}>
              {/* Header row (NO internal ID shown) */}
              <button onClick={() => toggleJob(job.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">
                      {job.title || "Cleaning"} • <span className="text-emerald-900">{job.client}</span>
                    </h4>
                    <div className="text-sm flex gap-2 mt-1 text-slate-700">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {fmtDate(job.date)}
                        {job.start ? ` • ${job.start}${job.end?`–${job.end}`:""}` : ""}
                      </span>
                    </div>
                    {job.address && (
                      <div className="text-sm flex gap-2 mt-1 text-slate-700">
                        <MapPin className="w-4 h-4" />
                        <span>{job.address}</span>
                      </div>
                    )}
                  </div>
                  {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Body */}
              {open && (
                <div className="mt-4 space-y-3">
                  {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
                    const rOpen = !!rooms[room];
                    return (
                      <div key={room} className="border rounded-xl">
                        <button type="button" onClick={() => toggleRoom(job.id, room)}
                          className="w-full flex items-center justify-between px-4 py-3">
                          <span className="font-semibold">{room}</span>
                          {rOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                        {rOpen && (
                          <div className="px-4 pb-4">
                            <ul className="space-y-2">
                              {tasks.map((t) => (
                                <li key={t} className="flex items-start gap-3">
                                  <input type="checkbox" className="mt-1"
                                         checked={!!checked[job.id]?.[room]?.[t]}
                                         onChange={() => toggleTask(job.id, room, t)} />
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Photos */}
                  <div className="mt-2 p-3 border rounded-xl bg-slate-50">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Camera className="w-4 h-4" />
                      <span>Upload before/after photos (3 angles per room)</span>
                      <input type="file" accept="image/*" multiple className="hidden"
                             onChange={(e)=>onFiles(job.id, e.target.files)} />
                    </label>
                  </div>

                  {/* Complete */}
                  <div className="flex justify-end">
                    {!done[job.id] && (
                      <button onClick={() => completeJob(job)}
                              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2">
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
    </div>
  );
}

// ---------- APP SHELL ----------
export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <header className="px-5 py-6 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="M.O.R. Clean Daytona" className="w-10 h-10 rounded-full border" />
            <h1 className="text-xl font-bold text-emerald-900">M.O.R. Clean Daytona</h1>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => setTab("cleaner")}
              className={`px-4 py-2 rounded-xl ${tab==="cleaner"?"bg-emerald-600 text-white":"bg-white border"}`}>
              Cleaner Portal
            </button>
            <button onClick={() => setTab("customer")}
              className={`px-4 py-2 rounded-xl ${tab==="customer"?"bg-emerald-600 text-white":"bg-white border"}`}>
              Customer Portal
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        <CleanerView />
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}

