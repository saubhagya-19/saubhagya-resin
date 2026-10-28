/* live-products.js
   Shows products uploaded from the Admin panel on any page.

   Put this where the products should appear:
     <div id="liveProducts" data-match="keychain"></div>
     <script src="live-products.js"></script>

   Options on the #liveProducts div:
     data-match="keychain"        show only products whose Category or Sub category matches (separate several with commas)
     data-limit="8"               show at most 8 products (newest first)
     data-all="1"                 also show products that have no photo (normally hidden, so old products are not repeated)
   If the div sits inside an element with the attribute  data-live-section , that element is hidden when there is nothing to show. */
(function () {
  var box = document.getElementById("liveProducts");

  /* Category pages: if the page has no #liveProducts div, one is created automatically (before the footer)
     using the match word for that page below. Change a word here if your Category names differ. */
  if (!box) {
    var AUTO = {
      "rose.html": "rose", "clock.html": "clock", "pooja-thali.html": "pooja", "t-light.html": "light",
      "jewel.html": "jewel", "frame.html": "frame", "keychain.html": "keychain"
    };
    var page = location.pathname.split("/").pop().toLowerCase();
    if (!AUTO[page]) return;
    var sec = document.createElement("section");
    sec.setAttribute("data-live-section", "");
    sec.style.cssText = "padding:40px 5vw;font-family:'Montserrat',Arial,sans-serif";
    sec.innerHTML = '<h2 style="text-align:center;font-size:1.6rem;font-weight:800;letter-spacing:2px;margin:0 0 26px;text-transform:uppercase">New Arrivals</h2>' +
      '<div id="liveProducts" data-match="' + AUTO[page] + '"></div>';
    var foot = document.querySelector("footer");
    if (foot) foot.parentNode.insertBefore(sec, foot); else document.body.appendChild(sec);
    box = document.getElementById("liveProducts");
  }

  var API = location.protocol === "file:" ? "http://localhost:3000" : "";
  var match = (box.getAttribute("data-match") || "").split(",").map(norm).filter(Boolean);
  var limit = parseInt(box.getAttribute("data-limit"), 10) || 0;
  var showAll = box.getAttribute("data-all") === "1";
  var section = box.closest("[data-live-section]");
  var products = [];

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]/g, ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function imgUrl(p) { return !p ? "" : (/^(https?:|data:)/.test(p) || !API) ? p : (p.charAt(0) === "/" ? API + p : p); }

  /* ---------- styles (added once, all names start with lp-) ---------- */
  if (!document.getElementById("lpStyle")) {
    var st = document.createElement("style");
    st.id = "lpStyle";
    st.textContent =
      "#liveProducts.lp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px;max-width:1100px;margin:0 auto;font-family:'Montserrat',Arial,sans-serif}" +
      ".lp-card{position:relative;background:#fff;border:1px solid #eee;border-radius:14px;overflow:hidden;text-align:center;padding-bottom:16px;transition:transform .2s,box-shadow .2s}" +
      ".lp-card:hover{transform:translateY(-6px);box-shadow:0 12px 26px rgba(0,0,0,.12)}" +
      ".lp-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#f4f4f4}" +
      ".lp-off{position:absolute;top:10px;left:10px;background:#e91e63;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px}" +
      ".lp-card h3{font-size:15px;margin:14px 10px 4px;font-weight:700;color:#222}" +
      ".lp-cat{font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;margin:0 10px 6px}" +
      ".lp-desc{font-size:13px;color:#666;margin:0 14px 10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".lp-price{font-size:17px;font-weight:700;color:#1a8a3c;margin-bottom:12px}" +
      ".lp-price s{color:#999;font-size:13px;font-weight:500;margin-left:6px}" +
      ".lp-btn{background:#000;color:#fff;border:0;border-radius:50px;padding:10px 24px;font:600 13px 'Montserrat',Arial,sans-serif;cursor:pointer;transition:background .2s,color .2s}" +
      ".lp-btn:hover{background:#f5b400;color:#000}" +
      ".lp-btn.done{background:#1a8a3c;color:#fff}" +
      "#lpToast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:#000;color:#fff;padding:12px 22px;border-radius:50px;font:600 14px 'Montserrat',Arial,sans-serif;opacity:0;pointer-events:none;transition:all .3s;z-index:3000}" +
      "#lpToast.show{opacity:1;transform:translateX(-50%) translateY(0)}" +
      "#lpToast a{color:#f5b400;margin-left:10px;text-decoration:none}";
    document.head.appendChild(st);
  }
  box.classList.add("lp-grid");

  /* ---------- cart (same format cart.html reads) ---------- */
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function cartKey() {
    var keys = ["cart", "srCart", "cartItems", "sr_cart"], i;
    for (i = 0; i < keys.length; i++) { var v = readJSON(keys[i]); if (Array.isArray(v) && v.length) return keys[i]; }
    try {
      for (var j = 0; j < localStorage.length; j++) {
        var k = localStorage.key(j);
        if (k === "sr_users" || k === "sr_session") continue;
        var d = readJSON(k);
        if (Array.isArray(d) && d.length && d.every(function (x) { return x && typeof x === "object" && "price" in x; })) return k;
      }
    } catch (e) {}
    for (i = 0; i < keys.length; i++) if (Array.isArray(readJSON(keys[i]))) return keys[i];
    return "cart";
  }
  function addToCart(p) {
    var key = cartKey(), cart = readJSON(key);
    if (!Array.isArray(cart)) cart = [];
    var found = null;
    cart.forEach(function (it) { if (String(it.name || it.title || "").toLowerCase() === p.name.toLowerCase()) found = it; });
    if (found) {
      var q = (parseFloat(found.qty || found.quantity || found.count || 1) || 1) + 1;
      if ("quantity" in found && !("qty" in found)) found.quantity = q;
      else if ("count" in found && !("qty" in found)) found.count = q;
      else found.qty = q;
      found.price = p.final_price;
    } else {
      cart.push({ name: p.name, price: p.final_price, mrp: p.discount > 0 ? p.price : undefined, image: p.image || "", qty: 1 });
    }
    try { localStorage.setItem(key, JSON.stringify(cart)); } catch (e) {}
  }
  function toast(msg) {
    var t = document.getElementById("lpToast");
    if (!t) { t = document.createElement("div"); t.id = "lpToast"; document.body.appendChild(t); }
    t.innerHTML = esc(msg) + ' <a href="cart.html">VIEW CART</a>';
    t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- show the products ---------- */
  function draw(list) {
    box.innerHTML = list.map(function (p) {
      var disc = Math.round(Number(p.discount) || 0);
      var cat = [p.category, p.sub_category].filter(Boolean).join(" · ");
      var search = [p.name, p.category, p.sub_category, p.description].join(" ");
      return '<div class="lp-card" data-s="' + esc(search) + '">' +
        (disc ? '<span class="lp-off">' + disc + '% OFF</span>' : '') +
        (p.image ? '<img src="' + esc(imgUrl(p.image)) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') +
        '<h3>' + esc(p.name) + '</h3>' +
        (cat ? '<div class="lp-cat">' + esc(cat) + '</div>' : '') +
        (p.description ? '<p class="lp-desc" title="' + esc(p.description) + '">' + esc(p.description) + '</p>' : '') +
        '<div class="lp-price">' + money(p.final_price) + (disc ? '<s>' + money(p.price) + '</s>' : '') + '</div>' +
        '<button type="button" class="lp-btn" data-id="' + p.id + '">ADD TO CART</button></div>';
    }).join("");
  }

  box.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]"); if (!b) return;
    var p = products.filter(function (x) { return String(x.id) === b.getAttribute("data-id"); })[0]; if (!p) return;
    addToCart(p);
    b.textContent = "ADDED ✓"; b.classList.add("done");
    setTimeout(function () { b.textContent = "ADD TO CART"; b.classList.remove("done"); }, 1400);
    toast(p.name + " added to cart");
  });

  fetch(API + "/api/products")
    .then(function (r) { return r.json(); })
    .then(function (list) {
      if (!Array.isArray(list)) throw new Error("bad data");
      var out = list.filter(function (p) {
        if (!showAll && !p.image) return false;           // old products already have their own cards
        if (!match.length) return true;
        var fields = [norm(p.category), norm(p.sub_category)].filter(Boolean);
        return match.some(function (m) { return fields.some(function (f) { return f.indexOf(m) > -1 || m.indexOf(f) > -1; }); });
      });
      if (limit) out = out.slice(0, limit);
      products = out;
      if (!out.length) { if (section) section.style.display = "none"; return; }
      draw(out);
    })
    .catch(function () { if (section) section.style.display = "none"; });
})();