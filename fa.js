/* finhouse.ai — çerezsiz, gizlilik-öncelikli ziyaret beacon'ı.
   Veri üçüncü tarafa gitmez; kendi altyapımızda (FirmaAI/DGX) toplanır.
   Çerez YOK · kalıcı kimlik YOK (sekme-ömrü session) · ham IP saklanmaz · DNT'ye saygı. */
(function () {
  try {
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    if (dnt === "1" || dnt === "yes") return;
    var COLLECT = "https://gx10-70db.tail9fb942.ts.net/api/site-analytics/hit";
    var sid = "";
    try {
      sid = sessionStorage.getItem("_fa_s");
      if (!sid) { sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); sessionStorage.setItem("_fa_s", sid); }
    } catch (e) { sid = ""; }
    function hit() {
      try {
        var body = JSON.stringify({
          p: location.pathname,
          r: document.referrer || "",
          t: document.title || "",
          s: sid,
          w: (window.screen && screen.width) || null,
          l: navigator.language || ""
        });
        if (navigator.sendBeacon) navigator.sendBeacon(COLLECT, body);
        else {
          var x = new XMLHttpRequest();
          x.open("POST", COLLECT, true);
          x.setRequestHeader("Content-Type", "text/plain");
          x.send(body);
        }
      } catch (e) {}
    }
    if (document.readyState === "complete" || document.readyState === "interactive") hit();
    else document.addEventListener("DOMContentLoaded", function () { hit(); }, { once: true });
  } catch (e) {}
})();
