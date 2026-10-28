// guard.js - include on every page that needs a logged-in customer:
// <script src="guard.js"></script>   (put it right after <body>)
// Do NOT include it on login.html.
(function(){
  var LOGIN_PAGE = 'login.html';   // <-- your login page file name
  var user = null;
  try{
    var session = JSON.parse(localStorage.getItem('sr_session') || 'null');
    var users = JSON.parse(localStorage.getItem('sr_users') || '[]');
    user = session && users.find(function(u){ return u.id === session.id; });
  }catch(e){}

  // Not logged in -> go to login, and come back to THIS page afterwards
  if (!user){
    var here;
    if (location.protocol === 'file:') {
      here = decodeURIComponent(location.pathname.split('/').pop()) + location.search;   // just the file name
    } else {
      here = location.pathname + location.search + location.hash;
    }
    location.replace(LOGIN_PAGE + '?next=' + encodeURIComponent(here));
    return;
  }

  // Available to the rest of your page
  window.currentCustomer = { id: user.id, name: user.name, email: user.email };
  window.srLogout = function(){
    try{ localStorage.removeItem('sr_session'); }catch(e){}
    location.href = LOGIN_PAGE;
  };
})();