document.addEventListener('DOMContentLoaded', () => {
  // --- Page fade transition (applies to all pages using main.js) ---
  const FADE_MS = 150;
  const fadeStyle = document.createElement('style');
  fadeStyle.textContent = `
    body.cw-fade-page {
      opacity: 0;
      transition: opacity ${FADE_MS}ms ease;
    }
    body.cw-fade-page.cw-fade-ready {
      opacity: 1;
    }
  `;
  document.head.appendChild(fadeStyle);

  document.body.classList.add('cw-fade-page');
  requestAnimationFrame(() => {
    document.body.classList.add('cw-fade-ready');
  });

  // Resolve API base URL in the browser. Prefer explicit runtime values that can be injected
  // into the page (window.BW_API_BASE or a meta tag). Fall back to process.env when available
  // (build-time), then to the page origin, and lastly localhost.
  var API_BASE = (function(){
    try {
      if (typeof window !== 'undefined' && window.BW_API_BASE) return window.BW_API_BASE;
      var meta = document.querySelector('meta[name="next-public-api-url"]');
      if (meta && meta.content) return meta.content;
      if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
      if (typeof location !== 'undefined' && location.origin) return location.origin;
    } catch (e) {}
    return 'http://localhost:3000';
  })();

  // If the page is running on a non-localhost origin (deployed site) and
  // the resolved API_BASE points to a different origin (e.g., cached ngrok),
  // prefer same-origin so admin requests go through the serverless proxy.
  try {
    if (typeof location !== 'undefined' && location.hostname && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
      var locOrigin = location.origin;
      if (API_BASE && String(API_BASE).indexOf(locOrigin) !== 0) {
        API_BASE = locOrigin;
      }
    }
  } catch (e) {}

  // -- Navigation instrumentation (debugging random reloads) --
  (function navInstrumentation(){
    try {
      var bwLogKey = 'bw_nav_log';
      function pushNavEvent(ev) {
        try {
          var a = JSON.parse(localStorage.getItem(bwLogKey) || '[]');
          a.push({ ts: Date.now(), ev: ev, stack: (new Error()).stack.split('\n').slice(2,8) });
          if (a.length > 20) a = a.slice(a.length - 20);
          localStorage.setItem(bwLogKey, JSON.stringify(a));
        } catch (e) { /* ignore */ }
      }

      var _origReplace = window.location.replace.bind(window.location);
      window.location.replace = function(url) {
        pushNavEvent({ type: 'replace', url: String(url) });
        return _origReplace(url);
      };

      var _origAssign = window.location.assign.bind(window.location);
      window.location.assign = function(url) {
        pushNavEvent({ type: 'assign', url: String(url) });
        return _origAssign(url);
      };

      var _origReload = window.location.reload.bind(window.location);
      window.location.reload = function() {
        pushNavEvent({ type: 'reload' });
        return _origReload();
      };

      // ensure navigateWithFade also logs
      var _origNavigateWithFade = navigateWithFade;
      navigateWithFade = function(url) {
        pushNavEvent({ type: 'navigateWithFade', url: String(url) });
        return _origNavigateWithFade(url);
      };
    } catch (e) {
      /* ignore instrumentation failures */
    }
  })();

  function navigateWithFade(url) {
    if (!url) return;
    document.body.classList.remove('cw-fade-ready');
    window.setTimeout(() => {
      window.location.href = url;
    }, FADE_MS);
  }

  // --- Navigation map for buttons that go to form pages ---
  const navMap = {
    btnclearance: './form.html?type=clearance',
    btnresidency: './form.html?type=residency',
    btnindigency: './form.html?type=indigency',
    btnblotter: './form.html?type=blotter',
    btncedula: './form.html?type=cedula',
    btncommunity: './form.html?type=community'
  };
  Object.keys(navMap).forEach(key => {
    const el = document.querySelector(`.${key}`);
    if (el) el.addEventListener('click', () => { navigateWithFade(navMap[key]); });
  });

  // --- btnexisting: open existing appointment lookup page ---
  const btnExisting = document.querySelector('.btnexisting');
  if (btnExisting) {
    btnExisting.style.cursor = 'pointer';
    btnExisting.addEventListener('click', () => {
      navigateWithFade('./update.html');
    });
  }

  // --- btnsearch: scroll to the existing appointments section ---
  const btnSearch = document.querySelector('.btnsearch');
  if (btnSearch) {
    const isUpdatePage = !!document.querySelector('.update');
    const lockScroll = () => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.touchAction = 'none';
      document.body.style.touchAction = 'none';
    };
    const unlockScroll = () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.style.touchAction = '';
      document.body.style.touchAction = '';
    };
    if (isUpdatePage) lockScroll();
    const updateSearchButtonState = () => {
      const emailField = document.querySelector('.text-field .tfusedemail');
      const firstNameField = document.querySelector('.text-field3 .tfusedemail');
      const lastNameField = document.querySelector('.text-field5 .tfusedemail');
      const email = (emailField?.textContent || '').trim();
      const firstName = (firstNameField?.textContent || '').trim();
      const lastName = (lastNameField?.textContent || '').trim();
      const enabled = email.length > 0 || (firstName.length > 0 && lastName.length > 0);
      btnSearch.style.opacity = enabled ? '1' : '0.45';
      btnSearch.style.cursor = enabled ? 'pointer' : 'not-allowed';
      btnSearch.style.pointerEvents = enabled ? 'auto' : 'none';
      btnSearch.dataset.enabled = enabled ? '1' : '0';
    };
    btnSearch.addEventListener('click', () => {
      if (btnSearch.dataset.enabled !== '1') return;
      unlockScroll();
      const target = document.querySelector('.rectangle-parent');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    [
      document.querySelector('.text-field .tfusedemail'),
      document.querySelector('.text-field3 .tfusedemail'),
      document.querySelector('.text-field5 .tfusedemail')
    ].filter(Boolean).forEach((field) => {
      field.addEventListener('input', updateSearchButtonState);
      field.addEventListener('keyup', updateSearchButtonState);
      field.addEventListener('blur', updateSearchButtonState);
      field.addEventListener('paste', () => { window.setTimeout(updateSearchButtonState, 0); });
    });
    updateSearchButtonState();
  }

  // quick scroll-to-frame button
  const btnsetapp = document.querySelector('.btnsetapp');
  if (btnsetapp) {
    btnsetapp.style.cursor = 'pointer';
    btnsetapp.addEventListener('click', () => {
      const target = document.querySelector('.frame-div') || document.querySelector('.rectangle-container');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- btnAdmin: navigate to admin login page ---
  const btnAdmin = document.querySelector('.btnadmin');
  if (btnAdmin) {
    btnAdmin.style.cursor = 'pointer';
    btnAdmin.addEventListener('click', () => {
      navigateWithFade('./adminlogin.html');
    });
  }

  // --- btnCalendar scroll to the calendar container ---
  const btnCalendar = document.querySelector('.btncalendar');
  if (btnCalendar) {
    btnCalendar.style.cursor = 'pointer';
    btnCalendar.addEventListener('click', () => {
      const target = document.querySelector('.rectangle-container');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }

  // --- admin dashboard: manage schedules tile ---
  const btnSchedules = document.querySelector('.btnschedules');
  if (btnSchedules) {
    btnSchedules.style.cursor = 'pointer';
    btnSchedules.addEventListener('click', () => {
      navigateWithFade('./schedule.html');
    });
  }

  // --- btnlogs: open logs page ---
  const btnLogs = document.querySelector('.btnlogs');
  if (btnLogs) {
    btnLogs.style.cursor = 'pointer';
    btnLogs.addEventListener('click', () => {
      navigateWithFade('./logs.html');
    });
  }

  // --- btnSuccess enable/disable helper ---
  const btnSuccess = document.querySelector('.btnsuccess');
  function setBtnSuccessEnabled(enabled) {
    if (!btnSuccess) return;
    if (enabled) {
      btnSuccess.style.opacity = '1';
      btnSuccess.style.cursor = 'pointer';
      btnSuccess.style.pointerEvents = 'auto';
      btnSuccess.dataset.enabled = '1';
    } else {
      btnSuccess.style.opacity = '0.5';
      btnSuccess.style.cursor = 'not-allowed';
      btnSuccess.style.pointerEvents = 'none';
      delete btnSuccess.dataset.enabled;
    }
  }
  if (btnSuccess) setBtnSuccessEnabled(false);

  // --- Generic handling: all `tf*` fields and clear buttons ---
  (function wireTfAndEraseButtons(){
    const tfCandidates = [];
    document.querySelectorAll('[class]').forEach((el) => {
      for (const cls of Array.from(el.classList)) {
        if (cls && cls.startsWith('tf')) {
          tfCandidates.push(el);
          break;
        }
      }
    });
    const tfFields = Array.from(new Set(tfCandidates));
    tfFields.forEach((field) => {
      if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
        field.style.cursor = 'text';
        field.spellcheck = false;
      } else {
        field.contentEditable = 'true';
        field.setAttribute('role', 'textbox');
        field.setAttribute('aria-multiline', 'false');
        field.setAttribute('tabindex', '0');
        field.spellcheck = false;
        field.style.outline = 'none';
        field.style.minHeight = '20px';
        field.style.cursor = 'text';
      }
      try {
        field.addEventListener('focus', () => { field.style.borderBottom = '2px solid #1d88d9'; });
        field.addEventListener('blur', () => { field.style.borderBottom = 'none'; });
      } catch (e) { /* ignore */ }
    });
    const eraseButtons = Array.from(document.querySelectorAll('[class]')).filter((el) => {
      if (!el.classList) return false;
      return Array.from(el.classList).some((cls) => cls && cls.startsWith('erase'));
    });
    eraseButtons.forEach((btn) => {
      btn.setAttribute('role', 'button');
      if (btn.tagName === 'BUTTON') btn.type = 'button';
      btn.style.cursor = 'pointer';
      const stateLayer = btn.closest('.state-layer');
      if (!stateLayer) return;
      const nearbyTf = Array.from(stateLayer.querySelectorAll('[class]')).find((el) =>
        Array.from(el.classList).some((c) => c && c.startsWith('tf'))
      );
      if (!nearbyTf) return;
      const syncButton = () => {
        const value = (nearbyTf.tagName === 'INPUT' || nearbyTf.tagName === 'TEXTAREA') ? (nearbyTf.value || '') : (nearbyTf.textContent || '');
        btn.style.display = value.trim().length > 0 ? 'flex' : 'none';
      };
      btn.addEventListener('click', () => {
        if (nearbyTf.tagName === 'INPUT' || nearbyTf.tagName === 'TEXTAREA') {
          nearbyTf.value = '';
          nearbyTf.focus();
        } else {
          nearbyTf.textContent = '';
          nearbyTf.focus();
        }
        syncButton();
      });
      try {
        if (nearbyTf.tagName === 'INPUT' || nearbyTf.tagName === 'TEXTAREA') {
          nearbyTf.addEventListener('input', syncButton);
          nearbyTf.addEventListener('blur', syncButton);
        } else {
          nearbyTf.addEventListener('input', syncButton);
          nearbyTf.addEventListener('keyup', syncButton);
          nearbyTf.addEventListener('paste', () => { setTimeout(syncButton, 0); });
        }
      } catch (e) { /* ignore */ }
      if (btn.tagName !== 'BUTTON') {
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            btn.click();
          }
        });
      }
      syncButton();
    });
  })();

  // --- PERMISSIONS PAGE: dynamic user rows with floating role select ---
  const isPermissionsPage = !!document.querySelector('.permissions');
  if (isPermissionsPage) {
    var btnApply = document.querySelector('.btnapply');
    var permBtnBack = document.querySelector('.btnback');
    var menuEl = document.querySelector('.menu');
    var adminApiBase = API_BASE;

    var roles = [
      { label: 'Supervisor', image: './assets/supervisor.png' },
      { label: 'Manager', image: './assets/manager.png' },
      { label: 'Officer', image: './assets/officer.png' }
    ];
    var roleImageMap = {};
    roles.forEach(function(r) { roleImageMap[r.label] = r.image; });
    var willDelete = false; // flag if user selected "Delete User"

    // Pending changes: { username -> { originalRole, selectedRole } }
    var pendingChanges = {};
    var _pendingStorageKey = 'bw_pending_changes';
    function _loadPendingFromStorage() {
      try {
        var raw = localStorage.getItem(_pendingStorageKey);
        if (raw) {
          var parsed = JSON.parse(raw || '{}');
          if (parsed && typeof parsed === 'object') {
            pendingChanges = parsed;
          }
        }
      } catch (e) { /* ignore malformed storage */ }
    }
    function _savePendingToStorage() {
      try {
        localStorage.setItem(_pendingStorageKey, JSON.stringify(pendingChanges || {}));
      } catch (e) { /* ignore */ }
    }
    _loadPendingFromStorage();
    var allUsers = [];

    // Apply button state
    function updateApplyState() {
      var hasChanges = false;
      for (var k in pendingChanges) {
        if (pendingChanges[k].selectedRole !== pendingChanges[k].originalRole) {
          hasChanges = true;
          break;
        }
      }
      if (!btnApply) return;
      if (hasChanges) {
        btnApply.style.opacity = '1';
        btnApply.style.cursor = 'pointer';
        btnApply.style.pointerEvents = 'auto';
        btnApply.dataset.enabled = '1';
      } else {
        btnApply.style.opacity = '0.45';
        btnApply.style.cursor = 'not-allowed';
        btnApply.style.pointerEvents = 'none';
        delete btnApply.dataset.enabled;
      }
    }

    if (permBtnBack) {
      permBtnBack.style.cursor = 'pointer';
      permBtnBack.addEventListener('click', function() {
        window.location.replace('./admindashboard.html');
      });
    }

    // Floating role dropdown element (single shared overlay)
    var floatDropdown = document.createElement('div');
    floatDropdown.className = 'role-dropdown';
    document.body.appendChild(floatDropdown);

    var activeIconButton = null; // the icon element that opened this dropdown

    function showFloatDropdown(iconEl, username, currentRole) {
      // Position dropdown near the icon
      var rect = iconEl.getBoundingClientRect();
      floatDropdown.innerHTML = '';
      floatDropdown.classList.add('is-visible');

      // Position to the right of the icon
      floatDropdown.style.left = (rect.right + 6) + 'px';
      floatDropdown.style.top = rect.top + 'px';

      roles.forEach(function(role) {
        var opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'role-option';
        if (role.label === currentRole) opt.classList.add('is-selected');
        var icon = document.createElement('img');
        icon.className = 'role-option-icon';
        icon.src = role.image;
        icon.alt = '';
        var label = document.createElement('span');
        label.className = 'role-option-label';
        label.textContent = role.label;
        opt.appendChild(icon);
        opt.appendChild(label);
        opt.addEventListener('click', function(e) {
          e.stopPropagation();
          // Update pending change
          if (!pendingChanges[username]) {
            pendingChanges[username] = { originalRole: currentRole, selectedRole: role.label };
          } else {
            pendingChanges[username].selectedRole = role.label;
          }
          _savePendingToStorage();
          // Update the role icon in the row
          var roleIcon = iconEl.closest('.admin1').querySelector('.icon2');
          if (roleIcon && roleImageMap[role.label]) {
            roleIcon.src = roleImageMap[role.label];
          }
          // Update the admin name label to show current role
          var nameLabel = iconEl.closest('.admin1').querySelector('.lbladminname');
          if (nameLabel) {
            var baseName = nameLabel.dataset.displayname || '';
            var bId = nameLabel.dataset.barangayid || '';
            var suffix = bId ? ' — ' + bId : '';
            nameLabel.textContent = baseName + ' (' + role.label + ')' + suffix;
          }
          closeFloatDropdown();
          updateApplyState();
        });
        floatDropdown.appendChild(opt);
      });

      // Add a destructive "Delete user" option at the end
      var delOpt = document.createElement('button');
      delOpt.type = 'button';
      delOpt.className = 'role-option role-option-destructive';
      var delIcon = document.createElement('img');
      delIcon.className = 'role-option-icon';
      delIcon.src = './assets/trash.png';
      delIcon.alt = 'delete';
      var delLabel = document.createElement('span');
      delLabel.className = 'role-option-label';
      delLabel.textContent = 'Delete user';
      delOpt.appendChild(delIcon);
      delOpt.appendChild(delLabel);
      delOpt.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!username) return;
        if (!confirm('Delete user "' + username + '"? This cannot be undone.')) return;
        // Call backend to delete user
        fetch(`${API_BASE}/api/admin/user/${encodeURIComponent(username)}`, {
          method: 'DELETE'
        , credentials: 'include' })
        .then(function(r) { return r.json().catch(function(){ return { ok: false }; }); })
        .then(function(data) {
          if (data && data.ok) {
            // remove from local list and re-render
            allUsers = allUsers.filter(function(u) { return u.username !== username; });
            delete pendingChanges[username];
            _savePendingToStorage();
            closeFloatDropdown();
            renderUsers();
            updateApplyState();
            alert('User deleted');
          } else {
            alert('Failed to delete user: ' + (data && data.error ? data.error : 'unknown'));
          }
        })
        .catch(function() {
          alert('Could not reach server to delete user');
        });
      });
      floatDropdown.appendChild(delOpt);

      activeIconButton = iconEl;
    }

    function closeFloatDropdown() {
      floatDropdown.classList.remove('is-visible');
      activeIconButton = null;
    }

    // Close floating dropdown on outside click
    document.addEventListener('click', function(e) {
      if (floatDropdown.classList.contains('is-visible') && !floatDropdown.contains(e.target) && e.target !== activeIconButton) {
        closeFloatDropdown();
      }
    });

    // Build user rows inside the menu
    function renderUsers() {
      if (!menuEl) return;
      // Keep the first child (admin1 placeholder) only
      while (menuEl.firstChild) {
        menuEl.removeChild(menuEl.firstChild);
      }

      // Filter out 'admin' user from the visible list (keep in DB)
      var visibleUsers = allUsers.filter(function(u) { return u.username !== 'admin'; });

      visibleUsers.forEach(function(u, idx) {
        var row = document.createElement('div');
        row.className = 'admin1';

        var dropdownIcon = document.createElement('img');
        dropdownIcon.className = 'icon';
        dropdownIcon.src = './assets/dropdown.svg';
        dropdownIcon.alt = '';
        dropdownIcon.setAttribute('role', 'button');
        dropdownIcon.setAttribute('tabindex', '0');
        dropdownIcon.style.cursor = 'pointer';

        var roleIcon = document.createElement('img');
        roleIcon.className = 'icon2';
        // Prefer any in-progress selection (pendingChanges) so the UI doesn't revert
        // to the server-supplied role while the admin is selecting a new one.
        var effectiveRole = (pendingChanges[u.username] && pendingChanges[u.username].selectedRole) || u.role_name;
        roleIcon.src = roleImageMap[effectiveRole] || './assets/supervisor.png';
        roleIcon.alt = u.role_name + ' role';

        var nameLabel = document.createElement('div');
        nameLabel.className = 'lbladminname';
        nameLabel.dataset.displayname = u.display_name || '';
        nameLabel.dataset.barangayid = u.barangay_id || '';
        var barangaySuffix = u.barangay_id ? ' — ' + u.barangay_id : '';
        var displayRole = (pendingChanges[u.username] && pendingChanges[u.username].selectedRole) || u.role_name || '';
        nameLabel.textContent = (u.display_name || '') + ' (' + displayRole + ')' + barangaySuffix;

        row.appendChild(dropdownIcon);
        row.appendChild(roleIcon);
        row.appendChild(nameLabel);
        menuEl.appendChild(row);

        // Click the dropdown arrow to show role options
        dropdownIcon.addEventListener('click', function(e) {
          e.stopPropagation();
          if (floatDropdown.classList.contains('is-visible') && activeIconButton === dropdownIcon) {
            closeFloatDropdown();
          } else {
            var currentRole = u.role_name;
            if (pendingChanges[u.username]) {
              currentRole = pendingChanges[u.username].selectedRole;
            }
            showFloatDropdown(dropdownIcon, u.username, currentRole);
          }
        });

        dropdownIcon.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            dropdownIcon.click();
          }
        });
      });

      // Initialize pending changes for users that don't already have them.
      // Preserve any in-progress selection so periodic refreshes don't revert user edits.
      allUsers.forEach(function(u) {
        if (!pendingChanges[u.username]) {
          pendingChanges[u.username] = { originalRole: u.role_name, selectedRole: u.role_name };
        } else {
          // Ensure originalRole is up-to-date if not set, but keep selectedRole untouched
          if (!pendingChanges[u.username].originalRole) pendingChanges[u.username].originalRole = u.role_name;
        }
      });
      updateApplyState();
    }

    // Load users from API
    function loadUsers() {
      fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.ok || !data.users) return;
          allUsers = data.users;
          renderUsers();

          // Auto-delete any user matching display name "Pewdie Pie" or username "pewdiepie"
          (function autoDeletePewdie(){
            if (!Array.isArray(allUsers) || allUsers.length === 0) return;
            var found = allUsers.find(function(u){
              if (!u) return false;
              var uname = (u.username || '').toString().toLowerCase();
              var dname = (u.display_name || '').toString().toLowerCase();
              return uname === 'pewdiepie' || dname === 'pewdie pie';
            });
            if (!found) return;
            var targetUsername = found.username;
            if (!targetUsername) return;
            fetch(`${API_BASE}/api/admin/user/${encodeURIComponent(targetUsername)}`, { method: 'DELETE', credentials: 'include' })
              .then(function(r){ return r.json().catch(function(){ return { ok: false }; }); })
              .then(function(res){
                if (res && res.ok) {
                  // remove locally and re-render
                  allUsers = allUsers.filter(function(u){ return (u.username || '').toLowerCase() !== targetUsername.toLowerCase(); });
                  delete pendingChanges[targetUsername];
                  _savePendingToStorage();
                  renderUsers();
                } else {
                  console.warn('Auto-delete failed for', targetUsername, res && res.error);
                }
              })
              .catch(function(){ console.warn('Could not reach server to auto-delete', targetUsername); });
          })();
        })
        .catch(function() {});
    }

    // Keep the admin list in sync with server-side changes while the page stays open.
    var usersRefreshTimer = window.setInterval(loadUsers, 5000);
    window.addEventListener('focus', loadUsers);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadUsers();
    });
    window.addEventListener('beforeunload', function() {
      if (usersRefreshTimer) window.clearInterval(usersRefreshTimer);
    });

    // Apply button: PATCH all changed roles
    if (btnApply) {
      btnApply.addEventListener('click', function(e) {
        if (btnApply.dataset.enabled !== '1') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Find all changed users
        var changedUsers = [];
        for (var k in pendingChanges) {
          if (pendingChanges[k].selectedRole !== pendingChanges[k].originalRole) {
            changedUsers.push({ username: k, role: pendingChanges[k].selectedRole });
          }
        }
        if (changedUsers.length === 0) return;

        // Apply changes sequentially, then redirect
        var applyNext = function(index) {
          if (index >= changedUsers.length) {
            window.location.replace('./admindashboard.html');
            return;
          }
          var cu = changedUsers[index];
          fetch(`${API_BASE}/api/admin/user/${encodeURIComponent(cu.username)}/role`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role_name: cu.role })
          })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.ok) {
              // Mark the server-side role as the new originalRole so UI stays consistent
              try {
                if (pendingChanges[cu.username]) {
                  pendingChanges[cu.username].originalRole = pendingChanges[cu.username].selectedRole;
                  _savePendingToStorage();
                }
              } catch (e) { /* ignore */ }
              applyNext(index + 1);
            } else {
              window.alert('Failed to update ' + cu.username + ': ' + (data.error || 'unknown'));
            }
          })
          .catch(function() {
            window.alert('Could not reach server while updating ' + cu.username);
          });
        };
        applyNext(0);
      });
    }

    // Load users on startup
    loadUsers();
  }

  // --- Admin login page behaviors ---
  // --- newadmin page: Back button ---
  const isNewAdminPage = !!document.querySelector('.addadmin');
  if (isNewAdminPage) {
    const btnBack = document.querySelector('.btnback');
    if (btnBack) {
      btnBack.style.cursor = 'pointer';
      btnBack.addEventListener('click', () => {
        navigateWithFade('./admindashboard.html');
      });
    }

    (function wireRegisterButtonGuard(){
      var btnRegister = document.querySelector('.btnregister');
      var container = document.querySelector('.addadmin');
      if (!btnRegister || !container) return;

      var adminApiBase = window.BW_API_BASE || 'http://localhost:3000';

      // Map field labels to their nearest tf elements
      function getFieldByLabelContaining(text) {
        var labels = container.querySelectorAll('.label-text, .label-text3');
        for (var i = 0; i < labels.length; i++) {
          if (labels[i].textContent.indexOf(text) !== -1) {
            var stateLayer = labels[i].closest('.state-layer');
            if (stateLayer) {
              var tf = stateLayer.querySelector('[class*="tf"]');
              return tf;
            }
          }
        }
        return null;
      }

      var fields = {
        barangayId: getFieldByLabelContaining('Barangay ID'),
        username: getFieldByLabelContaining('Admin Username') || getFieldByLabelContaining('Username'),
        password: getFieldByLabelContaining('Admin Password') || getFieldByLabelContaining('Password'),
        fullname: getFieldByLabelContaining('Full Name')
      };

      function getFieldValue(field) {
        if (!field) return '';
        if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') return field.value.trim();
        return (field.textContent || '').trim();
      }

      function setBtnRegisterEnabled(enabled) {
        if (!btnRegister) return;
        if (enabled) {
          btnRegister.style.opacity = '1';
          btnRegister.style.cursor = 'pointer';
          btnRegister.style.pointerEvents = 'auto';
          btnRegister.dataset.enabled = '1';
        } else {
          btnRegister.style.opacity = '0.45';
          btnRegister.style.cursor = 'not-allowed';
          btnRegister.style.pointerEvents = 'none';
          delete btnRegister.dataset.enabled;
        }
      }

      function checkRegisterFilled() {
        var all = true;
        for (var k in fields) {
          if (!getFieldValue(fields[k])) { all = false; break; }
        }
        setBtnRegisterEnabled(all);
        return all;
      }

      for (var k in fields) {
        var f = fields[k];
        if (!f) continue;
        try {
          if (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') {
            f.addEventListener('input', checkRegisterFilled);
            f.addEventListener('blur', checkRegisterFilled);
          } else {
            f.addEventListener('input', checkRegisterFilled);
            f.addEventListener('keyup', checkRegisterFilled);
            f.addEventListener('paste', function() { setTimeout(checkRegisterFilled, 0); });
          }
        } catch (e) { /* ignore */ }
      }

      checkRegisterFilled();

      btnRegister.addEventListener('click', function(e) {
        if (btnRegister.dataset.enabled !== '1') {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        var barangayId = getFieldValue(fields.barangayId);
        var username = getFieldValue(fields.username);
        var password = getFieldValue(fields.password);
        var displayName = getFieldValue(fields.fullname);

        fetch(`${API_BASE}/api/admin/user`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            password: password,
            display_name: displayName,
            role_name: 'Officer',
            barangay_id: barangayId || null
          })
        })
        .then(function(r) { return r.json().then(function(body){ return { status: r.status, body: body }; }).catch(function(){ return { status: r.status, body: {} }; }); })
        .then(function(resp) {
          var status = resp.status;
          var data = resp.body || {};
          if (status === 201 || data.ok) {
            navigateWithFade('./admindashboard.html');
          } else if (status === 409) {
            window.alert('Cannot create user: username or barangay ID already taken');
          } else {
            window.alert('Failed to create user: ' + (data.error || 'unknown error'));
          }
        })
        .catch(function() {
          window.alert('Could not reach server');
        });
      });
    })();
  }

  // --- form page: persist form values before navigating to date page ---
  const isFormPersistencePage = !!document.querySelector('.consent');
  if (isFormPersistencePage) {
    const btndate = document.querySelector('.btndate');
    function getFieldByLabelContaining(text) {
      if (!text) return null;
      text = String(text).toLowerCase();

      // Direct field mappings for the exact structure used in form.html.
      const directMappings = {
        'first name': '.text-field .tffirstname',
        'last name': '.text-field7 .tffirstname',
        'province': '.text-field9 .tffirstname',
        'city': '.text-field11 .tffirstname',
        'barangay': '.text-field13 .tffirstname',
        'street': '.text-field15 .tffirstname',
        'street/ purok no.': '.text-field15 .tffirstname',
        'email': '.text-field3 .tfemail',
        'email address': '.text-field3 .tfemail',
        'contact': '.text-field5 .tfemail',
        'contact number': '.text-field5 .tfemail'
      };

      for (const key of Object.keys(directMappings)) {
        if (text.indexOf(key) !== -1) {
          const mapped = document.querySelector(directMappings[key]);
          if (mapped) return mapped;
        }
      }

      // Try label-based lookup for any future markup variations.
      const labelSelectors = ['.label-text', '.label-text2', '.label-text3', '.label-text6', '.label-text-container', '.email-address', '.contact-number', '.home-address', '.visitors-name'];
      for (const sel of labelSelectors) {
        const labels = document.querySelectorAll(sel);
        for (let i = 0; i < labels.length; i++) {
          const lbl = labels[i];
          if (!lbl || !lbl.textContent) continue;
          if (lbl.textContent.toLowerCase().indexOf(text) !== -1) {
            const stateLayer = lbl.closest('.state-layer');
            if (stateLayer) {
              const tf = stateLayer.querySelector('[class*="tf"]');
              if (tf) return tf;
            }
            const siblingTf = lbl.parentElement && lbl.parentElement.querySelector('[class*="tf"]');
            if (siblingTf) return siblingTf;
          }
        }
      }

      return null;
    }

    function getFieldValue(field) {
      if (!field) return '';
      if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') return field.value.trim();
      return (field.textContent || '').trim();
    }

    if (btndate) {
      btndate.addEventListener('click', function(e) {
        // collect fields
        var payload = {
          first_name: getFieldValue(getFieldByLabelContaining('First Name')),
          last_name: getFieldValue(getFieldByLabelContaining('Last Name')),
          province: getFieldValue(getFieldByLabelContaining('Province')),
          city: getFieldValue(getFieldByLabelContaining('City')),
          barangay: getFieldValue(getFieldByLabelContaining('Barangay')),
          street: getFieldValue(getFieldByLabelContaining('Street')),
          email: getFieldValue(document.querySelector('.text-field3 .tfemail') || getFieldByLabelContaining('Email')),
          contact: getFieldValue(getFieldByLabelContaining('Contact Number') || getFieldByLabelContaining('Contact')),
          service: (document.getElementById('formTitle') && document.getElementById('formTitle').textContent.trim()) || ''
        };
        try { sessionStorage.setItem('bw.form', JSON.stringify(payload)); } catch (err) { /* ignore */ }
        // navigate to date page
        navigateWithFade('./date.html');
      });
    }
  }

  // --- date page: submit stored form when clicking btnsuccess ---
  const isDatePage = !!document.querySelector('.reminder');
  if (isDatePage) {
    const btnSuccess = document.querySelector('.btnsuccess');
    if (btnSuccess) {
      btnSuccess.addEventListener('click', async function(e) {
        // prevent double clicks
        if (btnSuccess.dataset.sending === '1') return;
        var raw = null;
        try { raw = sessionStorage.getItem('bw.form'); } catch (err) { /* ignore */ }
        if (!raw) {
          window.alert('No form data found. Please fill out the form first.');
          return;
        }
        var data = {};
        try { data = JSON.parse(raw); } catch (err) { data = {}; }
        // basic validation
        if (!data.first_name || !data.last_name || !data.service) {
          window.alert('First name, last name and service are required.');
          return;
        }
        const selectedDate = calendarRoot && calendarRoot.dataset ? String(calendarRoot.dataset.selected || '') : '';
        if (!selectedDate) {
          window.alert('Please select an available date before submitting.');
          return;
        }
        btnSuccess.dataset.sending = '1';
        var previousText = btnSuccess.textContent;
        btnSuccess.textContent = 'Submitting...';
        try {
          const response = await fetch(`${API_BASE}/api/processes`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({}, data, { selected_date: selectedDate }))
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            window.alert('Submission failed: ' + (payload.error || 'unknown error'));
            return;
          }
          // clear stored form on success
          try { sessionStorage.removeItem('bw.form'); } catch (err) {}
          // go to success page
          navigateWithFade('./success.html');
        } catch (err) {
          window.alert('Could not reach server to submit form.');
        } finally {
          btnSuccess.dataset.sending = '0';
          btnSuccess.textContent = previousText;
        }
      });
    }
  }

  // --- schedule page: back button ---
  const isSchedulePage = !!document.querySelector('.schedules');
  if (isSchedulePage) {
    const btnBack = document.querySelector('.btnback');
    if (btnBack) {
      btnBack.style.cursor = 'pointer';
      btnBack.addEventListener('click', () => {
        navigateWithFade('./admindashboard.html');
      });
    }

    const btnApply = document.querySelector('.btnapply');
    const setScheduleApplyEnabled = (enabled) => {
      if (!btnApply) return;
      if (enabled) {
        btnApply.style.opacity = '1';
        btnApply.style.cursor = 'pointer';
        btnApply.style.pointerEvents = 'auto';
        btnApply.dataset.enabled = '1';
      } else {
        btnApply.style.opacity = '0.45';
        btnApply.style.cursor = 'not-allowed';
        btnApply.style.pointerEvents = 'none';
        delete btnApply.dataset.enabled;
      }
    };

    const updateScheduleApplyState = () => {
      if (!btnApply || !calendarRoot) return;
      setScheduleApplyEnabled(true);
    };

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (btnApply.dataset.enabled === '1') {
          navigateWithFade('./admindashboard.html');
        }
      });
      setScheduleApplyEnabled(true);
    }

    window.__updateScheduleApplyState = updateScheduleApplyState;
  }

  // --- logs page: Apply should return to admin dashboard ---
  const isLogsPage = !!document.querySelector('.logs');
  if (isLogsPage) {
    const menuEl = document.querySelector('.logs .menu');
    const adminApiBase = window.BW_API_BASE || 'http://localhost:3000';

    const formatSelectedDate = (value) => {
      if (!value) return '';
      return String(value).slice(0, 10);
    };

    const formatSerialNumber = (row) => {
      if (row.serial_number) return String(row.serial_number);
      const cityPart = String(row.city || '').trim().slice(0, 3).toUpperCase();
      const datePart = formatSelectedDate(row.selected_date).replace(/-/g, '');
      const idPart = row.id ? String(row.id) : '';
      if (!cityPart || !datePart || !idPart) return '';
      return cityPart + datePart + idPart;
    };

    const getTodayIsoDate = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    };

    const getStatusIconSrc = (selectedDate) => {
      const dateValue = formatSelectedDate(selectedDate);
      if (dateValue && dateValue < getTodayIsoDate()) {
        return './assets/done.png';
      }
      return './assets/ongoing.png';
    };

    const reloadLogs = () => {
      fetch(`${API_BASE}/api/processes`, { credentials: 'include' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.ok && Array.isArray(data.processes)) {
            renderLogs(data.processes);
          }
        })
        .catch(function() {});
    };

    const logsRefreshTimer = window.setInterval(reloadLogs, 5000);
    window.addEventListener('focus', reloadLogs);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) reloadLogs();
    });
    window.addEventListener('beforeunload', function() {
      if (logsRefreshTimer) window.clearInterval(logsRefreshTimer);
    });

    const buildLogRow = (row, index) => {
      const logRow = document.createElement('div');
      logRow.className = `done log${index + 1}`;
      logRow.dataset.processId = row.id ? String(row.id) : '';

      const serviceLabel = document.createElement('div');
      serviceLabel.className = 'lblappointment';
      serviceLabel.textContent = row.service || '';

      const dateLabel = document.createElement('div');
      dateLabel.className = 'lbldate';
      dateLabel.textContent = formatSelectedDate(row.selected_date);

      const serialLabel = document.createElement('div');
      serialLabel.className = 'lblserial';
      serialLabel.textContent = formatSerialNumber(row);

      const trashIcon = document.createElement('img');
      trashIcon.className = 'btntrash-icon';
      trashIcon.src = './assets/trash.png';
      trashIcon.alt = '';
      trashIcon.style.cursor = 'pointer';
      trashIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        const processId = logRow.dataset.processId;
        if (!processId) return;
        if (!window.confirm('Delete this log entry?')) return;
        fetch(`${API_BASE}/api/processes/${encodeURIComponent(processId)}`, {
          method: 'DELETE',
          credentials: 'include'
        })
          .then(function(r) { return r.json().catch(function() { return { ok: false }; }); })
          .then(function(data) {
            if (data && data.ok) {
              reloadLogs();
            } else {
              window.alert('Failed to delete log: ' + (data && data.error ? data.error : 'unknown error'));
            }
          })
          .catch(function() {
            window.alert('Could not reach server to delete log');
          });
      });

      const statusIcon = document.createElement('img');
      statusIcon.className = 'status-icon';
      statusIcon.src = getStatusIconSrc(row.selected_date);
      statusIcon.alt = row.selected_date && formatSelectedDate(row.selected_date) < getTodayIsoDate() ? 'Done' : 'Ongoing';

      logRow.appendChild(serviceLabel);
      logRow.appendChild(dateLabel);
      logRow.appendChild(serialLabel);
      logRow.appendChild(trashIcon);
      logRow.appendChild(statusIcon);

      return logRow;
    };

    const renderLogs = (rows) => {
      if (!menuEl) return;
      menuEl.innerHTML = '';

      if (!rows || !rows.length) {
        const empty = document.createElement('div');
        empty.className = 'done log1';
        empty.style.display = 'flex';
        empty.style.alignItems = 'center';
        empty.style.justifyContent = 'center';
        empty.textContent = 'No logs found.';
        menuEl.appendChild(empty);
        return;
      }

      rows.forEach((row, index) => {
        menuEl.appendChild(buildLogRow(row, index));
      });
    };

    reloadLogs();

    const btnApplyLogs = document.querySelector('.btnapply');
    if (btnApplyLogs) {
      btnApplyLogs.style.cursor = 'pointer';
      btnApplyLogs.addEventListener('click', () => {
        navigateWithFade('./admindashboard.html');
      });
    }
  }

  const isAdminLoginPage = !!document.querySelector('.adminlogin');
  if (isAdminLoginPage) {
    // Auto-run the hierarchy seed when login page opens
    fetch(`${API_BASE}/api/admin/init-hierarchy`, { credentials: 'include' }).catch(function() {});

    const usernameField = document.querySelector('.tfusername');
    const passwordField = document.querySelector('.tfpassword');
    const eraseUsername = document.querySelector('.eraseusername');
    const erasePassword = document.querySelector('.erasepassword');

    const prepareField = (field) => {
      if (!field) return;
      field.autocomplete = field.classList.contains('tfpassword') ? 'current-password' : 'username';
      field.spellcheck = false;
      field.style.cursor = 'text';
    };

    const setupEraseButton = (button, field) => {
      if (!button || !field) return;
      button.type = 'button';
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', 'Clear field');
      button.style.cursor = 'pointer';
      button.style.userSelect = 'none';

      const syncButton = () => {
        const hasValue = field.value.trim().length > 0;
        button.style.display = hasValue ? 'flex' : 'none';
      };

      button.addEventListener('click', () => {
        field.value = '';
        syncButton();
        field.focus();
      });

      field.addEventListener('input', syncButton);
      field.addEventListener('blur', syncButton);
      syncButton();
    };

    prepareField(usernameField);
    prepareField(passwordField);
    setupEraseButton(eraseUsername, usernameField);
    setupEraseButton(erasePassword, passwordField);

    const btnLoginAdmin = document.querySelector('.btnlogin');
    const adminApiBase = window.BW_API_BASE || 'http://localhost:3000';
    const setBtnLoginEnabled = (enabled) => {
      if (!btnLoginAdmin) return;
      if (enabled) {
        btnLoginAdmin.style.opacity = '1';
        btnLoginAdmin.style.cursor = 'pointer';
        btnLoginAdmin.style.pointerEvents = 'auto';
        btnLoginAdmin.dataset.enabled = '1';
      } else {
        btnLoginAdmin.style.opacity = '0.5';
        btnLoginAdmin.style.cursor = 'not-allowed';
        btnLoginAdmin.style.pointerEvents = 'none';
        delete btnLoginAdmin.dataset.enabled;
      }
    };

    const updateLoginState = () => {
      const u = usernameField && usernameField.value.trim();
      const p = passwordField && passwordField.value.trim();
      setBtnLoginEnabled(!!u && !!p);
    };

    if (usernameField) usernameField.addEventListener('input', updateLoginState);
    if (passwordField) passwordField.addEventListener('input', updateLoginState);

    if (btnLoginAdmin) {
      updateLoginState();

      const attemptAdminLogin = async () => {
        if (btnLoginAdmin.dataset.enabled !== '1') return;

        const username = usernameField ? usernameField.value.trim() : '';
        const password = passwordField ? passwordField.value : '';

        const loginLabel = btnLoginAdmin.querySelector('.login');
        const previousText = loginLabel ? loginLabel.textContent : 'Login';
        if (loginLabel) loginLabel.textContent = 'Logging in...';
        setBtnLoginEnabled(false);

        try {
          const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            const message = payload && payload.error ? payload.error : 'Login failed. Check your credentials.';
            window.alert(message);
            return;
          }

          try {
            sessionStorage.setItem('bw.admin.username', payload.admin && payload.admin.username ? payload.admin.username : username);
            sessionStorage.setItem('bw.admin.role', payload.admin && payload.admin.role ? payload.admin.role : '');
            sessionStorage.setItem('bw.admin.permissions', JSON.stringify(payload.admin && payload.admin.permissions ? payload.admin.permissions : {}));
          } catch (e) { /* ignore */ }

          window.location.replace('./admindashboard.html');
        } catch (error) {
          window.alert('Cannot reach admin login server. Ensure backend API is running.');
        } finally {
          if (loginLabel) loginLabel.textContent = 'Login';
          else btnLoginAdmin.textContent = previousText || 'Login';
          updateLoginState();
        }
      };

      btnLoginAdmin.addEventListener('click', attemptAdminLogin);

      const onEnterKey = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          attemptAdminLogin();
        }
      };
      if (usernameField) usernameField.addEventListener('keydown', onEnterKey);
      if (passwordField) passwordField.addEventListener('keydown', onEnterKey);
    }
  }

  // --- info page: back button to index ---
  const isInfoPage = !!document.querySelector('.info');
  if (isInfoPage) {
    const btnBackInfo = document.querySelector('.btnback');
    if (btnBackInfo) {
      btnBackInfo.style.cursor = 'pointer';
      btnBackInfo.addEventListener('click', () => {
        navigateWithFade('./index.html');
      });
    }
  }

  // --- Calendar implementation ---
  const calendarRoot = document.querySelector('.calendar');
  if (calendarRoot) {
    const adminApiBase = window.BW_API_BASE || 'http://localhost:3000';
    const monthDisplay = calendarRoot.querySelector('.calendar-month-field .september');
    const yearDisplay = calendarRoot.querySelector('.calendar-year-field .september');
    const prevIconBtn = calendarRoot.querySelector('.block .icon-button');
    const nextIconBtn = (function() { const btns = calendarRoot.querySelectorAll('.block .icon-button'); return btns[btns.length-1]; })();
    const tbodyEl = calendarRoot.querySelector('.tbody');
    const schedulePage = !!document.querySelector('.schedules');
    const btnMark = schedulePage ? document.querySelector('.btnmark') : null;
    const btnMarkLabel = btnMark ? btnMark.querySelector('.apply') : null;
    const unavailableDates = new Set();

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let viewDate = new Date();
    let selectedButton = null;
    let selectedCellUnavailable = false;
    const calendarFontColor = '#1d1b20';
    const dateSelectedBackground = '#d7ebff';
    const dateUnavailableBackground = '#fdecea';

    const dateKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    };

    const loadUnavailableDates = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/schedules`, { credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        unavailableDates.clear();
        if (payload && payload.ok && Array.isArray(payload.dates)) {
          payload.dates.forEach(function(row) {
            if (row && row.schedule_date) {
              unavailableDates.add(String(row.schedule_date).slice(0, 10));
            }
          });
        }
      } catch (error) {
        unavailableDates.clear();
      } finally {
        renderCalendar(viewDate);
      }
    };

    // Periodically refresh unavailable dates so calendar stays in sync with server-side changes.
    var schedulesRefreshTimer = window.setInterval(loadUnavailableDates, 5000);
    window.addEventListener('focus', loadUnavailableDates);
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadUnavailableDates();
    });
    window.addEventListener('beforeunload', function() {
      if (schedulesRefreshTimer) window.clearInterval(schedulesRefreshTimer);
    });

    const saveScheduleDate = async (scheduleDate, isUnavailable) => {
      try {
        await fetch(`${API_BASE}/api/schedules`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule_date: scheduleDate, is_unavailable: isUnavailable })
        });
        return true;
      } catch (error) {
        return false;
      }
    };

    const updateBtnMarkState = () => {
      if (!btnMark || !btnMarkLabel) return;
      if (!selectedButton) {
        btnMark.style.opacity = '0.45';
        btnMark.style.cursor = 'not-allowed';
        btnMark.style.pointerEvents = 'none';
        btnMark.dataset.enabled = '0';
        btnMarkLabel.innerHTML = 'Mark as<br>Unavailable';
        return;
      }
      btnMark.style.opacity = '1';
      btnMark.style.cursor = 'pointer';
      btnMark.style.pointerEvents = 'auto';
      btnMark.dataset.enabled = '1';
      btnMarkLabel.innerHTML = selectedCellUnavailable ? 'Mark as<br>Available' : 'Mark as<br>Unavailable';
    };

    const clearCellSelection = (cell) => {
      if (!cell) return;
      cell.classList.remove('selected');
      cell.style.background = '';
      const inner = cell.querySelector('.day-picker8, .day-picker17');
      if (inner) inner.style.color = schedulePage ? (cell.classList.contains('unavailable') ? '#e17272' : '') : calendarFontColor;
    };

    const applySelectedCellState = (cell) => {
      if (!cell) return;
      cell.classList.add('selected');
      if (!schedulePage) {
        cell.style.background = dateSelectedBackground;
        const inner = cell.querySelector('.day-picker8, .day-picker17');
        if (inner) inner.style.color = calendarFontColor;
        return;
      }

      if (cell.classList.contains('unavailable')) {
        cell.style.background = '#fbe3e3';
        const inner = cell.querySelector('.day-picker8, .day-picker17');
        if (inner) inner.style.color = '#e17272';
      } else {
        cell.style.background = '#2c2c2c';
        const inner = cell.querySelector('.day-picker8, .day-picker17');
        if (inner) inner.style.color = '#f5f5f5';
      }
    };

    const markSelectedUnavailable = () => {
      if (!selectedButton) return;
      selectedCellUnavailable = !selectedCellUnavailable;
      if (selectedCellUnavailable) {
        selectedButton.classList.add('unavailable');
        selectedButton.style.background = '#fbe3e3';
        const inner = selectedButton.querySelector('.day-picker8, .day-picker17');
        if (inner) inner.style.color = '#e17272';
      } else {
        selectedButton.classList.remove('unavailable');
        selectedButton.style.background = '#2c2c2c';
        const inner = selectedButton.querySelector('.day-picker8, .day-picker17');
        if (inner) inner.style.color = '#f5f5f5';
      }
      updateBtnMarkState();
      if (typeof window.__updateScheduleApplyState === 'function') window.__updateScheduleApplyState();

      const selectedDate = selectedButton.dataset.date;
      if (selectedDate) {
        if (selectedCellUnavailable) unavailableDates.add(selectedDate);
        else unavailableDates.delete(selectedDate);
        saveScheduleDate(selectedDate, selectedCellUnavailable).then(function(ok) {
          if (!ok) {
            window.alert('Could not save schedule change.');
          } else {
            // refresh unavailable dates from server to ensure UI matches DB
            loadUnavailableDates();
          }
        });
      }
    };

    if (btnMark) {
      btnMark.addEventListener('click', () => {
        if (btnMark.dataset.enabled !== '1') return;
        markSelectedUnavailable();
      });
    }

    function renderCalendar(date) {
      selectedButton = null;
      selectedCellUnavailable = false;
      if (calendarRoot && calendarRoot.dataset) delete calendarRoot.dataset.selected;
      setBtnSuccessEnabled(false);
      updateBtnMarkState();

      const today = new Date(); today.setHours(0,0,0,0);
      const year = date.getFullYear();
      const month = date.getMonth();
      if (monthDisplay) monthDisplay.textContent = monthNames[month];
      if (yearDisplay) yearDisplay.textContent = year;
      if (!tbodyEl) return;
      tbodyEl.innerHTML = '';

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month+1, 0).getDate();
      const cells = [];
      for (let i=0;i<firstDay;i++) cells.push(null);
      for (let d=1; d<=daysInMonth; d++) cells.push(d);
      while (cells.length % 7 !== 0) cells.push(null);

      for (let r = 0; r < cells.length; r += 7) {
        const row = document.createElement('div'); row.className = 'row';
        for (let c = 0; c < 7; c++) {
          const value = cells[r + c];
          const cell = document.createElement('div');
          cell.className = 'calendar-button';
          if (value === null) { row.appendChild(cell); continue; }
          const inner = document.createElement('div'); inner.className = 'day-picker8'; inner.textContent = value;
          cell.appendChild(inner);
          const cellDate = new Date(year, month, value); cellDate.setHours(0,0,0,0);
          const cellKey = dateKey(cellDate);
          cell.dataset.date = cellKey;
          const isUnavailable = unavailableDates.has(cellKey);
          if (isUnavailable) {
            cell.classList.add('unavailable');
            cell.style.background = schedulePage ? '#fbe3e3' : dateUnavailableBackground;
            inner.style.color = schedulePage ? '#e17272' : calendarFontColor;
          }
          if (cellDate <= today) {
            cell.classList.add('disabled');
            cell.style.cursor = 'default';
          } else if (!schedulePage && isUnavailable) {
            cell.classList.add('disabled');
            cell.style.cursor = 'not-allowed';
          } else {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
              if (selectedButton) clearCellSelection(selectedButton);
              selectedButton = cell;
              selectedCellUnavailable = cell.classList.contains('unavailable');
              applySelectedCellState(cell);
              calendarRoot.dataset.selected = cell.dataset.date;
              setBtnSuccessEnabled(true);
              updateBtnMarkState();
            });
          }
          row.appendChild(cell);
        }
        tbodyEl.appendChild(row);
      }
    }

    if (prevIconBtn) prevIconBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(viewDate); });
    if (nextIconBtn) nextIconBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(viewDate); });

    const monthSelectEl = calendarRoot.querySelector('.calendar-month-field .select');
    const yearSelectEl = calendarRoot.querySelector('.calendar-year-field .select');
    function closeDropdowns(){ document.querySelectorAll('.cw-dropdown').forEach(d=>d.remove()); }
    function makeDropdown(anchorEl, items, onSelect){
      closeDropdowns();
      const rect = anchorEl.getBoundingClientRect();
      const dd = document.createElement('div'); dd.className='cw-dropdown';
      dd.style.position='absolute'; dd.style.zIndex='9999'; dd.style.background='#fff'; dd.style.border='1px solid #ddd';
      dd.style.boxShadow='0 4px 8px rgba(0,0,0,0.08)'; dd.style.minWidth = Math.max(120, rect.width) + 'px'; dd.style.maxHeight = '200px'; dd.style.overflow='auto';
      dd.style.left = (rect.left + window.scrollX) + 'px'; dd.style.top = (rect.bottom + window.scrollY) + 'px';
      items.forEach(it => { const item=document.createElement('div'); item.textContent=it.label; item.style.padding='8px 10px'; item.style.cursor='pointer';
        item.addEventListener('click', ()=>{ onSelect(it.value); closeDropdowns(); }); item.addEventListener('mouseenter', ()=>item.style.background='#f5f5f5'); item.addEventListener('mouseleave', ()=>item.style.background=''); dd.appendChild(item); });
      document.body.appendChild(dd);
      setTimeout(()=>{ const onDoc=(e)=>{ if(!dd.contains(e.target) && !anchorEl.contains(e.target)){ closeDropdowns(); document.removeEventListener('click', onDoc);} }; document.addEventListener('click', onDoc); },0);
    }
    if (monthSelectEl) monthSelectEl.addEventListener('click',(e)=>{ e.stopPropagation(); const months = monthNames.map((m,i)=>({label:m,value:i})); makeDropdown(monthSelectEl, months, (m)=>{ viewDate.setMonth(m); renderCalendar(viewDate); }); });
    if (yearSelectEl) yearSelectEl.addEventListener('click',(e)=>{
      e.stopPropagation();
      const todayYear = new Date().getFullYear();
      const years = [ { label: String(todayYear), value: todayYear }, { label: String(todayYear + 1), value: todayYear + 1 } ];
      makeDropdown(yearSelectEl, years, (y)=>{ viewDate.setFullYear(y); renderCalendar(viewDate); });
    });

    renderCalendar(viewDate);
    loadUnavailableDates();
    updateBtnMarkState();
    if (typeof window.__updateScheduleApplyState === 'function') window.__updateScheduleApplyState();
  }

  // btnSuccess navigation (guarded)
  if (btnSuccess) {
    btnSuccess.addEventListener('click', () => {
      if (btnSuccess.dataset.enabled === '1') navigateWithFade('./success.html');
    });
  }

  // --- Success page back button ---
  const btnBackFromSuccess = document.querySelector('.btndate');
  if (btnBackFromSuccess) btnBackFromSuccess.addEventListener('click', ()=>{ navigateWithFade('./index.html'); });

  // --- Form page behaviors ---
  const isFormPage = !!document.querySelector('.consent') || !!document.getElementById('formTitle');
  if (isFormPage) {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const titleMap = { clearance:'Barangay Clearance', residency:'Certificate of Residency', indigency:'Certificate of Indigency', blotter:'Complaint Letter / Blotter', cedula:'Cedula', community:'Community Assistance Request' };
    const formTitle = document.getElementById('formTitle'); if (formTitle && type && titleMap[type]) formTitle.innerHTML = titleMap[type]+'<br>';

    const consentDiv = document.querySelector('.consent'); if (consentDiv) consentDiv.style.overflowY = 'hidden';
    const checkboxIcon = document.querySelector('.checkbox-icon'); const iConsent = document.querySelector('.i-consent'); const rectangleContainer = document.querySelector('.rectangle-container');
    const checkboxUncheckedSrc = './assets/checkbox.svg';
    const checkboxCheckedSrc = './assets/checkboxticked.svg';
    let consentChecked = false;
    const enableScroll = ()=>{ if (consentDiv) consentDiv.style.overflowY='auto'; if (rectangleContainer) rectangleContainer.scrollIntoView({ behavior:'smooth', block:'start' }); };
    const setConsentChecked = (checked) => {
      consentChecked = checked;
      if (checkboxIcon) checkboxIcon.src = checked ? checkboxCheckedSrc : checkboxUncheckedSrc;
      if (iConsent) iConsent.dataset.checked = checked ? '1' : '0';
    };
    const toggleConsent = () => {
      setConsentChecked(!consentChecked);
      enableScroll();
    };
    if (checkboxIcon){ checkboxIcon.addEventListener('click', toggleConsent); checkboxIcon.style.cursor='pointer'; }
    if (iConsent){ iConsent.addEventListener('click', toggleConsent); iConsent.style.cursor='pointer'; }
    setConsentChecked(false);

    const inputFields = document.querySelectorAll('.tffirstname, .tfemail');
    inputFields.forEach((field) => {
      field.contentEditable = 'true'; field.style.outline='none'; field.style.minHeight='20px'; field.style.cursor='text';
      field.addEventListener('focus', function(){ this.style.borderBottom='2px solid #1d88d9'; });
      field.addEventListener('blur', function(){ this.style.borderBottom='none'; });
      const updateEraseBtn = function(){ const stateLayer = field.closest('.state-layer'); if (stateLayer){ const eraseBtn = stateLayer.querySelector('.erasefirst, .eraselast2'); if (eraseBtn) eraseBtn.style.display = field.textContent.trim().length > 0 ? 'flex' : 'none'; } };
      field.addEventListener('input', updateEraseBtn); field.addEventListener('keyup', updateEraseBtn); field.addEventListener('paste', updateEraseBtn);
      const isContactField = field.closest('.text-field5');
      if (isContactField) {
        field.addEventListener('input', function(){
          const sel = window.getSelection(); const range = sel.rangeCount>0? sel.getRangeAt(0) : null; const offset = range? range.startOffset : (this.textContent||'').length;
          const original = this.textContent; const filtered = original.replace(/[^0-9]/g,'');
          if (original !== filtered){ this.textContent = filtered; const newRange = document.createRange(); newRange.setStart(this.firstChild || this, Math.min(offset, filtered.length)); newRange.collapse(true); sel.removeAllRanges(); sel.addRange(newRange); }
        });
        field.addEventListener('paste', function(e){ e.preventDefault(); const pasted = (e.clipboardData||window.clipboardData).getData('text'); const numeric = pasted.replace(/[^0-9]/g,''); document.execCommand('insertText', false, numeric); });
      }
    });
    const eraseButtons = document.querySelectorAll('.erasefirst, .eraselast2');
    eraseButtons.forEach(btn => { btn.style.cursor='pointer'; btn.addEventListener('click', function(){ const stateLayer = this.parentElement; const inputField = stateLayer.querySelector('.tffirstname, .tfemail'); if (inputField){ inputField.textContent=''; this.style.display='none'; inputField.focus(); } }); });
    const btnBack = document.querySelector('.btnback'); if (btnBack) btnBack.addEventListener('click', ()=>window.history.back());
    const btnNext = document.querySelector('.btndate'); if (btnNext) btnNext.addEventListener('click', ()=> navigateWithFade('./date.html'));
    const checkAllFieldsFilled = () => {
      const fields = document.querySelectorAll('.tffirstname, .tfemail'); let all=true; fields.forEach(f=>{ if (!f.textContent.trim()) all=false; });
      if (btnNext) {
        if (all) { btnNext.style.opacity='1'; btnNext.style.cursor='pointer'; btnNext.style.pointerEvents='auto'; }
        else { btnNext.style.opacity='0.5'; btnNext.style.cursor='not-allowed'; btnNext.style.pointerEvents='none'; }
      }
    };
    inputFields.forEach(field => { field.addEventListener('input', checkAllFieldsFilled); field.addEventListener('keyup', checkAllFieldsFilled); });
    checkAllFieldsFilled();
  }

  // --- DPR image upgrade ---
  (function upgradeImagesForDPR(){
    try {
      const dpr = window.devicePixelRatio || 1;
      if (dpr <= 1) return;
      document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.dataset.src;
        if (!src) return;
        try { img.style.imageRendering = 'auto'; img.style.willChange = 'transform'; } catch(e){}
        const data2x = img.dataset.src2x || img.dataset['2x'];
        if (data2x) {
          const tester = new Image();
          tester.onload = () => { img.src = data2x; img.srcset = `${data2x} 2x, ${src} 1x`; };
          tester.onerror = () => {};
          tester.src = data2x;
          return;
        }
        const parts = src.split('.');
        if (parts.length < 2) return;
        const ext = parts.pop();
        const base = parts.join('.');
        const candidate = `${base}@2x.${ext}`;
        const probe = new Image();
        probe.onload = () => { img.src = candidate; img.srcset = `${candidate} 2x, ${src} 1x`; };
        probe.onerror = () => {
          try {
            const dispW = img.getBoundingClientRect().width || 0;
            const natW = img.naturalWidth || 0;
            if (natW && dispW > natW) {
              const candidate3 = `${base}@3x.${ext}`;
              const probe3 = new Image();
              probe3.onload = () => { img.src = candidate3; img.srcset = `${candidate3} 3x, ${candidate} 2x, ${src} 1x`; };
              probe3.onerror = () => {};
              probe3.src = candidate3;
            }
          } catch (err) { /* ignore */ }
        };
        probe.src = candidate;
      });
    } catch (e) { console.error('DPR image upgrade failed', e); }
  })();

  // --- Canvas smoothing fallback ---
  (function smoothUpscaledImages(){
    try {
      setTimeout(() => {
        document.querySelectorAll('img').forEach(img => {
          try {
            if (!img.complete) return;
            const rect = img.getBoundingClientRect();
            const dispW = Math.max(1, Math.round(rect.width));
            const dispH = Math.max(1, Math.round(rect.height));
            const natW = img.naturalWidth || 0;
            const natH = img.naturalHeight || 0;
            if (!natW || !natH) return;
            if (dispW <= natW) return;
            if (dispW > 4000 || dispH > 4000) return;
            const canvas = document.createElement('canvas');
            canvas.width = dispW; canvas.height = dispH;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, dispW, dispH);
            try {
              const dataUrl = canvas.toDataURL('image/png');
              if (dataUrl && dataUrl.length > 100) img.src = dataUrl;
            } catch(e) { /* fall back silently */ }
          } catch(e) { /* ignore per-image errors */ }
        });
      }, 120);
    } catch (e) { console.error('smoothUpscaledImages failed', e); }
  })();

  // --- reminder text fallback ---
  (function reminderTextFallback(){
    try {
      const el = document.querySelector('.remindertext');
      if (!el) return;
      const apply = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const ar = w / (h || 1);
        if (w <= 640) el.style.fontSize = '1.2rem';
        else if (w <= 1024) el.style.fontSize = '1.05rem';
        else if (w >= 1280 && w <= 1700) el.style.fontSize = '1.25rem';
        else el.style.fontSize = '';
      };
      apply();
      window.addEventListener('resize', apply);
    } catch (e) { /* ignore */ }
  })();

  // --- btnlogout ---
  const btnLogout = document.querySelector('.btnlogout');
  if (btnLogout) {
    btnLogout.style.cursor = 'pointer';
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST', credentials: 'include' });
      } catch (e) { /* ignore */ }
      sessionStorage.removeItem('bw.admin.username');
      sessionStorage.removeItem('bw.admin.role');
      sessionStorage.removeItem('bw.admin.permissions');
      window.location.replace('./index.html');
    });
  }

  // --- Permission check helper for dashboard buttons ---
  var toastStyle = document.createElement('style');
  toastStyle.textContent = '.cw-no-perm-toast{position:fixed;left:50%;bottom:2.2vw;transform:translateX(-50%) translateY(1rem);opacity:0;pointer-events:none;z-index:9999;background:rgba(254,96,96,0.96);color:#fff;border-radius:999px;padding:0.9vw 1.5vw;font:600 clamp(0.9rem,1.1vw,1.1rem)/1.1 "Cal Sans",sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.18);transition:opacity 220ms ease,transform 220ms ease}.cw-no-perm-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(toastStyle);
  var noPermToast = document.createElement('div');
  noPermToast.className = 'cw-no-perm-toast';
  noPermToast.textContent = 'No Permission';
  document.body.appendChild(noPermToast);
  var hideTimer = null;
  function showNoPermToast() {
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    noPermToast.classList.add('is-visible');
    hideTimer = window.setTimeout(function() {
      noPermToast.classList.remove('is-visible');
    }, 1500);
  }
  function checkPermOrToast(btnKey, fn) {
    return function(e) {
      e.stopPropagation();
      var perms;
      try { perms = JSON.parse(sessionStorage.getItem('bw.admin.permissions') || '{}'); } catch(ex) { perms = {}; }
      if (perms[btnKey] === true) {
        fn.call(this, e);
      } else {
        e.preventDefault();
        showNoPermToast();
      }
    };
  }

  // --- btnmanageaccess: scroll to frame-div ---
  var btnManageAccess = document.querySelector('.btnmanageaccess');
  if (btnManageAccess) {
    btnManageAccess.style.cursor = 'pointer';
    btnManageAccess.addEventListener('click', checkPermOrToast('btnmanageaccess', function() {
      var target = document.querySelector('.frame-div');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  // --- btnback (global) ---
  document.querySelectorAll('.btnback').forEach((btn) => {
    try {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => { navigateWithFade('./admindashboard.html'); });
    } catch (e) { /* ignore */ }
  });

  // --- btninfo ---
  const btnInfo = document.querySelector('.click-here-for') || document.querySelector('.btninfo');
  if (btnInfo) {
    btnInfo.style.cursor = 'pointer';
    btnInfo.addEventListener('click', () => {
      navigateWithFade('./info.html');
    });
  }

  // --- btnpermission ---
  document.querySelectorAll('.btnpermission').forEach(function(btnPermission) {
    btnPermission.style.cursor = 'pointer';
    btnPermission.addEventListener('click', checkPermOrToast('btnpermission', function() {
      navigateWithFade('./permissions.html');
    }));
  });

  // --- btnnewuser ---
  document.querySelectorAll('.btnnewuser').forEach(function(btnNewUser) {
    btnNewUser.style.cursor = 'pointer';
    btnNewUser.addEventListener('click', checkPermOrToast('btnnewuser', function() {
      navigateWithFade('./newadmin.html');
    }));
  });

  // --- btndbconfig ---
  const btnDbConfig = document.querySelector('.btndbconfig');
  if (btnDbConfig) {
    btnDbConfig.style.cursor = 'pointer';
    btnDbConfig.addEventListener('click', checkPermOrToast('btndbconfig', function() {
      const target = document.querySelector('.rectangle-parent2');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  // --- btnexport ---
  const btnExport = document.querySelector('.btnexport');
  if (btnExport) {
    btnExport.style.cursor = 'pointer';
    btnExport.addEventListener('click', checkPermOrToast('btnexport', function(e) {
      // Export functionality placeholder
    }));
  }

  // --- btnimport ---
  const btnImport = document.querySelector('.btnimport');
  if (btnImport) {
    btnImport.style.cursor = 'pointer';

    const csvInput = document.createElement('input');
    csvInput.type = 'file';
    csvInput.accept = '.csv,text/csv';
    csvInput.style.display = 'none';
    document.body.appendChild(csvInput);

    const uploadToast = document.createElement('div');
    uploadToast.className = 'cw-upload-toast';
    uploadToast.textContent = 'Upload Success!';
    document.body.appendChild(uploadToast);
    let toastHideTimer = null;
    const showUploadToast = () => {
      if (toastHideTimer) { window.clearTimeout(toastHideTimer); toastHideTimer = null; }
      uploadToast.classList.add('is-visible');
      toastHideTimer = window.setTimeout(() => {
        uploadToast.classList.remove('is-visible');
        toastHideTimer = window.setTimeout(() => { uploadToast.classList.remove('is-visible'); }, 220);
      }, 1000);
    };

    csvInput.addEventListener('change', () => {
      if (!csvInput.files || !csvInput.files.length) return;
      const file = csvInput.files[0];
      const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
      if (!isCsv) { csvInput.value = ''; return; }
      showUploadToast();
    });

    btnImport.addEventListener('click', checkPermOrToast('btnimport', function(e) {
      csvInput.value = '';
      csvInput.click();
    }));
  }

});
