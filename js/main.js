/* Hadley Wood Jewish Community — site behaviour
   Progressive enhancement only: the site works fully without this file. */
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  /* ---------- Palette preview (?palette=stone|slate|linen|mono, ?palette-picker) ---------- */
  var params = new URLSearchParams(window.location.search);
  var palettes = ["stone", "slate", "linen", "mono"];
  var root = document.documentElement;
  var stored = null;
  try { stored = window.localStorage.getItem("hwjc-palette"); } catch (e) { /* ignore */ }
  var requested = params.get("palette") || stored;
  if (requested && palettes.indexOf(requested) !== -1) {
    root.setAttribute("data-palette", requested);
    try { window.localStorage.setItem("hwjc-palette", requested); } catch (e) { /* ignore */ }
  }
  if (params.has("palette-picker") || params.has("palette")) {
    var picker = document.createElement("div");
    picker.className = "palette-picker is-visible";
    picker.setAttribute("aria-label", "Preview colour palettes");
    palettes.forEach(function (name) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      b.setAttribute("aria-pressed", String(root.getAttribute("data-palette") === name));
      b.addEventListener("click", function () {
        root.setAttribute("data-palette", name);
        try { window.localStorage.setItem("hwjc-palette", name); } catch (e) { /* ignore */ }
        picker.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      });
      picker.appendChild(b);
    });
    document.body.appendChild(picker);
  }

  /* ---------- Header shadow on scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".nav-toggle__label").textContent = open ? "Close" : "Menu";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.querySelector(".nav-toggle__label").textContent = "Menu";
        toggle.focus();
      }
    });
  }

  /* ---------- Community sub-menu ---------- */
  document.querySelectorAll(".nav-btn[aria-controls]").forEach(function (btn) {
    var menu = document.getElementById(btn.getAttribute("aria-controls"));
    if (!menu) return;
    function setOpen(open) {
      menu.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    }
    btn.addEventListener("click", function () {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("click", function (e) {
      if (!btn.contains(e.target) && !menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setOpen(false); btn.focus(); }
    });
  });

  /* ---------- Reveal on scroll ---------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = document.querySelectorAll(".reveal, .reveal-stagger");
  if (reduce || !("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Current year in footer ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
