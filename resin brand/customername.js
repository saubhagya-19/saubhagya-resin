// customer-name.js - shows "Welcome, <name>" + Log out under the logo.
// Add before </body> on your shop/home page:  <script src="customer-name.js"></script>
// Does NOT force login. If nobody is logged in it shows a "Login / Sign Up" link.
(function(){
  var LOGIN_PAGE = 'login.html';   // <-- your login page file name

  function run(){
    var user = null;
    try{
      var session = JSON.parse(localStorage.getItem('sr_session') || 'null');
      var users = JSON.parse(localStorage.getItem('sr_users') || '[]');
      user = session && users.find(function(u){ return u.id === session.id; });
    }catch(e){}

    // 1) Your own spot: <div id="customerGreeting"></div>
    var box = document.getElementById('customerGreeting');

    // 2) Right after the logo image
    if (!box){
      var logo = document.querySelector('img[alt*="logo" i], img[src*="logo" i], .logo img, header img, .logo');
      if (logo){
        box = document.createElement('div');
        box.id = 'customerGreeting';
        logo.insertAdjacentElement('afterend', box);
      }
    }

    // 3) Fallback: a bar at the very top of the page, so it is always visible
    if (!box){
      box = document.createElement('div');
      box.id = 'customerGreeting';
      document.body.insertBefore(box, document.body.firstChild);
    }

    box.style.cssText = 'display:block;width:100%;text-align:center;font-size:15px;font-weight:600;margin:6px 0;color:#222;font-family:inherit;';
    box.textContent = '';

    if (user){
      var hi = document.createElement('span');
      hi.textContent = 'Welcome, ' + user.name;
      var out = document.createElement('a');
      out.href = '#';
      out.textContent = 'Log out';
      out.style.cssText = 'margin-left:10px;font-size:13px;font-weight:400;color:#2b5fd9;text-decoration:underline;cursor:pointer;';
      out.addEventListener('click', function(e){
        e.preventDefault();
        try{ localStorage.removeItem('sr_session'); }catch(x){}
        location.href = LOGIN_PAGE;
      });
      box.appendChild(hi);
      box.appendChild(out);
    } else {
      var a = document.createElement('a');
      var here = location.protocol === 'file:'
        ? decodeURIComponent(location.pathname.split('/').pop()) + location.search
        : location.pathname + location.search;
      a.href = LOGIN_PAGE + '?next=' + encodeURIComponent(here);
      a.textContent = 'Login / Sign Up';
      a.style.cssText = 'font-size:14px;color:#2b5fd9;text-decoration:underline;';
      box.appendChild(a);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();