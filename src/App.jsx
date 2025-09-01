// src/app.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "./lib/supabase";
import { MASTER_CHECKLIST } from "./lib/checklist";
import {
  Check, Clock, Camera, Calendar, MapPin, LogIn, LogOut,
  ChevronDown, ChevronRight, Phone, Search
} from "lucide-react";

/** ---------- helpers ---------- **/
const TZ = "America/New_York"; // change if you operate in another timezone
const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const addDaysISO = (days) =>
  new Date(Date.now() + days*24*60*60*1000).toLocaleDateString("en-CA", { timeZone: TZ });
const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const prettyService = (s="") =>
  (s || "Standard").replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
const normalizePhone = (v="") => v.replace(/[^\d]/g,"");

/** ---------- Cleaner View ---------- **/
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [checked, setChecked] = useState({});         // { [jobId]: { [room]: { [task]: true } } }
  const [done, setDone] = useState({});
  const [beforeFiles, setBeforeFiles] = useState({});  // { [jobId]: FileList }
  const [afterFiles, setAfterFiles] = useState({});    // { [jobId]: FileList }
  const [clockIn, setClockIn] = useState(null);
  const [openJobs, setOpenJobs] = useState({});        // { [jobId]: bool }  <-- job-level collapse
  const [openRooms, setOpenRooms] = useState({});      // { [jobId]: { [room]: bool } }
  const [scope, setScope] = useState("today");         // "today" | "week" | "all"
  const [q, setQ] = useState("");

  // load jobs from our API (Google Sheet → CSV → JSON)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();

        // normalize: never show ID to cleaners as title
        const events = (data?.events || []).map((e) => ({
          id: e.id,
          date: e.date || "",
          start: e.start || "",
          end: e.end || "",
          client: e.client || "",
          service_type: e.service_type || e.title || "Standard",
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          assigned_cleaner: e.assigned_cleaner || "",
          status: e.status || "",
          price: e.price || "",
          pay: e.pay || ""
        }));

        const today = todayISO();
        const in30  = addDaysISO(30);
        const upcoming = events
          .filter(j => j.date >= today && j.date <= in30)
          .sort((a,b)=> (a.date + (a.start||"")).localeCompare(b.date + (b.start||"")));

        setJobs(upcoming);

        // INIT: every job collapsed; every room collapsed
        const oj = {};
        const or = {};
        for (const j of upcoming) {
          oj[j.id] = false;
          const rooms = {};
          Object.keys(MASTER_CHECKLIST).forEach((room) => { rooms[room] = false; });
          or[j.id] = rooms;
        }
        setOpenJobs(oj);
        setOpenRooms(or);

      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  const toggleJob = (jobId) => setOpenJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  const toggleRoom = (jobId, room) =>
    setOpenRooms((prev) => ({ ...prev, [jobId]: { ...(prev[jobId]||{}), [room]: !prev[jobId]?.[room] }}));

  const toggleTask = (jobId, room, task) => {
    setChecked((prev) => {
      const next = structuredClone(prev);
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });
  };

  // filter by scope + search (client, address, notes, service type, assigned cleaner)
  const filteredJobs = useMemo(() => {
    const t = todayISO();
    const weekEnd = addDaysISO(7);

    let base = jobs;
    if (scope === "today") base = base.filter(j => j.date === t);
    else if (scope === "week") base = base.filter(j => j.date >= t && j.date <= weekEnd);

    const qq = q.trim().toLowerCase();
    if (!qq) return base;
    return base.filter(j =>
      [j.client, j.address, j.notes, j.service_type, j.assigned_cleaner].some(
        (f) => String(f || "").toLowerCase().includes(qq)
      )
    );
  }, [jobs, scope, q]);

  // save completion + photos → Supabase
  async function completeJob(job) {
    const uploadedBefore = [];
    const uploadedAfter = [];

    const doUploadGroup = async (groupFiles, bucketPrefix) => {
      const urls = [];
      const list = groupFiles || [];
      for (const file of list) {
        const key = `${job.id}/${bucketPrefix}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(key);
          urls.push(publicUrl);
        }
      }
      return urls;
    };

    uploadedBefore.push(...(await doUploadGroup(beforeFiles[job.id], "before")));
    uploadedAfter.push(...(await doUploadGroup(afterFiles[job.id], "after")));

    const { error: insErr } = await supabase.from("completions").insert({
      job_key: job.id,
      checklist: checked[job.id] || {},
      photos_before: uploadedBefore,
      photos_after: uploadedAfter,
      cleaner_name: job.assigned_cleaner || "Cleaner",
      client_phone: job.client_phone || "",
      service_type: job.service_type || "",
      client: job.client || "",
      address: job.address || "",
      date: job.date || "",
    });
    if (insErr) {
      console.error(insErr);
      alert("Error saving completion");
      return;
    }

    setDone((d) => ({ ...d, [job.id]: true }));
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 shadow-sm border border-emerald-100">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold text-emerald-900">Shift</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {!clockIn ? (
              <button onClick={() => setClockIn(Date.now())} className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm text-emerald-900/80">
                  Clocked in at <strong>{fmtTime(clockIn)}</strong>
                </span>
                <button onClick={() => setClockIn(null)} className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white shadow-sm border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-700" />
            <h3 className="font-semibold text-slate-800">Jobs</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">{todayISO()}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {["today","week","all"].map(k => (
              <button
                key={k}
                onClick={()=>setScope(k)}
                className={`px-3 py-1 rounded-full text-xs border ${scope===k ? "bg-emerald-600 text-white border-emerald-600":"bg-white text-slate-700"}`}
              >
                {k==="today"?"Today":k==="week"?"This Week":"All"}
              </button>
            ))}
          </div>

          <div className="mt-3 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm"
              placeholder="Search client, address, notes…"
            />
          </div>
        </div>
      </div>

      {/* Jobs list */}
      {!filteredJobs.length ? (
        <p className="text-sm text-slate-500">No jobs found.</p>
      ) : (
        <div className="grid gap-5">
          {filteredJobs.map((job) => {
            const isOpenJob = !!openJobs[job.id];
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-5 shadow-sm ${done[job.id] ? "bg-emerald-50/70" : "bg-white"}`}
              >
                {/* Job header (click to expand) */}
                <button
                  type="button"
                  onClick={() => toggleJob(job.id)}
                  className="w-full flex items-start justify-between gap-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-lg font-semibold text-slate-800 truncate">
                        {job.client || "Client"}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {prettyService(job.service_type)}
                      </span>
                      {job.assigned_cleaner ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border">{job.assigned_cleaner}</span>
                      ) : null}
                      {job.status ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border">{job.status}</span>
                      ) : null}
                    </div>

                    <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{job.address || "No address on file"}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {job.date} • {job.start}{job.end ? `–${job.end}` : ""}
                    </div>

                    {job.notes ? (
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{job.notes}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs ${done[job.id] ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {done[job.id] ? "Completed" : "In progress"}
                    </span>
                    {isOpenJob ? (
                      <ChevronDown className="w-5 h-5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Job body (only when opened) */}
                {isOpenJob && (
                  <div className="mt-4">
                    {/* ROOM-BY-ROOM CHECKLIST */}
                    <div className="space-y-3">
                      {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
                        const isOpenRoom = !!openRooms[job.id]?.[room];
                        return (
                          <div key={room} className="border rounded-xl">
                            <button
                              type="button"
                              onClick={() => toggleRoom(job.id, room)}
                              className="w-full flex items-center justify-between px-4 py-3"
                            >
                              <span className="font-semibold text-slate-800">{room}</span>
                              {isOpenRoom ? <ChevronDown className="w-5 h-5 text-slate-500"/> : <ChevronRight className="w-5 h-5 text-slate-500"/>}
                            </button>
                            {isOpenRoom && (
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
                                      <span className={checked[job.id]?.[room]?.[t] ? "line-through text-slate-400" : "text-slate-700"}>
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

                    {/* PHOTOS: BEFORE & AFTER (separate) */}
                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="p-3 border rounded-xl bg-slate-50">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Upload BEFORE photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => setBeforeFiles((p)=>({ ...p, [job.id]: e.target.files }))}
                          />
                        </label>
                        <p className="text-xs text-slate-500 mt-2">Take 3 angles per room on arrival.</p>
                      </div>

                      <div className="p-3 border rounded-xl bg-slate-50">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Upload AFTER photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => setAfterFiles((p)=>({ ...p, [job.id]: e.target.files }))}
                          />
                        </label>
                        <p className="text-xs text-slate-500 mt-2">Take 3 angles per room before leaving.</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      {!done[job.id] && (
                        <button onClick={() => completeJob(job)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2">
                          <Check className="w-4 h-4" /> Mark Job Complete
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

/** ---------- Customer View (phone-gated; shows only their stuff) ---------- **/
function CustomerView() {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const p = normalizePhone(phone);
    if (!p) return;

    try {
      // Upcoming from /api/jobs
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      const all = (data?.events || []).map(e => ({
        id: e.id,
        date: e.date, start: e.start, end: e.end,
        client: e.client, address: e.address,
        service_type: e.service_type || e.title || "Standard",
        client_phone: e.client_phone || "",
      }));

      const matches = all
        .filter(ev => {
          const evp = normalizePhone(ev.client_phone);
          // match full, or last 4 as a fallback
          return evp && (evp === p || evp.endsWith(p));
        })
        .sort((a,b)=> (a.date+(a.start||"")).localeCompare(b.date+(b.start||"")));

      setEvents(matches);
    } catch (e2) {
      console.error(e2);
      setEvents([]);
    }

    // Past completions from Supabase (phone filtered)
    const { data: comps } = await supabase
      .from("completions")
      .select("*")
      .order("created_at", { ascending: false });

    const myHistory = (comps || []).filter((c) => {
      const cp = normalizePhone(c.client_phone || "");
      return cp && (cp === p || cp.endsWith(p));
    });

    setHistory(myHistory);
    setSubmitted(true);
  };

  if (!submitted) {
    return (
      <form onSubmit={onSubmit} className="max-w-md space-y-3">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Phone className="w-4 h-4" /> Enter your phone number
        </label>
        <input
          value={phone}
          onChange={(e)=>setPhone(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border"
          inputMode="tel"
          placeholder="(555) 123-4567"
        />
        <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm">
          View my schedule & photos
        </button>
        <p className="text-xs text-slate-500">We only use this to find your bookings and photos.</p>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Upcoming Cleans</h3>
        {!events.length ? (
          <p className="text-sm text-slate-500 mt-2">No upcoming cleans found for that phone.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((j) => (
              <div key={j.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{j.client}</div>
                    <div className="text-xs text-slate-600">{j.date} • {j.start}{j.end?`–${j.end}`:""}</div>
                    <div className="text-xs text-slate-600">{j.address || "No address on file"}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {prettyService(j.service_type)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-white border">
        <h3 className="font-semibold">Past Cleans (Photos)</h3>
        {!history.length ? (
          <p className="text-sm text-slate-500 mt-2">No completed cleans with photos yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {history.map((c) => (
              <div key={c.id} className="border rounded-xl p-3">
                <div className="text-sm text-slate-700 font-medium">{c.client || c.job_key}</div>
                <div className="text-xs text-slate-500">{c.address || ""}</div>
                <div className="text-xs text-slate-500">{c.date || ""}</div>

                {Array.isArray(c.photos_before) && c.photos_before.length > 0 && (
                  <>
                    <div className="mt-2 text-xs font-medium text-slate-700">Before</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.photos_before.map((url) => (
                        <img key={url} src={url} alt="before" className="w-20 h-20 rounded object-cover" />
                      ))}
                    </div>
                  </>
                )}

                {Array.isArray(c.photos_after) && c.photos_after.length > 0 && (
                  <>
                    <div className="mt-3 text-xs font-medium text-slate-700">After</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.photos_after.map((url) => (
                        <img key={url} src={url} alt="after" className="w-20 h-20 rounded object-cover" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** ---------- App Shell ---------- **/
export default function App() {
  const [tab, setTab] = useState("cleaner"); // "cleaner" | "customer"

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MOR" className="w-10 h-10 rounded-2xl object-contain bg-white border"/>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">M.O.R. Clean Daytona</h1>
              <p className="text-xs text-emerald-800/70">Women-owned • Family-operated</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 bg-white border rounded-2xl p-1 shadow-sm">
            <button
              onClick={()=>setTab("cleaner")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab==="cleaner"?"bg-emerald-600 text-white":"text-slate-700 hover:bg-slate-50"}`}
            >
              Cleaner Portal
            </button>
            <button
              onClick={()=>setTab("customer")}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab==="customer"?"bg-emerald-600 text-white":"text-slate-700 hover:bg-slate-50"}`}
            >
              Customer Portal
            </button>
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
              {tab === "cleaner"
                ? <>Clock in, view jobs (Today/This Week/All), search, open a job to check tasks, and upload BEFORE & AFTER photos.</>
                : <>Enter your phone number to see your upcoming schedule and your before/after photos. Only your data is shown.</>}
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

      <footer className="text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} MOR – A Clean Living Company
      </footer>
    </div>
  );
}
