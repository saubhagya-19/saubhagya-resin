/* Adds a "My Orders" link (pay.html) to index.html: header icon + footer Quick Links.
   Keep this file in the SAME folder as index.html ("resin brand") and run:  node add-my-orders.js */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, process.argv[2] || "index.html");
if (!fs.existsSync(file)) { console.error("index.html not found in this folder."); process.exit(1); }

let html = fs.readFileSync(file, "utf8");
if (html.includes('href="pay.html"')) { console.log("My Orders link is already in index.html. Nothing changed."); process.exit(0); }

const headerOld = '<a href="login.html" class="icon-link" title="Login">👤</a>';
const headerNew = headerOld + '\n                <a href="pay.html" class="icon-link" title="My Orders">📦</a>';
const footerOld = '<a href="cart.html">Cart</a>';
const footerNew = footerOld + '\n                <a href="pay.html">My Orders</a>';

if (!html.includes(headerOld) || !html.includes(footerOld)) {
  console.error("Could not find the Login icon or the footer Cart link. Nothing changed.");
  process.exit(1);
}

fs.writeFileSync(file + ".bak", html);            // backup of the old file
html = html.replace(headerOld, headerNew).replace(footerOld, footerNew);
fs.writeFileSync(file, html);
console.log("Done! My Orders added to the header and footer. Old copy saved as " + path.basename(file) + ".bak");