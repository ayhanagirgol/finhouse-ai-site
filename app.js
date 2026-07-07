(function(){
  const themeToggle = document.getElementById("themeToggle");
  const themeLabel  = document.getElementById("themeLabel");
  const yearEl      = document.getElementById("y");

  function setTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    if (themeLabel) themeLabel.textContent = theme === "dark" ? "Koyu" : "Açık";
    try{ localStorage.setItem("fh-theme", theme); }catch(e){}
  }

  // FOUC head script already set html[data-theme]; sync label + persistence here.
  const current = document.documentElement.getAttribute("data-theme")
    || (() => { try { return localStorage.getItem("fh-theme"); } catch(e){ return null; } })()
    || ((window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
  setTheme(current);

  themeToggle?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    setTheme(cur === "dark" ? "light" : "dark");
  });

  // --- Accordions (auto-open where requested) ---
  function setAccOpen(btn, open){
    const key = btn.dataset.acc;
    const root = btn.closest(".accordion") || document;
    const body = root.querySelector(`[data-acc-body="${key}"]`);
    btn.classList.toggle("is-open", open);
    if (body) body.style.display = open ? "block" : "none";
  }

  const accHeads = Array.from(document.querySelectorAll(".acc-head"));
  accHeads.forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = !btn.classList.contains("is-open");
      setAccOpen(btn, open);
    });
  });

  // Default: expand accordions that declare data-autopen="true"
  const autoAcc = Array.from(document.querySelectorAll('.accordion[data-autopen="true"]'));
  autoAcc.forEach(acc => {
    const heads = Array.from(acc.querySelectorAll(".acc-head"));
    heads.forEach(h => setAccOpen(h, true));
  });





  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

/* demo-card-click */
(function(){
  function goDemo(){ window.location.href = "./demo.html"; }
  document.addEventListener("click", function(e){
    const card = e.target.closest && e.target.closest('[data-demo-link="true"]');
    if(card) goDemo();
  });
  document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    const card = e.target && e.target.matches && e.target.matches('[data-demo-link="true"]') ? e.target : null;
    if(card){ e.preventDefault(); goDemo(); }
  });
})();


/* Demo form mail buttons (mailto / Gmail compose) */
(function(){
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function buildEmailPayload(){
    var form = qs('#demoForm');
    if(!form) return null;

    var name = (form.querySelector('[name="name"]')||{}).value || '';
    var company = (form.querySelector('[name="company"]')||{}).value || '';
    var email = (form.querySelector('[name="email"]')||{}).value || '';
    var phone = (form.querySelector('[name="phone"]')||{}).value || '';
    var message = (form.querySelector('[name="message"]')||{}).value || '';

    var sols = qsa('input[name="solutions"]:checked').map(function(i){ return i.value; });
    var subject = 'FinHouse.ai Demo Talebi' + (company ? (' - ' + company) : '');
    var body =
      'Demo Talebi\n' +
      '------------------------------\n' +
      'Ad Soyad: ' + name + '\n' +
      'Firma: ' + company + '\n' +
      'E-posta: ' + email + '\n' +
      'Telefon: ' + phone + '\n' +
      'Seçilen Çözümler: ' + (sols.length ? sols.join(', ') : '-') + '\n\n' +
      'Hedef / Kısa Açıklama:\n' + (message || '-') + '\n';

    return { subject: subject, body: body };
  }

  function enc(s){ return encodeURIComponent(s || ''); }

  document.addEventListener('click', function(ev){
    var t = ev.target;
    if(!t) return;

    if(t.id === 'mailtoBtn'){
      var p = buildEmailPayload();
      if(!p) return;
      window.location.href = 'mailto:info@finhouse.ai?subject=' + enc(p.subject) + '&body=' + enc(p.body);
    }

    if(t.id === 'gmailBtn'){
      var p2 = buildEmailPayload();
      if(!p2) return;
      var url = 'https://mail.google.com/mail/?view=cm&fs=1&to=info@finhouse.ai&su=' + enc(p2.subject) + '&body=' + enc(p2.body);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
})();
