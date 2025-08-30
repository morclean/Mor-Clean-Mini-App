// src/App.jsx — CLEAN VERSION

import { supabase } from "./lib/supabase";
import { MASTER_CHECKLIST } from "./lib/checklist";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Camera, Calendar, MapPin, LogIn, LogOut, Send } from "lucide-react";

const fmtTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const todayISO = () => new Date().toISOString().slice(0, 10);

useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.events || []);
    } catch (err) {
      console.error(err);
      setJobs([]);
    }
  })();
}, []);


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
        <p className="text-slate-700 mt-2">Thanks, {data.name || "friend"}! We'll text you from <strong>386-318-5521</strong> to confirm details and pricing.</p>
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
          <option>Mid-day (12p–3p)</option>
          <option>Afternoon (3p–6p)</option>
        </select>
      </div>

      <textarea rows={4} className="px-3 py-2 rounded-xl border" placeholder="Notes (pets, gate codes, priorities)" value={data.notes} onChange={(e)=>setData({...data,notes:e.target.value})}/>

      <div className="flex flex-wrap items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
          <Send className="w-4 h-4"/> Submit request
        </button>
        <a className="text-emerald-700 underline" href="https://www.morcleandaytona.com" target="_blank" rel="noreferrer">Visit website</a>
        <a className="text-emerald-700 underline" href="tel:13863185521">Call/Text 386-318-5521</a>
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
              <p className="text-xs text-emerald-800/70">Women-owned • Family-operated</p>
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
                <>Request a clean in under a minute. Same-day payment • Card on file • No refunds.</>
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
        <p className="text-slate-700 mt-2">Thanks, {data.name || "friend"}! We'll text you from <strong>386-318-5521</strong> to confirm details and pricing.</p>
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
          <option>Mid-day (12p–3p)</option>
          <option>Afternoon (3p–6p)</option>
        </select>
      </div>

      <textarea rows={4} className="px-3 py-2 rounded-xl border" placeholder="Notes (pets, gate codes, priorities)" value={data.notes} onChange={(e)=>setData({...data,notes:e.target.value})}/>

      <div className="flex flex-wrap items-center gap-3">
        <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-2">
          <Send className="w-4 h-4"/> Submit request
        </button>
        <a className="text-emerald-700 underline" href="https://www.morcleandaytona.com" target="_blank" rel="noreferrer">Visit website</a>
        <a className="text-emerald-700 underline" href="tel:13863185521">Call/Text 386-318-5521</a>
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
              <p className="text-xs text-emerald-800/70">Women-owned • Family-operated</p>
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
                <>Request a clean in under a minute. Same-day payment • Card on file • No refunds.</>
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
