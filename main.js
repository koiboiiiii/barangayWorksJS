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

  // --- Calendar implementation ---
  const calendarRoot = document.querySelector('.calendar');
  if (calendarRoot) {
    const monthDisplay = calendarRoot.querySelector('.calendar-month-field .september');
    const yearDisplay = calendarRoot.querySelector('.calendar-year-field .september');
    const prevIconBtn = calendarRoot.querySelector('.block .icon-button');
    const nextIconBtn = (function() { const btns = calendarRoot.querySelectorAll('.block .icon-button'); return btns[btns.length-1]; })();
    const tbodyEl = calendarRoot.querySelector('.tbody');

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let viewDate = new Date();
    let selectedButton = null;

    function renderCalendar(date) {
      // clear selection and disable success
      selectedButton = null;
      if (calendarRoot && calendarRoot.dataset) delete calendarRoot.dataset.selected;
      setBtnSuccessEnabled(false);

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
              if (selectedButton) {
                selectedButton.style.background = '';
                const prevInner = selectedButton.querySelector('.day-picker8'); if (prevInner) prevInner.style.color = '';
              }
              selectedButton = cell;
              cell.style.background = '#2c2c2c';
              inner.style.color = '#f5f5f5';
              calendarRoot.dataset.selected = cell.dataset.date;
              setBtnSuccessEnabled(true);
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
    const enableScroll = ()=>{ if (consentDiv) consentDiv.style.overflowY='auto'; if (rectangleContainer) rectangleContainer.scrollIntoView({ behavior:'smooth', block:'start' }); };
    if (checkboxIcon){ checkboxIcon.addEventListener('click', enableScroll); checkboxIcon.style.cursor='pointer'; }
    if (iConsent){ iConsent.addEventListener('click', enableScroll); iConsent.style.cursor='pointer'; }

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

});
