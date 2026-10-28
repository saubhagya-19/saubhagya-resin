const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const fs = require("fs");
const crypto = require("crypto");
const dns = require("dns").promises;
const multer = require("multer");   // product photo upload: npm install multer

const SECRET = process.env.JWT_SECRET || "change-this-secret";
const ADMIN_KEY = process.env.ADMIN_KEY || "sapna1910";
const DELIVERY_CHARGE = 100;   // same as the cart page

if (SECRET === "change-this-secret" || ADMIN_KEY === "sapna1910")
  console.warn("WARNING: JWT_SECRET / ADMIN_KEY are still the default values. Set your own before going live.");

const app = express();
app.set("trust proxy", 1);     // so rate limits see the real visitor IP when hosted online
app.use(cors());
app.use(express.json());
// serves your website at http://localhost:3000
app.use(express.static(path.join(__dirname, "..", "resin brand")));

/* ---------- PRODUCT PHOTOS (saved in the "uploads" folder, shown at /uploads/<file>) ---------- */
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype] || "";
      cb(null, Date.now() + "-" + crypto.randomInt(100000, 1000000) + ext);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },   // 3 MB
  fileFilter: (req, file, cb) =>
    cb(/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? null : new Error("Only JPG, PNG or WEBP photos are allowed."), true)
});
// runs the upload and returns multer errors (too big, wrong type) as normal JSON errors
const photoUpload = (req, res, next) =>
  upload.single("photo")(req, res, err => err
    ? res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Photo is too large. Maximum 3 MB." : err.message })
    : next());
const removeFile = rel => { if (rel) fs.unlink(path.join(UPLOAD_DIR, path.basename(rel)), () => {}); };

const db = new Database("saubhagya.db");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE,
  password TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, phone TEXT,
  address TEXT, pincode TEXT, items TEXT, subtotal REAL, discount REAL,
  total REAL, coupon TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

/* ---------- ORDER STATUS (adds the column once; safe to run every time) ---------- */
try { db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'New'"); } catch (e) {}
db.prepare("UPDATE orders SET status='New' WHERE status IS NULL").run();

/* ---------- LOGIN TABLES (users keep their old phone column; one-time codes are kept per email) ---------- */
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch (e) {}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone)");
db.exec(`
CREATE TABLE IF NOT EXISTS email_otps(
  email TEXT PRIMARY KEY, code_hash TEXT, expires_at INTEGER,
  attempts INTEGER DEFAULT 0, last_sent INTEGER);
`);
const STATUSES = ["Pending Confirmation", "Customization Confirmed", "Payment Pending", "Payment Received", "In Production", "Ready for Delivery", "Delivered", "Cancelled"];

/* ---------- PRODUCTS (the server decides prices, not the browser) ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE COLLATE NOCASE NOT NULL,
  price REAL NOT NULL,
  active INTEGER DEFAULT 1);
`);
// new product details (each column is added once; safe to run every time)
["category TEXT", "sub_category TEXT", "discount REAL DEFAULT 0", "description TEXT", "image TEXT"]
  .forEach(col => { try { db.exec("ALTER TABLE products ADD COLUMN " + col); } catch (e) {} });

// Starter products seen in test orders. Check these, and add the rest in Admin > Products.
const seed = db.prepare("INSERT OR IGNORE INTO products(name, price) VALUES(?, ?)");
[["MARBLE TEXTURE CLOCK", 1650], ["Rose Kundan Earrings (Pink)", 699],
 ["GEODE CRYSTAL HOLDER", 649], ["Floral Pendant Set", 649]].forEach(p => seed.run(p[0], p[1]));

// price after the product's own discount (what the customer actually pays per item)
const finalPrice = p => Math.round(p.price - p.price * (Number(p.discount) || 0) / 100);

/* ---------- AUTOMATIC BACKUP (on start, then every 24 hours; keeps the last 14) ---------- */
const BACKUP_DIR = path.join(__dirname, "backups");
fs.mkdirSync(BACKUP_DIR, { recursive: true });
function backupDb() {
  const file = path.join(BACKUP_DIR, "saubhagya-" + new Date().toISOString().slice(0, 10) + ".db");
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (e) {}
  db.backup(file).then(() => {
    console.log("Backup saved:", file);
    const old = fs.readdirSync(BACKUP_DIR).filter(f => /^saubhagya-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    old.slice(0, Math.max(0, old.length - 14)).forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {} });
  }).catch(e => console.error("Backup failed:", e.message));
}
backupDb();
setInterval(backupDb, 24 * 60 * 60 * 1000);

/* ---------- COUPONS (checked on the server, so customers can't fake them) ---------- */
const COUPONS = {
  SAUBHAGYA19: { percent: 10, start: "2026-10-09", end: "2026-10-19" }
};
function couponPercent(code) {
  const c = COUPONS[String(code || "").trim().toUpperCase()];
  if (!c) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return today >= c.start && today <= c.end ? c.percent : 0;
}

/* ---------- LOGIN CHECK (used by routes that need a logged-in customer) ---------- */
function requireLogin(req, res, next) {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    req.user = jwt.verify(t, SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: "Please log in to place an order." });
  }
}

/* ---------- ACCOUNTS ---------- */
/* Password sign up / login stays switched off: anyone could register with an email that is not theirs.
   Customers sign in with their email address and a one-time code (OTP) sent to that inbox. */
app.post("/api/signup", (req, res) =>
  res.status(410).json({ error: "Please sign in with your email address." }));
app.post("/api/login", (req, res) =>
  res.status(410).json({ error: "Please sign in with your email address." }));

/* ---------- EMAIL OTP LOGIN ---------- */
// EMAIL_USER + EMAIL_PASS set  = REAL EMAIL: the OTP is mailed through Gmail (free). EMAIL_PASS must be a Gmail "App Password".
// Not set                      = DEMO MODE: no email is sent; the OTP is printed here AND shown on the login page.
const EMAIL_USER = process.env.EMAIL_USER || "";
const EMAIL_PASS = process.env.EMAIL_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || ("Saubhagya Resin <" + EMAIL_USER + ">");
const REAL_EMAIL = !!(EMAIL_USER && EMAIL_PASS);

let mailer = null;
function getMailer() {
  if (mailer) return mailer;
  const nodemailer = require("nodemailer");   // only needed for real email: npm install nodemailer
  mailer = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS }
  });
  return mailer;
}

async function sendOtpEmail(email, code) {
  if (!REAL_EMAIL) {
    console.log("\n[DEMO MODE] OTP for " + email + " is " + code + "\n");
    return;
  }
  await getMailer().sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: "Your Saubhagya Resin login code: " + code,
    text: "Your Saubhagya Resin login code is " + code + ". It is valid for 5 minutes. If you did not ask for it, you can ignore this email.",
    html: "<div style=\"font-family:Arial,sans-serif;max-width:420px\">" +
          "<h2 style=\"margin:0 0 8px\">Saubhagya Resin</h2>" +
          "<p>Your login code is:</p>" +
          "<p style=\"font-size:30px;letter-spacing:6px;font-weight:bold;margin:8px 0\">" + code + "</p>" +
          "<p style=\"color:#666\">It is valid for 5 minutes. If you did not ask for it, you can ignore this email.</p></div>"
  });
}

const hits = new Map();   // small in-memory limiter so nobody can spam OTP emails
function tooMany(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
const hashOtp = (email, code) => crypto.createHash("sha256").update(email + ":" + code + ":" + SECRET).digest("hex");
const cleanEmail = v => String(v || "").trim().toLowerCase();
const validEmail = e => e.length <= 100 && /^[a-z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(e) && !e.includes("..");

// Checks the part after the @ really exists and can receive mail (rejects things like name@gmial.invalid or name@notarealsite123.com)
async function emailDomainOk(email) {
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (mx && mx.length) return true;
  } catch (e) {
    if (e.code !== "ENODATA" && e.code !== "ENOTFOUND") return true;   // DNS itself unreachable: don't block the customer
  }
  try {
    const a = await dns.resolve4(domain);
    return !!(a && a.length);
  } catch (e) {
    return !(e.code === "ENODATA" || e.code === "ENOTFOUND");
  }
}

app.post("/api/otp/send", async (req, res) => {
  const email = cleanEmail(req.body.email);
  if (!validEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!(await emailDomainOk(email))) return res.status(400).json({ error: "This email address does not look real. Please check it and try again." });
  if (tooMany("ip:" + req.ip, 15, 3600000) || tooMany("em:" + email, 5, 3600000))
    return res.status(429).json({ error: "Too many OTP requests. Please try again in an hour." });
  const prev = db.prepare("SELECT last_sent FROM email_otps WHERE email=?").get(email);
  if (prev && Date.now() - prev.last_sent < 30000)
    return res.status(429).json({ error: "Please wait 30 seconds before asking for a new OTP." });

  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare(`INSERT INTO email_otps(email, code_hash, expires_at, attempts, last_sent) VALUES(?,?,?,0,?)
              ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at,
              attempts=0, last_sent=excluded.last_sent`)
    .run(email, hashOtp(email, code), Date.now() + 5 * 60 * 1000, Date.now());
  try { await sendOtpEmail(email, code); }
  catch (e) {
    console.error("OTP email failed:", e.message);
    if (/Invalid login|535|Username and Password|Application-specific/i.test(e.message))
      console.error("HINT: Gmail rejected the login. Use a 16-letter Google App Password (2-Step Verification must be ON), typed without spaces.");
    if (/Cannot find module/i.test(e.message))
      console.error("HINT: run  npm install nodemailer  in the resin-backend folder, then restart the server.");
    db.prepare("DELETE FROM email_otps WHERE email=?").run(email);   // failed send: allow an immediate retry
    return res.status(502).json({ error: "Could not send the OTP email. Please try again." });
  }
  // DEMO MODE (no email account set): send the OTP back so the login page can show it. For college demo only.
  if (!REAL_EMAIL) return res.json({ ok: true, demoOtp: code });
  res.json({ ok: true });
});

app.post("/api/otp/verify", (req, res) => {
  const email = cleanEmail(req.body.email);
  const code = String(req.body.code || "").trim();
  const name = String(req.body.name || "").trim().slice(0, 60);
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit OTP." });

  const row = db.prepare("SELECT * FROM email_otps WHERE email=?").get(email);
  if (!row || Date.now() > row.expires_at) return res.status(400).json({ error: "OTP expired. Please ask for a new one." });
  if (row.attempts >= 5) return res.status(429).json({ error: "Too many wrong tries. Please ask for a new OTP." });

  const ok = crypto.timingSafeEqual(Buffer.from(hashOtp(email, code)), Buffer.from(row.code_hash));
  if (!ok) {
    db.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE email=?").run(email);
    return res.status(401).json({ error: "Wrong OTP." });
  }

  let u = db.prepare("SELECT * FROM users WHERE lower(email)=?").get(email);
  if (!u) {
    if (name.length < 2) return res.json({ needName: true });   // new customer: ask for a name, the OTP stays valid
    const r = db.prepare("INSERT INTO users(name, email) VALUES(?, ?)").run(name, email);
    u = { id: r.lastInsertRowid, name };
  }
  db.prepare("DELETE FROM email_otps WHERE email=?").run(email);
  const token = jwt.sign({ id: u.id, name: u.name, email }, SECRET, { expiresIn: "30d" });
  res.json({ token, name: u.name, email });
});

/* ---------- COUPON CHECK ---------- */
app.post("/api/coupon", (req, res) => {
  const p = couponPercent(req.body.code);
  p ? res.json({ percent: p }) : res.status(400).json({ error: "Invalid or expired coupon." });
});

/* ---------- PUBLIC PRODUCT LIST (for the website: shows photo, category, discount, description) ---------- */
app.get("/api/products", (req, res) => {
  const rows = db.prepare(`SELECT id, name, price, category, sub_category, discount, description, image
                           FROM products WHERE active = 1 ORDER BY id DESC`).all();
  res.json(rows.map(p => Object.assign(p, { final_price: finalPrice(p) })));
});

/* ---------- ORDERS (login is mandatory) ---------- */
app.post("/api/orders", requireLogin, (req, res) => {
  const { name, phone, address, pincode, items, coupon } = req.body;
  if (!name || !phone || !address || !pincode || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "Missing order details." });
  if (!/^\d{10}$/.test(String(phone))) return res.status(400).json({ error: "Invalid mobile number." });
  if (!/^\d{6}$/.test(String(pincode))) return res.status(400).json({ error: "Invalid pincode." });

  // look every item up in the products table; the server's price (after product discount) is the only price used
  const find = db.prepare("SELECT name, price, discount FROM products WHERE name = ? COLLATE NOCASE AND active = 1");
  const priced = [], changed = [];
  for (const i of items) {
    const qty = Number(i.qty) || 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > 50)
      return res.status(400).json({ error: "Invalid quantity in cart." });
    const p = find.get(String(i.name || "").trim());
    if (!p)
      return res.status(400).json({ error: "\"" + i.name + "\" is not available right now. Please remove it from your cart." });
    const unit = finalPrice(p);
    if (Number(i.price) !== unit) changed.push({ name: i.name, price: unit });
    priced.push({ name: p.name, price: unit, qty });
  }
  if (changed.length)
    return res.status(409).json({ error: "Some prices have changed. Please check your cart and place the order again.", updated: changed });

  const subtotal = priced.reduce((s, i) => s + i.price * i.qty, 0);
  const percent = couponPercent(coupon);
  const discount = Math.round(subtotal * percent / 100);
  const total = subtotal - discount + DELIVERY_CHARGE;

  const r = db.prepare(`INSERT INTO orders
    (user_id,name,phone,address,pincode,items,subtotal,discount,total,coupon)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(req.user.id, name, phone, address, pincode, JSON.stringify(priced),
         subtotal, discount, total, percent ? String(coupon).toUpperCase() : null);
  res.json({ orderId: r.lastInsertRowid, items: priced, subtotal, discount, delivery: DELIVERY_CHARGE, total });
});

/* ---------- ADMIN (needs the x-admin-key header) ---------- */
function admin(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(403).json({ error: "Not allowed" });
  next();
}
app.get("/api/admin/users", admin, (req, res) =>
  res.json(db.prepare("SELECT id,name,email,phone,created_at FROM users ORDER BY id DESC").all()));
app.get("/api/admin/orders", admin, (req, res) =>
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC").all()));

app.patch("/api/admin/orders/:id/status", admin, (req, res) => {
  const status = req.body.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const r = db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, req.params.id);
  r.changes ? res.json({ ok: true, status }) : res.status(404).json({ error: "Order not found." });
});

/* ---------- ADMIN: PRODUCTS ---------- */
function readProductFields(body) {
  return {
    name: String(body.name || "").trim().slice(0, 120),
    category: String(body.category || "").trim().slice(0, 60),
    sub_category: String(body.sub_category || "").trim().slice(0, 60),
    description: String(body.description || "").trim().slice(0, 2000),
    price: Number(body.price),
    discount: Number(body.discount) || 0
  };
}
function checkProductFields(f) {
  if (!f.name) return "Enter the product name.";
  if (!f.category) return "Enter a category.";
  if (!(f.price > 0)) return "Enter a price above 0.";
  if (f.discount < 0 || f.discount > 90) return "Discount must be between 0 and 90%.";
  return null;
}

app.get("/api/admin/products", admin, (req, res) =>
  res.json(db.prepare(`SELECT id, name, price, active, category, sub_category, discount, description, image
                       FROM products ORDER BY name COLLATE NOCASE`).all()));

// add a new product (multipart form: fields + photo)
app.post("/api/admin/products", admin, photoUpload, (req, res) => {
  const f = readProductFields(req.body), err = checkProductFields(f);
  if (err || !req.file) {
    if (req.file) removeFile(req.file.filename);
    return res.status(400).json({ error: err || "Please add a product photo." });
  }
  try {
    db.prepare(`INSERT INTO products(name, price, category, sub_category, discount, description, image, active)
                VALUES(?,?,?,?,?,?,?,1)`)
      .run(f.name, f.price, f.category, f.sub_category, f.discount, f.description, "/uploads/" + req.file.filename);
    res.json({ ok: true });
  } catch (e) {
    removeFile(req.file.filename);
    res.status(400).json({ error: /UNIQUE/i.test(e.message) ? "A product with this name already exists." : "Could not add the product." });
  }
});

// edit a product (photo is optional; a new photo replaces the old one)
app.put("/api/admin/products/:id", admin, photoUpload, (req, res) => {
  const old = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  const f = readProductFields(req.body), err = checkProductFields(f);
  if (!old || err) {
    if (req.file) removeFile(req.file.filename);
    return res.status(old ? 400 : 404).json({ error: err || "Product not found." });
  }
  const image = req.file ? "/uploads/" + req.file.filename : old.image;
  try {
    db.prepare(`UPDATE products SET name=?, price=?, category=?, sub_category=?, discount=?, description=?, image=? WHERE id=?`)
      .run(f.name, f.price, f.category, f.sub_category, f.discount, f.description, image, old.id);
    if (req.file) removeFile(old.image);
    res.json({ ok: true });
  } catch (e) {
    if (req.file) removeFile(req.file.filename);
    res.status(400).json({ error: /UNIQUE/i.test(e.message) ? "A product with this name already exists." : "Could not save the product." });
  }
});

// quick save from the table (price / discount / on sale)
app.patch("/api/admin/products/:id", admin, (req, res) => {
  const price = Number(req.body.price), active = req.body.active ? 1 : 0;
  const discount = req.body.discount === undefined ? null : Number(req.body.discount) || 0;
  if (!(price > 0)) return res.status(400).json({ error: "Price must be above 0." });
  if (discount !== null && (discount < 0 || discount > 90)) return res.status(400).json({ error: "Discount must be between 0 and 90%." });
  const r = discount === null
    ? db.prepare("UPDATE products SET price = ?, active = ? WHERE id = ?").run(price, active, req.params.id)
    : db.prepare("UPDATE products SET price = ?, discount = ?, active = ? WHERE id = ?").run(price, discount, active, req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: "Product not found." });
});

// delete a product (past orders keep their own copy of the item name and price)
app.delete("/api/admin/products/:id", admin, (req, res) => {
  const p = db.prepare("SELECT image FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Product not found." });
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  removeFile(p.image);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
require("./review.js")(app, db, { admin, tooMany });
require("./payments.js")(app, db, { admin, requireLogin, tooMany });
app.listen(PORT, () => console.log("Running at http://localhost:" + PORT +
  (REAL_EMAIL ? "  (OTP by real email)" : "  (OTP DEMO MODE: shown on the login page)")));