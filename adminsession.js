(function() {
  'use strict';

  // If loaded from file://, redirect to the server login page immediately
  if (window.location.protocol === 'file:') {
    window.location.replace('http://localhost:3000/adminlogin.html');
    return;
  }

  // If loaded from server but no session, redirect to login
  try {
    var username = sessionStorage.getItem('bw.admin.username');
    if (!username) {
      window.location.replace('/adminlogin.html');
      return;
    }
  } catch (e) {
    window.location.replace('/adminlogin.html');
    return;
  }

  // Resolve API base: prefer same-origin (Vercel proxy) when on a deployed site
  var apiBase = (function(){
    try {
      if (window.location.hostname && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
        return window.location.origin;
      }
    } catch(e) {}
    try {
      var meta = document.querySelector('meta[name="next-public-api-url"]');
      if (meta && meta.content) return meta.content;
    } catch(e) {}
    try {
      if (window.BW_API_BASE) return window.BW_API_BASE;
    } catch(e) {}
    return 'https://pampers-undrafted-urchin.ngrok-free.dev';
  })();
  try {
    window.BW_API_BASE = apiBase;
  } catch(e) {}

  // Server-side validation + refresh permissions in sessionStorage
  var refreshTimer = null;
  var refreshInFlight = false;
  function refreshAdminSession() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', apiBase + '/api/admin/' + encodeURIComponent(username) + '/permissions?ts=' + Date.now(), true);
    xhr.withCredentials = true;
    xhr.onload = function() {
      refreshInFlight = false;
      try {
        var data = JSON.parse(xhr.responseText);
        if (!data.ok || !data.admin) {
          sessionStorage.removeItem('bw.admin.username');
          sessionStorage.removeItem('bw.admin.role');
          sessionStorage.removeItem('bw.admin.permissions');
          window.location.replace('/adminlogin.html');
          return;
        }
        // Refresh permissions in sessionStorage so permission checks use latest data
        sessionStorage.setItem('bw.admin.role', data.admin.role);
        sessionStorage.setItem('bw.admin.permissions', JSON.stringify(data.admin.permissions));
      } catch(e) {}
    };
    xhr.onerror = function() {
      refreshInFlight = false;
    };
    xhr.send();
  }
  refreshAdminSession();
  refreshTimer = window.setInterval(refreshAdminSession, 5000);
  window.addEventListener('focus', refreshAdminSession);
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) refreshAdminSession();
  });
  window.addEventListener('beforeunload', function() {
    if (refreshTimer) window.clearInterval(refreshTimer);
  });
})();