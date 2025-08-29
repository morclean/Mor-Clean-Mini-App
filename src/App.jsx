import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Camera, Calendar, MapPin, LogIn, LogOut, Send } from "lucide-react";

const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0,10);

const seedJobs = () => ([
  {
    id: "job-1",
    date: todayISO(),
    title: "2BR/2BA • Monthly • Student Housing",
    client: "ATP Flight School – Integra Shores #1204",
    address: "100 Integra Shores Dr, Daytona Beach, FL",
    window: "10:00a–12:00p",
    notes: "Use MOR standard + patio included. Laundry already handled.",
    tasks: ["Kitchen & appliances", "2 bathrooms", "Dust & surfaces", "Floors & baseboards", "Patio sweep & wipe"],
  },
  {
    id: "job-2",
    date: todayISO(),
    title: "3BR/2BA • Bi-weekly",
    client: "Lisa • Riverfront Condo",
    address: "Riverside Dr, Ormond Beach, FL",
    window: "1:00p–3:30p",
    notes: "Both patios included. Olivia is lead.",
    tasks: ["General tidy", "Glass & mirrors", "Bathrooms", "Mop tile floors", "Patio wipe down"],
  },
]);

const load = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function CleanerView() {
  const [clockIn, setClockIn] = useState(load("mor_clockIn", null));
  const [jobs, setJobs] = useState(load("mor_jobs", seedJobs()));
  const [done, setDone] = useState(load("mor_done", {}));
  const [checked, setChecked] = useState(load("mor_checked", {}));

  useEffect(() => save("mor_clockIn", clockIn), [clockIn]);
  useEffect(() => save("mor_jobs", jobs), [jobs]);
  useEffect(() => save("mor_done", done), [done]);
  useEffect(() => save("mor_checked", checked), [checked]);

  const onToggleTask = (jobId, task) => {
    setChecked((prev) => ({
      ...prev,
      [jobId]: { ...(prev[jobId] || {}), [task]: !(prev[jobId]?.[task]) },
    }));
  };

  const onComplete = (jobId) => {
    setDone((d) => ({ ...d, [jobId]: true }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="p-5 rounded-2xl bg-emerald-50 shadow-sm border border-emerald-100">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-emerald-700"/>
            <h3 className="font-semibold text-emerald-900">Shift</h3>
          </div>
          <div className="mt-3 flex items-center gap-3">
            {!clockIn ? (
              <button onClick={() => setClockIn(Date.now())} className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2 shadow hover:bg-emerald-700">
                <LogIn className="w-4 h-4"/> Clock In
              </button>
            ) : (
              <>
                <span className="text-sm text-emerald-900/80">Clocked in at <strong>{fmtTime(clockIn)}</strong></span>
                <button onClick={() => setClockIn(null)} className="px-4 py-2 rounded-xl bg-rose-600 text-white flex items-center gap-2 shadow hover:bg-rose-700">
                  <LogOut className="w-4 h-4"/> Clock Out
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white shadow-sm border">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-emerald-700"/>
            <h3 className="font-semibold text-slate-800">Today's Jobs</h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">{todayISO()}</p>
        </div>
      </div>

      <div className="grid gap-5">
        {jobs.map((job) => (
          <motion.div key={job.id} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className={`rounded-2xl border p-5 shadow-sm ${done[job.id] ? "bg-emerald-50/70" : "bg-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-800">{job.title}</h4>
                <p className="text-emerald-900 font-medium">{job.client}</p>
                <div className="mt-1 text-sm text-slate-600 flex flex-wrap items-center gap-2">
                  <MapPin className="w-4 h-4"/> <span>{job.address}</span>
                </div>
                <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4"/> <span>{job.window}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs ${done[job.id] ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {done[job.id] ? "Completed" : "In progress"}
                </span>
                {!done[job.id] && (
                  <button onClick={() => onComplete(job.id)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2 hover:bg-emerald-700">
                    <Check className="w-4 h-4"/> Mark Complete
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-600 mt-3">{job.notes}</p>

            <div className="mt-4 grid sm:grid-cols-2 gap-6">
              <div>
                <h5 className="font-medium text-slate-800 mb-2">Checklist</h5>
                <ul className="space-y-2">
                  {job.tasks.map((t) => (
                    <li key={t} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={!!checked[job.id]?.[t]}
                        onChange={() => onToggleTask(job.id, t)}
                      />
                      <span className={checked[job.id]?.[t] ? "line-through text-slate-400" : "text-slate-700"}>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-slate-800 mb-2">Photos (Before / After)</h5>
                <div className="p-3 border rounded-xl bg-slate-50">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Camera className="w-4 h-4 text-slate-600"/>
                    <span>Upload images</span>
                    <input type="file" accept="image/*" multiple className="hidden"/>
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Tip: take wide shots and any damage notes.</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CustomerView() {
  const [sent, setSent] = useState(false);
  const [data, setData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    service: "Standard clean",
    beds: 2,
    baths: 2,
    date: "",
    window: "Morning (9a–12p)",
    notes: "",
  });

  const onSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="p-6 rounded-2xl border bg-emerald-50">
        <h3 className="text-emerald-900 font-semibold text-lg">Request received 🎉</h3>
        <p className="text-slate-700 mt-2">Thanks, {data.name || "friend"}! We'll text you from <strong>386‑318‑5521</strong> to confirm details and pricing. Same‑day payment and card on file policy applies.</p>
        <div className="mt-4 text-sm text-slate-600">
          <p><strong>Service:</strong> {data.service} • {data.beds}bd/{data.baths}ba</p>
          <p><strong>Date:</strong> {data.date || "TBD"} • <strong>Window:</strong> {data.window}</p>
          <p><strong>Address:</strong> {data.address}</p>
        </div>
        <button onClick={() => setSent(false)} className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm">Send another request</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <input required placeholder="Full name" className="px-3 py-2 rounded-xl border" value={data.name} onChange={(e)=>setData({...data,name:e.target.value})}/>
        <input required placeholder="Phone" className="px-3 py-2 rounded-xl border" value={data.phone} onChange={(e)=>setData({...data,phone:e.target.value})}/>
      </div>
      <input type="email" placeholder="Email (optional)" className="px-3 py-2 rounded-xl border" value={data.email} onChange={(e)=>setData({...data,email:e.target.value})}/>
      <input required placeholder="Service address" className="px-3 py-2 rounded-xl border" value={data.address} onChange={(e)=>setData({...data,address:e.target.value})}/>

      <div className="grid sm:grid-cols-3 gap-4">
        <select className="px-3 py-2 rounded-xl border" value={data.service} onChange={(e)=>setData({...data,service:e.target.value})}>
          <option>Standard clean</option>
          <option>Deep clean</option>
          <option>Move-in/out</option>
          <option>Post-construction</option>
          <option>Airbnb turnover</option>
        </select>
        <input type="number" min={0} className="px-3 py-2 rounded-xl border" value={data.beds} onChange={(e)=>setData({...data,beds:+e.target.value})} placeholder="Bedrooms"/>
        <input type="number" min={0} className="px-3 py-2 rounded-xl border" value={data.baths} onChange={(e)=>setData({...data,baths:+e.target.value})} placeholder="Bathrooms"/>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <input type="date" className="px-3 py-2 rounded-xl border" value={data.date} onChange={(e)=>setData({...data,date:e.target.value})}/>
        <select className="px-3 py-2 rounded-xl border" value={data.window} onChange={(e)=>setData({...data,window:e.target.value})}>
          <option>Morning (9a–12p)</option>
          <option>Mid‑day (12p–3p)</option>
          <option>Afternoon (3p–6p)</option>
        </select>
      </div>

      <textarea rows={4} className="px-3 py-2 rounded-xl border" placeholder="Notes (pets, gate codes, priorities)" value={data.notes} onChange={(e)=>setData({...data,notes:e.target.value})}/>

      <div className="flex flex-wrap items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
          <Send className="w-4 h-4"/> Submit request
        </button>
        <a className="text-emerald-700 underline" href="https://www.morcleandaytona.com" target="_blank" rel="noreferrer">Visit website</a>
        <a className="text-emerald-700 underline" href="tel:13863185521">Call/Text 386‑318‑5521</a>
      </div>
    </form>
  );
}

export default function App() {
  const [tab, setTab] = useState("cleaner");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
      <header className="px-5 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600"></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900">M.O.R. Clean Daytona</h1>
              <p className="text-xs text-emerald-800/70">Women‑owned • Family‑operated</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 bg-white border rounded-2xl p-1 shadow-sm">
            {[
              {k:"cleaner", label:"Cleaner Portal"},
              {k:"customer", label:"Customer Portal"},
            ].map(({k,label}) => (
              <button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab===k?"bg-emerald-600 text-white":"text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-5 pb-16">
        <div className="max-w-5xl mx-auto grid gap-6">
          <section className="rounded-3xl bg-white border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">{tab === "cleaner" ? "Cleaner Portal" : "Customer Booking"}</h2>
            <p className="text-sm text-slate-500 mb-6">
              {tab === "cleaner" ? (
                <>Clock in, view today’s jobs, check off tasks, and attach photos.</>
              ) : (
                <>Request a clean in under a minute. Same‑day payment • Card on file • No refunds.</>
              )}
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
