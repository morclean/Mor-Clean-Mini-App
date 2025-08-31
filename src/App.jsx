function CleanerView() {
  const [jobs, setJobs] = useState([]);
  const [expanded, setExpanded] = useState({});       // collapsed by default
  const [checked, setChecked] = useState({});
  const [done, setDone] = useState({});
  const [files, setFiles] = useState({});
  const [openRooms, setOpenRooms] = useState({});
  const [clockIn, setClockIn] = useState(null);

  const fmtTime = (d) =>
    d ? new Date(`${d}`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  // load jobs from Google Sheet (/api/jobs)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json();

        // expect rows with these fields from the Sheet:
        // date, start, end, title, client, address, notes, client_phone, service_type
        const events = (data?.events || []).map((e) => ({
          id: `${e.date}-${(e.client || "").replace(/\s+/g, "_")}-${(e.title || "Clean").replace(/\s+/g, "_")}`,
          date: e.date,
          start: e.start || "",
          end: e.end || "",
          title: e.title || "Clean",
          client: e.client || "",
          address: e.address || "",
          notes: e.notes || "",
          client_phone: e.client_phone || "",
          service_type: e.service_type || "", // e.g. "Residential", "Airbnb", "Deep Clean"
        }));

        // today → +30 days
        const today = new Date().toISOString().slice(0, 10);
        const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

        const upcoming = events
          .filter((j) => j.date >= today && j.date <= in30)
          .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

        setJobs(upcoming);
      } catch (err) {
        console.error(err);
        setJobs([]);
      }
    })();
  }, []);

  // set “standard” rooms open by default when a job is expanded the first time
  useEffect(() => {
    if (!jobs.length) return;
    const init = {};
    for (const j of jobs) init[j.id] = {};
    setOpenRooms(init);
  }, [jobs]);

  const toggleCard = (jobId) =>
    setExpanded((x) => ({ ...x, [jobId]: !x[jobId] }));

  const toggleRoom = (jobId, room) =>
    setOpenRooms((prev) => ({ ...prev, [jobId]: { ...prev[jobId], [room]: !prev[jobId]?.[room] } }));

  const toggleTask = (jobId, room, task) =>
    setChecked((prev) => {
      const next = structuredClone(prev);
      if (!next[jobId]) next[jobId] = {};
      if (!next[jobId][room]) next[jobId][room] = {};
      next[jobId][room][task] = !next[jobId][room][task];
      return next;
    });

  const onFiles = (jobId, list) => setFiles((prev) => ({ ...prev, [jobId]: list }));

  async function completeJob(job) {
    const uploaded = [];
    const list = files[job.id] || [];
    for (const file of list) {
      const key = `${job.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(key, file, { upsert: true });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(key);
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
    return <p className="text-sm text-slate-500">No upcoming jobs found.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Shift card */}
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
          <p className="text-sm text-slate-500">{new Date().toISOString().slice(0, 10)}</p>
        </div>
      </div>

      {/* Job list (collapsed by default) */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const isOpen = !!expanded[job.id];
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border shadow-sm overflow-hidden ${
                done[job.id] ? "bg-emerald-50" : "bg-white"
              }`}
            >
              {/* Header row (always visible) */}
              <button
                type="button"
                onClick={() => toggleCard(job.id)}
                className="w-full text-left p-4 flex items-start gap-4 hover:bg-emerald-50/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <span>{job.service_type || "Clean"}</span>
                    <span>•</span>
                    <span>{job.date}</span>
                    {job.start ? (
                      <>
                        <span>•</span>
                        <span>
                          {job.start}
                          {job.end ? ` – ${job.end}` : ""}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-0.5 font-semibold truncate">
                    {/* Show client + title, NOT the booking id */}
                    {job.client || "Client"}{job.title ? ` — ${job.title}` : ""}
                  </div>

                  {job.address ? (
                    <div className="mt-0.5 text-sm text-slate-600 truncate flex items-center gap-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="truncate">{job.address}</span>
                    </div>
                  ) : null}
                </div>

                <div className="self-center text-slate-500">
                  {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </button>

              {/* Expanded content (details + checklist + photos + complete) */}
              {isOpen && (
                <div className="px-4 pb-4">
                  {/* Notes */}
                  {(job.notes || job.client_phone) && (
                    <div className="mb-3 text-sm">
                      {job.notes && (
                        <div className="mb-1">
                          <span className="font-medium">Notes: </span>
                          <span className="whitespace-pre-wrap">{job.notes}</span>
                        </div>
                      )}
                      {job.client_phone && (
                        <div className="text-slate-600">
                          <span className="font-medium">Phone: </span>
                          {job.client_phone}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Room-by-room checklist (collapsed sections) */}
                  <div className="space-y-3">
                    {Object.entries(MASTER_CHECKLIST).map(([room, tasks]) => {
                      const roomOpen = !!openRooms[job.id]?.[room];
                      return (
                        <div key={room} className="border rounded-xl">
                          <button
                            type="button"
                            onClick={() => toggleRoom(job.id, room)}
                            className="w-full flex items-center justify-between px-4 py-3"
                          >
                            <span className="font-semibold">{room}</span>
                            {roomOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                          </button>
                          {roomOpen && (
                            <div className="px-4 pb-3">
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

                  {/* Complete */}
                  <div className="mt-4 flex justify-end">
                    {!done[job.id] && (
                      <button
                        onClick={() => completeJob(job)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
