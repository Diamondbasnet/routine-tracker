/* ============================================================
   TR-1 server: accounts + cloud sync
   - Express serves the PWA from /public
   - Postgres stores users and their tracker data
   - JWT auth (30-day tokens), bcrypt password hashing
   API:
     POST /api/register {username, password}        -> {token, username}
     POST /api/login    {username, password}        -> {token, username}
     GET  /api/data     (Bearer token)              -> {data, updatedAt}
     PUT  /api/data     (Bearer token) {data}       -> {ok, updatedAt}
   ============================================================ */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PROD = process.env.NODE_ENV === "production";
const DATABASE_URL = process.env.DATABASE_URL;

if (PROD && (!process.env.JWT_SECRET || !DATABASE_URL)) {
  console.error("Production requires JWT_SECRET and DATABASE_URL environment variables");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || require("crypto").randomBytes(32).toString("hex");

/* Storage layer: Postgres when DATABASE_URL is set, otherwise an in-memory
   store for local development (data lost on restart — dev only). */
let db;

if (DATABASE_URL) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  db = {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS tracker_data (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          data JSONB NOT NULL DEFAULT '{"tasks":[],"log":{}}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    },
    async createUser(username, hash) {
      const r = await pool.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id, username",
        [username, hash]
      );
      if (r.rows.length === 0) return null;
      await pool.query("INSERT INTO tracker_data (user_id) VALUES ($1)", [r.rows[0].id]);
      return r.rows[0];
    },
    async findUser(username) {
      const r = await pool.query(
        "SELECT id, username, password_hash FROM users WHERE username = $1", [username]);
      return r.rows[0] || null;
    },
    async getData(uid) {
      const r = await pool.query(
        "SELECT data, updated_at FROM tracker_data WHERE user_id = $1", [uid]);
      return r.rows[0] ? { data: r.rows[0].data, updatedAt: r.rows[0].updated_at } : null;
    },
    async putData(uid, data) {
      const r = await pool.query(
        `INSERT INTO tracker_data (user_id, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()
         RETURNING updated_at`,
        [uid, JSON.stringify(data)]
      );
      return r.rows[0].updated_at;
    },
  };
} else {
  console.warn("⚠ DATABASE_URL not set — using in-memory store (DEV ONLY, data lost on restart)");
  const users = new Map();   // username -> {id, username, password_hash}
  const store = new Map();   // id -> {data, updatedAt}
  let nextId = 1;
  db = {
    async init() {},
    async createUser(username, hash) {
      if (users.has(username)) return null;
      const user = { id: nextId++, username, password_hash: hash };
      users.set(username, user);
      store.set(user.id, { data: { tasks: [], log: {} }, updatedAt: new Date() });
      return user;
    },
    async findUser(username) { return users.get(username) || null; },
    async getData(uid) { return store.get(uid) || null; },
    async putData(uid, data) {
      const rec = { data, updatedAt: new Date() };
      store.set(uid, rec);
      return rec.updatedAt;
    },
  };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---------- helpers ----------

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function sign(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "not logged in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "session expired, log in again" });
  }
}

// tiny in-memory rate limit on auth endpoints: 20 tries / 10 min / IP
const attempts = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const list = (attempts.get(key) || []).filter(t => now - t < 10 * 60 * 1000);
  if (list.length >= 20) return res.status(429).json({ error: "too many attempts, try later" });
  list.push(now);
  attempts.set(key, list);
  next();
}

// ---------- auth routes ----------

app.post("/api/register", rateLimit, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!USERNAME_RE.test(username || "")) {
      return res.status(400).json({ error: "username: 3-20 letters, numbers, _" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "password must be 8+ characters" });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(username.toLowerCase(), hash);
    if (!user) return res.status(409).json({ error: "username is taken" });
    res.json({ token: sign(user), username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.post("/api/login", rateLimit, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await db.findUser((username || "").toLowerCase());
    const ok = user && (await bcrypt.compare(password || "", user.password_hash));
    if (!ok) return res.status(401).json({ error: "wrong username or password" });
    res.json({ token: sign(user), username: user.username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

// ---------- data routes ----------

app.get("/api/data", auth, async (req, res) => {
  try {
    const rec = await db.getData(req.user.uid);
    if (!rec) return res.json({ data: { tasks: [], log: {} }, updatedAt: null });
    res.json({ data: rec.data, updatedAt: rec.updatedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

app.put("/api/data", auth, async (req, res) => {
  try {
    const { data } = req.body || {};
    if (!data || !Array.isArray(data.tasks) || typeof data.log !== "object") {
      return res.status(400).json({ error: "bad data shape" });
    }
    const updatedAt = await db.putData(req.user.uid, data);
    res.json({ ok: true, updatedAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server error" });
  }
});

// ---------- static PWA ----------

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

db.init()
  .then(() => app.listen(PORT, () => console.log(`TR-1 listening on :${PORT}`)))
  .catch(err => {
    console.error("DB init failed:", err);
    process.exit(1);
  });
