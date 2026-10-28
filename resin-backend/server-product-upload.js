// =====================================================================
// server.js mein ye changes karein (product upload ke liye backend)
// =====================================================================
// 1) Install:   npm install multer
// 2) Neeche wala code apne server.js mein paste karein.
//    NOTE: Yahan "db" better-sqlite3 style (db.prepare(...).run/get/all) maana hai.
//    Agar aap sqlite3 use karte ho to calls ko callback style mein badalna hoga.
//    Purane "/api/admin/products" POST/PATCH routes ko is code se REPLACE karein.
// =====================================================================

const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ---- uploads folder + public access ----
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use('/uploads', express.static(UPLOAD_DIR));

// ---- DB: naye columns (ek baar chalega, dobara chalane par error ignore hoga) ----
['category TEXT', 'sub_category TEXT', 'discount REAL DEFAULT 0', 'description TEXT', 'image TEXT']
  .forEach(col => { try { db.prepare('ALTER TABLE products ADD COLUMN ' + col).run(); } catch (e) {} });

// ---- multer: sirf images, max 3 MB ----
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype] || '';
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    }
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? null : new Error('Only JPG, PNG or WEBP photos are allowed.'), true);
  }
});

// multer errors ko JSON mein bhejne ke liye wrapper
const photoUpload = (req, res, next) =>
  upload.single('photo')(req, res, err => err ? res.status(400).json({ error: err.message }) : next());

// ---- admin check: aapke purane code mein jo function hai wahi use karein ----
// (yahan maana hai ki "requireAdmin" naam ka middleware pehle se hai)

function cleanFields(body) {
  const price = Number(body.price), discount = Number(body.discount) || 0;
  return {
    name: String(body.name || '').trim(),
    category: String(body.category || '').trim(),
    sub_category: String(body.sub_category || '').trim(),
    description: String(body.description || '').trim(),
    price, discount
  };
}
function validate(f) {
  if (!f.name) return 'Product name is required.';
  if (!f.category) return 'Category is required.';
  if (!(f.price > 0)) return 'Enter a valid price.';
  if (f.discount < 0 || f.discount > 90) return 'Discount must be between 0 and 90%.';
  return null;
}

// ---- ADD new product (multipart) ----
app.post('/api/admin/products', requireAdmin, photoUpload, (req, res) => {
  const f = cleanFields(req.body), err = validate(f);
  if (err) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: err }); }
  if (!req.file) return res.status(400).json({ error: 'Product photo is required.' });

  const exists = db.prepare('SELECT id FROM products WHERE lower(name)=lower(?)').get(f.name);
  if (exists) { fs.unlink(req.file.path, () => {}); return res.status(400).json({ error: 'A product with this name already exists.' }); }

  db.prepare(`INSERT INTO products (name, price, category, sub_category, discount, description, image, active)
              VALUES (?,?,?,?,?,?,?,1)`)
    .run(f.name, f.price, f.category, f.sub_category, f.discount, f.description, '/uploads/' + req.file.filename);
  res.json({ ok: true });
});

// ---- EDIT product (multipart, photo optional) ----
app.put('/api/admin/products/:id', requireAdmin, photoUpload, (req, res) => {
  const f = cleanFields(req.body), err = validate(f);
  const old = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (err || !old) { if (req.file) fs.unlink(req.file.path, () => {}); return res.status(err ? 400 : 404).json({ error: err || 'Product not found.' }); }

  let image = old.image;
  if (req.file) {
    image = '/uploads/' + req.file.filename;
    if (old.image) fs.unlink(path.join(__dirname, old.image), () => {});   // purani photo hatao
  }
  db.prepare(`UPDATE products SET name=?, price=?, category=?, sub_category=?, discount=?, description=?, image=? WHERE id=?`)
    .run(f.name, f.price, f.category, f.sub_category, f.discount, f.description, image, old.id);
  res.json({ ok: true });
});

// ---- QUICK save (price / discount / on-sale) — table ke "Save" button ke liye ----
app.patch('/api/admin/products/:id', requireAdmin, express.json(), (req, res) => {
  const price = Number(req.body.price), discount = Number(req.body.discount) || 0;
  if (!(price > 0)) return res.status(400).json({ error: 'Enter a valid price.' });
  if (discount < 0 || discount > 90) return res.status(400).json({ error: 'Discount must be between 0 and 90%.' });
  db.prepare('UPDATE products SET price=?, discount=?, active=? WHERE id=?')
    .run(price, discount, req.body.active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// ---- DELETE product ----
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT image FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found.' });
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  if (p.image) fs.unlink(path.join(__dirname, p.image), () => {});
  res.json({ ok: true });
});

// ---- ORDER ke time price: server ko DISCOUNTED price use karna chahiye ----
// Jahan aap order total calculate karte ho, wahan:
//   const unit = Math.round(p.price - p.price * (p.discount || 0) / 100);
// use karein, taaki customer ko wahi price mile jo website par dikhta hai.

// ---- Website ke liye public product list mein naye fields bhi bhejein ----
// SELECT id, name, price, category, sub_category, discount, description, image FROM products WHERE active=1