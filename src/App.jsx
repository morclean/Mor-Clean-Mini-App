import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  ImageDown,
  ImageUp,
  Search,
  Users,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { MASTER_CHECKLIST } from "./lib/checklist";

// ---------- helpers ----------
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);

const SERVICE_LABELS = [
  "Airbnb Turnover",
  "Standard Maintenance",
  "Deep Clean",
  "Post-Construction",
  "Move-in/Out",
  "Commercial/Office",
  "One-Time",
];

function normalizePhone(p) {
  const digits = String(p || "").replace(/\D/g, "");
  return digits.slice(-10); // last 10
}

function normalizeService(raw) {
  const s = String(raw || "").toLowerCase();
  if (s.includes("airbnb")) return "Airbnb Turnover";
  if (s.includes("deep")) return "Deep Clean";
  if (s.includes("post")) return "Post-Construction";
  if (s.includes("construction")) return "Post-Construction";
  if (s.includes("move") || s.includes("out") || s.includes("in"))
    return "Move-in/Out";
  if (s.includes("commercial") || s.includes("office"))
    return "Commercial/Office";
  if (s.includes("one")) return "One-Time";
  if (s.includes("standard")) return "Standard Maintenance";
  // safety default
  return "Standard Maintenance";
}

// Which rooms appear for which service
const STANDARD_ROOMS = [
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
  "Office / Bonus Rooms",
  "Patio / Balcony",
  "Garage",
  "HVAC / Filters / Thermostat",
  "Final Walk & Lockup",
  "Photos (Before/After)",
];

const AIRBNB_EXTRA = [
  "Pantry / Owner’s Closet (if accessible)",
  "Supplies & Inventory",
  "Trash / Recycle Days",
  "Damage / Lost & Found",
];

const DEEP_SECTIONS = [
  "Deep Clean — Kitchen",
  "Deep Clean — Bathrooms",
  "Deep Clean — All Areas",
];

function roomsForService(service) {
  const base = [...STANDARD_ROOMS];
  if (service === "Airbnb Turnover") base.push(...AIRBNB_EXTRA);
  if (
    service === "Deep Clean" ||
    service === "Post-Construction" ||
    service === "Move-in/Out"
  ) {
    DEEP_SECTIONS.forEach((r) => base.push(r));
  }
  // filter to only rooms that exist in MASTER_CHECKLIST
  return base.filter((r) => Array.isArray(MASTER_CHECKLIST[r]));
}

// ---------- Cleaner Portal ----------
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("today"); // today | week | all
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mor_checked") || "{}");
    } catch {
      return {};
    }
  }); // { [jobId]: { [room]: { [task]: true } } }
  const [openJob, setOpenJob] = useState(null); // which job card is open
  const [openRooms, setOpenRooms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mor_openRooms") || "{}");
    } catch {
      return {};
    }
  }); // { [jobId]: { [room]: true } }
  const [done, setDone] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [beforeFiles, setBeforeFiles] = useState({}); // { [jobId]: FileList }
  const [afterFiles, setAfterFiles] = useState({}); // { [jobId]: FileList }

  // fetch jobs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        if (!res.ok) {
          console.error("API /api/jobs failed", res.status);
          setJobs([]);
          return;
        }
        const json = await res.json();
        const events = (json?.events || []).map((e) => {
          // expect e has: date, start, end, client, address, notes, service_type, client_phone, assigned
          const service = normalizeService(e.service_type || e.title || "");
          const id = `${e.date}-${(e.client || "")
            .replace(/\s+/g, "_")
            .slice(0, 40)}-${service.replace(/\s+/g, "_")}`;
          return {
            id,
            job_key: id,
            date: e.date,
            start: e.start || "",
            end: e.end || "",
            client: e.client || "",
            address: e.address || "",
            notes: e.notes || "",
            service_type: service,
            client_phone: normalizePhone(e.client_phone),
            assigned: e.assigned || "",
          };
        });

        // default sort by date+start
        events.sort((a, b) => {
          const d = a.date.localeCompare(b.date);
          if (d !== 0) return d;
          return (a.start || "").localeCompare(b.start || "");
        });

        setJobs(events);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  // persist UI state
  useEffect(() => {
    localStorage.setItem("mor_checked", JSON.stringify(checked));
  }, [checked]);
  useEffect(() => {
    localStorage.setItem("mor_openRooms", JSON.stringify(openRooms));
  }, [openRooms]);

  // filter jobs
  const filtered = useMemo(() => {
    const t = todayISO();
    const now = new Date();
    const weekTo = new Date(now.getTime() + 6 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    let list = [...jobs];
    if (filter === "today") list = list.filter((j) => j.date === t);
    if (filter === "week") list = list.filter((j) => j.date >= t && j.date <= weekTo);

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (j) =>
          j.client.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          j.notes.toLowerCase().includes(q) ||
          j.service_type.toLowerCase().includes(q)
      );
    }

    return list;
  }, [jobs, filter, query]);

  function toggleRoom(jobId, room) {
    setOpenRooms((prev) => ({
      ...prev,
      [jobId]: { ...(prev[jobId] || {}), [room]: !prev[jobId]?.[room] },
    }));
  }

  function expandAll(jobId, rooms, open) {
    const map = {};
    rooms.forEach((r) => (map[r] = !!open));
    setOpenRooms((prev) => ({ ...prev, [jobId]: map }));
  }

  function onBeforeFiles(jobId, list) {
    setBeforeFiles((prev) => ({ ...prev, [jobId]: list }));
  }
  function onAfterFiles(jobId, list) {
    setAfterFiles((prev) => ({ ...prev, [jobId]: list }));
  }

  const toggleTask = (jobId, room, task) => {
    setChecked((prev) => {
      const next = structuredClone(prev || {});
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

  async function uploadMany(jobKey, kind, list) {
    const urls = [];
    if (!list || !list.length) return urls;
    for (const file of list) {
      const key = `${jobKey}/${kind}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("photos")
        .upload(key, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("photos").getPublicUrl(key);
        urls.push(data.publicUrl);
      } else {
        console.error("upload error", error);
      }
    }
    return urls;
  }

  async function completeJob(job) {
    const jobKey = job.job_key || job.id;

    // upload photos
    const b4 = await uploadMany(jobKey, "before", beforeFiles[jobKey] || []);
    const aft = await uploadMany(jobKey, "after", afterFiles[jobKey] || []);

    // write completion row
    const payload = {
      job_key: jobKey,
      date: job.date,
      client: job.client,
      client_phone: job.client_phone || "",
      address: job.address || "",
      service_type: job.service_type,
      assigned: job.assigned || "",
      checklist: checked[jobKey] || {},
      photos_before: b4,
      photos_after: aft,
      photos: [...b4, ...aft], // legacy field
    };

    const { error } = await supabase.from("completions").insert(payload);
    if (error) {
      console.error(error);
      alert("Error saving completion");
      return;
    }
    setDone((d) => ({ ...d, [jobKey]: true }));
  }

  return (
    <div className="space-y-6">
      {/* top controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100">
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
                <span className="text-sm text-emerald-900/80">
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

        <div className="p-5 rounded-2xl bg-white border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold">Filters</h3>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { k: "today", label: "Today" },
              { k: "week", label: "This Week" },
              { k: "all", label: "All" },
            ].map((p) => (
              <button
                key={p.k}
                onClick={() => setFilter(p.k)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  filter === p.k
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-xl border"
              placeholder="Search client, address, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* jobs */}
      <div className="space-y-4">
        {!filtered.length && (
          <p className="text-sm text-slate-500">No jobs found.</p>
        )}

        <AnimatePresence>
          {filtered.map((job) => {
            const rooms = roomsForService(job.service_type);
            const isOpen = openJob === job.id;

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-2xl border p-5 shadow-sm ${
                  done[job.id] ? "bg-emerald-50" : "bg-white"
                }`}
              >
                {/* job header */}
                <button
                  className="w-full text-left"
                  onClick={() => setOpenJob(isOpen ? null : job.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-slate-800">
                          {job.client || "Unknown Client"}
                        </h4>
                        {job.assigned && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                            <Users className="w-3 h-3" />
                            {job.assigned}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {job.date}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {job.start}
                          {job.end ? `–${job.end}` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.address || "No address on file"}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800">
                          {job.service_type}
                        </span>
                      </div>
                      {job.notes && (
                        <p className="mt-2 text-sm text-slate-600">{job.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs ${
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

                {/* expanded body */}
                {isOpen && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-500">
                        Tip: Each room → take <strong>3 angles</strong> for
                        Before & After.
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => expandAll(job.id, rooms, true)}
                          className="text-xs px-3 py-1 rounded-full border"
                        >
                          Expand All
                        </button>
                        <button
                          onClick={() => expandAll(job.id, rooms, false)}
                          className="text-xs px-3 py-1 rounded-full border"
                        >
                          Collapse All
                        </button>
                      </div>
                    </div>

                    {/* room accordions */}
                    <div className="mt-4 space-y-3">
                      {rooms.map((room) => {
                        const tasks = MASTER_CHECKLIST[room] || [];
                        const rOpen = !!openRooms[job.id]?.[room];
                        const doneCount = tasks.reduce(
                          (n, t) => (checked[job.id]?.[room]?.[t] ? n + 1 : n),
                          0
                        );
                        return (
                          <div key={room} className="border rounded-xl">
                            <button
                              type="button"
                              onClick={() => toggleRoom(job.id, room)}
                              className="w-full flex items-center justify-between px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                {rOpen ? (
                                  <ChevronDown className="w-5 h-5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-slate-500" />
                                )}
                                <span className="font-semibold text-slate-800">
                                  {room}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {doneCount}/{tasks.length}
                                </span>
                              </div>
                            </button>

                            {rOpen && (
                              <div className="px-4 pb-4">
                                <ul className="space-y-2">
                                  {tasks.map((t) => (
                                    <li
                                      key={t}
                                      className="flex items-center gap-3"
                                    >
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                        checked={
                                          !!checked[job.id]?.[room]?.[t]
                                        }
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

                    {/* photos */}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <ImageDown className="w-4 h-4 text-slate-600" />
                          <span>Upload BEFORE photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) =>
                              onBeforeFiles(job.id, e.target.files)
                            }
                          />
                        </label>
                        <p className="text-xs text-slate-500 mt-2">
                          3 angles per room.
                        </p>
                      </div>

                      <div className="p-3 border rounded-xl bg-slate-50">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <ImageUp className="w-4 h-4 text-slate-600" />
                          <span>Upload AFTER photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) =>
                              onAfterFiles(job.id, e.target.files)
                            }
                          />
                        </label>
                        <p className="text-xs text-slate-500 mt-2">
                          3 angles per room.
                        </p>
                      </div>
                    </div>

                    {/* complete */}
                    <div className="mt-4 flex justify-end">
                      {!done[job.id] && (
                        <button
                          onClick={() => completeJob(job)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Mark Job Complete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- Customer Portal ----------
function CustomerView() {
  const [phone, setPhone] = useState("");
  const [normPhone, setNormPhone] = useState("");
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  async function lookup() {
    const p = normalizePhone(phone);
    setNormPhone(p);

    // upcoming from sheet api
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const json = await res.json();
      const events = (json?.events || []).map((e) => ({
        date: e.date,
        start: e.start || "",
        end: e.end || "",
        client: e.client || "",
        address: e.address || "",
        service_type: normalizeService(e.service_type || e.title || ""),
        client_phone: normalizePhone(e.client_phone),
      }));
      const mine = events
        .filter((e) => e.client_phone && e.client_phone === p)
        .sort((a, b) => a.date.localeCompare(b.date));
      setUpcoming(mine);
    } catch (e) {
      console.error(e);
      setUpcoming([]);
    }

    // past completions from supabase
    const { data, error } = await supabase
      .from("completions")
      .select("*")
      .eq("client_phone", p)
      .order("created_at", { ascending: false });
    if (!error) setHistory(data || []);
    else {
      console.error(error);
      setHistory([]);
    }
  }

  if (!normPhone) {
    return (
      <div className="max-w-sm">
        <label className="block text-sm font-medium text-slate-700">
          Enter your phone number (last 10 digits)
        </label>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-xl border"
            placeholder="e.g. 386-555-1234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            onClick={lookup}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white"
          >
            View
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          We’ll show your upcoming appointments and past photos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Upcoming appointments</h3>
          <p className="text-xs text-slate-500">for {normPhone}</p>
        </div>
        <button
          onClick={() => {
            setNormPhone("");
            setUpcoming([]);
            setHistory([]);
            setPhone("");
          }}
          className="text-sm underline text-slate-600"
        >
          Log out
        </button>
      </div>

      <div className="rounded-2xl border bg-white divide-y">
        {upcoming.length ? (
          upcoming.map((u, i) => (
            <div key={i} className="p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {u.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {u.start}
                  {u.end ? `–${u.end}` : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {u.address || "Address on file"}
                </span>
                <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs">
                  {u.service_type}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-sm text-slate-500">No upcoming appointments.</div>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-2">
          Completed cleans — photos
        </h3>
        {history.length ? (
          <div className="space-y-5">
            {history.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl border bg-white">
                <div className="text-sm text-slate-700">
                  <strong>{c.date}</strong> • {c.service_type} • {c.address}
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <h4 className="text-xs font-medium text-slate-600 mb-2">
                      Before
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(c.photos_before || []).map((u) => (
                        <img
                          key={u}
                          src={u}
                          alt="before"
                          className="w-24 h-24 rounded object-cover"
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-slate-600 mb-2">
                      After
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(c.photos_after || []).map((u) => (
                        <img
                          key={u}
                          src={u}
                          alt="after"
                          className="w-24 h-24 rounded object-cover"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No completed cleans yet.</p>
        )}
      </div>
    </div>
  );
}

// ---------- App Root ----------
export default function App() {
  const [tab, setTab] = useState("cleaner"); // "cleaner" | "customer"

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="M.O.R. Clean Daytona"
              className="w-10 h-10 rounded-2xl object-cover bg-emerald-600"
              onError={(e) => {
                // fallback if logo missing
                e.currentTarget.style.display = "none";
              }}
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
              {tab === "cleaner" ? "Cleaner Portal" : "Customer Portal"}
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              {tab === "cleaner" ? (
                <>View jobs, check off tasks, upload before/after photos, and mark complete.</>
              ) : (
                <>Enter your phone number to see your schedule and past photos.</>
              )}
            </p>
            {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
          </section>

          <section className="rounded-3xl border p-6 bg-emerald-50/60">
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
      </main>

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}
