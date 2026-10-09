(() => {
  "use strict";
  const config = window.REVAHEAD_CONFIG || {};
  const query = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const email = String(config.contactEmail || "").trim();
  const validEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email);
  const liveContact = config.contactEnabled === true && config.draftMode === false && validEmail;
  const httpsURL = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  };

  // Im Entwurf bleibt der Hinweis sichtbar. Suchmaschinenfreigabe erfolgt separat im HTML.
  all("[data-draft-bar]").forEach((bar) => { bar.hidden = config.draftMode === false; });
  all("[data-year]").forEach((node) => { node.textContent = String(new Date().getFullYear()); });

  const toggle = query(".menu-toggle");
  const navigation = query(".mobile-nav");
  const setMenu = (open) => {
    if (!toggle || !navigation) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    navigation.hidden = !open;
  };
  toggle?.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  navigation?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") { setMenu(false); toggle.focus(); }
  });
  document.addEventListener("click", (event) => {
    if (toggle?.getAttribute("aria-expanded") === "true" && !event.target.closest(".site-header")) setMenu(false);
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", () => setMenu(false));

  all("[data-linkedin]").forEach((node) => {
    const url = httpsURL(config.linkedinUrl);
    if (url) node.href = url;
    else node.hidden = true;
  });

  all("[data-contact-email]").forEach((node) => {
    if (liveContact) { node.textContent = email; node.href = "mailto:" + email; node.hidden = false; }
  });
  all("[data-email-placeholder]").forEach((node) => { node.hidden = liveContact; });
  const phone = String(config.phone || "").trim();
  const validPhone = /^\+?[\d\s()/-]{6,30}$/.test(phone);
  all("[data-phone-item]").forEach((node) => {
    if (!config.draftMode && !validPhone) node.hidden = true;
    if (liveContact && validPhone) {
      const link = node.querySelector("a"); link.textContent = phone; link.href = "tel:" + phone.replace(/[^\d+]/g, ""); link.hidden = false;
      node.querySelector(".placeholder").hidden = true;
    }
  });
  const bookingUrl = httpsURL(config.bookingUrl);
  all("[data-booking-item]").forEach((node) => {
    if (!config.draftMode && !bookingUrl) node.hidden = true;
    if (liveContact && bookingUrl) {
      const link = node.querySelector("a"); link.href = bookingUrl; link.hidden = false;
      node.querySelector(".placeholder").hidden = true;
    }
  });

  const form = query("[data-contact-form]");
  if (!form) return;
  const intent = form.querySelector("[name=intent]");
  const options = ["saas-unternehmen", "kanzlei", "saas-karriere", "legal-karriere", "allgemein"];
  const selectIntent = (value) => { if (options.includes(value)) intent.value = value; };
  selectIntent(new URLSearchParams(window.location.search).get("anliegen"));
  all("[data-intent]").forEach((link) => link.addEventListener("click", () => selectIntent(link.dataset.intent)));

  // Netlify Forms: real URL-encoded POST. Never retry automatically.
  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[data-form-status]');
  let sending = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    status.textContent = "";
    for (const [name, label] of [['name', 'Ihren Namen'], ['message', 'eine Nachricht']]) {
      const input = form.elements.namedItem(name);
      input.setCustomValidity('');
      if (!input.value.trim()) {
        input.setCustomValidity('Bitte geben Sie ' + label + ' ein.');
        input.reportValidity();
        input.addEventListener('input', () => input.setCustomValidity(''), {once: true});
        return;
      }
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    data.set('form-name','kontakt');
    for (const name of ['name', 'email', 'company', 'message']) {
      data.set(name, String(data.get(name) || '').trim());
    }
    sending = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    status.textContent = "Nachricht wird gesendet …";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams(data).toString(),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const responseText = await response.text();
      // A static page returned by a missing/misconfigured backend is not an acknowledgement.
      if (/data-revahead-page="(?!danke")/.test(responseText)) {
        throw new Error('Unexpected static page instead of form acknowledgement');
      }
      const selectedIntent = intent.value;
      form.reset();
      selectIntent(selectedIntent);
      status.textContent = "Vielen Dank! Ihre Nachricht wurde erfolgreich übermittelt.";
    } catch (error) {
      status.textContent = "Die Übermittlung konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte warten Sie kurz, bevor Sie erneut senden, oder klären Sie den Eingang über " + email + ".";
      console.error('RevAhead Kontaktformular: Keine Übermittlungsbestätigung', error.name);
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  });
})();
