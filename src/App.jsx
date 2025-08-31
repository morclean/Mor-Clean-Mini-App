import { useEffect, useMemo, useState } from "react";

// --- helpers ----------------------------------------------------
const fmtDate = (iso) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso || "";
  }
};
const onlyDigits = (s) => (s || "").replace(/\D+/g, "");
const withinThisWeek = (iso) => {
  if (!iso) return false;
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  const day = now.getDay(); // 0..6, Sun=0
  const start = new Date(now);
  start.setDate(now.getDate() - day); // Sunday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Saturday
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
};

// A little accordion for sections
function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="font-medium text-slate-800">{title}</span>
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// One job card used in both portals
function JobCard({ job, compact = false }) {
  const subtitle = [
    job.client && <span key="c" className="text-slate-600">{job.client}</span>,
    (job.start || job.end) && (
      <span key="t" className="text-slate-500">
        {(job.client ? " • " : "")}{job.start || ""}{job.end ? `–${job.end}` : ""}
      </span>
    ),
  ];

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
      <div className="text-sm text-slate-500">{fmtDate(job.date)}</div>
      <div className="mt-0.5 font-semibold text-slate-800">
        {/* Human title only; never show codes/IDs */}
        {job.title || "Clean"}{job.client ? " — " : ""}{/* keep the em dash spacing */}
        {job.client}
      </div>
      {!compact && (
        <div className="mt-1 text-sm">{subtitle}</div>
      )}
      {!!job.address && (
        <div className="mt-1 text-sm text-slate-600">{job.address}</div>
      )}
    </div>
  );
}

// =====================================================================
// Cleaner Portal
// =====================================================================
function CleanerPortal({ events }) {
  const [tab, setTab] = useState("today"); // today | week | all
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const base = (events || []).filter((e) => {
      if (tab === "today") {
        const today = new Date().toISOString().slice(0, 10);
        return e.date === today;
      }
      if (tab === "week") return withinThisWeek(e.date);
      return true; // all
    });

    if (!q.trim()) return base;

    const needle = q.trim().toLowerCase();
    return base.filter((e) => {
      return (
        (e.client || "").toLowerCase().includes(needle) ||
        (e.address || "").toLowerCase().includes(needle) ||
        (e.notes || "").toLowerCase().includes(needle) ||
        (e.title || "").toLowerCase().includes(needle)
      );
    });
  }, [events, tab, q]);

  return (
    <div className="space-y-6">
      {/* top controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-white rounded-full p-1 border border-slate-200">
          {[
            { k: "today", label: "Today" },
            { k: "week", label: "This Week" },
            { k: "all", label: "All" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={
                "px-3 py-1.5 text-sm rounded-full " +
                (tab === t.k
                  ? "bg-emerald-600 text-white"
                  : "text-slate-700 hover:bg-slate-100")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className="ml-auto w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Search client, address, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* list */}
      <div className="space-y-5">
        {filtered.map((job) => (
          <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <JobCard job={job} compact />

            {/* collapsibles for checklists — collapsed by default */}
            <div className="mt-4 grid gap-3">
              <Accordion title="Arrival / Safety">
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  <li>Park safely; avoid blocking driveways/garages</li>
                  <li>Announce arrival if occupied; respect quiet hours</li>
                  <li>Log any safety issues in Notes</li>
                </ul>
              </Accordion>
              <Accordion title="Kitchen">
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  <li>Surfaces wiped & sanitized</li>
                  <li>Appliance exteriors wiped</li>
                  <li>Sink & faucet cleaned</li>
                </ul>
              </Accordion>
              <Accordion title="Bathrooms">
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  <li>Toilet/shower/sink cleaned</li>
                  <li>Mirrors streak-free</li>
                  <li>Restock essentials</li>
                </ul>
              </Accordion>
              <Accordion title="Bedrooms">
                <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                  <li>Dust, surfaces, tidy</li>
                  <li>Floors vacuumed/mopped</li>
                </ul>
              </Accordion>
            </div>
          </div>
        ))}

        {!filtered.length && (
          <div className="text-center text-slate-500 text-sm">No jobs match.</div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Customer Portal (phone-gated view)
// =====================================================================
function CustomerPortal({ events }) {
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [nameFallback, setNameFallback] = useState("");

  const matches = useMemo(() => {
    if (!submitted) return [];
    const p = onlyDigits(phone);
    const last4 = p.slice(-4);

    return (events || []).filter((e) => {
      const ep = onlyDigits(e.client_phone);
      if (ep) {
        // exact or last-4 match
        return ep === p || (last4 && ep.endsWith(last4));
      }
      // if your sheet doesn’t yet have phone, allow a temporary name fallback
      if (nameFallback.trim()) {
        const n = nameFallback.trim().toLowerCase();
        return (e.client || "").toLowerCase().includes(n);
      }
      return false;
    });
  }, [events, phone, submitted, nameFallback]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
        <div className="font-semibold text-slate-800 mb-1">Customer Portal</div>
        <div className="text-slate-600 text-sm">
          See your upcoming cleans and photos from past visits.
        </div>
      </div>

      {!submitted ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Phone number on file
          </label>
          <input
            inputMode="tel"
            placeholder="(xxx) xxx-xxxx or last 4"
            className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="text-xs text-slate-500">
            Don’t have your phone on file yet? Enter your name as a temporary fallback:
          </div>
          <input
            placeholder="Name (optional)"
            className="w-full sm:w-80 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={nameFallback}
            onChange={(e) => setNameFallback(e.target.value)}
          />

          <button
            onClick={() => setSubmitted(true)}
            className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            View my cleans
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="font-semibold text-slate-800 mb-2">Upcoming Cleans</div>
          {!matches.length && (
            <div className="text-sm text-slate-500">
              No cleans found for that phone. Try your full number or check with us.
            </div>
          )}
          <div className="space-y-3">
            {matches.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Root App
// =====================================================================
export default function App() {
  const [tab, setTab] = useState("cleaner"); // cleaner | customer
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load jobs");
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (e) {
        setErr(e.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="sticky top-0 z-10 border-b border-emerald-100 bg-emerald-50/90 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-3">
          <img src="/logo.png" alt="M.O.R. Clean Daytona" className="h-8 w-8 rounded-full" />
          <div className="font-semibold text-emerald-900">M.O.R. Clean Daytona</div>
          <div className="ml-auto flex gap-2">
            <button
              className={
                "rounded-full px-3 py-1.5 text-sm " +
                (tab === "cleaner"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200")
              }
              onClick={() => setTab("cleaner")}
            >
              Cleaner Portal
            </button>
            <button
              className={
                "rounded-full px-3 py-1.5 text-sm " +
                (tab === "customer"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-slate-700 border border-slate-200")
              }
              onClick={() => setTab("customer")}
            >
              Customer Portal
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading && <div className="text-slate-600">Loading jobs…</div>}
        {!!err && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
            {err}
          </div>
        )}
        {!loading && !err && (
          tab === "cleaner" ? (
            <CleanerPortal events={events} />
          ) : (
            <CustomerPortal events={events} />
          )
        )}
      </main>
    </div>
  );
}
