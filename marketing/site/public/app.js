// Ayam Labs site behaviour: live status probing, copy buttons, reveal on scroll.
(function () {
  "use strict";

  var HEALTH = {
    "emailcheck": "https://emailcheck.ayamk.in/health",
    "seo-audit": "https://seo-audit.ayamk.in/health",
    "docparse": "https://docparse.ayamk.in/health",
    "ai-text": "https://textmind.ayamk.in/health",
    "pii-shield": "https://piishield.ayamk.in/health"
  };

  var statusTargets = document.querySelectorAll("[data-status-for]");

  function paint(slug, ok, latencyMs) {
    statusTargets.forEach(function (el) {
      if (el.getAttribute("data-status-for") !== slug) return;
      el.setAttribute("data-state", ok ? "ok" : "bad");
      var label = el.querySelector("[data-status-label]");
      if (label) label.textContent = ok ? latencyMs + "ms" : "down";
    });
  }

  function probe(slug, url) {
    var started = performance.now();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 4000);
    return fetch(url, { signal: controller.signal, cache: "no-store", mode: "cors" })
      .then(function (response) {
        clearTimeout(timer);
        if (!response.ok) throw new Error("status " + response.status);
        return response.json();
      })
      .then(function () { paint(slug, true, Math.round(performance.now() - started)); })
      .catch(function () { paint(slug, false, null); });
  }

  if (statusTargets.length) {
    Object.keys(HEALTH).forEach(function (slug) { probe(slug, HEALTH[slug]); });
  }

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", function () {
      var source = document.querySelector(button.getAttribute("data-copy"));
      if (!source) return;
      var previous = button.textContent;
      var done = function () {
        button.textContent = "copied";
        setTimeout(function () { button.textContent = previous; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(source.innerText).then(done, function () {});
      }
    });
  });

  var revealables = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealables.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealables.forEach(function (el) { observer.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("in"); });
  }
})();
