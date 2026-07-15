/* ============================================================
   TR–1 · daily routine tracker · rev.E (local profile, no accounts)
   data model (localStorage "tr1-data"):
   {
     tasks: [{ id, name, created: "YYYY-MM-DD", archived: "YYYY-MM-DD"|null }],
     log:   { "YYYY-MM-DD": ["taskId", ...] }   // ids checked that day
   }
   profile (localStorage "tr1-profile"): { name, dob: "YYYY-MM-DD" }
   Deleting a task archives it, so history and stats stay intact.
   All data stays on the device — there is no server-side storage.
   ============================================================ */

const STORE_KEY = "tr1-data";
const PROFILE_KEY = "tr1-profile";

// ---------- state ----------

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.tasks) && typeof data.log === "object") return data;
    }
  } catch (e) { /* corrupted store -> start fresh */ }
  return { tasks: [], log: {} };
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const state = load();

// ---------- profile (name + birthdate, stored locally) ----------

function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (p && typeof p.name === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.dob || "")) return p;
  } catch (e) { /* fall through */ }
  return null;
}

let profile = loadProfile();

function ageFrom(dob) {
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

function updateAccountUi() {
  const btn = document.getElementById("account-btn");
  btn.textContent = profile ? `${profile.name} · ${ageFrom(profile.dob)}` : "set up";
  document.getElementById("footnote-mode").textContent = "made by Aquma";
}

// ---------- welcome overlay ----------

const welcomeEl = document.getElementById("welcome");
const welcomeError = document.getElementById("welcome-error");

function showWelcome(show) {
  welcomeEl.classList.toggle("hidden", !show);
  welcomeError.textContent = "";
  if (show && profile) {
    // editing an existing profile: prefill
    document.getElementById("welcome-name").value = profile.name;
    document.getElementById("welcome-dob").value = profile.dob;
  }
}

document.getElementById("welcome-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = document.getElementById("welcome-name").value.trim().slice(0, 20);
  const dob = document.getElementById("welcome-dob").value;
  if (!name) { welcomeError.textContent = "please enter your name"; return; }
  const age = ageFrom(dob);
  if (!dob || age < 0 || age > 120) { welcomeError.textContent = "please enter a valid birthdate"; return; }
  profile = { name, dob };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  updateAccountUi();
  showWelcome(false);
});

// ---------- settings overlay ----------

const settingsEl = document.getElementById("settings");
const settingsMsg = document.getElementById("settings-msg");

function showSettings(show) {
  settingsEl.classList.toggle("hidden", !show);
  settingsMsg.textContent = "";
  if (show) {
    document.getElementById("settings-profile").textContent =
      profile ? `${profile.name} · ${ageFrom(profile.dob)} years` : "not set";
    document.getElementById("reminder-time").value = localStorage.getItem(REMINDER_KEY) || "";
  }
}

document.getElementById("account-btn").addEventListener("click", () => showSettings(true));
document.getElementById("settings-close").addEventListener("click", () => showSettings(false));

document.getElementById("profile-edit-btn").addEventListener("click", () => {
  showSettings(false);
  showWelcome(true);
});

// --- export / import ---

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `tr1-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  settingsMsg.textContent = "exported ✓";
});

document.getElementById("import-btn").addEventListener("click", () =>
  document.getElementById("import-file").click());

// clear all: tap once to arm, tap again within 4s to confirm (no popup)
const clearAllBtn = document.getElementById("clear-all-btn");
let clearArmTimer = null;
clearAllBtn.addEventListener("click", () => {
  if (clearArmTimer) {
    clearTimeout(clearArmTimer);
    clearArmTimer = null;
    clearAllBtn.textContent = "clear all actions";
    clearAllTasks();
    settingsMsg.textContent = "all actions cleared (history kept)";
  } else {
    clearAllBtn.textContent = "tap again to confirm";
    settingsMsg.textContent = "";
    clearArmTimer = setTimeout(() => {
      clearArmTimer = null;
      clearAllBtn.textContent = "clear all actions";
    }, 4000);
  }
});

document.getElementById("import-file").addEventListener("change", async e => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.tasks) || typeof data.log !== "object") throw new Error("bad shape");
    if (!confirm(`import ${data.tasks.length} actions?\nthis replaces current data.`)) return;
    state.tasks = data.tasks;
    state.log = data.log || {};
    save();
    renderToday();
    settingsMsg.textContent = "imported ✓";
  } catch {
    settingsMsg.textContent = "not a valid TR-1 backup file";
  }
});

// --- daily reminder (local notification while app/PWA is running) ---

const REMINDER_KEY = "tr1-reminder";
let reminderFiredFor = null; // day string it last fired

document.getElementById("reminder-time").addEventListener("change", async e => {
  const time = e.target.value;
  if (!time) return;
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if ("Notification" in window && Notification.permission !== "granted") {
    settingsMsg.textContent = "notifications blocked — allow them in browser settings";
    e.target.value = "";
    return;
  }
  localStorage.setItem(REMINDER_KEY, time);
  settingsMsg.textContent = `reminder set for ${time} ✓`;
});

document.getElementById("reminder-clear").addEventListener("click", () => {
  localStorage.removeItem(REMINDER_KEY);
  document.getElementById("reminder-time").value = "";
  settingsMsg.textContent = "reminder off";
});

function checkReminder() {
  const time = localStorage.getItem(REMINDER_KEY);
  if (!time || !("Notification" in window) || Notification.permission !== "granted") return;
  const day = today();
  if (reminderFiredFor === day) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm < time) return;
  const r = ratioOn(day);
  if (r !== null && r < 1) {
    reminderFiredFor = day;
    const tasks = activeTasksOn(day);
    const done = doneOn(day).filter(id => tasks.some(t => t.id === id)).length;
    new Notification("TR–1", { body: `${done}/${tasks.length} done today — finish your routine`, icon: "./icons/icon-180.png" });
  } else {
    reminderFiredFor = day; // all done (or nothing scheduled): don't nag
  }
}

// ---------- date helpers (all local time) ----------

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function today() { return dateStr(new Date()); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

function prettyDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

// tasks that existed (created, not yet archived) on a given day
function activeTasksOn(day) {
  return state.tasks.filter(t => t.created <= day && (!t.archived || t.archived > day));
}

function doneOn(day) { return state.log[day] || []; }

// completion ratio for a day: checked / tasks that existed that day
function ratioOn(day) {
  const active = activeTasksOn(day);
  if (active.length === 0) return null; // nothing scheduled that day
  const ids = new Set(active.map(t => t.id));
  const done = doneOn(day).filter(id => ids.has(id)).length;
  return done / active.length;
}

// ---------- today screen ----------

const taskListEl = document.getElementById("task-list");
const emptyHintEl = document.getElementById("empty-hint");
const addForm = document.getElementById("add-form");
const addInput = document.getElementById("add-input");

function renderToday() {
  const day = today();
  const tasks = activeTasksOn(day);
  const done = new Set(doneOn(day));

  taskListEl.innerHTML = "";
  emptyHintEl.classList.toggle("hidden", tasks.length > 0);

  for (const t of tasks) {
    const li = document.createElement("li");
    li.className = "task-item" + (done.has(t.id) ? " done" : "");

    const check = document.createElement("button");
    check.className = "check";
    check.textContent = "✓";
    check.setAttribute("aria-label", `toggle ${t.name}`);
    check.addEventListener("click", () => toggleTask(t.id));

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = t.name;
    name.title = "tap to rename";
    name.addEventListener("click", () => renameTask(t));

    const move = document.createElement("span");
    move.className = "move";
    const up = document.createElement("button");
    up.className = "move-btn";
    up.textContent = "▲";
    up.setAttribute("aria-label", `move ${t.name} up`);
    up.addEventListener("click", () => moveTask(t, -1));
    const down = document.createElement("button");
    down.className = "move-btn";
    down.textContent = "▼";
    down.setAttribute("aria-label", `move ${t.name} down`);
    down.addEventListener("click", () => moveTask(t, 1));
    move.append(up, down);

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.setAttribute("aria-label", `remove ${t.name}`);
    del.addEventListener("click", () => removeTask(t));

    li.append(check, name, move, del);
    taskListEl.appendChild(li);
  }

  renderMeter(tasks.length, [...done].filter(id => tasks.some(t => t.id === id)).length);
}

function renderMeter(total, done) {
  document.getElementById("date-label").textContent = prettyDate(today());
  document.getElementById("progress-label").textContent = `${done}/${total}`;

  const meter = document.getElementById("meter");
  meter.innerHTML = "";
  const lit = total === 0 ? 0 : Math.round((done / total) * 20);
  for (let i = 0; i < 20; i++) {
    const seg = document.createElement("span");
    if (i < lit) seg.className = "on";
    meter.appendChild(seg);
  }
}

function toggleTask(id) {
  const day = today();
  const list = state.log[day] || (state.log[day] = []);
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1);
  else {
    list.push(id);
    const led = document.getElementById("led-activity");
    led.classList.remove("blink");
    void led.offsetWidth; // restart animation
    led.classList.add("blink");
  }
  save();
  renderToday();
}

function addTask(name) {
  state.tasks.push({
    id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    created: today(),
    archived: null,
  });
  save();
  renderToday();
}

function removeTask(task) {
  task.archived = today();
  save();
  renderToday();
}

function clearAllTasks() {
  const day = today();
  for (const t of state.tasks) if (!t.archived) t.archived = day;
  save();
  renderToday();
}

function renameTask(task) {
  const name = prompt("rename action:", task.name);
  if (name === null) return;
  const trimmed = name.trim().slice(0, 60);
  if (!trimmed) return;
  task.name = trimmed;
  save();
  renderToday();
}

function moveTask(task, dir) {
  const i = state.tasks.indexOf(task);
  // find the adjacent non-archived task to swap with
  let j = i + dir;
  while (j >= 0 && j < state.tasks.length && state.tasks[j].archived) j += dir;
  if (j < 0 || j >= state.tasks.length) return;
  [state.tasks[i], state.tasks[j]] = [state.tasks[j], state.tasks[i]];
  save();
  renderToday();
}

addForm.addEventListener("submit", e => {
  e.preventDefault();
  const name = addInput.value.trim();
  if (name) addTask(name);
  addInput.value = "";
  addInput.focus();
});

// ---------- history screen ----------

function renderHistory() {
  const heatmap = document.getElementById("heatmap");
  heatmap.innerHTML = "";

  // 12 weeks ending today, columns = weeks, rows = weekday
  const days = 7 * 12;
  const todayDow = new Date().getDay(); // 0=Sun
  const lead = 6 - todayDow;            // pad so today lands in last column
  for (let i = days - 1 - lead; i >= -lead; i--) {
    const cell = document.createElement("span");
    cell.className = "cell";
    if (i >= 0) {
      const day = daysAgo(i);
      const r = ratioOn(day);
      if (r !== null && r > 0) cell.classList.add(r >= 1 ? "l3" : r >= 0.5 ? "l2" : "l1");
      if (i === 0) cell.classList.add("today-cell");
      cell.title = `${day} · ${r === null ? "no tasks" : Math.round(r * 100) + "%"}`;
    } else {
      cell.style.visibility = "hidden"; // future days this week
    }
    heatmap.appendChild(cell);
  }

  // recent day log
  const logEl = document.getElementById("day-log");
  logEl.innerHTML = "";
  let shown = 0;
  for (let i = 0; i < 60 && shown < 21; i++) {
    const day = daysAgo(i);
    const active = activeTasksOn(day);
    if (active.length === 0) continue;
    const ids = new Set(active.map(t => t.id));
    const done = doneOn(day).filter(id => ids.has(id)).length;

    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = prettyDate(day) + (i === 0 ? " · today" : "");
    const count = document.createElement("span");
    count.className = "count" + (done === active.length ? " full" : "");
    count.textContent = `${done}/${active.length}${done === active.length ? " ●" : ""}`;
    li.append(label, count);
    logEl.appendChild(li);
    shown++;
  }
}

// ---------- stats screen ----------

function renderStats() {
  // streak: consecutive days (ending today or yesterday) with 100% completion
  let streak = 0;
  const startOffset = ratioOn(today()) >= 1 ? 0 : 1; // today not finished yet doesn't break streak
  for (let i = startOffset; i < 3650; i++) {
    const r = ratioOn(daysAgo(i));
    if (r !== null && r >= 1) streak++;
    else break;
  }
  if (ratioOn(today()) >= 1) { /* today already counted via offset 0 */ }

  // best streak + perfect days + total check-ins over stored history
  let best = 0, run = 0, perfect = 0, total = 0;
  const firstDay = state.tasks.reduce((min, t) => (t.created < min ? t.created : min), today());
  const span = Math.min(3650, Math.round((new Date(today()) - new Date(firstDay)) / 86400000));
  for (let i = span; i >= 0; i--) {
    const day = daysAgo(i);
    const r = ratioOn(day);
    total += doneOn(day).length;
    if (r !== null && r >= 1) { run++; perfect++; best = Math.max(best, run); }
    else if (r !== null) run = 0;
  }

  document.getElementById("stat-streak").textContent = streak;
  document.getElementById("stat-best").textContent = best;
  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-perfect").textContent = perfect;

  // per-task completion over last 30 days
  const listEl = document.getElementById("task-stats");
  listEl.innerHTML = "";
  for (const t of state.tasks.filter(t => !t.archived)) {
    let possible = 0, done = 0;
    for (let i = 0; i < 30; i++) {
      const day = daysAgo(i);
      if (t.created > day) continue;
      possible++;
      if (doneOn(day).includes(t.id)) done++;
    }
    const pct = possible === 0 ? 0 : Math.round((done / possible) * 100);

    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = t.name;
    const pctEl = document.createElement("span");
    pctEl.className = "pct";
    pctEl.textContent = pct + "%";
    row.append(name, pctEl);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    li.append(row, bar);
    listEl.appendChild(li);
  }
}

// ---------- tabs ----------

const renderers = { today: renderToday, history: renderHistory, stats: renderStats };

document.querySelectorAll(".tabs .tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("screen-" + tab.dataset.screen).classList.add("active");
    renderers[tab.dataset.screen]();
  });
});

// re-render at midnight rollover / when app resumes; check reminder each tick
let lastDay = today();
setInterval(() => {
  if (today() !== lastDay) { lastDay = today(); renderToday(); updateAccountUi(); }
  checkReminder();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { renderToday(); updateAccountUi(); checkReminder(); }
});

// ---------- boot ----------

updateAccountUi();
renderToday();

if (!profile) showWelcome(true); // first visit: ask name + birthdate

// ---------- offline support ----------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
