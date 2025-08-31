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

/* ---------------- helpers ---------------- */

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// very lightweight classifier based on the service_type text coming from Sheet
const kindFromService = (s = "") => {
  const t = s.toLowerCase();
  if (t.includes("deep")) return "deep";
  if (t.includes("airbnb") || t.includes("turnover") || t.includes("bnb"))
    return "airbnb";
  return "residential";
};

// pick checklist rooms based on kind
const roomsForKind = (kind) => {
  const keep = {
    residential: [
      "Arrival / Safety",
      "General — All Areas",
      "Entry / Hallways",
      "Kitchen",
      "Dining Area",
      "Living / Family Room",
      "Bedrooms (each)",
      "Bathrooms (each)",
      "Laundry Room",
      "Windows / Glass (interior only)",
      "Patio / Balcony",
      "Final Walk & Lockup",
      "Photos (Before/After)",
    ],
    airbnb: [
      "Arrival / Safety",
      "General — All Areas",
      "Entry / Hallways",
      "Kitchen",
      "Dining Area",
      "Living / Family Room",
      "Bedrooms (each)",
      "Bathrooms (each)",
      "Laundry Room",
      "Windows / Glass (interior only)",
      "Patio / Balcony",
      "Trash / Recycle Days",
      "Supplies & Inventory",
      "Damage / Lost & Found",
      "Final Walk & Lockup",
      "Photos (Before/After)",
    ],
    deep: [
      "Arrival / Safety",
      "General — All Areas",
      "Kitchen",
      "Bathrooms (each)",
      "Deep Clean — Kitchen",
      "Deep Clean — Bathrooms",
      "Deep Clean — All Areas",
      "Windows / Glass (interior only)",
      "Final Walk & Lockup",
      "Photos (Before/After)",
    ],
  };
  const wanted = keep[kind] || keep.residential;
  const entries = Object.entries(MASTER_CHECKLIST).filter(([room]) =>
    wanted.includes(room)
  );
  return Object.fromEntries(entries);
};

const humanTitle = (job) => {
  // If Square gave a cryptic service id in `title`, prefer service_type or a nice fallback
  const service = job.service_type || "";
  if (service) return service;
  if (job.title && !/^[A-Z0-9-_]{10,}$/.test(job.title)) return job.title; // looks human
  return "Scheduled Clean";
};

/* ---------------- Cleaner View ---------------- */

function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [checked, setChecked] = useState({});
  const [done, setDone] = useState({});
  const [files, setFiles] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [open, setOpen] = useState({}); // per-job collapse state

  // Load jobs from our sheet-backed API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();

        // normalize (supports either our Apps Script headers or your earlier shape)
        const events = (data?.events || data || []).map((e) => ({
          id:
            e.id ||
            `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${
              (e.title || "Clean").replace(/\s+/g, "_")
            }`,
          date: e.date || "",
          start: e.start || "",
          end: e.end || "",
          title: e.title || "",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
          service_type: e.service_type || e.service || "",
        }));

        const today = todayISO();
        const in30 = new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString().slice(0, 10);

        const upcoming = events
          .filter((j) => j.date && j.date >= today && j.date <= in30)
          .sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));

        setJobs(upcoming);

        // start with everything collapsed
        const collapsed = {};
        for (const j of upcoming) collapsed[j.id] = false;
        setOpen(collapsed);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  const toggleJob = (jobId) =>
    setOpen((o) => ({ ...o, [jobId]: !o[jobId] }));

  const toggleTask = (jobId, room, task) => {
    setChecked((prev) => {
      const next = structuredClone(prev);
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

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
      }
    }

    // save completion
    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      date: job.date,
      client: job.client,
      address: job.address,
      service_type: job.service_type || "",
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
    // auto-collapse when marked complete
    setOpen((o) => ({ ...o, [job.id]: false }));
  }

  if (!jobs.length) {
    return (
      <p className="text-sm text-slate-500">
        No upcoming jobs found. Check your Google Sheet dates (today → next 30
        days).
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* top bar */}
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
          <p className="text-sm text-slate-500">{todayISO()}</p>
        </div>
      </div>

      {/* jobs list (each card collapsed by default) */}
      <div className="grid gap-5">
        {jobs.map((job) => {
          const kind = kindFromService(job.service_type);
          const checklist = roomsForKind(kind);
          const isOpen = !!open[job.id];
          const title = humanTitle(job);

          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 shadow-sm ${
                done[job.id] ? "bg-emerald-50" : "bg-white"
              }`}
            >
              {/* compact header row */}
              <button
                className="w-full text-left"
                onClick={() => toggleJob(job.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-base font-semibold text-slate-900 truncate">
                      {title}
                      {job.client ? ` • ${job.client}` : ""}
                    </h4>
                    <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-3">
                      {job.address && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {job.address}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {job.start || ""} {job.end ? `– ${job.end}` : ""}
                      </span>
                      {job.service_type && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {job.service_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] ${
                        done[job.id]
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {done[job.id] ? "Completed" : "In progress"}
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                </div>
              </button>

              {/* expanded content */}
              {isOpen && (
                <div className="mt-4">
                  {job.notes && (
                    <p className="text-sm text-slate-600 mb-3">{job.notes}</p>
                  )}

                  {/* room-by-room */}
                  <div className="space-y-4">
                    {Object.entries(checklist).map(([room, tasks]) => (
                      <div key={room} className="border rounded-xl">
                        <div className="px-4 py-2.5 font-semibold text-slate-800 bg-slate-50 rounded-t-xl">
                          {room}
                        </div>
                        <div className="px-4 pb-3 pt-2">
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
                      </div>
                    ))}
                  </div>

                  {/* photos */}
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
                    <p className="text-xs text-slate-500 mt-2">
                      Tip: **3 angles per room** (wide, detail, any issues). Add
                      before/after + damage notes.
                    </p>
                  </div>

                  {/* complete */}
                  {!done[job.id] && (
                    <div className="mt-4">
                      <button
                        onClick={() => completeJob(job)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm inline-flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" /> Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Customer View (unchanged, compact) ---------------- */

function CustomerView() {
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();
        setUpcoming(data?.events || data || []);
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
            <strong>{j.date}</strong> – {j.client} ({j.service_type || j.title})
          </div>
        ))}
      </div>
      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Past Cleans</h3>
        {history.map((c) => (
          <div key={c.id} className="border-b py-2">
            <div className="text-sm text-slate-700">
              {c.date} – {c.client} ({c.service_type || "Clean"})
            </div>
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

/* ---------------- App Shell (with logo) ---------------- */

export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* put your logo file at /public/logo.png */}
            <img
              src="/logo.png"
              alt="M.O.R. Clean"
              className="w-10 h-10 rounded-2xl object-contain bg-white border"
            />
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
          <section className="rounded-3xl bg-white border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {tab === "cleaner" ? "Cleaner Portal" : "Customer"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {tab === "cleaner"
                ? "Tap a job to expand. Check rooms, add photos, and mark complete."
                : "View your upcoming cleans and past photos."}
            </p>
            {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
          </section>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}
