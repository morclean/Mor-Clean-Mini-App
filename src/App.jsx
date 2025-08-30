// src/app.jsx
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
  Phone,
} from "lucide-react";

// helpers
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const digits = (s) => (s || "").replace(/\D/g, "");
const isDeepRoom = (room) => room.startsWith("Deep Clean");

// tiny localStorage helpers for progress
const loadLS = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const saveLS = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// ---------------------- Cleaner View ----------------------
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [checked, setChecked] = useState(loadLS("mor_checked", {})); // { [jobId]: { [room]: { [task]: true } } }
  const [done, setDone] = useState(loadLS("mor_done", {}));
  const [files, setFiles] = useState({}); // { [jobId]: FileList }
  const [clockIn, setClockIn] = useState(loadLS("mor_clockIn", null));
  const [openRooms, setOpenRooms] = useState({}); // { [jobId]: { [room]: boolean } }

  // persist to localStorage
  useEffect(() => saveLS("mor_checked", checked), [checked]);
  useEffect(() => saveLS("mor_done", done), [done]);
  useEffect(() => saveLS("mor_clockIn", clockIn), [clockIn]);

  // Load jobs from Google Sheet via /api/jobs and normalize
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const payload = await res.json();

        const all = (payload?.events || []).map((e) => ({
          id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
          // NEW fields you added
          client_phone: digits(e.client_phone),
          service_type: e.service_type || "Standard",
          assigned_cleaner: e.assigned_cleaner || "",
          status: e.status || "Scheduled",
          price: e.price || "",
          paid: (e.paid ?? "").toString(),
        }));

        const today = todayISO();
        const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

        const upcoming = all
          .filter((j) => j.date >= today && j.date <= in30)
          .sort((a, b) => a.date.localeCompare(b.date));

        setJobs(upcoming);

        // Initialize expand/collapse per job:
        // Standard rooms open, Deep-clean rooms collapsed.
        const initOpen = {};
        for (const j of upcoming) {
          const rooms = {};
          Object.keys(MASTER_CHECKLIST).forEach((room) => {
            rooms[room] = !isDeepRoom(room); // true=open
          });
          initOpen[j.id] = rooms;
        }
        setOpenRooms(initOpen);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  const toggleRoom = (jobId, room) =>
    setOpenRooms((prev) => ({
      ...prev,
      [jobId]: { ...(prev[jobId] || {}), [room]: !prev[jobId]?.[room] },
    }));

  const toggleTask = (jobId, room, task) =>
    setChecked((prev) => {
      const next = structuredClone(prev || {});
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });

  const onFiles = (jobId, list) =>
    setFiles((prev) => ({ ...prev, [jobId]: list }));

  async function completeJob(job) {
    const uploaded = [];
    const list = files[job.id] || [];

    // upload photos
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

    // save completion
    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      photos: uploaded,
      cleaner_name: job.assigned_cleaner || "MOR Cleaner",
      client_phone: job.client_phone || "",
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
        No upcoming jobs found. Check your Google Sheet dates (today or later).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shift + Today's date */}
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
            <h3 className="font-semibold text-slate-800">Today's Jobs</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">{todayISO()}</p>
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
                <h4 className="text-lg font-semibold text-slate-800">
                  {job.title} {job.service_type !== "Standard" && `• ${job.service_type}`}
                </h4>
                <p className="text-emerald-900 font-medium">{job.client}</p>
                {job.assigned_cleaner && (
                  <p className="text-sm text-slate-600 mt-0.5">
                    Cleaner: <strong>{job.assigned_cleaner}</strong>
                  </p>
                )}
                <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-2">
                  <MapPin className="w-4 h-4" /> <span>{job.address}</span>
                </div>
                <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4" />{" "}
                  <span>
                    {job.start}
                    {job.end ? `–${job.end}` : ""}
                  </span>
                </div>
                {job.price && (
                  <div className="text-sm text-slate-600 mt-1">Price: {job.price} • Paid: {job.paid}</div>
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
              </div>
            </div>

            {/* Room-by-room checklist (expand/collapse) */}
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
                      <span className="font-semibold text-slate-800">{room}</span>
                      {isOpen ? (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4">
                        <ul className="space-y-2">
                          {tasks.map((t) => (
                            <li key={t} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={!!checked[job.id]?.[room]?.[t]}
                                onChange={() => toggleTask(job.id, room, t)}
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

            {/* Photo upload */}
            <div className="mt-4 p-3 border rounded-xl bg-slate-50">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Camera className="w-4 h-4 text-slate-600" />
                <span>Upload images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(job.id, e.target.files)}
                />
              </label>
              <p className="text-xs text-slate-500 mt-2">
                Add before/after photos (wide shots + any issues).
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------------------- Customer View ----------------------
function CustomerView() {
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState(""); // normalized
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);
  const [ready, setReady] = useState(false);

  const onLock = (e) => {
    e.preventDefault();
    const p = digits(phoneInput);
    if (!p) return alert("Enter your phone number to view your cleans.");
    setPhone(p);
    setReady(true);
  };

  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        // Upcoming from Google Sheet filtered by phone
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const { events = [] } = await res.json();

        const mapped = events
          .filter((e) => digits(e.client_phone) === phone)
          .map((e) => ({
            id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
            date: e.date,
            start: e.start || "",
            end: e.end || "",
            title: e.title || "Clean",
            client: e.client || "",
            address: e.address || "",
            notes: e.notes || "",
            service_type: e.service_type || "Standard",
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setUpcoming(mapped);
      } catch (e) {
        console.error(e);
      }

      // Past completions from Supabase filtered by phone
      const { data, error } = await supabase
        .from("completions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        setHistory((data || []).filter((c) => digits(c.client_phone) === phone));
      }
    })();
  }, [ready, phone]);

  if (!ready) {
    return (
      <form onSubmit={onLock} className="max-w-md space-y-3">
        <h3 className="font-semibold text-slate-900">Access your cleans</h3>
        <p className="text-sm text-slate-600">
          Enter the phone number you used for booking to see your schedule and photos.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              className="w-full pl-9 pr-3 py-2 border rounded-xl"
              placeholder="e.g. 386-318-5521"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              inputMode="tel"
            />
          </div>
          <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm">
            View
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white border p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Upcoming Cleans</h3>
          <span className="text-xs text-slate-500">for • {phone}</span>
        </div>
        {upcoming.length === 0 && (
          <p className="text-sm text-slate-500 mt-2">
            No upcoming cleans found for this number.
          </p>
        )}
        <div className="mt-3 divide-y">
          {upcoming.map((j) => (
            <div key={j.id} className="py-3">
              <div className="text-sm text-slate-600">{j.date}</div>
              <div className="font-medium">
                {j.client || j.title} {j.service_type !== "Standard" && `• ${j.service_type}`}
              </div>
              <div className="text-xs text-slate-500">
                {j.address} • {j.start}
                {j.end ? `–${j.end}` : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white border p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Past Cleans & Photos</h3>
          <span className="text-xs text-slate-500">for • {phone}</span>
        </div>
        {history.length === 0 && (
          <p className="text-sm text-slate-500 mt-2">
            No completed cleans with photos for this number yet.
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
    </div>
  );
}

// ---------------------- App Shell ----------------------
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

      <main className="max-w-5xl mx-auto p-6">
        {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}
