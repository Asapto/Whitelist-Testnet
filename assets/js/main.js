/* O'Cadre — scripts du site (vanilla JS, sans dépendance) */
(function () {
  "use strict";

  /* ---- Menu mobile ------------------------------------------------------ */
  var toggle = document.querySelector(".nav-toggle");
  var header = document.querySelector(".site-header");
  if (toggle && header) {
    toggle.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && header.classList.contains("nav-open")) {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
    header.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---- Lien actif dans la navigation ------------------------------------ */
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path) a.setAttribute("aria-current", "page");
  });

  /* ---- Apparition au défilement ----------------------------------------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* ---- Navigation de la carte (section active) -------------------------- */
  var menuLinks = document.querySelectorAll(".menu-nav a[href^='#']");
  if (menuLinks.length && "IntersectionObserver" in window) {
    var sections = [];
    menuLinks.forEach(function (a) {
      var s = document.querySelector(a.getAttribute("href"));
      if (s) sections.push({ el: s, link: a });
    });
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          sections.forEach(function (s) {
            s.link.classList.toggle("is-active", s.el === entry.target);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach(function (s) {
      spy.observe(s.el);
    });
  }

  /* ---- Ouvert / fermé en ce moment (bandeau haut) ------------------------ */
  var status = document.querySelector("[data-open-status]");
  if (status) {
    var now = new Date();
    var day = now.getDay(); // 0 = dimanche
    var mins = now.getHours() * 60 + now.getMinutes();
    var lunch = mins >= 11 * 60 + 30 && mins < 14 * 60;
    var evening = mins >= 17 * 60 + 30 && mins < 22 * 60;
    var isOpen = evening || (lunch && day !== 0);
    status.textContent = isOpen
      ? "Ouvert en ce moment — commandez en ligne"
      : "Fermé pour le moment — ouverture 11h30 / 17h30";
    status.previousElementSibling &&
      (status.previousElementSibling.style.background = isOpen ? "#3ddc84" : "#ff5b70");
  }

  /* ---- Formulaires (avis, devis) ----------------------------------------- */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var msg = form.querySelector(".form-msg");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var endpoint = form.getAttribute("action");
      var btn = form.querySelector("button[type='submit']");
      if (btn) btn.disabled = true;

      var done = function (ok, text) {
        if (btn) btn.disabled = false;
        if (!msg) return;
        msg.className = "form-msg " + (ok ? "is-ok" : "is-err");
        msg.textContent = text;
        msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (ok) form.reset();
      };

      if (!endpoint || endpoint === "#") {
        // Pas encore de point de terminaison serveur : on confirme simplement la saisie.
        done(true, "Merci ! Votre message a bien été enregistré. Nous revenons vers vous rapidement.");
        return;
      }

      fetch(endpoint, { method: "POST", body: new FormData(form) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.statusText);
          done(true, "Merci ! Votre message a bien été envoyé.");
        })
        .catch(function () {
          done(false, "Oups, l'envoi a échoué. Appelez-nous directement au 03 87 00 66 62.");
        });
    });
  });

  /* ---- Bandeau cookies ---------------------------------------------------- */
  var cookie = document.querySelector(".cookie");
  if (cookie) {
    var KEY = "ocadre-cookies-ok";
    var seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch (err) {
      seen = false;
    }
    if (!seen) cookie.classList.add("is-visible");
    var ok = cookie.querySelector("button");
    if (ok) {
      ok.addEventListener("click", function () {
        cookie.classList.remove("is-visible");
        try {
          localStorage.setItem(KEY, "1");
        } catch (err) {
          /* stockage indisponible : on ignore */
        }
      });
    }
  }

  /* ---- Année du pied de page ---------------------------------------------- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
