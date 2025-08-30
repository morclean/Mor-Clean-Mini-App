// src/App.jsx
import React, { useEffect, useState } from "react";
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

/* ---------- small helpers ---------- */
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const clone = (obj) => JSON.parse(JSON.stringify(obj));
const isDeepRoom = (room) => /^Deep Clean —/i.test(room);

/* If a job title or notes includes "deep", we treat it as deep-clean by default */
const isDeepJob = (job) =>
  /deep/i.test(job?.title || "") || /deep/i.test(job?.notes || "");

/* ---------- CLEANER VIEW ---------- */
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [checked, setChecked] = useState({});   // { [jobId]: { [room]: { [task]: true } } }
  const [done, setDone] = useState({});         // { [jobId]: true }
  const [files, setFiles] = useState({});       // { [jobId]: FileList }
  const [clockIn, setClockIn] = useState(null);
  const [openRooms, setOpenRooms] = useState({}); // { [jobId]: { [room]: true } }
  const [showDeepOverride, setShowDeepOverride] = useState(false); // global toggle to reveal deep sections

  /* 1) Load jobs from Google Sheet via /api/jobs (today → +30d) */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const payload = await res.json();

        const events = (payload?.events || []).map((e) => ({
          id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
        }));

        const today = todayISO();
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const upcoming = events
          .filter((j) => j.date >= today && j.date <= in30)
          .sort((a, b) => a.date.localeCompare(b.date));

        setJobs(upcoming);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  /* 2) Auto-expand standard rooms when jobs load */
  useEffect(() => {
    if (!jobs.length) return;
    const init = {};
    for (const j of jobs) {
      const rooms = {};
      Object.keys(MASTER_CHECKLIST).forEach((room) => {
        if (!isDeepRoom(room)) rooms[room] = true; // standard rooms open by default
      });
      init[j.id] = rooms;
    }
    setOpenRooms(init);
  }, [jobs]);

  /* 3) Load any saved progress (checked boxes) from Supabase when jobs load */
  useEffect(() => {
    if (!jobs.length) return;
    (async () => {
      try {
        const keys = jobs.map((j) => j.id);
        const { data, error } = await supabase
          .from("progress")
          .select("job_key, checklist, done")
          .in("job_key", keys);

        if (!error && Array.isArray(data)) {
          const nextChecked = {};
          const nextDone = {};
          data.forEach((row) => {
            nextChecked[row.job_key] = row.checklist || {};
            if (row.done) nextDone[row.job_key] = true;
          });
          setChecked((prev) => ({ ...prev, ...nextChecked }));
          setDone((prev) => ({ ...prev, ...nextDone }));
        }
      } catch (e) {
        console.error("load progress error", e);
      }
    })();
  }, [jobs]);

  /* expand / collapse helpers */
  const toggleRoom = (jobId, room) => {
    setOpenRooms((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], [room]: !prev[jobId]?.[room] },
    }));
  };
  const setAllRoomsOpen = (jobId, open) => {
    const next = {};
    Object.keys(MASTER_CHECKLIST).forEach((room) => {
      // respect deep toggle: only include deep if override is on OR job is deep
      if (showDeepOverride || isDeepJob(jobs.find((j) => j.id === jobId)) || !isDeepRoom(room)) {
        next[room] = open;
      }
    });
    setOpenRooms((prev) => ({ ...prev, [jobId]: next }));
  };

  /* Persisted toggle */
  const toggleTask = async (jobId, room, task) => {
    const newChecked = (() => {
      const next = clone(checked);
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    })();

    setChecked(newChecked);

    try {
      await supabase.from("progress").upsert({
        job_key: jobId,
        checklist: newChecked[jobId],
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Error saving progress:", err);
    }
  };

  /* Photo input handler */
  const onFiles = (jobId, list) =>
    setFiles((prev) => ({ ...prev, [jobId]: list }));

  /* Complete Job: uploads photos → storage/photos, writes to completions, marks done in progress */
  async function completeJob(job) {
    const uploaded = [];
    const list = files[job.id] || [];
    for (const file of list) {
      const key = `${job.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(key, file, { upsert: true });
      if (!upErr) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("photos").getPublicUrl(key);
        uploaded.push(publicUrl);
      } else {
        console.error(upErr);
      }
    }

    // write to completions
    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      photos: uploaded,
      cleaner_name: "MOR Cleaner",
    });
    if (insErr) {
      console.error(insErr);
      alert("Error saving completion");
      return;
    }

    // mark as done in progress
    await supabase.from("progress").upsert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      done: true,
      updated_at: new Date().toISOString(),
    });

    setDone((d) => ({ ...d, [job.id]: true }));
  }

  if (!jobs.length) {
    return (
      <p className="text-sm text-slate-500">
        No upcoming jobs found. Check your Google Sheet dates (today or later).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shift + Today's Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 shadow-sm border">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold text-emerald-900">Shift</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {!clockIn ? (
              <button
                onClick={() => setClockIn(Date.now())}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm">
                  Clocked in at <strong>{fmtTime(clockIn)}</strong>
                </span>
                <button
                  onClick={() => setClockIn(null)}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white shadow-sm border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold">Today's Jobs</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">{todayISO()}</p>
        </div>
      </div>

      {/* Job Cards */}
      <div className="grid gap-5">
        {jobs.map((job) => {
          const deepThisJob = isDeepJob(job);
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-5 shadow-sm ${
                done[job.id] ? "bg-emerald-50/70" : "bg-white"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold">{job.title}</h4>
                  {job.client && (
                    <p className="text-emerald-900 font-medium">{job.client}</p>
                  )}
                  {job.address && (
                    <div className="text-sm flex items-center gap-2 mt-1 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>{job.address}</span>
                    </div>
                  )}
                  <div className="text-sm flex items-center gap-2 mt-1 text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>
                      {job.start}
                      {job.end ? `–${job.end}` : ""}
                    </span>
                  </div>
                  {job.notes && (
                    <p className="text-sm text-slate-600 mt-2">{job.notes}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs ${
                      done[job.id]
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {done[job.id] ? "Completed" : "In progress"}
                  </span>

                  {!done[job.id] && (
                    <button
                      onClick={() => completeJob(job)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
                    >
                      <Check className="w-4 h-4" /> Mark Complete
                    </button>
                  )}

                  {/* Controls: deep toggle + expand/collapse */}
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showDeepOverride || deepThisJob}
                        onChange={(e) => setShowDeepOverride(e.target.checked)}
                      />
                      Show deep-clean tasks
                    </label>
                    <button
                      type="button"
                      onClick={() => setAllRoomsOpen(job.id, true)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllRoomsOpen(job.id, false)}
                      className="text-xs px-2 py-1 border rounded"
                    >
                      Collapse all
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible room-by-room checklist */}
              <div className="mt-4 space-y-3">
                {Object.entries(MASTER_CHECKLIST)
                  .filter(([room]) => {
                    // hide deep rooms unless: job is deep OR override is on
                    if (isDeepRoom(room)) {
                      return deepThisJob || showDeepOverride;
                    }
                    return true;
                  })
                  .map(([room, tasks]) => {
                    const isOpen = !!openRooms[job.id]?.[room];
                    return (
                      <div key={room} className="border rounded-xl">
                        <button
                          type="button"
                          onClick={() => toggleRoom(job.id, room)}
                          className="w-full flex items-center justify-between px-4 py-3"
                        >
                          <span className="font-semibold">{room}</span>
                          {isOpen ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4">
                            <ul className="space-y-2">
                              {tasks.map((t) => (
                                <li key={t} className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={!!checked[job.id]?.[room]?.[t]}
                                    onChange={() =>
                                      toggleTask(job.id, room, t)
                                    }
                                  />
                                  <span
                                    className={
                                      checked[job.id]?.[room]?.[t]
                                        ? "line-through text-slate-400"
                                        : "text-slate-700"
                                    }
                                  >
                                    {t}
                                  </span>
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
              <div className="mt-4 p-3 border rounded-xl bg-slate-50">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Camera className="w-4 h-4" />
                  <span>Upload images (before/after)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onFiles(job.id, e.target.files)}
                  />
                </label>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- CUSTOMER VIEW ---------- */
/* Shows upcoming cleans (from Sheet) and past cleans (from Supabase completions),
   including photos attached by cleaners. */
function CustomerView() {
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      // upcoming from /api/jobs
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const { events } = await res.json();
        const list = (events || [])
          .map((e) => ({
            id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
            date: e.date,
            start: e.start || "",
            end: e.end || "",
            title: e.title || "Clean",
            client: e.client || "",
            address: e.address || "",
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setUpcoming(list);
      } catch (e) {
        console.error(e);
      }

      // past completions with photos
      const { data, error } = await supabase
        .from("completions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setHistory(data || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border p-5">
        <h3 className="font-semibold text-slate-900">Upcoming Cleans</h3>
        {upcoming.length === 0 && (
          <p className="text-sm text-slate-500 mt-2">
            No upcoming cleans found.
          </p>
        )}
        <div className="mt-3 divide-y">
          {upcoming.map((j) => (
            <div key={j.id} className="py-3">
              <div className="text-sm text-slate-600">{j.date}</div>
              <div className="font-medium">{j.client || j.title}</div>
              <div className="text-xs text-slate-500">
                {j.address} • {j.start}
                {j.end ? `–${j.end}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white border p-5">
        <h3 className="font-semibold text-slate-900">Past Cleans & Photos</h3>
        {history.length === 0 && (
          <p className="text-sm text-slate-500 mt-2">
            No completed cleans with photos yet.
          </p>
        )}
        <div className="mt-3 space-y-6">
          {history.map((c) => (
            <div key={c.id} className="border rounded-xl p-4">
              <div className="text-sm text-slate-600 mb-1">
                <strong>Job:</strong> {c.job_key}
              </div>
              {Array.isArray(c.photos) && c.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {c.photos.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="clean"
                      className="w-24 h-24 rounded object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border p-5 bg-emerald-50/60">
        <h3 className="font-semibold text-emerald-900">
          Add it to your phone like an app
        </h3>
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
  );
}

/* ---------- APP SHELL ---------- */
export default function App() {
  const [tab, setTab] = useState("cleaner");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">
                M.O.R. Clean Daytona
              </h1>
              <p className="text-xs text-emerald-800/70">
                Women-owned • Family-operated
              </p>
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
                  tab === k
                    ? "bg-emerald-600 text-white"
                    : "text-slate-700 hover:bg-slate-50"
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
          {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}


 
