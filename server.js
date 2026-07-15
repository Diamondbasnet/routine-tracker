/* ============================================================
   TR-1 server · rev.E
   All user data lives on the user's device (localStorage) —
   this server only hosts the PWA's static files.
   ============================================================ */

const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`TR-1 listening on :${PORT}`));
