/* chatbot.js - FREE rule-based shopping assistant (no API, no key, no cost).
   Add to any page, just before </body>:   <script src="chatbot.js"></script>
   It answers from the texts in CFG below and from your real products (/api/products).
   To change an answer, edit the text in CFG. */
(function () {
  "use strict";
  if (document.getElementById("sbBotBtn")) return;

  /* ================== EDIT YOUR ANSWERS HERE ================== */
  var CFG = {
    whatsapp: "919175171659",
    phone: "9175171659",
    email: "saubhagya2in@gmail.com",
    hello: "Namaste! 🙏 Main Saubhagya ka assistant hoon. Products, daam, delivery ya design ke baare mein poochiye.",
    delivery: "Delivery charge ₹100 hai. ₹5000 se upar ke order par free shipping offer hai.",
    offers: "Offers: ₹5000 se upar free shipping, aur ₹10,000 se upar ke order par extra 10% off.",
    payment: "Payment UPI se hota hai. Order place karne ke baad \"My Orders\" (📦) mein jaiye. Jab aapka order confirm ho jaata hai, wahan QR code aur UPI ID dikhti hai.",
    track: "Login karke upar diye gaye 📦 \"My Orders\" icon par apne order ka status dekh sakte hain.",
    custom: "Haan! \"Design Your Own\" page par aap shape, size, resin colour, real flowers aur apna text (English, Hindi, Marathi, Gujarati ya Sanskrit) chun sakte hain. Live price bhi dikhta hai.",
    howto: "Order karna aasan hai: product chunkar cart mein daalein, phir cart page par delivery details bharkar order place karein. Aap seedha WhatsApp par bhi order de sakte hain.",
    time: "Resin art haath se banta hai aur resin ko sookhne mein time lagta hai, isliye custom order mein kuch din lagte hain. Sahi samay design ke hisaab se alag ho sakta hai, order ke time WhatsApp par confirm karein.",
    care: "Resin product ko seedhi tez dhoop aur zyada garmi se bachayein, aur naram, sookhe kapde se saaf karein. Kharoch aur kemikal cleaner se door rakhein.",
    course: "Humare paas casting + coating ka 5 in 1 Pro online course hai, jisme expert guidance, free workshop kit aur beginner friendly step by step training milti hai. Details ke liye WhatsApp par poochiye.",
    thanks: "Aapka swagat hai! 😊 Aur kuch poochna ho to likhiye.",
    fallback: "Maaf kijiye, ye main samajh nahi paaya. Aap neeche ke options chun sakte hain, ya seedha WhatsApp par poochiye."
  };
  var CATS = [
    ["Rose Preserve", "Rose.html"], ["Resin Clock", "clock.html"], ["Pooja Thali", "pooja-thali.html"],
    ["Resin T-Light", "t-light.html"], ["Resin Jewellery", "jewel.html"], ["Resin Frame", "frame.html"],
    ["Resin Keychain", "keychain.html"]
  ];
  var CHIPS = [
    { label: "Categories", q: "categories" }, { label: "Daam / Price", q: "price" },
    { label: "Offers", q: "offers" }, { label: "Delivery", q: "delivery" },
    { label: "Payment", q: "payment" }, { label: "Order track", q: "order track" },
    { label: "Custom design", q: "custom design" }
  ];
  /* ============================================================ */

  var API = location.protocol === "file:" ? "http://localhost:3000" : "";
  var products = null;                         // loaded once from the server
  fetch(API + "/api/products").then(function (r) { return r.json(); })
    .then(function (l) { products = Array.isArray(l) ? l : []; }).catch(function () { products = null; });

  /* ---------- helpers ---------- */
  function norm(s) { return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(); }
  function rs(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function any(m, re) { return re.test(m); }
  function waLink(text) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text || "Hello, mujhe jaankari chahiye."); }

  var STOP = (
    "kya hai hain ho hu hoon ka ki ke ko se me mein mai main par pe aur ya bhi to toh ye yeh wo woh is us ek kuch koi " +
    "kitna kitne kitni kaun konsa kaunsa kaise kab kahan kaha kyun kyu mujhe mere meri mera hum aap tum ap please plz " +
    "chahiye chahie dikhao dikha dikhaiye batao bataiye bata dijiye do dena de hona milega milta milti milte sakta sakte " +
    "price prices daam dam rate rates cost keemat kimat paisa paise rupee rupees rupay rs inr " +
    "andar kam under below upto within budget tak neeche less than max about the for and are you your what how much many which " +
    "show tell me can have any all sab sabhi list type types prakar kind kinds item items product products saman " +
    "category categories collection collections catalog catalogue " +
    "order orders track status delivery shipping ship charge charges courier deliver payment pay upi qr " +
    "custom customize customised design designs personal personalised offer offers discount coupon sale off " +
    "contact call phone number whatsapp email mail address sampark baat course workshop class care clean time days din " +
    "hi hello hey hii namaste namaskar thanks thank dhanyawad shukriya ok okay haan han nahi no yes"
  ).split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });

  function productTokens(m) {
    return m.split(" ").filter(function (w) {
      return w.length >= 3 && !STOPSET[w] && !/^\d+$/.test(w);
    }).map(function (w) { return w.length > 4 && /s$/.test(w) ? w.slice(0, -1) : w; });
  }
  function parseBudget(m) {
    if (!/(andar|kam|under|below|tak|within|upto|up to|less|budget|neeche|max)/.test(m)) return 0;
    var nums = m.replace(/,/g, "").match(/\d+/g);
    if (!nums) return 0;
    var n = parseInt(nums[nums.length - 1], 10);
    return n >= 50 ? n : 0;
  }
  function pText(p) { return norm([p.name, p.category, p.sub_category].join(" ")); }

  function findProducts(tokens, budget) {
    var list = (products || []).slice();
    if (tokens.length) {
      list = list.map(function (p) {
        var t = pText(p), score = 0;
        tokens.forEach(function (w) { if (t.indexOf(w) > -1) score++; });
        return { p: p, s: score };
      }).filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s || a.p.final_price - b.p.final_price; })
        .map(function (x) { return x.p; });
    } else {
      list.sort(function (a, b) { return a.final_price - b.final_price; });
    }
    if (budget) list = list.filter(function (p) { return p.final_price <= budget; });
    return list;
  }

  function productLines(list, max) {
    var out = list.slice(0, max || 6).map(function (p) {
      var d = Math.round(Number(p.discount) || 0);
      return "• " + p.name + " — " + rs(p.final_price) + (d ? " (" + rs(p.price) + " tha, " + d + "% off)" : "");
    });
    if (list.length > (max || 6)) out.push("…aur " + (list.length - (max || 6)) + " products. Poori list category pages par hai.");
    return out;
  }

  /* ---------- the brain ---------- */
  function reply(text) {
    var m = norm(text), tokens = productTokens(m), budget = parseBudget(m);
    var catLinks = CATS.map(function (c) { return { label: c[0], href: c[1] }; });
    var wa = [{ label: "WhatsApp par baat karein", href: waLink(text) }];

    if (!m) return { text: CFG.fallback, chips: CHIPS, links: wa };

    if (any(m, /^(hi+|hello|helo|hey|namaste|namaskar)\b/) && !tokens.length) return { text: CFG.hello, chips: CHIPS };
    if (any(m, /\b(thanks|thank|dhanyawad|shukriya)\b/)) return { text: CFG.thanks, chips: CHIPS };

    if (any(m, /(track|kahan hai|kaha hai|order status|my order|mera order|meri order|status)/))
      return { text: CFG.track, links: [{ label: "My Orders kholein", href: "pay.html" }], chips: CHIPS };
    if (any(m, /(payment|pay |upi|\bqr\b|gpay|phonepe|paytm|paise|\bcod\b|cash)/))
      return { text: CFG.payment + (/\bcod\b|cash/.test(m) ? "\nCash on delivery ke liye WhatsApp par poochiye." : ""), links: [{ label: "My Orders", href: "pay.html" }], chips: CHIPS };
    if (any(m, /(kitna time|kitne din|kab tak|how long|time lag|days|kitne time)/))
      return { text: CFG.time, links: wa, chips: CHIPS };
    if (any(m, /(delivery|shipping|\bship\b|courier|deliver|charge)/))
      return { text: CFG.delivery, links: wa, chips: CHIPS };
    if (any(m, /(custom|customi|personal|design your own|apne hisaab|apna design)/) && !tokens.length)
      return { text: CFG.custom, links: [{ label: "Design Your Own", href: "customizer.html" }], chips: CHIPS };
    if (any(m, /(course|workshop|class|seekh|learn|training)/))
      return { text: CFG.course, links: wa, chips: CHIPS };
    if (any(m, /(care|dekhbhaal|saaf|clean|wash|dhoop|safai|maintain)/))
      return { text: CFG.care, chips: CHIPS };
    if (any(m, /(contact|call|phone|number|whatsapp|email|mail|address|sampark)/))
      return { text: "WhatsApp / Phone: " + CFG.phone + "\nEmail: " + CFG.email, links: wa, chips: CHIPS };

    // offers + discounted products
    if (any(m, /(offer|discount|coupon|sale|\boff\b)/) && !tokens.length) {
      var disc = (products || []).filter(function (p) { return Number(p.discount) > 0; });
      var lines = [CFG.offers];
      if (disc.length) lines.push("Abhi discount par:", ...productLines(disc, 6));
      return { text: lines.join("\n"), chips: CHIPS };
    }

    // a product / category name was typed
    if (tokens.length) {
      if (products === null) return { text: "Abhi products ki list nahi mil paayi. Kripya thodi der baad koshish karein ya WhatsApp par poochiye.", links: wa, chips: CHIPS };
      var found = findProducts(tokens, budget);
      if (found.length) {
        var head = budget ? ("Ye products " + rs(budget) + " ke andar mile:") : "Ye products mile:";
        return { text: [head].concat(productLines(found, 6)).join("\n"), links: catLinks.slice(0, 0), chips: CHIPS };
      }
      return { text: "\"" + text.trim().slice(0, 40) + "\" naam ka koi product list mein nahi mila. Categories dekhein, ya WhatsApp par poochiye.", links: catLinks.concat(wa), chips: CHIPS };
    }

    // price / budget with no product name
    if (budget || any(m, /(price|daam|dam|rate|keemat|kimat|kitna|cost|sasta|cheap)/)) {
      if (products === null) return { text: "Abhi products ki list nahi mil paayi. Kripya WhatsApp par poochiye.", links: wa, chips: CHIPS };
      if (budget) {
        var inb = findProducts([], budget);
        return inb.length
          ? { text: ["Ye products " + rs(budget) + " ke andar hain:"].concat(productLines(inb.reverse(), 6)).join("\n"), chips: CHIPS }
          : { text: rs(budget) + " ke andar abhi koi product nahi mila.", links: wa, chips: CHIPS };
      }
      return { text: "Kis product ka daam jaanna hai? Naam likhiye (jaise keychain, clock, thali) ya budget batayein (jaise \"500 ke andar\"). Ya category chuniye:", links: catLinks, chips: CHIPS };
    }

    if (any(m, /(categor|collection|prakar|kya kya|konsa|kaunsa|catalog|products|saman|kitne type|type)/))
      return { text: "Humare paas " + CATS.length + " categories hain:", links: catLinks, chips: CHIPS };
    if (any(m, /(order|khareed|buy|cart|kaise)/)) return { text: CFG.howto, links: wa, chips: CHIPS };
    if (any(m, /(offer|discount|coupon|sale)/)) return { text: CFG.offers, chips: CHIPS };

    return { text: CFG.fallback, chips: CHIPS, links: wa };
  }

  /* ---------- the chat window ---------- */
  var css = document.createElement("style");
  css.textContent =
    "#sbBotBtn{position:fixed;bottom:24px;left:24px;padding:13px 20px;border:0;border-radius:50px;background:#000;color:#f5b400;font:700 14px 'Montserrat',Arial,sans-serif;cursor:pointer;z-index:999;box-shadow:0 4px 14px rgba(0,0,0,.3)}" +
    "#sbBotBtn:hover{background:#f5b400;color:#000}" +
    "#sbBot{display:none;position:fixed;bottom:84px;left:24px;width:340px;max-width:calc(100vw - 32px);height:470px;max-height:calc(100vh - 110px);background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:999;flex-direction:column;overflow:hidden;font-family:'Montserrat',Arial,sans-serif}" +
    "#sbBot .hd{background:#000;color:#f5b400;padding:12px 14px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;align-items:center}" +
    "#sbBot .hd button{background:none;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1}" +
    "#sbBot .ms{flex:1;overflow-y:auto;padding:12px;font-size:13px;line-height:1.5}" +
    "#sbBot .b{margin:6px 0;display:flex}#sbBot .b.u{justify-content:flex-end}" +
    "#sbBot .b span{display:inline-block;padding:8px 11px;border-radius:10px;max-width:88%;background:#fff7dc;white-space:pre-line}" +
    "#sbBot .b.u span{background:#eee}" +
    "#sbBot .lk{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px}" +
    "#sbBot .lk a{font-size:12px;font-weight:600;text-decoration:none;color:#000;border:1px solid #f5b400;background:#fff;border-radius:50px;padding:5px 11px}" +
    "#sbBot .lk a:hover{background:#f5b400}" +
    "#sbBot .ch{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}" +
    "#sbBot .ch button{font:600 12px 'Montserrat',Arial,sans-serif;border:1px solid #ccc;background:#fff;border-radius:50px;padding:5px 11px;cursor:pointer}" +
    "#sbBot .ch button:hover{background:#000;color:#fff;border-color:#000}" +
    "#sbBot .wa{text-align:center;font-size:12px;padding:6px;color:#128c4a;font-weight:600;text-decoration:none;border-top:1px solid #eee}" +
    "#sbBot .in{display:flex;border-top:1px solid #ddd}" +
    "#sbBot .in input{flex:1;border:0;padding:12px;outline:none;font:13px 'Montserrat',Arial,sans-serif}" +
    "#sbBot .in button{border:0;background:#f5b400;color:#000;padding:0 16px;font-weight:700;cursor:pointer}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "sbBotBtn"; btn.type = "button"; btn.textContent = "💬 Poochiye";
  var box = document.createElement("div");
  box.id = "sbBot";
  box.innerHTML =
    '<div class="hd"><span>Saubhagya Assistant</span><button type="button" aria-label="Close">&times;</button></div>' +
    '<div class="ms"></div>' +
    '<a class="wa" target="_blank" rel="noopener">WhatsApp par baat karein</a>' +
    '<div class="in"><input type="text" placeholder="Apna sawaal likhein..." maxlength="120"><button type="button">Bhejein</button></div>';
  document.body.appendChild(btn); document.body.appendChild(box);
  box.querySelector(".wa").href = waLink();

  var ms = box.querySelector(".ms"), inp = box.querySelector("input"), opened = false;

  function bubble(text, user) {
    var d = document.createElement("div"); d.className = "b" + (user ? " u" : "");
    var s = document.createElement("span"); s.textContent = text; d.appendChild(s); ms.appendChild(d);
  }
  function clearChips() { ms.querySelectorAll(".ch").forEach(function (c) { c.remove(); }); }
  function show(res) {
    clearChips();
    if (res.text) bubble(res.text, false);
    if (res.links && res.links.length) {
      var l = document.createElement("div"); l.className = "lk";
      res.links.forEach(function (x) {
        var a = document.createElement("a"); a.textContent = x.label; a.href = x.href;
        if (/^https?:/.test(x.href)) { a.target = "_blank"; a.rel = "noopener"; }
        l.appendChild(a);
      });
      ms.appendChild(l);
    }
    if (res.chips && res.chips.length) {
      var c = document.createElement("div"); c.className = "ch";
      res.chips.forEach(function (x) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = x.label;
        b.onclick = function () { ask(x.q, x.label); };
        c.appendChild(b);
      });
      ms.appendChild(c);
    }
    ms.scrollTop = ms.scrollHeight;
  }
  function ask(q, shown) {
    var text = String(q || "").trim(); if (!text) return;
    clearChips(); bubble(shown || text, true);
    setTimeout(function () { show(reply(text)); }, 250);
  }
  function send() { var t = inp.value; inp.value = ""; ask(t); }

  btn.onclick = function () {
    var open = box.style.display === "flex";
    box.style.display = open ? "none" : "flex";
    if (!open && !opened) { opened = true; show({ text: CFG.hello, chips: CHIPS }); }
    if (!open) inp.focus();
  };
  box.querySelector(".hd button").onclick = function () { box.style.display = "none"; };
  box.querySelector(".in button").onclick = send;
  inp.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") box.style.display = "none"; });
})();