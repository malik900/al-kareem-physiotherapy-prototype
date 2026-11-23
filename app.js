/* COORDINATOR PATCHES (23 Nov 2026, overnight demo assembly): P1 role-group
   visibility + role label in renderAuthViews; P2 ROLE_LINKS point at real
   pages (patient -> login.html, admin -> admin.html#...); P3 addToCart honours
   the product page #qty input; P4 closed drawers set hidden=true (with CSS C1);
   P5 search matches on every word; P6 login form validates email/password
   (mobile D4) + store contract note corrected. Original css-lead contract otherwise unchanged.
   ==========================================================================
   Al Kareem Physiotherapy & Rehabilitation Centre — Shared Demo JS
   Vanilla JS, no libraries. DEMO ONLY — nothing here books, orders, or
   takes money for anything real. No payment UI of any kind and no
   gateway names anywhere in this file.
   --------------------------------------------------------------------------
   BUILDER CONTRACT — IDs/classes the page builders MUST use (app.js hooks):
   Cart:      [data-add-to-cart="shoulder-pulley"] on Add to Cart buttons;
              [data-cart-open] on the cart icon button (in nav-snippet).
   Booking:   <form id="booking-form"> with #booking-name, #booking-phone,
              #booking-service (select), #booking-date (input type=date),
              optional #booking-time / #booking-notes; each field wrapped in
              <div class="field"> with <span class="field-error"
              id="<field-id>-error" hidden></span> underneath; confirmation
              panel <div id="booking-confirm" hidden> containing
              <span id="booking-ref"> and <span id="booking-summary">,
              plus optional <button id="booking-again">.
   Login:     <form id="login-form"> with #login-email (+ optional
              #login-password, #login-role select with values demo-patient /
              demo-admin); demo buttons [data-demo-login="demo-patient"|
              "demo-admin"] [data-demo-name="..."]; logout [data-demo-logout].
              Account-page blocks: [data-show-when="logged-in" |
              "logged-out"], [data-account-name], [data-account-role].
   Enrol:     [data-demo-enrol] on any enrol button.
   Newsletter:<form id="newsletter-form">.
   Store:     the store page owns its own search (#store-search) + category
              chips [data-category] ("all" | "exercise-fitness" |
              "rehabilitation-equipment" | "daily-living-aids") + its inline
              filter script; app.js owns search toggle, drawer and cart.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Storage keys ---------- */
  var CART_KEY = 'ak_cart';
  var SESSION_KEY = 'ak_demo_session';
  var BOOKING_SEQ_KEY = 'ak_demo_booking_seq';

  /* ---------- Products (verified from the clinic's Facebook Store page, Nov 2026; only Shoulder Pulley is priced, Rs 850) ---------- */
  var PRODUCTS = {
    'shoulder-pulley': { id: 'shoulder-pulley', name: 'Shoulder Pulley', price: 850 }
  };

  /* ---------- Small helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function money(n) { return 'Rs ' + Number(n).toLocaleString('en-PK'); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Toast (demo feedback: enrolment, newsletter) ---------- */
  var toastTimer = null;
  function showDemoToast(message) {
    var old = $('.demo-toast');
    if (old) old.remove();
    var toast = el('div', 'demo-toast');
    toast.setAttribute('role', 'status');
    toast.appendChild(document.createTextNode(message));
    var close = el('button', null, '\u00d7');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', function () { toast.remove(); });
    toast.appendChild(close);
    document.body.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toast.parentNode) toast.remove(); }, 6000);
  }

  /* ========================================================================
     (a) CART — localStorage. Seven real products; only Shoulder Pulley is priced (Rs 850).
     ======================================================================== */
  function getCart() {
    var cart = readJSON(CART_KEY, []);
    return Array.isArray(cart) ? cart.filter(function (i) { return PRODUCTS[i.id]; }) : [];
  }
  function saveCart(cart) { writeJSON(CART_KEY, cart); }

  function cartCount() {
    return getCart().reduce(function (sum, i) { return sum + (Number(i.qty) || 0); }, 0);
  }

  function updateCartBadges() {
    var count = cartCount();
    $all('.cart-count').forEach(function (badge) {
      badge.textContent = count >= 100 ? '99+' : String(count);
      badge.hidden = count === 0;
    });
  }

  function addToCart(id, qty) {
    var cart = getCart();
    var line = null;
    cart.forEach(function (i) { if (i.id === id) line = i; });
    if (line) { line.qty = Math.min(99, (Number(line.qty) || 0) + (qty || 1)); }
    else { cart.push({ id: id, qty: qty || 1 }); }
    saveCart(cart);
    updateCartBadges();
    renderCartDrawer();
    openCartDrawer();
  }

  function setQty(id, qty) {
    var cart = getCart().map(function (i) {
      if (i.id === id) i.qty = Math.max(0, Math.min(99, qty));
      return i;
    }).filter(function (i) { return i.qty > 0; });
    saveCart(cart);
    updateCartBadges();
    renderCartDrawer();
  }

  function removeFromCart(id) {
    saveCart(getCart().filter(function (i) { return i.id !== id; }));
    updateCartBadges();
    renderCartDrawer();
  }

  function renderCartDrawer() {
    var body = $('#cart-drawer-body');
    if (!body) return;
    body.innerHTML = '';
    var cart = getCart();
    if (cart.length === 0) {
      var empty = el('p', 'cart-empty', 'Your cart is empty. The store has seven real products; only the Shoulder Pulley is priced (Rs 850).');
      body.appendChild(empty);
      var foot = $('#cart-drawer-foot');
      if (foot) foot.hidden = true;
      return;
    }
    var subtotal = 0;
    cart.forEach(function (line) {
      var p = PRODUCTS[line.id];
      var lineTotal = p.price * line.qty;
      subtotal += lineTotal;

      var item = el('div', 'cart-item');
      var info = el('div', 'cart-item-info');
      info.appendChild(el('strong', null, p.name));
      info.appendChild(el('span', 'cart-item-price', money(p.price) + ' each'));

      var qtyRow = el('div', 'cart-item-qty');
      var dec = el('button', 'qty-btn', '\u2212');
      dec.type = 'button';
      dec.setAttribute('aria-label', 'Decrease quantity of ' + p.name);
      dec.addEventListener('click', function () { setQty(line.id, line.qty - 1); });
      var val = el('span', 'qty-value', String(line.qty));
      var inc = el('button', 'qty-btn', '+');
      inc.type = 'button';
      inc.setAttribute('aria-label', 'Increase quantity of ' + p.name);
      inc.addEventListener('click', function () { setQty(line.id, line.qty + 1); });
      qtyRow.appendChild(dec); qtyRow.appendChild(val); qtyRow.appendChild(inc);
      info.appendChild(qtyRow);

      var remove = el('button', 'cart-item-remove', 'Remove');
      remove.type = 'button';
      remove.addEventListener('click', function () { removeFromCart(line.id); });
      info.appendChild(remove);

      item.appendChild(info);
      item.appendChild(el('span', 'cart-item-line-total', money(lineTotal)));
      body.appendChild(item);
    });

    var summary = el('div', 'cart-summary');
    var row1 = el('div', 'cart-summary-row');
    row1.appendChild(el('span', null, 'Subtotal'));
    row1.appendChild(el('span', null, money(subtotal)));
    var row2 = el('div', 'cart-summary-row');
    row2.appendChild(el('span', null, 'Delivery'));
    var del = el('span', null, 'Free home delivery within Lodhran City');
    row2.appendChild(del);
    var row3 = el('div', 'cart-summary-row total');
    row3.appendChild(el('span', null, 'Total'));
    row3.appendChild(el('span', null, money(subtotal)));
    summary.appendChild(row1); summary.appendChild(row2); summary.appendChild(row3);
    body.appendChild(summary);

    var foot = $('#cart-drawer-foot');
    if (foot) foot.hidden = false;
  }

  /* "Place order (Demo)" — ends the flow. No order is placed. */
  function placeDemoOrder() {
    var body = $('#cart-drawer-body');
    var foot = $('#cart-drawer-foot');
    if (!body) return;
    body.innerHTML = '';
    var box = el('div', 'demo-confirm');
    box.appendChild(el('h3', null, 'Demo \u2014 order not placed.'));
    box.appendChild(el('p', null, 'No payment was taken and nothing was ordered.'));
    body.appendChild(box);
    if (foot) foot.hidden = true;
    saveCart([]);
    updateCartBadges();
  }

  /* ========================================================================
     (b) Mobile drawer + cart drawer — open/close, Esc, outside tap,
         body scroll lock, focus return.
     ======================================================================== */
  var lastFocus = null;

  function openDrawer() {
    var drawer = $('#nav-drawer');
    var overlay = $('#overlay');
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('open');
    drawer.removeAttribute('hidden');
    if (overlay) overlay.hidden = false;
    document.body.classList.add('no-scroll');
    var burger = $('#hamburger-btn');
    if (burger) burger.setAttribute('aria-expanded', 'true');
    var closeBtn = $('#drawer-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeDrawer() {
    var drawer = $('#nav-drawer');
    var overlay = $('#overlay');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.hidden = true;
    if (overlay && !isCartOpen()) overlay.hidden = true;
    if (!isCartOpen()) document.body.classList.remove('no-scroll');
    var burger = $('#hamburger-btn');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function isCartOpen() {
    var cart = $('#cart-drawer');
    return !!(cart && cart.classList.contains('open'));
  }
  function openCartDrawer() {
    var cart = $('#cart-drawer');
    var overlay = $('#overlay');
    if (!cart) return;
    lastFocus = document.activeElement;
    renderCartDrawer();
    cart.classList.add('open');
    cart.removeAttribute('hidden');
    if (overlay) overlay.hidden = false;
    document.body.classList.add('no-scroll');
    var closeBtn = $('#cart-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeCartDrawer() {
    var cart = $('#cart-drawer');
    var overlay = $('#overlay');
    if (!cart) return;
    cart.classList.remove('open');
    cart.hidden = true;
    var drawer = $('#nav-drawer');
    var drawerOpen = !!(drawer && drawer.classList.contains('open'));
    if (overlay && !drawerOpen) overlay.hidden = true;
    if (!drawerOpen) document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function closeAllDrawers() { closeDrawer(); closeCartDrawer(); }

  /* ========================================================================
     (c) Header search — built-in index of REAL items only.
     ======================================================================== */
  var SEARCH_INDEX = [
    /* 12 verified service names (flyers) */
    { type: 'Service', label: 'Physiotherapy Treatment', href: 'services.html' },
    { type: 'Service', label: 'Pain Relief', href: 'services.html' },
    { type: 'Service', label: 'Post-Surgery Rehab', href: 'services.html' },
    { type: 'Service', label: 'Sports Injury Rehab', href: 'services.html' },
    { type: 'Service', label: 'Neurological Rehab', href: 'services.html' },
    { type: 'Service', label: 'CP Children Therapy', href: 'services.html' },
    { type: 'Service', label: 'Stroke Rehab', href: 'services.html' },
    { type: 'Service', label: 'Back & Neck Pain', href: 'services.html' },
    { type: 'Service', label: 'Knee & Joint Therapy', href: 'services.html' },
    { type: 'Service', label: 'Geriatric Care', href: 'services.html' },
    { type: 'Service', label: 'Pediatric Rehab', href: 'services.html' },
    { type: 'Service', label: 'Musculoskeletal Rehab', href: 'services.html' },
    /* 7 real products (Facebook Store page, Nov 2026) */
    { type: 'Product', label: 'Shoulder Pulley \u2014 Rs 850', href: 'store.html' },
    { type: 'Product', label: 'Walking Walker', href: 'store.html' },
    { type: 'Product', label: 'Massage Gun / Fascia Gun', href: 'store.html' },
    { type: 'Product', label: 'Digital Thermometer', href: 'store.html' },
    { type: 'Product', label: 'ATOM King Size Heating Pad', href: 'store.html' },
    { type: 'Product', label: 'Care Vision 3-in-1 Combo TENS Machine', href: 'store.html' },
    { type: 'Product', label: 'Blood Pressure Monitors', href: 'store.html' },
    /* Pages */
    { type: 'Page', label: 'Home', href: 'index.html' },
    { type: 'Page', label: 'About \u2014 Dr. Muhammad Imran', href: 'about.html' },
    { type: 'Page', label: 'Services', href: 'services.html' },
    { type: 'Page', label: 'Specialists', href: 'specialists.html' },
    { type: 'Page', label: 'Facilities', href: 'facilities.html' },
    { type: 'Page', label: 'Store', href: 'store.html' },
    { type: 'Page', label: 'Academy / Courses', href: 'academy.html' },
    { type: 'Page', label: 'Blog', href: 'blog.html' },
    { type: 'Page', label: 'Contact', href: 'contact.html' },
    { type: 'Page', label: 'Book Appointment', href: 'book.html' },
    { type: 'Page', label: 'Login / My Account', href: 'login.html' }
  ];

  function renderSearchResults(query) {
    var box = $('#global-search-results');
    if (!box) return;
    box.innerHTML = '';
    var q = (query || '').trim().toLowerCase();
    if (q.length < 2) return;
    var words = q.split(/\s+/).filter(function (w) { return w.length > 0; });
    var matches = SEARCH_INDEX.filter(function (item) {
      var label = item.label.toLowerCase();
      return words.every(function (w) { return label.indexOf(w) !== -1; });
    });
    if (matches.length === 0) {
      box.appendChild(el('p', 'search-no-results', 'No results for \u201c' + query.trim() + '\u201d. Try a service name (for example, \u201cback pain\u201d), \u201cShoulder Pulley\u201d, or a page name.'));
      return;
    }
    var groups = {};
    var order = [];
    matches.forEach(function (item) {
      if (!groups[item.type]) { groups[item.type] = []; order.push(item.type); }
      groups[item.type].push(item);
    });
    order.forEach(function (type) {
      var group = el('div', 'search-group');
      group.appendChild(el('div', 'search-group-title', type + 's'));
      groups[type].forEach(function (item) {
        var a = el('a', 'search-result', item.label);
        a.href = item.href;
        a.addEventListener('click', function () { closeSearchRow(); });
        group.appendChild(a);
      });
      box.appendChild(group);
    });
  }

  function openSearchRow() {
    var row = $('#global-search-row');
    var input = $('#global-search');
    var toggle = $('#search-toggle');
    if (!row) return;
    row.hidden = false;
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    if (input) input.focus();
  }
  function closeSearchRow() {
    var row = $('#global-search-row');
    var toggle = $('#search-toggle');
    if (row) row.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  /* ========================================================================
     (d) + (e) Account dropdown + demo login / logout
     ======================================================================== */
  var ROLE_LINKS = {
    'demo-patient': {
      label: 'Patient',
      links: [
        ['My Appointments', 'login.html'],
        ['My Sessions / History', 'login.html'],
        ['My Account', 'login.html']
      ]
    },
    'demo-admin': {
      label: 'Admin',
      links: [
        ['Dashboard', 'admin.html'],
        ['Appointments', 'admin.html#appointments'],
        ['Patients', 'admin.html#patients'],
        ['Students', 'admin.html#students'],
        ['Courses', 'admin.html#courses'],
        ['Products', 'admin.html#products'],
        ['Orders', 'admin.html#orders'],
        ['Settings', 'admin.html#settings']
      ]
    }
  };

  function getSession() { return readJSON(SESSION_KEY, null); }

  function renderAccountArea() {
    var area = $('#account-area');
    if (!area) return;
    area.innerHTML = '';
    var session = getSession();
    if (!session) {
      var signIn = el('a', 'btn small navy', 'Sign In');
      signIn.href = 'login.html';
      area.appendChild(signIn);
      return;
    }
    var wrap = el('div', 'account-wrap');
    var btn = el('button', 'account-btn');
    btn.type = 'button';
    btn.id = 'account-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    var initial = (session.name || 'D').charAt(0).toUpperCase();
    btn.appendChild(el('span', 'avatar-circle', initial));
    btn.appendChild(document.createTextNode(session.name || 'Demo User'));
    btn.appendChild(document.createTextNode(' \u25be'));
    var panel = el('div', 'account-panel');
    panel.id = 'account-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'menu');
    var head = el('div', 'account-head');
    head.appendChild(el('strong', null, session.name || 'Demo User'));
    var role = ROLE_LINKS[session.role] || ROLE_LINKS['demo-patient'];
    head.appendChild(el('small', null, role.label + ' \u00b7 Demo account'));
    panel.appendChild(head);
    role.links.forEach(function (link) {
      var a = el('a', null, link[0]);
      a.href = link[1];
      a.setAttribute('role', 'menuitem');
      panel.appendChild(a);
    });
    var divider = el('div', 'account-divider');
    panel.appendChild(divider);
    var logout = el('button', 'account-item', 'Log out');
    logout.type = 'button';
    logout.setAttribute('role', 'menuitem');
    logout.setAttribute('data-demo-logout', '');
    logout.addEventListener('click', logoutDemo);
    panel.appendChild(logout);
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    area.appendChild(wrap);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = panel.hidden === false;
      closeAccountPanel();
      if (isOpen) return;
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closeAccountPanel();
    });
  }

  function closeAccountPanel() {
    var panel = $('#account-panel');
    var btn = $('#account-btn');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function loginDemo(role, name) {
    var displayName = name || (role === 'demo-admin' ? 'Demo Admin' : 'Demo Patient');
    writeJSON(SESSION_KEY, { name: displayName, role: role });
    renderAccountArea();
    renderAuthViews();
    window.location.href = 'login.html';
  }

  function logoutDemo() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    renderAccountArea();
    renderAuthViews();
    window.location.href = 'login.html';
  }

  /* Show/hide logged-in vs logged-out blocks on the account page. */
  function renderAuthViews() {
    var session = getSession();
    $all('[data-show-when="logged-in"]').forEach(function (n) { n.hidden = !session; });
    $all('[data-show-when="logged-out"]').forEach(function (n) { n.hidden = !!session; });
    $all('[data-account-name]').forEach(function (n) { n.textContent = session ? (session.name || 'Demo User') : ''; });
    $all('[data-account-role]').forEach(function (n) {
      var role = session ? (ROLE_LINKS[session.role] || ROLE_LINKS['demo-patient']) : null;
      n.textContent = role ? role.label : '';
    });
    /* COORDINATOR PATCH P1: role-group visibility + role label (login page). */
    $all('[data-role-group]').forEach(function (n) {
      var g = n.getAttribute('data-role-group');
      var show = !!session && ((g === 'patient' && session.role === 'demo-patient') ||
                               (g === 'admin' && session.role === 'demo-admin'));
      n.hidden = !show;
    });
    $all('[data-demo-role-label]').forEach(function (n) {
      var role = session ? (ROLE_LINKS[session.role] || ROLE_LINKS['demo-patient']) : null;
      n.textContent = role ? role.label : '';
    });
  }

  /* ========================================================================
     (f) Demo booking form
     ======================================================================== */
  function nextBookingRef() {
    var seq = readJSON(BOOKING_SEQ_KEY, 0) || 0;
    seq += 1;
    writeJSON(BOOKING_SEQ_KEY, seq);
    return 'DEMO-' + String(seq).padStart(4, '0');
  }

  function setFieldError(input, message) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    var err = input.closest('.field') ? $('.field-error', input.closest('.field')) : null;
    if (!err) err = document.getElementById(input.id + '-error');
    if (err) { err.textContent = message; err.hidden = false; }
  }
  function clearFieldError(input) {
    if (!input) return;
    input.removeAttribute('aria-invalid');
    var err = input.closest('.field') ? $('.field-error', input.closest('.field')) : null;
    if (!err) err = document.getElementById(input.id + '-error');
    if (err) { err.textContent = ''; err.hidden = true; }
  }

  function initBookingForm() {
    var form = $('#booking-form');
    if (!form) return;
    var name = $('#booking-name');
    var phone = $('#booking-phone');
    var service = $('#booking-service');
    var date = $('#booking-date');
    [name, phone, service, date].forEach(function (input) {
      if (input) input.addEventListener('input', function () { clearFieldError(input); });
      if (input) input.addEventListener('change', function () { clearFieldError(input); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var firstBad = null;
      function fail(input, msg) {
        setFieldError(input, msg);
        valid = false;
        if (!firstBad) firstBad = input;
      }
      if (!name || name.value.trim().length < 2) fail(name, 'Please enter your full name.');
      var digits = phone ? phone.value.replace(/\D/g, '') : '';
      if (!phone || digits.length < 10 || digits.length > 15) fail(phone, 'Please enter a valid phone number (10\u201315 digits).');
      if (!service || !service.value) fail(service, 'Please choose a service.');
      if (!date || !date.value) {
        fail(date, 'Please choose a date.');
      } else {
        var chosen = new Date(date.value + 'T00:00:00');
        var today = new Date(); today.setHours(0, 0, 0, 0);
        if (isNaN(chosen.getTime())) fail(date, 'Please choose a valid date.');
        else if (chosen < today) fail(date, 'Please choose today or a future date.');
      }
      if (!valid) { if (firstBad) firstBad.focus(); return; }

      var ref = nextBookingRef();
      var confirmBox = $('#booking-confirm');
      var refEl = $('#booking-ref');
      var summaryEl = $('#booking-summary');
      if (refEl) refEl.textContent = ref;
      if (summaryEl) {
        summaryEl.textContent = (name.value.trim() || '') + ' \u00b7 ' +
          (service.options ? service.options[service.selectedIndex].text : service.value) +
          ' \u00b7 ' + date.value;
      }
      form.hidden = true;
      if (confirmBox) {
        confirmBox.hidden = false;
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    var again = $('#booking-again');
    if (again) {
      again.addEventListener('click', function () {
        var confirmBox = $('#booking-confirm');
        if (confirmBox) confirmBox.hidden = true;
        form.reset();
        form.hidden = false;
        if (name) name.focus();
      });
    }
  }

  /* ========================================================================
     (g) Demo enrolment  |  (h) Newsletter demo form
     ======================================================================== */
  function initDemoButtons() {
    $all('[data-demo-enrol]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showDemoToast('Demo \u2014 enrolment is not live yet; no course exists to enrol in.');
      });
    });
    var news = $('#newsletter-form');
    if (news) {
      news.addEventListener('submit', function (e) {
        e.preventDefault();
        showDemoToast('Demo \u2014 no subscription saved.');
        news.reset();
      });
    }
  }

  /* ========================================================================
     Store page: product search + category chips (seven real products; the page's
     own inline script owns filtering — this only keeps chip state consistent)
     ======================================================================== */
  function initStoreFilters() {
    var input = $('#product-search');
    var grid = $('#product-grid');
    if (input && grid) {
      input.addEventListener('input', function () {
        var q = input.value.trim().toLowerCase();
        $all('.card[data-name]', grid).forEach(function (card) {
          var hay = ((card.getAttribute('data-name') || '') + ' ' + (card.getAttribute('data-cat') || '')).toLowerCase();
          card.hidden = q !== '' && hay.indexOf(q) === -1;
        });
        var none = $('#product-no-results');
        var visible = $all('.card[data-name]', grid).filter(function (c) { return !c.hidden; }).length;
        if (none) none.hidden = visible !== 0;
      });
    }
    $all('.cat-chips [data-category]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        $all('.cat-chips [data-category]').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        var cat = chip.getAttribute('data-category');
        var gridEl = $('#product-grid');
        if (!gridEl) return;
        $all('.card[data-name]', gridEl).forEach(function (card) {
          card.hidden = cat !== 'all' && card.getAttribute('data-cat') !== cat;
        });
      });
    });
  }

  /* ---------- Nav active state ---------- */
  function initActiveNav() {
    var path = window.location.pathname.split('/').pop() || 'index.html';
    $all('nav.main-nav a, .drawer nav.drawer-nav a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) a.classList.add('active');
    });
  }

  /* ---------- Wire everything up ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    updateCartBadges();
    renderCartDrawer();
    renderAccountArea();
    renderAuthViews();
    initActiveNav();
    initBookingForm();
    initDemoButtons();
    initStoreFilters();

    /* Cart: add buttons + open/close */
    $all('[data-add-to-cart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
      var q = document.getElementById('qty');
      var n = q ? Math.max(1, Math.min(99, parseInt(q.value, 10) || 1)) : 1;
      addToCart(btn.getAttribute('data-add-to-cart'), n);
    });
    });
    $all('[data-cart-open]').forEach(function (btn) {
      btn.addEventListener('click', openCartDrawer);
    });
    var cartClose = $('#cart-close');
    if (cartClose) cartClose.addEventListener('click', closeCartDrawer);
    var placeOrder = $('#place-order-demo');
    if (placeOrder) placeOrder.addEventListener('click', placeDemoOrder);

    /* Mobile drawer */
    var burger = $('#hamburger-btn');
    if (burger) burger.addEventListener('click', openDrawer);
    var drawerClose = $('#drawer-close');
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    $all('#nav-drawer a').forEach(function (a) {
      a.addEventListener('click', closeDrawer);
    });

    /* Shared overlay: closes whichever drawer/cart is open */
    var overlay = $('#overlay');
    if (overlay) overlay.addEventListener('click', closeAllDrawers);

    /* Header search */
    var searchToggle = $('#search-toggle');
    if (searchToggle) {
      searchToggle.addEventListener('click', function () {
        var row = $('#global-search-row');
        if (row && row.hidden) openSearchRow();
        else closeSearchRow();
      });
    }
    var searchClose = $('#search-close');
    if (searchClose) searchClose.addEventListener('click', closeSearchRow);
    var searchInput = $('#global-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () { renderSearchResults(searchInput.value); });
    }

    /* Demo login: buttons + form */
    $all('[data-demo-login]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        loginDemo(btn.getAttribute('data-demo-login'), btn.getAttribute('data-demo-name') || null);
      });
    });
    var loginForm = $('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = $('#login-email');
        var pw = $('#login-password');
        var emailErr = $('#login-email-error');
        var pwErr = $('#login-password-error');
        var ok = true;
        if (!email || !email.value || email.value.indexOf('@') === -1) {
          if (emailErr) emailErr.hidden = false;
          ok = false;
        } else if (emailErr) { emailErr.hidden = true; }
        if (!pw || !pw.value) {
          if (pwErr) pwErr.hidden = false;
          ok = false;
        } else if (pwErr) { pwErr.hidden = true; }
        if (!ok) return;
        var local = email.value.split('@')[0].replace(/[._-]+/g, ' ').trim();
        var name = local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Demo Patient';
        var roleSel = $('#login-role');
        var role = (roleSel && roleSel.value) || 'demo-patient';
        loginDemo(role, name);
      });
    }
    $all('[data-demo-logout]').forEach(function (btn) {
      btn.addEventListener('click', logoutDemo);
    });

    /* Card "Learn More" detail toggles (v3 pattern) */
    $all('[data-toggle-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-toggle-detail'));
        if (target) target.classList.toggle('open');
      });
    });

    /* Esc closes drawer / cart / search / account panel */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllDrawers();
        closeSearchRow();
        closeAccountPanel();
      }
    });
  });
})();
