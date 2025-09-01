import React, { useState, useEffect } from "react";
import "./App.css";

// Timezone + helpers
const TZ = "America/New_York";
const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDaysISO = (days) =>
  new Date(Date.now() + days * 86400000).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
const fmtTime = (ms) =>
  new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });

// Service name cleanup
const prettyService = (s = "") => {
  const raw = String(s || "").trim();
  // Hide ugly Square IDs
  if (/^[A-Z0-9]{10,}$/.test(raw)) return "Standard Clean";
  const label = raw.replace(/_/g, " ").toLowerCase();
  return label ? label.replace(/\b\w/g, (c) => c.toUpperCase()) : "Standard Clean";
};

// Phone normalization
const normalizePhone = (v = "") =>
  v.replace(/[^\d]/g, "").replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");

// Main app
export default function App() {
  const [tab, setTab] = useState("cleaner");
  return (
    <div className="App">
      <header>
        <img src="/logo.png" alt="M.O.R. Clean Daytona" className="logo" />
        <h1>M.O.R. Clean Daytona</h1>
        <p>Women-owned • Family-operated</p>
        <div className="tabs">
          <button
            className={tab === "cleaner" ? "active" : ""}
            onClick={() => setTab("cleaner")}
          >
            Cleaner Portal
          </button>
          <button
            className={tab === "customer" ? "active" : ""}
            onClick={() => setTab("customer")}
          >
            Customer Portal
          </button>
        </div>
      </header>
      {tab === "cleaner" ? <CleanerView /> : <CustomerView />}
    </div>
  );
}

// Cleaner portal
function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [range, setRange] = useState("today");
  const [beforeFiles, setBeforeFiles] = useState({});
  const [afterFiles, setAfterFiles] = useState({});

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.events || []))
      .catch((err) => console.error("API error", err));
  }, []);

  const today = todayISO();
  const weekEnd = addDaysISO(7);

  const filtered = jobs.filter((j) => {
    if (range === "today") return j.date === today;
    if (range === "week") return j.date >= today && j.date <= weekEnd;
    return true;
  });

  return (
    <div className="portal">
      <div className="filters">
        <button
          className={range === "today" ? "active" : ""}
          onClick={() => setRange("today")}
        >
          Today
        </button>
        <button
          className={range === "week" ? "active" : ""}
          onClick={() => setRange("week")}
        >
          This Week
        </button>
        <button
          className={range === "all" ? "active" : ""}
          onClick={() => setRange("all")}
        >
          All
        </button>
      </div>
      {filtered.length === 0 ? (
        <p>No jobs found.</p>
      ) : (
        filtered.map((job) => (
          <details key={job.id} className="job">
            <summary>
              <span className="type">{prettyService(job.service_type)}</span>{" "}
              • <span className="client">{job.client}</span>{" "}
              <span className="time">
                {job.date} {job.start}-{job.end}
              </span>
            </summary>
            <p className="addr">{job.address || "No address on file"}</p>
            <p className="notes">{job.notes}</p>

            <h4>Arrival / Safety</h4>
            <ul>
              <li><input type="checkbox" /> Lock/Alarm off</li>
              <li><input type="checkbox" /> Shoes off</li>
              <li><input type="checkbox" /> Initial walkthrough</li>
            </ul>

            <h4>Kitchen</h4>
            <ul>
              <li><input type="checkbox" /> Counters wiped</li>
              <li><input type="checkbox" /> Sink scrubbed</li>
              <li><input type="checkbox" /> Appliances outside</li>
              <li><input type="checkbox" /> Floors swept/mopped</li>
            </ul>

            <h4>Bathrooms</h4>
            <ul>
              <li><input type="checkbox" /> Toilets sanitized</li>
              <li><input type="checkbox" /> Mirrors cleaned</li>
              <li><input type="checkbox" /> Shower/tub scrubbed</li>
              <li><input type="checkbox" /> Floors</li>
            </ul>

            <h4>Bedrooms</h4>
            <ul>
              <li><input type="checkbox" /> Beds made</li>
              <li><input type="checkbox" /> Dust surfaces</li>
              <li><input type="checkbox" /> Floors vacuumed/mopped</li>
            </ul>

            <div className="photos">
              <h4>Before Photos</h4>
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setBeforeFiles({ ...beforeFiles, [job.id]: e.target.files })
                }
              />
              <h4>After Photos</h4>
              <input
                type="file"
                multiple
                onChange={(e) =>
                  setAfterFiles({ ...afterFiles, [job.id]: e.target.files })
                }
              />
            </div>
          </details>
        ))
      )}
    </div>
  );
}

// Customer portal
function CustomerView() {
  const [phone, setPhone] = useState("");
  const [jobs, setJobs] = useState([]);
  const [ok, setOk] = useState(false);

  const load = () => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        const matches = (data.events || []).filter(
          (j) => normalizePhone(j.client_phone) === normalizePhone(phone)
        );
        setJobs(matches);
        setOk(true);
      });
  };

  return (
    <div className="portal">
      {!ok ? (
        <div>
          <p>Enter your phone number to view your schedule and photos.</p>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
          <button onClick={load}>View my schedule</button>
        </div>
      ) : jobs.length === 0 ? (
        <p>No upcoming cleans found.</p>
      ) : (
        jobs.map((job) => (
          <div key={job.id} className="job">
            <h3>
              {prettyService(job.service_type)} • {job.date} {job.start}–
              {job.end}
            </h3>
            <p>{job.address}</p>
            <div className="photos">
              <h4>Before Photos</h4>
              <div className="grid before">
                {/* images would load here */}
              </div>
              <h4>After Photos</h4>
              <div className="grid after">
                {/* images would load here */}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
