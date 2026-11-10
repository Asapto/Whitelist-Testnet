/* O'Cadre — commande en ligne (vanilla JS, sans dépendance)
   Flux : secteur & mode → carte → panier → coordonnées & créneau → confirmation.
   Les données viennent de assets/data/menu.json. Le panier est conservé dans localStorage. */
(function () {
  "use strict";

  var STORE_KEY = "ocadre-order";
  var MENU = null;
  var state = { secteur: null, mode: "livraison", cart: [], slot: null, step: 1 };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- utilitaires ---------- */
  function money(n) {
    return n.toFixed(2).replace(".", ",") + " " + (MENU.devise || "€");
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ secteur: state.secteur, mode: state.mode, cart: state.cart }));
    } catch (e) { /* stockage indisponible */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.secteur) state.secteur = saved.secteur;
      if (saved.mode) state.mode = saved.mode;
      if (Array.isArray(saved.cart)) state.cart = saved.cart;
    } catch (e) { /* ignoré */ }
  }
  function sector() {
    return MENU.secteurs.filter(function (s) { return s.id === state.secteur; })[0] || null;
  }
  function findItem(id) {
    for (var i = 0; i < MENU.categories.length; i++) {
      var cat = MENU.categories[i];
      for (var j = 0; j < cat.items.length; j++) {
        if (cat.items[j].id === id) return { item: cat.items[j], cat: cat };
      }
    }
    return null;
  }
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }
  function scrollTo(el) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  /* ---------- totaux ---------- */
  function subtotal() {
    return state.cart.reduce(function (sum, l) { return sum + l.prix * l.qty; }, 0);
  }
  function deliveryFee() {
    var s = sector();
    if (!s || state.mode !== "livraison" || !state.cart.length) return 0;
    var liv = s.livraison || {};
    if (liv.gratuite_des && subtotal() >= liv.gratuite_des) return 0;
    return liv.frais || 0;
  }
  function total() { return subtotal() + deliveryFee(); }
  function count() { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); }
  function minimumOk() {
    var s = sector();
    if (!s || state.mode !== "livraison") return true;
    return subtotal() >= ((s.livraison || {}).minimum || 0);
  }

  /* ---------- étape 1 : secteur & mode ---------- */
  function renderSectors() {
    var wrap = $("#secteurs");
    wrap.innerHTML = MENU.secteurs.map(function (s) {
      var active = s.id === state.secteur;
      return '<button type="button" class="sector-pick' + (active ? " is-active" : "") + '" data-secteur="' + s.id + '">' +
        '<span class="sector-pick__name">' + esc(s.nom) + "</span>" +
        '<span class="sector-pick__sub">' + esc(s.restaurant) + "</span>" +
        '<span class="sector-pick__check" aria-hidden="true">✓</span>' +
        "</button>";
    }).join("");
    $$(".sector-pick", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        state.secteur = b.getAttribute("data-secteur");
        $("#cp").value = "";
        $("#cp-msg").textContent = "";
        save();
        renderSectors();
        renderSectorInfo();
        renderCart();
      });
    });
    $$(".mode-pick").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-mode") === state.mode);
      b.setAttribute("aria-pressed", b.getAttribute("data-mode") === state.mode ? "true" : "false");
    });
  }

  function detectSector(value) {
    var v = value.trim().toLowerCase();
    if (!v) return null;
    for (var i = 0; i < MENU.secteurs.length; i++) {
      var s = MENU.secteurs[i];
      if (s.codes_postaux.indexOf(v) >= 0) return s;
      for (var j = 0; j < s.communes.length; j++) {
        if (s.communes[j].toLowerCase().indexOf(v) === 0) return s;
      }
    }
    return null;
  }

  function renderSectorInfo() {
    var box = $("#secteur-info");
    var s = sector();
    var next = $("#etape1-suivant");
    if (!s) {
      box.hidden = true;
      next.disabled = true;
      return;
    }
    var open = isOpenNow(s);
    var liv = s.livraison || {};
    box.hidden = false;
    box.innerHTML =
      '<div class="secteur-info__head"><strong>' + esc(s.restaurant) + "</strong>" +
      '<span class="pill ' + (open ? "pill--ok" : "pill--off") + '">' + (open ? "Ouvert en ce moment" : "Fermé en ce moment") + "</span></div>" +
      "<p>" + esc(s.adresse) + ' · <a href="tel:' + esc(s.tel_lien) + '">' + esc(s.telephone) + "</a></p>" +
      (state.mode === "livraison"
        ? "<p>Livraison " + money(liv.frais || 0) + (liv.gratuite_des ? ", offerte dès " + money(liv.gratuite_des) : "") + (liv.minimum ? " · minimum " + money(liv.minimum) : "") + "</p>"
        : "<p>À emporter : votre commande vous attend au comptoir à l'heure choisie.</p>");
    next.disabled = false;
  }

  /* ---------- horaires & créneaux ---------- */
  function hm(str) { var p = str.split(":"); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function windowsFor(s, date) {
    var day = date.getDay();
    var wins = [];
    if ((s.horaires.ferme_midi || []).indexOf(day) < 0) wins.push(s.horaires.midi);
    wins.push(s.horaires.soir);
    return wins;
  }
  function isOpenNow(s) {
    var now = new Date();
    var m = now.getHours() * 60 + now.getMinutes();
    return windowsFor(s, now).some(function (w) { return m >= hm(w[0]) && m < hm(w[1]); });
  }
  function slotsFor(s, date, isToday) {
    var step = MENU.commande.pas_creneau_min || 15;
    var lead = MENU.commande.delai_preparation_min || 30;
    var now = new Date();
    var minM = isToday ? now.getHours() * 60 + now.getMinutes() + lead : 0;
    var out = [];
    windowsFor(s, date).forEach(function (w) {
      for (var m = hm(w[0]); m <= hm(w[1]); m += step) {
        if (m < minM) continue;
        out.push(("0" + Math.floor(m / 60)).slice(-2) + ":" + ("0" + (m % 60)).slice(-2));
      }
    });
    return out;
  }
  var DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function renderSlots() {
    var s = sector();
    var daySel = $("#jour");
    var timeSel = $("#heure");
    if (!s) return;
    var days = [];
    for (var i = 0; i <= (MENU.commande.jours_a_l_avance || 2); i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      var slots = slotsFor(s, d, i === 0);
      days.push({ date: d, slots: slots, label: (i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : DAYS[d.getDay()]) + " " + d.getDate() + " " + MONTHS[d.getMonth()] });
    }
    daySel.innerHTML = days.map(function (d, i) {
      return '<option value="' + i + '"' + (d.slots.length ? "" : " disabled") + ">" + esc(d.label) + (d.slots.length ? "" : " — complet / fermé") + "</option>";
    }).join("");
    var first = days.findIndex(function (d) { return d.slots.length; });
    daySel.value = first >= 0 ? first : 0;
    function fillTimes() {
      var d = days[parseInt(daySel.value, 10)] || days[0];
      timeSel.innerHTML = d.slots.length
        ? '<option value="">Choisir une heure</option>' + d.slots.map(function (t) { return "<option>" + t + "</option>"; }).join("")
        : "<option value=''>Aucun créneau</option>";
      timeSel.disabled = !d.slots.length;
    }
    daySel.onchange = fillTimes;
    fillTimes();
    $("#slot-help").textContent = state.mode === "livraison"
      ? "Créneau de livraison souhaité (préparation + trajet : environ " + (MENU.commande.delai_preparation_min || 30) + " min)."
      : "Heure de retrait au restaurant (préparation : environ " + (MENU.commande.delai_preparation_min || 30) + " min).";
  }

  /* ---------- étape 2 : carte ---------- */
  function badge(item) {
    var b = [];
    if (item.populaire) b.push('<span class="badge badge--hot">Populaire</span>');
    if (item.veg) b.push('<span class="badge badge--veg">Végétarien</span>');
    if (item.epice) b.push('<span class="badge badge--spicy">Épicé</span>');
    return b.join("");
  }
  function renderMenu() {
    var nav = $("#carte-nav");
    var wrap = $("#carte-liste");
    nav.innerHTML = MENU.categories.map(function (c) {
      return '<a href="#cat-' + c.id + '">' + esc(c.nom) + "</a>";
    }).join("");
    wrap.innerHTML = MENU.categories.map(function (c) {
      return '<section class="cat" id="cat-' + c.id + '">' +
        '<header class="cat__head"><h2>' + esc(c.nom) + "</h2><p>" + esc(c.sous_titre || "") + "</p></header>" +
        '<div class="items">' + c.items.map(function (it) { return itemCard(it, c); }).join("") + "</div>" +
        "</section>";
    }).join("");
    $$(".item__add", wrap).forEach(function (b) {
      b.addEventListener("click", function () { onAdd(b.getAttribute("data-id")); });
    });
    // mise en évidence de la catégorie visible
    if ("IntersectionObserver" in window) {
      var links = $$("a", nav);
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id); });
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      $$(".cat", wrap).forEach(function (sec) { spy.observe(sec); });
    }
  }
  function itemCard(it, cat) {
    var hasOpts = (cat.options || []).length > 0;
    return '<article class="item" data-name="' + esc((it.nom + " " + it.desc).toLowerCase()) + '">' +
      '<div class="item__body">' +
      '<div class="item__top"><h3 class="item__name">' + esc(it.nom) + "</h3><span class=\"item__price\">" + money(it.prix) + "</span></div>" +
      '<p class="item__desc">' + esc(it.desc) + "</p>" +
      '<div class="item__foot">' + badge(it) +
      '<button type="button" class="btn btn--dark btn--sm item__add" data-id="' + esc(it.id) + '">' + (hasOpts ? "Choisir" : "Ajouter") + " +</button>" +
      "</div></div></article>";
  }
  function filterMenu(q) {
    q = q.trim().toLowerCase();
    $$(".item").forEach(function (el) {
      el.hidden = q !== "" && el.getAttribute("data-name").indexOf(q) < 0;
    });
    $$(".cat").forEach(function (sec) {
      sec.hidden = $$(".item", sec).every(function (el) { return el.hidden; });
    });
  }

  /* ---------- modale d'options ---------- */
  var modal, modalItem;
  function onAdd(id) {
    var found = findItem(id);
    if (!found) return;
    var opts = found.cat.options || [];
    if (!opts.length) {
      addLine(found.item, {}, 1, "");
      return;
    }
    openModal(found.item, opts);
  }
  function openModal(item, optKeys) {
    modal = $("#modal");
    modalItem = item;
    $("#modal-title").textContent = item.nom;
    $("#modal-desc").textContent = item.desc;
    $("#modal-price").textContent = money(item.prix);
    $("#modal-options").innerHTML = optKeys.map(function (k) {
      var o = MENU.options[k];
      return '<fieldset class="opt"><legend>' + esc(o.label) + "</legend><div class=\"opt__choices\">" +
        o.choix.map(function (c, i) {
          var id = "opt-" + k + "-" + i;
          return '<input type="radio" name="' + k + '" id="' + id + '" value="' + esc(c) + '"' + (c === o.defaut ? " checked" : "") + '><label for="' + id + '">' + esc(c) + "</label>";
        }).join("") + "</div></fieldset>";
    }).join("");
    $("#modal-qty").value = 1;
    $("#modal-note").value = "";
    modal.hidden = false;
    document.body.classList.add("modal-open");
    setTimeout(function () { var f = $("input[type=radio]:checked", modal) || $("#modal-qty"); f && f.focus(); }, 30);
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }
  function confirmModal() {
    var options = {};
    $$("fieldset", $("#modal-options")).forEach(function (fs) {
      var checked = $("input:checked", fs);
      if (checked) options[checked.name] = checked.value;
    });
    var qty = Math.max(1, parseInt($("#modal-qty").value, 10) || 1);
    addLine(modalItem, options, qty, $("#modal-note").value.trim());
    closeModal();
  }

  /* ---------- panier ---------- */
  function optLabel(options) {
    return Object.keys(options).map(function (k) { return options[k]; }).join(" · ");
  }
  function addLine(item, options, qty, note) {
    var key = item.id + "|" + optLabel(options) + "|" + note;
    var existing = state.cart.filter(function (l) { return l.key === key; })[0];
    if (existing) existing.qty += qty;
    else state.cart.push({ key: key, id: item.id, nom: item.nom, prix: item.prix, qty: qty, options: options, note: note });
    save();
    renderCart();
    flashCart(item.nom);
  }
  function changeQty(key, delta) {
    state.cart = state.cart.map(function (l) {
      if (l.key === key) l.qty += delta;
      return l;
    }).filter(function (l) { return l.qty > 0; });
    save();
    renderCart();
  }
  function flashCart(name) {
    var t = $("#toast");
    t.textContent = name + " ajouté au panier";
    t.classList.add("is-visible");
    clearTimeout(flashCart.timer);
    flashCart.timer = setTimeout(function () { t.classList.remove("is-visible"); }, 1800);
  }
  function renderCart() {
    var s = sector();
    var lines = $("#panier-lignes");
    var n = count();
    if (!state.cart.length) {
      lines.innerHTML = '<p class="panier__vide">Votre panier est vide. Ajoutez vos pizzas, pâtes et desserts depuis la carte.</p>';
    } else {
      lines.innerHTML = state.cart.map(function (l) {
        return '<div class="ligne">' +
          '<div class="ligne__info"><strong>' + esc(l.nom) + "</strong>" +
          (optLabel(l.options) ? '<span class="ligne__opt">' + esc(optLabel(l.options)) + "</span>" : "") +
          (l.note ? '<span class="ligne__opt">« ' + esc(l.note) + " »</span>" : "") + "</div>" +
          '<div class="ligne__qty"><button type="button" aria-label="Retirer un" data-key="' + esc(l.key) + '" data-d="-1">−</button><span>' + l.qty + '</span><button type="button" aria-label="Ajouter un" data-key="' + esc(l.key) + '" data-d="1">+</button></div>' +
          '<div class="ligne__prix">' + money(l.prix * l.qty) + "</div></div>";
      }).join("");
      $$(".ligne__qty button", lines).forEach(function (b) {
        b.addEventListener("click", function () { changeQty(b.getAttribute("data-key"), parseInt(b.getAttribute("data-d"), 10)); });
      });
    }
    var fee = deliveryFee();
    $("#panier-sous-total").textContent = money(subtotal());
    $("#panier-livraison").textContent = state.mode === "livraison" ? (fee ? money(fee) : "Offerte") : "—";
    $("#panier-livraison-row").hidden = state.mode !== "livraison";
    $("#panier-total").textContent = money(total());
    $("#panier-count").textContent = n;
    $("#bar-count").textContent = n + (n > 1 ? " articles" : " article");
    $("#bar-total").textContent = money(total());
    $("#cart-bar").classList.toggle("is-visible", n > 0);

    var warn = $("#panier-minimum");
    if (!state.cart.length) {
      warn.hidden = true;
    } else if (s && state.mode === "livraison" && !minimumOk()) {
      var liv = s.livraison;
      warn.hidden = false;
      warn.textContent = "Minimum de commande en livraison : " + money(liv.minimum) + " (il manque " + money(liv.minimum - subtotal()) + ").";
    } else if (s && state.mode === "livraison" && s.livraison.gratuite_des && subtotal() < s.livraison.gratuite_des) {
      warn.hidden = false;
      warn.textContent = "Plus que " + money(s.livraison.gratuite_des - subtotal()) + " pour la livraison offerte.";
    } else {
      warn.hidden = true;
    }
    $("#panier-commander").disabled = !state.cart.length || !s || !minimumOk();
    renderSuggestions();
    $("#recap-mode").textContent = (state.mode === "livraison" ? "Livraison" : "À emporter") + (s ? " · " + s.nom : "");
  }
  function renderSuggestions() {
    var box = $("#suggestions");
    var inCart = state.cart.map(function (l) { return l.id; });
    var ids = (MENU.suggestions || []).filter(function (id) { return inCart.indexOf(id) < 0; }).slice(0, 3);
    if (!state.cart.length || !ids.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "<p>Et pour finir ?</p><div class=\"sugg\">" + ids.map(function (id) {
      var f = findItem(id);
      if (!f) return "";
      return '<button type="button" data-id="' + esc(id) + '"><span>' + esc(f.item.nom) + "</span><em>" + money(f.item.prix) + " +</em></button>";
    }).join("") + "</div>";
    $$("button", box).forEach(function (b) { b.addEventListener("click", function () { onAdd(b.getAttribute("data-id")); }); });
  }
  function toggleDrawer(open) {
    var d = $("#panier");
    var isOpen = typeof open === "boolean" ? open : !d.classList.contains("is-open");
    d.classList.toggle("is-open", isOpen);
    document.body.classList.toggle("drawer-open", isOpen);
  }

  /* ---------- étape 3 : coordonnées & envoi ---------- */
  function goCheckout() {
    toggleDrawer(false);
    $("#etape-coordonnees").hidden = false;
    $$(".livraison-only").forEach(function (el) { el.hidden = state.mode !== "livraison"; });
    $$(".livraison-only input").forEach(function (i) { i.required = state.mode === "livraison"; });
    renderSlots();
    renderRecap();
    setStep(3);
    scrollTo($("#etape-coordonnees"));
  }
  function renderRecap() {
    $("#recap-lignes").innerHTML = state.cart.map(function (l) {
      return "<li><span>" + l.qty + " × " + esc(l.nom) + (optLabel(l.options) ? " <em>(" + esc(optLabel(l.options)) + ")</em>" : "") + "</span><span>" + money(l.prix * l.qty) + "</span></li>";
    }).join("") + (deliveryFee() ? "<li><span>Livraison</span><span>" + money(deliveryFee()) + "</span></li>" : "");
    $("#recap-total").textContent = money(total());
  }
  function orderText(order) {
    var s = sector();
    var lines = [
      "Commande O'Cadre " + order.numero,
      (order.mode === "livraison" ? "Livraison" : "À emporter") + " · " + s.restaurant,
      order.creneau.jour + " à " + order.creneau.heure,
      ""
    ];
    order.lignes.forEach(function (l) {
      lines.push(l.qty + " x " + l.nom + (optLabel(l.options) ? " (" + optLabel(l.options) + ")" : "") + (l.note ? " – " + l.note : "") + " : " + money(l.prix * l.qty));
    });
    if (order.livraison) lines.push("Livraison : " + money(order.livraison));
    lines.push("TOTAL : " + money(order.total));
    lines.push("");
    lines.push(order.client.prenom + " " + order.client.nom + " · " + order.client.telephone);
    if (order.mode === "livraison") lines.push(order.client.adresse + ", " + order.client.cp + " " + order.client.ville);
    lines.push("Paiement : " + order.paiement);
    if (order.client.note) lines.push("Note : " + order.client.note);
    return lines.join("\n");
  }
  function submitOrder(form) {
    var s = sector();
    var fd = new FormData(form);
    var daySel = $("#jour");
    var order = {
      numero: "OC-" + Date.now().toString(36).toUpperCase().slice(-6),
      secteur: s.id,
      restaurant: s.restaurant,
      mode: state.mode,
      creneau: { jour: daySel.options[daySel.selectedIndex].text.replace(/ — .*/, ""), heure: fd.get("heure") },
      lignes: state.cart,
      sous_total: subtotal(),
      livraison: deliveryFee(),
      total: total(),
      paiement: fd.get("paiement"),
      client: {
        prenom: fd.get("prenom"), nom: fd.get("nom"), telephone: fd.get("telephone"),
        adresse: fd.get("adresse") || "", cp: fd.get("cp") || "", ville: fd.get("ville") || "", note: fd.get("note") || ""
      }
    };
    var btn = $("button[type=submit]", form);
    btn.disabled = true;
    var endpoint = (MENU.commande.endpoint || "").trim();
    var finish = function (sent) {
      btn.disabled = false;
      showConfirmation(order, sent);
      state.cart = [];
      save();
      renderCart();
    };
    if (!endpoint) { finish(false); return; }
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) })
      .then(function (r) { if (!r.ok) throw new Error(r.statusText); finish(true); })
      .catch(function () { finish(false); });
  }
  function showConfirmation(order, sent) {
    var s = sector();
    var box = $("#confirmation");
    var text = orderText(order);
    var smsHref = "sms:" + s.tel_lien + "?&body=" + encodeURIComponent(text);
    box.innerHTML =
      '<div class="confirm">' +
      '<span class="confirm__icon" aria-hidden="true">✓</span>' +
      "<h2>" + (sent ? "Commande envoyée !" : "Votre commande est prête à être confirmée") + "</h2>" +
      "<p class=\"confirm__num\">N° <strong>" + esc(order.numero) + "</strong> · " + esc(order.creneau.jour) + " à " + esc(order.creneau.heure) + " · " + (order.mode === "livraison" ? "livraison" : "à emporter") + "</p>" +
      (sent
        ? "<p>" + esc(s.restaurant) + " a bien reçu votre commande. Vous recevrez un appel uniquement en cas de question.</p>"
        : "<p>Dernière étape : transmettez votre commande au restaurant en un geste. L'équipe de " + esc(s.restaurant) + " la confirme immédiatement.</p>" +
          '<div class="confirm__actions">' +
          (MENU.commande.sms_commande ? '<a class="btn btn--primary" href="' + smsHref + '">Envoyer par SMS</a>' : "") +
          '<a class="btn btn--dark" href="tel:' + esc(s.tel_lien) + '">Appeler le ' + esc(s.telephone) + "</a>" +
          '<button type="button" class="btn btn--outline" id="copier">Copier la commande</button>' +
          "</div>") +
      '<pre class="confirm__recap">' + esc(text) + "</pre>" +
      '<p class="confirm__alt">Vous avez déjà un compte ? <a href="' + esc(s.espace_client) + '" target="_blank" rel="noopener">Espace client ' + esc(s.nom) + "</a></p>" +
      "</div>";
    box.hidden = false;
    $("#etape-coordonnees").hidden = true;
    $("#etape-ou").hidden = true;
    $("#carte").hidden = true;
    $("#panier").hidden = true;
    var again = document.createElement("p");
    again.className = "confirm__alt";
    again.innerHTML = '<a href="commander.html">Passer une nouvelle commande</a>';
    $(".confirm", box).appendChild(again);
    var copy = $("#copier", box);
    if (copy) {
      copy.addEventListener("click", function () {
        var done = function () { copy.textContent = "Copié !"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
        else done();
      });
    }
    setStep(4);
    scrollTo(box);
  }

  /* ---------- stepper ---------- */
  function setStep(n) {
    state.step = n;
    $$(".stepper li").forEach(function (li, i) {
      li.classList.toggle("is-done", i + 1 < n);
      li.classList.toggle("is-current", i + 1 === n);
    });
  }

  /* ---------- init ---------- */
  function init() {
    load();
    var qs = param("secteur");
    if (qs && MENU.secteurs.some(function (s) { return s.id === qs; })) state.secteur = qs;
    var qm = param("mode");
    if (qm === "livraison" || qm === "emporter") state.mode = qm;

    if (!MENU.tarifs_valides) $("#tarifs-notice").hidden = false;

    renderSectors();
    renderSectorInfo();
    renderMenu();
    renderCart();

    $$(".mode-pick").forEach(function (b) {
      b.addEventListener("click", function () {
        state.mode = b.getAttribute("data-mode");
        save();
        renderSectors();
        renderSectorInfo();
        renderCart();
      });
    });
    $("#cp").addEventListener("input", function () {
      var s = detectSector(this.value);
      var msg = $("#cp-msg");
      if (this.value.trim().length < 2) { msg.textContent = ""; return; }
      if (s) {
        state.secteur = s.id;
        save();
        renderSectors();
        renderSectorInfo();
        renderCart();
        msg.textContent = "Vous êtes livré par " + s.restaurant + ".";
        msg.className = "cp-msg is-ok";
      } else {
        msg.textContent = "Nous ne trouvons pas cette commune : choisissez le restaurant le plus proche ci-dessous.";
        msg.className = "cp-msg is-err";
      }
    });
    $("#etape1-suivant").addEventListener("click", function () {
      setStep(2);
      scrollTo($("#carte"));
    });
    $("#recherche").addEventListener("input", function () { filterMenu(this.value); });

    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-ok").addEventListener("click", confirmModal);
    $("#modal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    $("#modal-minus").addEventListener("click", function () { var q = $("#modal-qty"); q.value = Math.max(1, (parseInt(q.value, 10) || 1) - 1); });
    $("#modal-plus").addEventListener("click", function () { var q = $("#modal-qty"); q.value = (parseInt(q.value, 10) || 1) + 1; });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeModal(); toggleDrawer(false); }
    });

    $("#cart-bar").addEventListener("click", function () { toggleDrawer(true); });
    $("#panier-fermer").addEventListener("click", function () { toggleDrawer(false); });
    $("#drawer-backdrop").addEventListener("click", function () { toggleDrawer(false); });
    $("#panier-commander").addEventListener("click", goCheckout);
    $("#retour-carte").addEventListener("click", function () { setStep(2); scrollTo($("#carte")); });

    var form = $("#form-commande");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!$("#heure").value) { $("#heure").focus(); $("#heure").reportValidity(); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      submitOrder(form);
    });

    setStep(state.secteur ? 2 : 1);
    if (state.secteur && (qs || state.cart.length)) {
      // Secteur déjà connu : on amène directement le client sur la carte.
      setTimeout(function () { scrollTo($("#carte")); }, 150);
    }
  }

  fetch("assets/data/menu.json")
    .then(function (r) { return r.json(); })
    .then(function (data) { MENU = data; init(); })
    .catch(function () {
      $("#carte-liste").innerHTML = '<p class="panier__vide">La carte n\'a pas pu être chargée. Appelez-nous : <a href="tel:+33387006662">03 87 00 66 62</a>.</p>';
    });
})();
