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
    // If we're on the update page, lock scrolling until the user performs a search.
    const isUpdatePage = !!document.querySelector('.update');
    const lockScroll = () => {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      // preserve touch scrolling lock for mobile
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
      // allow scrolling now that user intentionally invoked search
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
    // find all elements with a class token starting with 'tf'
    const tfCandidates = [];
    document.querySelectorAll('[class]').forEach((el) => {
      for (const cls of Array.from(el.classList)) {
        if (cls && cls.startsWith('tf')) {
          tfCandidates.push(el);
          break;
        }
      }
    });

    // Normalize unique list
    const tfFields = Array.from(new Set(tfCandidates));

    tfFields.forEach((field) => {
      // If it's a native input/textarea, keep default behavior but ensure accessibility
      if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
        field.style.cursor = 'text';
        field.spellcheck = false;
        // ensure the erase button (if any) toggles correctly via input event elsewhere
      } else {
        // make non-input tf fields editable (matches other pages behavior)
        field.contentEditable = 'true';
        field.setAttribute('role', 'textbox');
        field.setAttribute('aria-multiline', 'false');
        field.setAttribute('tabindex', '0');
        field.spellcheck = false;
        field.style.outline = 'none';
        field.style.minHeight = '20px';
        field.style.cursor = 'text';
      }

      // visual focus hint (light) for editable tf elements
      try {
        field.addEventListener('focus', () => { field.style.borderBottom = '2px solid #1d88d9'; });
        field.addEventListener('blur', () => { field.style.borderBottom = 'none'; });
      } catch (e) { /* ignore */ }
    });

    // Wire up any erase* button to the nearest .state-layer -> tf* field
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

      // find a tf field inside the same state-layer
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

      // Attach listeners to the tf field to keep erase visibility in sync
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

      // initialize visibility
      syncButton();
    });
  })();

  // --- permissions page role dropdown ---
  const isPermissionsPage = !!document.querySelector('.permissions');
  if (isPermissionsPage) {
    const btnApply = document.querySelector('.btnapply');
    if (btnApply) {
      // initial visual state — actual click behavior is guarded by enable/disable logic
      btnApply.style.cursor = 'not-allowed';
      btnApply.style.opacity = '0.45';
      btnApply.style.pointerEvents = 'none';
    }

    // permissions page back button (same position/function as newadmin.btnback)
    const permBtnBack = document.querySelector('.btnback');
    if (permBtnBack) {
      permBtnBack.style.cursor = 'pointer';
      permBtnBack.addEventListener('click', () => {
        navigateWithFade('./admindashboard.html');
      });
    }

    const menu = document.querySelector('.menu');
    const menuTrigger = document.querySelector('.icon');
    const selectedIcon = document.querySelector('.icon2');
    const editAdminNameIcon = document.querySelector('.editadminname-icon');
    const roleDropdown = menu ? menu.querySelector('.role-dropdown') : null;
    const roleLabel = document.querySelector('.lbladminname');

    // change-tracking for enabling/disabling the Apply button
    let __initialSelectedRole = null;
    let __initialAdminName = null;
    const getCurrentRole = () => (selectedIcon && selectedIcon.dataset && selectedIcon.dataset.role) ? selectedIcon.dataset.role : null;
    const getCurrentName = () => (roleLabel ? roleLabel.textContent.trim() : '');
    const setBtnApplyEnabled = (enabled) => {
      const btn = document.querySelector('.btnapply');
      if (!btn) return;
      if (enabled) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        btn.dataset.enabled = '1';
      } else {
        btn.style.opacity = '0.45';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        delete btn.dataset.enabled;
      }
    };
    const checkPermissionsDirty = () => {
      const curRole = getCurrentRole();
      const curName = getCurrentName();
      const dirty = (curRole !== __initialSelectedRole) || (curName !== __initialAdminName);
      setBtnApplyEnabled(!!dirty);
      return dirty;
    };

    // Guard clicks on Apply so they only act when enabled
    (function attachApplyGuard(){
      const btn = document.querySelector('.btnapply');
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        if (btn.dataset.enabled === '1') {
          navigateWithFade('./admindashboard.html');
        } else {
          // prevent accidental clicks when disabled
          e.preventDefault();
          e.stopPropagation();
        }
      });
    })();

    const roles = [
      { label: 'Supervisor', image: './assets/supervisor.png' },
      { label: 'Manager', image: './assets/manager.png' },
      { label: 'Officer', image: './assets/officer.png' }
    ];

    if (menu && menuTrigger && selectedIcon && roleDropdown) {
      menuTrigger.style.transition = 'transform 180ms ease';

      const setTriggerRotation = (isOpen) => {
        menuTrigger.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';
      };

      const closeDropdown = () => {
        menu.classList.remove('role-dropdown-open');
        menuTrigger.setAttribute('aria-expanded', 'false');
        setTriggerRotation(false);
      };

      const openDropdown = () => {
        menu.classList.add('role-dropdown-open');
        menuTrigger.setAttribute('aria-expanded', 'true');
        setTriggerRotation(true);
      };

      const setSelectedRole = (role) => {
        selectedIcon.src = role.image;
        selectedIcon.alt = `${role.label} role`;
        selectedIcon.dataset.role = role.label;
        menu.dataset.selectedRole = role.label;
        if (roleLabel) roleLabel.dataset.role = role.label;

        Array.from(roleDropdown.querySelectorAll('.role-option')).forEach((option) => {
          option.classList.toggle('is-selected', option.dataset.role === role.label);
        });

        // update apply enabled state when role changes
        try { checkPermissionsDirty(); } catch (e) { /* ignore if helper not ready */ }
      };

      roleDropdown.innerHTML = '';
      roles.forEach((role) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'role-option';
        option.dataset.role = role.label;

        const icon = document.createElement('img');
        icon.className = 'role-option-icon';
        icon.src = role.image;
        icon.alt = '';

        const label = document.createElement('span');
        label.className = 'role-option-label';
        label.textContent = role.label;

        option.appendChild(icon);
        option.appendChild(label);
        option.addEventListener('click', () => {
          setSelectedRole(role);
          closeDropdown();
        });

        roleDropdown.appendChild(option);
      });

      const initialRole = roles.find((role) => selectedIcon.getAttribute('src')?.includes(`${role.label.toLowerCase()}.png`)) || roles[0];
      setSelectedRole(initialRole);
      closeDropdown();

      // record initial state for dirty checks
      __initialSelectedRole = getCurrentRole();
      __initialAdminName = getCurrentName();
      // ensure Apply is disabled initially
      try { setBtnApplyEnabled(false); } catch (e) {}

      menuTrigger.style.cursor = 'pointer';
      menuTrigger.setAttribute('role', 'button');
      menuTrigger.setAttribute('tabindex', '0');
      menuTrigger.setAttribute('aria-expanded', 'false');

      menuTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menu.classList.contains('role-dropdown-open')) closeDropdown();
        else openDropdown();
      });

      menuTrigger.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (menu.classList.contains('role-dropdown-open')) closeDropdown();
          else openDropdown();
        }
      });

      roleDropdown.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) closeDropdown();
      });
    }

    if (roleLabel && editAdminNameIcon) {
      const HIDE_GRACE_MS = 250;
      let hideTimer = null;

      const clearHideTimer = () => {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = null;
        }
      };

      const positionEditIcon = () => {
        const labelRect = roleLabel.getBoundingClientRect();
        const parentRect = roleLabel.offsetParent ? roleLabel.offsetParent.getBoundingClientRect() : null;
        if (!parentRect) return;

        const left = labelRect.right - parentRect.left + 6;
        const top = labelRect.top - parentRect.top + Math.max(0, (labelRect.height - editAdminNameIcon.offsetHeight) / 2);

        editAdminNameIcon.style.left = `${left}px`;
        editAdminNameIcon.style.top = `${top}px`;
      };

      const syncEditIconVisibility = () => {
        const shouldShow = roleLabel.matches(':hover') || editAdminNameIcon.matches(':hover');
        editAdminNameIcon.classList.toggle('is-hover-visible', shouldShow);
      };

      const showEditIcon = () => {
        clearHideTimer();
        editAdminNameIcon.classList.add('is-hover-visible');
      };

      const scheduleHideEditIcon = () => {
        clearHideTimer();
        hideTimer = window.setTimeout(() => {
          if (!roleLabel.matches(':hover') && !editAdminNameIcon.matches(':hover')) {
            editAdminNameIcon.classList.remove('is-hover-visible');
          }
          hideTimer = null;
        }, HIDE_GRACE_MS);
      };

      const setEditingState = (isEditing) => {
        roleLabel.contentEditable = isEditing ? 'true' : 'false';
        roleLabel.spellcheck = false;
        roleLabel.style.cursor = isEditing ? 'text' : 'default';
        roleLabel.style.outline = isEditing ? 'none' : '';
      };

      setEditingState(false);

      positionEditIcon();
      window.addEventListener('resize', positionEditIcon);
      if (window.ResizeObserver) {
        const iconObserver = new ResizeObserver(positionEditIcon);
        iconObserver.observe(roleLabel);
      }

      roleLabel.addEventListener('input', () => { positionEditIcon(); try { checkPermissionsDirty(); } catch (e) {} });

      roleLabel.addEventListener('mouseenter', showEditIcon);
      roleLabel.addEventListener('mouseleave', scheduleHideEditIcon);

      editAdminNameIcon.addEventListener('mouseenter', showEditIcon);
      editAdminNameIcon.addEventListener('mouseleave', scheduleHideEditIcon);

      editAdminNameIcon.style.cursor = 'pointer';
      editAdminNameIcon.addEventListener('click', (event) => {
        event.stopPropagation();
        clearHideTimer();
        editAdminNameIcon.classList.remove('is-hover-visible');
        setEditingState(true);
        roleLabel.focus();

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(roleLabel);
        selection.removeAllRanges();
        selection.addRange(range);
      });

      roleLabel.addEventListener('blur', () => {
        setEditingState(false);
        syncEditIconVisibility();
        positionEditIcon();
        try { checkPermissionsDirty(); } catch (e) {}
      });

      roleLabel.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          roleLabel.blur();
        }
      });
    }
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

    // Disable/Register button until required `tf*` fields are filled
    (function wireRegisterButtonGuard(){
      const btnRegister = document.querySelector('.btnregister');
      const container = document.querySelector('.addadmin');
      if (!btnRegister || !container) return;

      const collectTfFields = () => {
        const out = [];
        container.querySelectorAll('[class]').forEach((el) => {
          for (const cls of Array.from(el.classList)) {
            if (cls && cls.startsWith('tf')) { out.push(el); break; }
          }
        });
        return Array.from(new Set(out));
      };

      const setBtnRegisterEnabled = (enabled) => {
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
      };

      const checkRegisterFilled = () => {
        const fields = collectTfFields();
        if (!fields.length) { setBtnRegisterEnabled(true); return true; }
        let all = true;
        fields.forEach((f) => {
          const val = (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') ? (f.value || '') : (f.textContent || '');
          if (!val || !String(val).trim()) all = false;
        });
        setBtnRegisterEnabled(all);
        return all;
      };

      // attach listeners to tf fields
      const tfFields = collectTfFields();
      tfFields.forEach((f) => {
        try {
          if (f.tagName === 'INPUT' || f.tagName === 'TEXTAREA') {
            f.addEventListener('input', checkRegisterFilled);
            f.addEventListener('blur', checkRegisterFilled);
          } else {
            f.addEventListener('input', checkRegisterFilled);
            f.addEventListener('keyup', checkRegisterFilled);
            f.addEventListener('paste', () => setTimeout(checkRegisterFilled, 0));
          }
        } catch (e) { /* ignore */ }
      });

      // initialize
      checkRegisterFilled();

      // guard click
      btnRegister.addEventListener('click', (e) => {
        if (btnRegister.dataset.enabled === '1') {
          navigateWithFade('./admindashboard.html');
        } else {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    })();
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
      const dirty = calendarRoot.querySelector('.calendar-button.unavailable') !== null;
      setScheduleApplyEnabled(dirty);
    };

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        if (btnApply.dataset.enabled === '1') {
          navigateWithFade('./admindashboard.html');
        }
      });
      setScheduleApplyEnabled(false);
    }

    // expose the updater to the calendar logic below
    window.__updateScheduleApplyState = updateScheduleApplyState;
  }

  // --- logs page: Apply should return to admin dashboard ---
  const isLogsPage = !!document.querySelector('.logs');
  if (isLogsPage) {
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
      // initialize state
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
          const response = await fetch(`${adminApiBase}/api/admin/login`, {
            method: 'POST',
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
          } catch (e) { /* ignore storage errors */ }

          navigateWithFade('./admindashboard.html');
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
    const monthDisplay = calendarRoot.querySelector('.calendar-month-field .september');
    const yearDisplay = calendarRoot.querySelector('.calendar-year-field .september');
    const prevIconBtn = calendarRoot.querySelector('.block .icon-button');
    const nextIconBtn = (function() { const btns = calendarRoot.querySelectorAll('.block .icon-button'); return btns[btns.length-1]; })();
    const tbodyEl = calendarRoot.querySelector('.tbody');
    const schedulePage = !!document.querySelector('.schedules');
    const btnMark = schedulePage ? document.querySelector('.btnmark') : null;
    const btnMarkLabel = btnMark ? btnMark.querySelector('.apply') : null;

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let viewDate = new Date();
    let selectedButton = null;
    let selectedCellUnavailable = false;

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
      if (inner) inner.style.color = cell.classList.contains('unavailable') ? '#e17272' : '';
    };

    const applySelectedCellState = (cell) => {
      if (!cell) return;
      cell.classList.add('selected');
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
    };

    if (btnMark) {
      btnMark.addEventListener('click', () => {
        if (btnMark.dataset.enabled !== '1') return;
        markSelectedUnavailable();
      });
    }

    function renderCalendar(date) {
      // clear selection and disable success
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
          cell.dataset.date = cellDate.toISOString();

          // disable past dates (include today)
          if (cellDate <= today) {
            cell.classList.add('disabled');
            cell.style.cursor = 'default';
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

    // chevrons
    if (prevIconBtn) prevIconBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(viewDate); });
    if (nextIconBtn) nextIconBtn.addEventListener('click', () => { viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(viewDate); });

    // month/year dropdowns (lightweight)
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
      // limit year selection to current year and next year
      const todayYear = new Date().getFullYear();
      const years = [ { label: String(todayYear), value: todayYear }, { label: String(todayYear + 1), value: todayYear + 1 } ];
      makeDropdown(yearSelectEl, years, (y)=>{ viewDate.setFullYear(y); renderCalendar(viewDate); });
    });

    // initial render
    renderCalendar(viewDate);
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

    // editable input fields and erase buttons
    const inputFields = document.querySelectorAll('.tffirstname, .tfemail');
    inputFields.forEach((field) => {
      field.contentEditable = 'true'; field.style.outline='none'; field.style.minHeight='20px'; field.style.cursor='text';
      field.addEventListener('focus', function(){ this.style.borderBottom='2px solid #1d88d9'; });
      field.addEventListener('blur', function(){ this.style.borderBottom='none'; });

      const updateEraseBtn = function(){ const stateLayer = field.closest('.state-layer'); if (stateLayer){ const eraseBtn = stateLayer.querySelector('.erasefirst, .eraselast2'); if (eraseBtn) eraseBtn.style.display = field.textContent.trim().length > 0 ? 'flex' : 'none'; } };
      field.addEventListener('input', updateEraseBtn); field.addEventListener('keyup', updateEraseBtn); field.addEventListener('paste', updateEraseBtn);

      // numeric-only handling for contact fields
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

  // --- Upgrade images on high-DPR devices when higher-resolution assets exist ---
  (function upgradeImagesForDPR(){
    try {
      const dpr = window.devicePixelRatio || 1;
      if (dpr <= 1) return;
      document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.dataset.src;
        if (!src) return;

        // Encourage smooth resampling by preferring the browser's default interpolation
        try { img.style.imageRendering = 'auto'; img.style.willChange = 'transform'; } catch(e){}

        // If author provided a data-src-2x attribute, prefer it.
        const data2x = img.dataset.src2x || img.dataset['2x'];
        if (data2x) {
          const tester = new Image();
          tester.onload = () => { img.src = data2x; img.srcset = `${data2x} 2x, ${src} 1x`; };
          tester.onerror = () => {};
          tester.src = data2x;
          return;
        }

        // Try filename@2x.ext convention (e.g., icon.png -> icon@2x.png)
        const parts = src.split('.');
        if (parts.length < 2) return;
        const ext = parts.pop();
        const base = parts.join('.');
        const candidate = `${base}@2x.${ext}`;
        const probe = new Image();
        probe.onload = () => { img.src = candidate; img.srcset = `${candidate} 2x, ${src} 1x`; };
        probe.onerror = () => {
          // if the image is being upscaled (displayed wider than natural), try a 3x candidate
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

  // --- Canvas smoothing fallback for upscaled images (reduces aliasing) ---
  (function smoothUpscaledImages(){
    try {
      // run slightly after load to allow layout to settle
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
            // only act when the image is being upscaled
            if (dispW <= natW) return;
            // avoid huge canvases
            if (dispW > 4000 || dispH > 4000) return;

            const canvas = document.createElement('canvas');
            canvas.width = dispW; canvas.height = dispH;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, dispW, dispH);
            // replace only if canvas produced valid output
            try {
              const dataUrl = canvas.toDataURL('image/png');
              if (dataUrl && dataUrl.length > 100) img.src = dataUrl;
            } catch(e) { /* fall back silently */ }
          } catch(e) { /* ignore per-image errors */ }
        });
      }, 120);
    } catch (e) { console.error('smoothUpscaledImages failed', e); }
  })();

  // JS fallback: ensure `.remindertext` gets larger on small screens if CSS is blocked
  (function reminderTextFallback(){
    try {
      const el = document.querySelector('.remindertext');
      if (!el) return;
      const apply = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const ar = w / (h || 1);
        // If device is small width, make large; if medium width, medium; if approx 16:10 aspect, increase too
        if (w <= 640) el.style.fontSize = '1.2rem';
        else if (w <= 1024) el.style.fontSize = '1.05rem';
        else if (w >= 1280 && w <= 1700) el.style.fontSize = '1.25rem';
        else el.style.fontSize = '';
      };
      apply();
      window.addEventListener('resize', apply);
    } catch (e) { /* ignore */ }
  })();

  // --- btnmanageaccess: scroll to frame-div parent ---
  const btnManageAccess = document.querySelector('.btnmanageaccess');
  if (btnManageAccess) {
    btnManageAccess.style.cursor = 'pointer';
    btnManageAccess.addEventListener('click', () => {
      const target = document.querySelector('.frame-div');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- btnback (global): send user to admin dashboard ---
  document.querySelectorAll('.btnback').forEach((btn) => {
    try {
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', () => { navigateWithFade('./admindashboard.html'); });
    } catch (e) { /* ignore if element not interactive */ }
  });

  // --- btninfo / click-here-for: open info page ---
  const btnInfo = document.querySelector('.click-here-for') || document.querySelector('.btninfo');
  if (btnInfo) {
    btnInfo.style.cursor = 'pointer';
    btnInfo.addEventListener('click', () => {
      navigateWithFade('./info.html');
    });
  }

  // --- btnpermission: navigate to permissions page ---
  document.querySelectorAll('.btnpermission').forEach((btnPermission) => {
    btnPermission.style.cursor = 'pointer';
    btnPermission.addEventListener('click', () => {
      navigateWithFade('./permissions.html');
    });
  });

  // --- btnnewuser: navigate to add-new-admin page ---
  document.querySelectorAll('.btnnewuser').forEach((btnNewUser) => {
    btnNewUser.style.cursor = 'pointer';
    btnNewUser.addEventListener('click', () => {
      navigateWithFade('./newadmin.html');
    });
  });

  // --- btndbconfig: scroll to rectangle-parent2 ---
  const btnDbConfig = document.querySelector('.btndbconfig');
  if (btnDbConfig) {
    btnDbConfig.style.cursor = 'pointer';
    btnDbConfig.addEventListener('click', () => {
      const target = document.querySelector('.rectangle-parent2');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- btnimport: open CSV file selector ---
  const btnImport = document.querySelector('.btnimport');
  if (btnImport) {
    btnImport.style.cursor = 'pointer';

    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
      .cw-upload-toast {
        position: fixed;
        left: 50%;
        bottom: 2.2vw;
        transform: translateX(-50%) translateY(1rem);
        opacity: 0;
        pointer-events: none;
        z-index: 9999;
        background: rgba(29, 136, 217, 0.96);
        color: #fff;
        border-radius: 999px;
        padding: 0.9vw 1.5vw;
        font: 600 clamp(0.9rem, 1.1vw, 1.1rem) / 1.1 Cal Sans, sans-serif;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
        transition: opacity 220ms ease, transform 220ms ease;
      }
      .cw-upload-toast.is-visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `;
    document.head.appendChild(toastStyle);

    const uploadToast = document.createElement('div');
    uploadToast.className = 'cw-upload-toast';
    uploadToast.textContent = 'Upload Success!';
    document.body.appendChild(uploadToast);

    let toastHideTimer = null;
    const showUploadToast = () => {
      if (toastHideTimer) {
        window.clearTimeout(toastHideTimer);
        toastHideTimer = null;
      }

      uploadToast.classList.add('is-visible');
      toastHideTimer = window.setTimeout(() => {
        uploadToast.classList.remove('is-visible');
        toastHideTimer = window.setTimeout(() => {
          uploadToast.classList.remove('is-visible');
        }, 220);
      }, 1000);
    };

    const csvInput = document.createElement('input');
    csvInput.type = 'file';
    csvInput.accept = '.csv,text/csv';
    csvInput.style.display = 'none';
    document.body.appendChild(csvInput);

    btnImport.addEventListener('click', () => {
      csvInput.value = '';
      csvInput.click();
    });

    csvInput.addEventListener('change', () => {
      if (!csvInput.files || !csvInput.files.length) return;
      const file = csvInput.files[0];
      const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
      if (!isCsv) {
        csvInput.value = '';
        return;
      }

      showUploadToast();
    });
  }

});
