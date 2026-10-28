const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

module.exports = function (app, db, deps) {
  const { admin, tooMany } = deps;
  const DIR = path.join(__dirname, "..", "resin brand", "uploads", "reviews");
  fs.mkdirSync(DIR, { recursive: true });

  db.exec(`
  CREATE TABLE IF NOT EXISTS reviews(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    text TEXT,
    image TEXT,
    video TEXT,
    owner_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  `);

  const EXT = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
    "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"
  };
  const sha = v => crypto.createHash("sha256").update(String(v)).digest("hex");

  const upload = multer({
    storage: multer.diskStorage({
      destination: DIR,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString("hex") + EXT[file.mimetype])
    }),
    limits: { fileSize: 50 * 1024 * 1024, files: 2 },
    fileFilter: (req, file, cb) => {
      const kind = file.fieldname === "image" ? "image/" : file.fieldname === "video" ? "video/" : null;
      if (kind && file.mimetype.startsWith(kind) && EXT[file.mimetype]) return cb(null, true);
      cb(new Error(file.fieldname === "image"
        ? "Photo must be JPG, PNG, WEBP or GIF."
        : "Video must be MP4, WEBM or MOV."));
    }
  }).fields([{ name: "image", maxCount: 1 }, { name: "video", maxCount: 1 }]);

  const pub = r => ({
    id: r.id, n: r.name, r: r.rating, t: r.text || "",
    i: r.image ? "/uploads/reviews/" + r.image : "",
    v: r.video ? "/uploads/reviews/" + r.video : "",
    created_at: r.created_at
  });
  function removeFiles(row) {
    [row.image, row.video].forEach(f => { if (f) fs.unlink(path.join(DIR, path.basename(f)), () => {}); });
  }

  app.get("/api/reviews", (req, res) =>
    res.json(db.prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 100").all().map(pub)));

  app.post("/api/reviews", (req, res) => {
    if (tooMany("rv:" + req.ip, 100, 3600000))
      return res.status(429).json({ error: "Too many reviews. Please try again later." });

    upload(req, res, err => {
      const files = req.files || {};
      const img = (files.image || [])[0], vid = (files.video || [])[0];
      const cleanup = () => [img, vid].forEach(f => f && fs.unlink(f.path, () => {}));

      if (err) {
        cleanup();
        return res.status(400).json({
          error: err.code === "LIMIT_FILE_SIZE" ? "File too large (video max 50 MB, photo max 10 MB)." : (err.message || "Upload failed.")
        });
      }
      const name = String(req.body.name || "").trim().slice(0, 60);
      const text = String(req.body.text || "").trim().slice(0, 1000);
      const rating = Number(req.body.rating);

      if (!name || (!text && !img && !vid)) { cleanup(); return res.status(400).json({ error: "Please enter your name and a review, photo or video." }); }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) { cleanup(); return res.status(400).json({ error: "Please choose 1 to 5 stars." }); }
      if (img && img.size > 10 * 1024 * 1024) { cleanup(); return res.status(400).json({ error: "Photo must be under 10 MB." }); }

      const ownerToken = crypto.randomBytes(16).toString("hex");
      const r = db.prepare("INSERT INTO reviews(name, rating, text, image, video, owner_hash) VALUES(?,?,?,?,?,?)")
        .run(name, rating, text, img ? img.filename : null, vid ? vid.filename : null, sha(ownerToken));
      const row = db.prepare("SELECT * FROM reviews WHERE id=?").get(r.lastInsertRowid);
      res.json({ review: pub(row), ownerToken });
    });
  });

  app.delete("/api/reviews/:id", (req, res) => {
    const row = db.prepare("SELECT * FROM reviews WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Review not found." });
    const given = Buffer.from(sha(req.headers["x-owner-token"] || ""));
    const real = Buffer.from(row.owner_hash || "");
    if (!real.length || given.length !== real.length || !crypto.timingSafeEqual(given, real))
      return res.status(403).json({ error: "You can only delete your own review." });
    db.prepare("DELETE FROM reviews WHERE id=?").run(row.id);
    removeFiles(row);
    res.json({ ok: true });
  });

  app.get("/api/admin/reviews", admin, (req, res) =>
    res.json(db.prepare("SELECT id, name, rating, text, image, video, created_at FROM reviews ORDER BY id DESC").all()));

  app.delete("/api/admin/reviews/:id", admin, (req, res) => {
    const row = db.prepare("SELECT * FROM reviews WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Review not found." });
    db.prepare("DELETE FROM reviews WHERE id=?").run(row.id);
    removeFiles(row);
    res.json({ ok: true });
  });
};