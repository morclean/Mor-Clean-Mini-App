// src/app.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  Phone,
  User,
  X,
} from "lucide-react";
import { supabase } from "./lib/supabase";

// ---------- helpers ----------
const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);
const norm = (s) => (s ?? "").toString().trim();
const withinWeek = (iso) => {
  const d = new Date(iso + "T00:00:00");
  const base = new Date(new Date().toDateString());
  const diff = (d - base) / 86400000;
  return diff >= 0 && diff <= 7;
};

// Normalize any “type/service” value to one of: standard | airbnb | deep
function normalizeType(raw) {
  const t = (raw || "").toString().toLowerCase();
  if (!t) return "";
  if (t.includes("airbnb") || t.includes("turnover")) return "airbnb";
  if (t.includes("deep")) return "deep";
  if (t.includes("standard") || t.includes("basic") || t.includes("maintenance")) return "standard";
  return "";
}

// Keyword fallback when no explicit type/service column
function detectTypeFromText(title, notes) {
  const joined = `${title || ""} ${notes || ""}`.toLowerCase();
  if (joined.includes("airbnb") || joined.includes("turnover")) return "airbnb";
  if (joined.includes("deep")) return "deep";
  return "standard";
}

// ---------- checklists ----------
const CHECKLISTS = {
  standard: {
    "Arrival / Safety": [
      "Park legally; avoid blocking walkways/driveways",
      "Announce arrival if occupied; PPE as needed",
      "Verify pets secured per notes",
    ],
    "General — All Areas": [
      "Stage per photos",
      "High dust (corners, vents, cobwebs)",
      "Dust fixtures & lamp shades",
      "Wipe doors/handles & switch plates",
      "Baseboards & window sills dusted",
      "Interior glass & mirrors streak-free",
      "Disinfect high-touch points",
      "Vacuum carpets & rugs",
      "Sweep & mop hard floors",
    ],
    Bedrooms: [
      "Strip/make beds per notes (fresh if provided)",
      "Dust tops, lamps, decor",
      "Mirrors streak-free",
      "Closet fronts wiped; floor vacuumed",
      "Under bed (visible area) vacuumed",
      "Trash emptied; floor finished",
    ],
    Bathrooms: [
      "Trash emptied; liner replaced",
      "Lights & vent dusted",
      "Mirrors streak-free",
      "Sink & faucet disinfected; polish",
      "Counters & splash areas wiped",
      "Shower/tub scrubbed; fixtures wiped",
      "Toilet bowl/seat/lid/base disinfected",
      "Behind toilet & baseboards wiped",
      "Refill soap; restock TP",
      "Sweep & mop (corners/behind door)",
    ],
    Kitchen: [
      "Dishes handled; run DW if full",
      "Sink/faucet cleaned & polished",
      "Stovetop/knobs/control panel degreased",
      "Microwave in/out wiped",
      "Fridge exterior wiped (handles/sides exposed)",
      "DW front & panel wiped",
      "Small appliances wiped",
      "Backsplash & counters wiped (move/replace items)",
      "Cabinet fronts spot-cleaned",
      "Sweep & mop kitchen floor",
      "Trash/recycle emptied; liners replaced",
    ],
    "Final Walk": [
      "Lights & blinds per policy",
      "Faucets off; toilets lids down",
      "Windows/doors locked",
      "Thermostat per policy",
      "Take required ‘after’ photos (3 angles/room)",
    ],
  },

  airbnb: {
    "Arrival / Safety": [
      "Park legally; avoid blocking walkways/driveways",
      "Announce arrival if occupied; PPE as needed",
      "Verify pets secured per notes; ventilate if needed",
    ],
    "General — All Areas": [
      "Stage per listing photos",
      "High dust (corners, vents, cobwebs)",
      "Dust fixtures & lamp shades",
      "Wipe doors/handles & switch plates",
      "Baseboards & window sills dusted",
      "Interior glass & mirrors streak-free",
      "Disinfect high-touch points",
      "Vacuum upholstery if needed (under cushions if soiled)",
      "Vacuum carpets; sweep & mop hard floors",
    ],
    Bedrooms: [
      "Strip beds; remake with fresh linens",
      "Inspect mattress protector; change if needed",
      "Hotel corners; pillows staged",
      "Dust tops, lamps, decor; mirrors clean",
      "Closet fronts wiped; floor vacuumed",
      "Under bed visible area vacuumed",
      "Trash emptied; floor finished",
    ],
    Bathrooms: [
      "Trash emptied; liner replaced",
      "Lights & vent dusted",
      "Mirrors & glass shelves streak-free",
      "Sink/faucet disinfected; polish",
      "Counters & splash areas wiped",
      "Shower/tub scrubbed; remove soap scum",
      "Glass & door tracks detailed",
      "Toilet full disinfect (bowl/seat/lid/base)",
      "Behind toilet & baseboards wiped",
      "Refill soap; restock TP (2 extra)",
      "Hang fresh towels per staging",
      "Sweep & mop (corners/behind door)",
    ],
    Kitchen: [
      "Dishes handled; run DW",
      "Sink/faucet polished",
      "Stovetop/knobs/control panel degreased",
      "Microwave in/out wiped",
      "Fridge exterior wiped; spot interior if needed",
      "DW front & panel wiped",
      "Small appliances wiped (coffee/toaster/kettle)",
      "Backsplash & counters wiped (move/replace items)",
      "Cabinet fronts spot-cleaned",
      "Restock consumables per host list",
      "Sweep & mop floor",
      "Trash/recycle emptied; liners replaced",
    ],
    "Turnover / Supplies": [
      "Restock consumables & hospitality items",
      "Inventory towels/sheets; stage per count",
      "Note low/out items in supplies log",
    ],
    "Final Walk": [
      "Lights & blinds per policy",
      "Faucets off; toilets lids down",
      "Windows/doors locked",
      "Thermostat set per policy",
      "Take required photos (3 angles/room, before & after)",
    ],
  },

  deep: {
    "Arrival / Safety": [
      "Park legally; avoid blocking walkways/driveways",
      "Announce arrival if occupied; PPE as needed",
    ],
    "All Areas — Deep": [
      "Stage per photos",
      "Ceiling corners/vents/cobwebs thoroughly",
      "Fixtures/trim/baseboards detailed",
      "Doors (tops/edges), switches detailed",
      "Interior glass & mirrors streak-free",
      "Move light furniture (safe) & clean underneath",
      "Vacuum under rugs; mop beneath if hard surface",
      "Window tracks/sills detailed",
      "Vacuum carpets; sweep/mop hard floors (edges)",
    ],
    Bedrooms: [
      "Strip/make beds per notes (fresh if provided)",
      "Detailed dusting of tops/lamps/decor",
      "Mirrors streak-free",
      "Closet fronts wiped; floors done",
      "Under bed visible area vacuumed",
      "Trash emptied; floors finished",
    ],
    Bathrooms: [
      "Trash emptied; liner replaced",
      "Lights & vent cover dusted (remove dust)",
      "Mirrors/glass shelves streak-free",
      "Sink/faucet disinfected; polish",
      "Detail counters, splash areas, grout edges",
      "Shower/tub walls & floor scrubbed (detail)",
      "Descale shower glass where needed",
      "Toilet full disinfect + behind/baseboards",
      "Refill soap; restock TP",
      "Floor thoroughly swept & mopped",
    ],
    Kitchen: [
      "Dishes handled; sink/faucet polished",
      "Stovetop & under grates degreased",
      "Microwave in/out detailed",
      "Oven interior detail (if assigned)",
      "Fridge interior detail (if assigned) + grill/coil cover",
      "Cabinet doors/hardware full wipe-down",
      "Backsplash grout/edges detailed",
      "Counters wiped (move/replace items)",
      "Sweep & mop floor (edges/toe-kicks)",
      "Trash/recycle emptied",
    ],
    "Final Walk": [
      "Lights/blinds per policy; faucets off; lids down",
      "Windows/doors locked; thermostat per policy",
      "Take required ‘after’ photos (3 angles/room)",
    ],
  },
};

// ---------- Cleaner ----------
function CleanerView() {
  const [filter, setFilter] = useState("today"); // today | week | all
  const [jobs, setJobs] = useState([]);
  const [open, setOpen] = useState({});
  const [checked, setChecked] = useState({});
  const [clockIn, setClockIn] = useState(null);
  const [files, setFiles] = useState({});
  const [cleanerName, setCleanerName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();

        const events = (data?.events || []).map((e) => {
          // pull from multiple possible column names
          const address =
            norm(e.address) ||
            norm(e.Address) ||
            norm(e.location) ||
            norm(e.Location) ||
            norm(e.addr) ||
            "";

          // prefer explicit type/service; fallback to keywords
          const explicit = normalizeType(e.type || e.service);
          const finalType = explicit || detectTypeFromText(e.title, e.notes);

          const titleText =
            norm(e.title) ||
            (finalType === "airbnb" ? "Airbnb turnover" : finalType === "deep" ? "Deep clean" : "Standard clean");

          return {
            id: `${norm(e.date)}-${norm(e.client).replace(/\s+/g, "_")}-${titleText.replace(/\s+/g, "_")}`,
            date: norm(e.date),
            start: norm(e.start),
            end: norm(e.end),
            title: titleText,
            client: norm(e.client),
            address,
            notes: norm(e.notes),
            client_phone: norm(e.client_phone),
            job_id: norm(e.job_id),
            type: finalType || "standard",
          };
        });

        // filter
        const t = todayISO();
        const filtered = events.filter((j) => {
          if (filter === "today") return j.date === t;
          if (filter === "week") return withinWeek(j.date);
          return true;
        });

        filtered.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
        setJobs(filtered);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, [filter]);

  const toggleOpen = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const toggleTask = (jobId, section, task) => {
    setChecked((prev) => {
      const next = { ...prev };
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][section]) next[jobId][section] = {};
      next[jobId][section][task] = !next[jobId][section][task];
      return next;
    });
  };

  const onFiles = (jobId, which, list) =>
    setFiles((prev) => ({ ...prev, [jobId]: { ...(prev[jobId] || {}), [which]: list } }));

  async function uploadList(jobId, which, list) {
    const out = [];
    if (!list) return out;
    for (const file of Array.from(list)) {
      const key = `${jobId}/${which}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
      if (!error) {
        const { data: u } = supabase.storage.from("photos").getPublicUrl(key);
        out.push(u.publicUrl);
      }
    }
    return out;
  }

  async function completeJob(job) {
    try {
      const beforeUrls = await uploadList(job.id, "before", files[job.id]?.before);
      const afterUrls = await uploadList(job.id, "after", files[job.id]?.after);
      const payload = {
        job_key: job.id,
        job_date: job.date,
        job_title: job.title,
        job_type: job.type,
        client: job.client,
        client_phone: job.client_phone || "",
        address: job.address || "",
        checklist: checked[job.id] || {},
        photos_before: beforeUrls,
        photos_after: afterUrls,
        cleaner_name: cleanerName || "MOR Cleaner",
      };
      const { error } = await supabase.from("completions").insert(payload);
      if (error) throw error;
      alert("Job saved as completed ✅");
      setOpen((o) => ({ ...o, [job.id]: false }));
    } catch (e) {
      console.error(e);
      alert("Error saving completion.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Shift / date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 shadow-sm border">
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
                <span className="text-sm">
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
          <div className="mt-3 flex gap-2">
            {[
              { k: "today", label: "Today" },
              { k: "week", label: "This Week" },
              { k: "all", label: "All" },
            ].map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-3 py-1 rounded-full text-sm border ${filter === k ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cleaner name */}
      <div className="p-4 rounded-2xl bg-white shadow-sm border">
        <label className="text-sm text-slate-700 flex items-center gap-2">
          <User className="w-4 h-4" />
          Cleaner name
          <input
            className="ml-3 px-3 py-2 rounded-xl border w-52"
            placeholder="Type your name"
            value={cleanerName}
            onChange={(e) => setCleanerName(e.target.value)}
          />
        </label>
      </div>

      {/* Jobs */}
      {!jobs.length ? (
        <p className="text-sm text-slate-500">No jobs found for this filter.</p>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const list = CHECKLISTS[job.type] || CHECKLISTS.standard;
            const isOpen = !!open[job.id];
            return (
              <motion.div key={job.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-4 bg-white shadow-sm">
                <button className="w-full text-left" onClick={() => setOpen((p) => ({ ...p, [job.id]: !p[job.id] }))} type="button">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {job.type === "airbnb" ? "Airbnb turnover" : job.type === "deep" ? "Deep clean" : "Standard clean"}
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">{job.client}</h4>
                      {job.address && (
                        <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{job.address}</span>
                        </div>
                      )}
                      <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          {job.date} • {job.start}
                          {job.end ? `–${job.end}` : ""}
                        </span>
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="pt-4">
                    {/* Checklist */}
                    <div className="rounded-xl border p-4 bg-emerald-50/50">
                      <h5 className="font-semibold text-emerald-900 mb-2">Checklist</h5>
                      {Object.entries(list).map(([section, tasks]) => (
                        <div key={section} className="mb-3">
                          <div className="text-sm font-medium text-emerald-800">{section}</div>
                          <ul className="mt-1 space-y-1">
                            {tasks.map((t) => (
                              <li key={t} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={!!checked[job.id]?.[section]?.[t]}
                                  onChange={() => toggleTask(job.id, section, t)}
                                />
                                <span className={checked[job.id]?.[section]?.[t] ? "line-through text-slate-400" : "text-slate-700"}>
                                  {t}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p className="text-xs text-emerald-900/80 mt-2">
                        Photo reminder: <strong>take 3 angles of each room</strong> (Before & After).
                      </p>
                    </div>

                    {/* Photos */}
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                      <div className="rounded-xl border p-4 bg-slate-50">
                        <div className="flex items-center gap-2 font-medium">
                          <ImageIcon className="w-4 h-4" /> Before photos
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Upload images</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(job.id, "before", e.target.files)} />
                        </label>
                      </div>
                      <div className="rounded-xl border p-4 bg-slate-50">
                        <div className="flex items-center gap-2 font-medium">
                          <ImageIcon className="w-4 h-4" /> After photos
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
                          <Camera className="w-4 h-4 text-slate-600" />
                          <span>Upload images</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(job.id, "after", e.target.files)} />
                        </label>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button onClick={() => completeJob(job)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2">
                        <Check className="w-4 h-4" /> Mark Complete
                      </button>
                      <button onClick={() => toggleOpen(job.id)} className="px-4 py-2 rounded-xl bg-white text-slate-700 border text-sm flex items-center gap-2">
                        <X className="w-4 h-4" /> Close
                      </button>
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

// ---------- Customer ----------
function CustomerView() {
  const [phone, setPhone] = useState("");
  const [authed, setAuthed] = useState(false);
  const [upcoming, setUpcoming] = useState([]);
  const [history, setHistory] = useState([]);

  async function loadForPhone(p) {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const data = await res.json();
      const events = (data?.events || []).map((e) => ({
        ...e,
        address: norm(e.address) || norm(e.Address) || norm(e.location) || norm(e.Location) || norm(e.addr) || "",
      }));
      const mine = events.filter((e) => (e.client_phone || "").replace(/\D/g, "") === p.replace(/\D/g, ""));
      mine.sort((a, b) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || ""));
      setUpcoming(mine);
    } catch {
      setUpcoming([]);
    }

    const { data: comps } = await supabase.from("completions").select("*").order("created_at", { ascending: false });
    const mineC = (comps || []).filter((c) => (c.client_phone || "").replace(/\D/g, "") === p.replace(/\D/g, ""));
    setHistory(mineC);
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    await loadForPhone(phone.trim());
    setAuthed(true);
  };

  if (!authed) {
    return (
      <div className="max-w-md mx-auto p-6 rounded-2xl bg-white border shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">View your cleans</h3>
        <p className="text-sm text-slate-600 mb-4">Enter the phone number on your account to view upcoming appointments and your photo gallery.</p>
        <form onSubmit={onSubmit} className="grid gap-3">
          <label className="text-sm text-slate-700 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Phone number
          </label>
          <input className="px-3 py-2 rounded-xl border" placeholder="e.g., 386-555-1212" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 text-white">Continue</button>
        </form>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="p-5 rounded-2xl bg-white border shadow-sm">
        <h3 className="font-semibold text-slate-900">Upcoming</h3>
        {!upcoming.length ? (
          <p className="text-sm text-slate-500 mt-2">No upcoming cleans found.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {upcoming.map((j) => (
              <div key={`${j.date}-${j.client}-${j.title}`} className="border rounded-xl p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {normalizeType(j.type || j.service) === "airbnb"
                    ? "Airbnb turnover"
                    : normalizeType(j.type || j.service) === "deep"
                    ? "Deep clean"
                    : detectTypeFromText(j.title, j.notes) === "airbnb"
                    ? "Airbnb turnover"
                    : detectTypeFromText(j.title, j.notes) === "deep"
                    ? "Deep clean"
                    : "Standard clean"}
                </div>
                <div className="font-medium">{j.client}</div>
                {j.address && <div className="text-sm text-slate-600">{j.address}</div>}
                <div className="text-sm text-slate-600">
                  {j.date} • {j.start}
                  {j.end ? `–${j.end}` : ""}
                </div>
                {j.notes && <div className="text-sm text-slate-600 mt-1">{j.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 rounded-2xl bg-white border shadow-sm">
        <h3 className="font-semibold text-slate-900">Past Cleans</h3>
        {!history.length ? (
          <p className="text-sm text-slate-500 mt-2">No completed cleans yet.</p>
        ) : (
          <div className="mt-3 grid gap-4">
            {history.map((c) => (
              <div key={c.id} className="border rounded-xl p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  {c.job_type === "airbnb" ? "Airbnb turnover" : c.job_type === "deep" ? "Deep clean" : "Standard clean"}
                </div>
                <div className="font-medium">{c.client}</div>
                {c.address && <div className="text-sm text-slate-600">{c.address}</div>}
                <div className="text-xs text-slate-500 mt-1">
                  Cleaner: <strong>{c.cleaner_name || "MOR Cleaner"}</strong>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium mb-1">Before</div>
                    <div className="flex flex-wrap gap-2">
                      {(c.photos_before || []).map((url) => (
                        <img key={url} src={url} alt="before" className="w-24 h-24 rounded object-cover" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">After</div>
                    <div className="flex flex-wrap gap-2">
                      {(c.photos_after || []).map((url) => (
                        <img key={url} src={url} alt="after" className="w-24 h-24 rounded object-cover" />
                      ))}
                    </div>
                  </div>
                </div>

                {c.checklist && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-emerald-700">View checked items</summary>
                    <div className="mt-2 text-sm text-slate-700">
                      {Object.entries(c.checklist).map(([section, tasks]) => (
                        <div key={section} className="mb-2">
                          <div className="font-medium">{section}</div>
                          <ul className="list-disc ml-5">
                            {Object.entries(tasks)
                              .filter(([, v]) => !!v)
                              .map(([t]) => (
                                <li key={t}>{t}</li>
                              ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- App shell ----------
export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6 border-b bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="MOR Clean" className="w-10 h-10 rounded-xl object-contain" />
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
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === k ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
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
                ? "View jobs, run the correct checklist per job type, and upload before/after photos."
                : "Login with your phone number to view only your upcoming appointments and photo history."}
            </p>
            {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
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
