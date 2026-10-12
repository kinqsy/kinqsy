/* Kinqsy · Gossip · надстройка над общим плеером (kinqsy-player.js не изменяется).
   Только на странице Gossip:
   1) состояние картинки (вращение винила, катушки кассеты, кнопка ▶/❚❚) берётся из РЕАЛЬНОГО состояния <audio>;
   2) русские названия оформлений в библиотеке;
   3) название трека на кассете подгоняется по размеру, чтобы читалось целиком;
   4) понятные сообщения, если трек не загрузился или библиотека не открылась.
   Громкость, перемотка, переключение треков и сам <audio> — общие, свои механизмы здесь не создаются. */
(function () {
  "use strict";
  var LABELS = { standard: "Стандартный", mini: "Мини", vinyl: "Винил", cassette: "Кассета" };

  function player() { return document.getElementById("kq-player"); }
  function audioEl() { return document.getElementById("kq-p-audio"); }
  function titleEl() { return document.getElementById("kq-p-title"); }

  function say(msg) {
    var t = titleEl();
    if (!t) return;
    t.textContent = msg;
    t.classList.add("gp-err");
  }

  function ensureReels(el) {
    if (el.querySelector(".gp-reel")) return;
    var l = document.createElement("div"); l.className = "gp-reel gp-reel-l"; l.setAttribute("aria-hidden", "true");
    var r = document.createElement("div"); r.className = "gp-reel gp-reel-r"; r.setAttribute("aria-hidden", "true");
    el.appendChild(l); el.appendChild(r);
  }

  // единственный источник правды — сам <audio>
  function syncState() {
    var a = audioEl(), el = player();
    if (!a || !el) return;
    var playing = !a.paused && !a.ended;
    el.classList.toggle("playing", playing);
    var b = document.getElementById("kq-p-play");
    if (b && !b.disabled) b.textContent = playing ? "❚❚" : "▶";
    if (playing) { var t = titleEl(); if (t) t.classList.remove("gp-err"); }
  }

  // кассета: название целиком (уменьшаем шрифт, пока не поместится)
  function fitTitle() {
    var el = player(), t = titleEl();
    if (!el || !t) return;
    t.setAttribute("title", t.textContent);
    t.style.fontSize = "";
    if (el.getAttribute("data-skin") !== "cassette") return;
    for (var s = 3; s >= 1.7; s -= 0.15) {
      t.style.fontSize = s + "cqw";
      if (t.scrollHeight <= t.clientHeight + 1) break;
    }
  }

  function processLib() {
    var host = document.getElementById("kq-music-lib");
    var el = player();
    if (!host || !el) return;
    var skins = host.querySelector(".kq-skins");
    if (!skins || skins.getAttribute("data-gp")) return;
    skins.setAttribute("data-gp", "1");
    skins.querySelectorAll("[data-skin]").forEach(function (b) {
      var s = b.getAttribute("data-skin");
      if (LABELS[s]) b.textContent = LABELS[s];
    });
  }

  function init() {
    var el = player(), a = audioEl(), t = titleEl();
    if (!el || !a || !t) return false;
    ensureReels(el);

    ["play", "playing", "pause", "ended", "emptied", "abort", "error"].forEach(function (ev) {
      a.addEventListener(ev, syncState);
    });
    a.addEventListener("error", function () {
      say(a.src ? "не удалось воспроизвести трек" : "трек недоступен");
      syncState();
    });
    syncState();

    new MutationObserver(fitTitle).observe(t, { childList: true, characterData: true, subtree: true });
    new MutationObserver(fitTitle).observe(el, { attributes: true, attributeFilter: ["data-skin"] });
    window.addEventListener("resize", fitTitle);
    fitTitle();
    // окно библиотеки создаётся общим скриптом заново при каждом открытии — подписываем кнопки оформлений
    new MutationObserver(processLib).observe(document.body, { childList: true, subtree: true });

    // диагностика: если открытие библиотеки не удалось
    var lib = document.getElementById("kq-p-lib");
    if (lib) lib.addEventListener("click", function () {
      setTimeout(function () {
        var host = document.getElementById("kq-music-lib");
        if (!host || host.style.display !== "flex") say("библиотека не открылась: проверь вход и соединение");
      }, 3000);
    });
    return true;
  }

  window.addEventListener("unhandledrejection", function (e) {
    var stack = String((e.reason && e.reason.stack) || "");
    if (stack.indexOf("kinqsy-player.js") >= 0) {
      console.warn("[gossip-player]", e.reason);
      say("ошибка плеера: " + String((e.reason && e.reason.message) || "неизвестная").slice(0, 60));
    }
  });

  function boot() {
    var tries = 0;
    (function wait() {
      if (init()) return;
      if (++tries < 40) setTimeout(wait, 150);
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
