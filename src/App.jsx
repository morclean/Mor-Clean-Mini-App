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

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);

function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [checked, setChecked] = useState({});
  const [done, setDone] = useState({});
  const [files, setFiles] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [openRooms, setOpenRooms] = useState({});

  // load jobs from Google Sheet (/api/jobs)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();

        const events = (data?.events || []).map((e) => ({
          id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(
            e.title || "Clean"
          ).replace(/\s+/g, "_")}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
        }));

        const today = todayISO();
        const in30 = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString().slice(0, 10);
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

  const toggleTask = (jobId, room, task) => {
    setChecked((prev) => {
      const next = { ...prev };
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

  const toggleRoom = (jobId, room) => {
    setOpenRooms((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], [room]: !prev[jobId]?.[room] },
    }));
  };

  const onFiles = (jobId, list) =>
    setFiles((prev) => ({ ...prev, [jobId]: list }));

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
      }
    }

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

    setDone((d) => ({ ...d, [job.id]: true }));
  }

  if (!jobs.length) {
    return (
      <p className="text-sm text-slate-500">
        No upcoming jobs found. Check your Google Sheet dates.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clock in/out + today's date */}
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
          <Calendar className="w-5 h-5 text-emerald-700" />
          <h3 className="font-semibold">Today's Jobs</h3>
          <p className="text-sm text-slate-500">{todayISO()}</p>
        </div>
      </div>

      {/* Jobs */}
      <div className="grid gap-5">
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-5 shadow-sm ${
              done[job.id] ? "bg-emerald-50" : "bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold">{job.title}</h4>
                <p className="text-emerald-900">{job.client}</p>
                <div className="text-sm flex gap-2 mt-1">
                  <MapPin className="w-4 h-4" /> {job.address}
                </div>
                <div className="text-sm flex gap-2 mt-1">
                  <Clock className="w-4 h-4" /> {job.start}{" "}
                  {job.end ? `–${job.end}` : ""}
                </div>
              </div>
              <div>
                {!done[job.id] && (
                  <button
                    onClick={() => completeJob(job)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
                  >
                    <Check className="w-4 h-4" /> Mark Complete
                  </button>
                )}
              </div>
            </div>

            {/* Room-by-room checklist */}
            <div className="mt-4 space-y-3">
              {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
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
                                onChange={() => toggleTask(job.id, room, t)}
                              />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Photo upload */}
            <div className="mt-4 p-3 border rounded-xl bg-slate-50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Camera className="w-4 h-4" />
                <span>Upload images</span>
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
        ))}
      </div>
    </div>
  );
}

function CustomerView() {
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  // fetch from Google Sheet (upcoming) and Supabase (completed)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        setUpcoming(data?.events || []);
      } catch (e) {
        console.error(e);
      }

      const { data: comps } = await supabase
        .from("completions")
        .select("*")
        .order("created_at", { ascending: false });
      setHistory(comps || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Upcoming Cleans</h3>
        {upcoming.map((j) => (
          <div key={j.id} className="border-b py-2">
            <strong>{j.date}</strong> – {j.client} ({j.title})
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Past Cleans</h3>
        {history.map((c) => (
          <div key={c.id} className="border-b py-2">
            <strong>{c.job_key}</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {c.photos?.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="clean"
                  className="w-20 h-20 rounded object-cover"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("cleaner");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <header className="px-5 py-6 border-b">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-900">
            M.O.R. Clean Daytona
          </h1>
          <nav className="flex gap-2">
            <button
              onClick={() => setTab("cleaner")}
              className={`px-4 py-2 rounded-xl ${
                tab === "cleaner"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border"
              }`}
            >
              Cleaner Portal
            </button>
            <button
              onClick={() => setTab("customer")}
              className={`px-4 py-2 rounded-xl ${
                tab === "customer"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border"
              }`}
            >
              Customer Portal
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}
