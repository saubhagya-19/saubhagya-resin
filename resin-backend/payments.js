/* =========================================================
   SAUBHAGYA RESIN - PAYMENTS MODULE
   - payments table (manual UPI with UTR)
   - new order status flow
   - routes for customers and for the admin
   Keep this file in resin-backend, next to server.js and reviews.js
   ========================================================= */

module.exports = function (app, db, deps) {
  const { admin, requireLogin, tooMany } = deps;

  /* ---------- SETTINGS (set these before starting the server) ----------
     UPI_ID   (e.g. yourname@okhdfcbank)
     UPI_NAME (shown to the customer)
  ----------------------------------------------------------------------- */
  const UPI_ID = process.env.UPI_ID || "";
  const UPI_NAME = process.env.UPI_NAME || "Saubhagya Resin";
  const UPI_ON = !!UPI_ID;

  // Customer can pay only while the order is in one of these statuses.
  // (Admin moves the order to "Payment Pending" after customization is confirmed.)
  const PAYABLE = ["Payment Pending"];

  console.log("Payments: UPI " + (UPI_ON ? "ON" : "OFF (set UPI_ID)"));

  /* ---------- DATABASE ---------- */
  db.exec(`
  CREATE TABLE IF NOT EXISTS payments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    user_id INTEGER,
    method TEXT NOT NULL,              -- upi | manual
    amount REAL NOT NULL,
    status TEXT NOT NULL,              -- pending_verification | paid | rejected
    utr TEXT,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT);
  CREATE INDEX IF NOT EXISTS payments_order ON payments(order_id);
  CREATE UNIQUE INDEX IF NOT EXISTS payments_utr ON payments(utr) WHERE utr IS NOT NULL;
  `);

  /* ---------- ORDER STATUS FLOW ---------- */
  // old statuses are moved to the closest new one (safe to run every time)
  db.exec(`
  UPDATE orders SET status='Pending Confirmation' WHERE status IS NULL OR status='New';
  UPDATE orders SET status='In Production' WHERE status='Packed';
  UPDATE orders SET status='Ready for Delivery' WHERE status='Shipped';
  CREATE TRIGGER IF NOT EXISTS orders_default_status AFTER INSERT ON orders
  WHEN NEW.status IS NULL OR NEW.status='New'
  BEGIN
    UPDATE orders SET status='Pending Confirmation' WHERE id=NEW.id;
  END;
  `);

  /* ---------- HELPERS ---------- */
  const safeParse = s => { try { return JSON.parse(s); } catch (e) { return []; } };

  function ownOrder(req, res) {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!o || o.user_id !== req.user.id) {
      res.status(404).json({ error: "Order not found." });
      return null;
    }
    return o;
  }

  // returns a message if the customer must NOT pay right now, else ""
  function payBlock(o) {
    const paid = db.prepare("SELECT 1 FROM payments WHERE order_id=? AND status='paid'").get(o.id);
    if (paid) return "This order is already paid.";
    if (o.status === "Cancelled") return "This order was cancelled.";
    if (!PAYABLE.includes(o.status))
      return "Payment is not open yet. We will message you on WhatsApp once your order is confirmed.";
    return "";
  }

  const markPaid = db.transaction((paymentId, orderId) => {
    db.prepare("UPDATE payments SET status='paid', verified_at=CURRENT_TIMESTAMP WHERE id=?").run(paymentId);
    db.prepare(`UPDATE orders SET status='Payment Received'
                WHERE id=? AND status IN ('Pending Confirmation','Customization Confirmed','Payment Pending')`)
      .run(orderId);
  });

  /* ---------- CUSTOMER: CONFIG + MY ORDERS ---------- */
  app.get("/api/payment/config", (req, res) =>
    res.json({ upi: UPI_ON, upiId: UPI_ID, upiName: UPI_NAME }));

  app.get("/api/my/orders", requireLogin, (req, res) => {
    const rows = db.prepare(
      "SELECT id, total, status, items, created_at FROM orders WHERE user_id=? ORDER BY id DESC").all(req.user.id);
    res.json(rows.map(o => ({ ...o, items: safeParse(o.items) })));
  });

  app.get("/api/my/orders/:id", requireLogin, (req, res) => {
    const o = ownOrder(req, res);
    if (!o) return;
    const pays = db.prepare(
      "SELECT id, method, amount, status, created_at FROM payments WHERE order_id=? ORDER BY id DESC").all(o.id);
    const block = payBlock(o);
    res.json({
      id: o.id, status: o.status, name: o.name, items: safeParse(o.items),
      subtotal: o.subtotal, discount: o.discount, total: o.total,
      delivery: Math.round((o.total - o.subtotal + o.discount) * 100) / 100,
      created_at: o.created_at,
      payments: pays,
      paid: pays.some(p => p.status === "paid"),
      awaitingVerification: pays.some(p => p.status === "pending_verification"),
      canPay: !block,
      payMessage: block,
      upiLink: UPI_ON
        ? "upi://pay?pa=" + encodeURIComponent(UPI_ID) + "&pn=" + encodeURIComponent(UPI_NAME) +
          "&am=" + Number(o.total).toFixed(2) + "&cu=INR&tn=" + encodeURIComponent("Order " + o.id)
        : ""
    });
  });

  /* ---------- CUSTOMER: MANUAL UPI (customer sends the 12-digit UTR) ---------- */
  app.post("/api/orders/:id/pay/upi", requireLogin, (req, res) => {
    if (!UPI_ON) return res.status(503).json({ error: "UPI payment is not available right now." });
    if (tooMany("upi:" + req.user.id, 10, 3600000))
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    const o = ownOrder(req, res);
    if (!o) return;
    const block = payBlock(o);
    if (block) return res.status(409).json({ error: block });

    const utr = String(req.body.utr || "").trim();
    if (!/^\d{12}$/.test(utr))
      return res.status(400).json({ error: "Enter the 12-digit UPI reference number (UTR) from your payment app." });

    const waiting = db.prepare("SELECT 1 FROM payments WHERE order_id=? AND method='upi' AND status='pending_verification'").get(o.id);
    if (waiting) return res.status(409).json({ error: "Your payment details are already submitted. We are verifying them." });

    try {
      db.prepare(`INSERT INTO payments(order_id, user_id, method, amount, status, utr)
                  VALUES(?,?,?,?,?,?)`).run(o.id, req.user.id, "upi", o.total, "pending_verification", utr);
    } catch (e) {
      return res.status(409).json({ error: "This reference number was already used." });
    }
    res.json({ ok: true, message: "Thank you! We will verify your payment and update your order soon." });
  });

  /* ---------- ADMIN (needs the x-admin-key header) ---------- */
  app.get("/api/admin/payments", admin, (req, res) =>
    res.json(db.prepare(`
      SELECT p.id, p.order_id, p.method, p.amount, p.status, p.utr, p.note,
             p.created_at, p.verified_at,
             o.name AS customer, o.phone, o.total AS order_total, o.status AS order_status
      FROM payments p JOIN orders o ON o.id = p.order_id
      ORDER BY p.id DESC`).all()));

  // approve or reject a manual UPI payment after checking your bank / UPI app
  app.patch("/api/admin/payments/:id", admin, (req, res) => {
    const p = db.prepare("SELECT * FROM payments WHERE id=?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Payment not found." });
    const action = req.body.action;
    if (p.status !== "pending_verification")
      return res.status(409).json({ error: "Only payments waiting for verification can be changed." });
    if (action === "approve") {
      markPaid(p.id, p.order_id);
      return res.json({ ok: true, status: "paid" });
    }
    if (action === "reject") {
      db.prepare("UPDATE payments SET status='rejected', note=?, verified_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(String(req.body.note || "").slice(0, 200), p.id);
      return res.json({ ok: true, status: "rejected" });
    }
    res.status(400).json({ error: "action must be approve or reject." });
  });

  // record a payment you received outside the website (cash, direct bank transfer, WhatsApp UPI)
  app.post("/api/admin/orders/:id/mark-paid", admin, (req, res) => {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
    if (!o) return res.status(404).json({ error: "Order not found." });
    if (db.prepare("SELECT 1 FROM payments WHERE order_id=? AND status='paid'").get(o.id))
      return res.status(409).json({ error: "Order is already paid." });
    const r = db.prepare(`INSERT INTO payments(order_id, user_id, method, amount, status, note)
                          VALUES(?,?,?,?,?,?)`)
      .run(o.id, o.user_id, "manual", o.total, "pending_verification", String(req.body.note || "").slice(0, 200));
    markPaid(r.lastInsertRowid, o.id);
    res.json({ ok: true });
  });
};