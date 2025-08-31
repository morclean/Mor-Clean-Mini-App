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
} from "lucide-react";

const fmtTime = (t) =>
  t ? new Date(`1970-01-01T${t}:00`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
const todayISO = () => new Date().toISOString().slice(0, 10);

function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [openRooms, setOpenRooms] = useState({});
  const [checked, setChecked] = useState({});
  const [files, setFiles] = useState({});
  const [done, setDone] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        const events = (data?.events || []).map((e) => ({
          id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          service_type: e.service_type || "",
        }));
        const today = todayISO();
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        const upcoming = events
          .filter((j) => j.date >= today && j.date <= in30)
          .sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
        setJobs(upcoming);
      } catch (e) {
        console.error(e);
        setJobs([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!jobs.length) return;
    const init = {};
    for (const j of jobs) init[j.id] = {};
    setOpenRooms(init);
  }, [jobs]);

  const toggleCard = (id) => setExpanded((x) => ({ ...x, [id]: !x[id] }));
  const toggleRoom = (id, room) => setOpenRooms((prev) => ({ ...prev, [id]: { ...prev[id], [room]: !prev[id]?.[room] } }));
  const onFiles = (id, list) => setFiles((prev) => ({ ...prev, [id]: list }));
  const toggleTask = (id, room, t) =>
    setChecked((prev) => {
      const next = structuredClone(prev);
      if (!next[id]) next[id] = {};
      if (!next[id][room]) next[id][room] = {};
      next[id][room][t] = !next[id][room][t];
      return next;
    });

  async function completeJob(job) {
    const uploaded = [];
    const list = files[job.id] || [];
    for (const file of list) {
      const key = `${job.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(key);
        uploaded.push(publicUrl);
      }
    }
    const { error } = await supabase.from("completions").insert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      photos: uploaded,
      cleaner_name: "MOR Cleaner",
    });
    if (error) {
      console.error(error);
      alert("Error saving completion");
      return;
    }
    setDone((d) => ({ ...d, [job.id]: true }));
  }

  const pills = useMemo(() => {
    const base = ["all", "today"];
    const types = Array.from(new Set(jobs.map((j) => j.service_type).filter(Boolean)));
    const preferred = ["Residential", "Airbnb", "Deep Clean"];
    const ordered = [...preferred.filter((p) => types.includes(p)), ...types.filter((t) => !preferred.includes(t))];
    return [...base, ...ordered];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "today") {
      const t = todayISO();
      return jobs.filter((j) => j.date === t);
    }
    return jobs.filter((j) => (j.service_type || "").toLowerCase() === filter.toLowerCase());
  }, [jobs, filter]);

  return (
    <div className="space-y-6">
      {/* Shift */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 border">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold">Shift</h3>
          </div>
          <div className="mt-3 flex gap-3">
            {!clockIn ? (
              <button onClick={() => setClockIn(Date.now())} className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm">
                  Clocked in at {new Date(clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button onClick={() => setClockIn(null)} className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
              </>
            )}
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white border">
          <Calendar className="w-5 h-5 text-emerald-700" />
          <h3 className="font-semibold">Today's Jobs</h3>
          <p className="text-sm text-slate-500">{todayISO()}</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 py-1.5 rounded-full border text-sm ${
              filter === p ? "bg-emerald-600 text-white" : "bg-white text-slate-700"
            }`}
          >
            {p === "all" ? "All" : p === "today" ? "Today" : p}
          </button>
        ))}
      </div>

      {/* Jobs */}
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const isOpen = !!expanded[job.id];
          return (
            <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border shadow-sm overflow-hidden ${done[job.id] ? "bg-emerald-50" : "bg-white"}`}>
              <button onClick={() => toggleCard(job.id)} className="w-full text-left p-4 flex justify-between">
                <div>
                  <div className="text-xs text-slate-500">{job.service_type || "Clean"} • {job.date} • {fmtTime(job.start)}–{fmtTime(job.end)}</div>
                  <div className="font-semibold">{job.client} — {job.title}</div>
                  <div className="text-sm text-slate-600 flex items-center gap-1"><MapPin className="w-4 h-4" />{job.address}</div>
                </div>
                {isOpen ? <ChevronDown /> : <ChevronRight />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  <p>{job.notes}</p>
                  <p className="text-sm">Phone: {job.client_phone}</p>
                  {/* Checklist */}
                  {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
                    const roomOpen = !!openRooms[job.id]?.[room];
                    return (
                      <div key={room} className="border rounded-xl my-2">
                        <button onClick={() => toggleRoom(job.id, room)} className="w-full px-3 py-2 flex justify-between font-semibold">
                          {room} {roomOpen ? <ChevronDown /> : <ChevronRight />}
                        </button>
                        {roomOpen && (
                          <ul className="px-3 pb-2">
                            {tasks.map((t) => (
                              <li key={t}><input type="checkbox" checked={!!checked[job.id]?.[room]?.[t]} onChange={() => toggleTask(job.id, room, t)} /> {t}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  {/* Upload + Complete */}
                  <div className="mt-3">
                    <input type="file" multiple onChange={(e) => onFiles(job.id, e.target.files)} />
                  </div>
                  {!done[job.id] && <button onClick={() => completeJob(job)} className="mt-3 px-3 py-2 bg-emerald-600 text-white rounded">Mark Complete</button>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function CustomerView() {
  return <div className="p-4">Customer Portal (coming soon)</div>;
}

export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <header className="px-5 py-6 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MOR Logo" className="w-10 h-10 rounded-full border" />
            <h1 className="text-xl font-bold text-emerald-900">M.O.R. Clean Daytona</h1>
          </div>
          <nav className="flex gap-2">
            <button onClick={() => setTab("cleaner")} className={`px-4 py-2 rounded-xl ${tab === "cleaner" ? "bg-emerald-600 text-white" : "bg-white border"}`}>Cleaner Portal</button>
            <button onClick={() => setTab("customer")} className={`px-4 py-2 rounded-xl ${tab === "customer" ? "bg-emerald-600 text-white" : "bg-white border"}`}>Customer Portal</button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-6">{tab === "cleaner" ? <CleanerView /> : <CustomerView />}</main>
      <footer className="text-center text-xs text-slate-500 py-6">© {new Date().getFullYear()} MOR – A Clean Living Company</footer>
    </div>
  );
}
