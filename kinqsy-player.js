(function () {
  var MAX = 15 * 1024 * 1024;
  var OK = /\.(mp3|m4a|ogg|wav|aac)$/i;
  var SKINS = ["standard", "mini", "vinyl", "cassette"];
  function sb() { return window.__kinqsy_sb; }
  async function uid() {
    if (!sb()) return null;
    var s = await sb().auth.getSession();
    return s.data && s.data.session && s.data.session.user && s.data.session.user.id;
  }
  function skin() { return localStorage.getItem("kq-player-skin") || "standard"; }
  function setSkin(s) {
    localStorage.setItem("kq-player-skin", s);
    var el = document.getElementById("kq-player");
    if (el) el.setAttribute("data-skin", s);
  }

  function bar() {
    var el = document.getElementById("kq-player");
    if (el) return el;
    el = document.createElement("div");
    el.id = "kq-player";
    el.setAttribute("data-skin", skin());
    el.innerHTML =
      '<div class="kq-vinyl" aria-hidden="true"></div>' +
      '<button type="button" id="kq-p-prev" disabled>⟨</button>' +
      '<button type="button" id="kq-p-play" disabled>▶</button>' +
      '<button type="button" id="kq-p-next" disabled>⟩</button>' +
      '<span id="kq-p-title">нет треков</span>' +
      '<input id="kq-p-seek" type="range" min="0" max="1000" value="0" disabled>' +
      '<input id="kq-p-vol" type="range" min="0" max="1" step="0.01" value="0.8" disabled>' +
      '<button type="button" id="kq-p-lib">библиотека</button>' +
      '<audio id="kq-p-audio"></audio>';
    document.body.appendChild(el);
    if (!document.getElementById("kinqsy-player-css")) {
      var l = document.createElement("link");
      l.id = "kinqsy-player-css";
      l.rel = "stylesheet";
      l.href = "kinqsy-player.css";
      document.head.appendChild(l);
    }
    return el;
  }

  var list = [];
  var idx = 0;
  var audio;
  var armed = false;

  function empty() { return !list.length; }

  function setEnabled(on) {
    armed = on;
    ["kq-p-prev","kq-p-play","kq-p-next","kq-p-seek","kq-p-vol"].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) n.disabled = !on;
    });
    document.getElementById("kq-player").classList.toggle("empty", !on);
    if (!on) {
      document.getElementById("kq-p-title").textContent = "нет треков";
      document.getElementById("kq-p-play").textContent = "▶";
      document.getElementById("kq-p-seek").value = "0";
    }
  }

  function title() {
    var t = document.getElementById("kq-p-title");
    t.textContent = empty() ? "нет треков" : ((list[idx] && list[idx].title) || "трек");
  }

  async function urlFor(track) {
    var { data } = await sb().storage.from("user-audio").createSignedUrl(track.path, 3600);
    return data && data.signedUrl;
  }

  function saveState(playing) {
    if (empty()) return;
    localStorage.setItem("kq-music-state", JSON.stringify({
      id: list[idx].id,
      t: Math.floor(audio && audio.currentTime || 0),
      playing: !!playing,
      vol: audio ? audio.volume : 0.8
    }));
  }

  async function playAt(i, resumeT, auto) {
    if (empty()) return;
    idx = (i + list.length) % list.length;
    var src = await urlFor(list[idx]);
    if (!src) return;
    audio.src = src;
    audio.currentTime = resumeT || 0;
    title();
    if (auto !== false) {
      try { await audio.play(); } catch (e) {}
    }
    document.getElementById("kq-p-play").textContent = audio.paused ? "▶" : "❚❚";
    document.getElementById("kq-player").classList.toggle("playing", !audio.paused);
    saveState(!audio.paused);
  }

  function bind() {
    audio = document.getElementById("kq-p-audio");
    document.getElementById("kq-p-play").onclick = function () {
      if (!armed) return;
      if (!audio.src) { playAt(idx); return; }
      if (audio.paused) { audio.play(); this.textContent = "❚❚"; }
      else { audio.pause(); this.textContent = "▶"; }
      document.getElementById("kq-player").classList.toggle("playing", !audio.paused);
      saveState(!audio.paused);
    };
    document.getElementById("kq-p-prev").onclick = function () { if (armed) playAt(idx - 1); };
    document.getElementById("kq-p-next").onclick = function () { if (armed) playAt(idx + 1); };
    document.getElementById("kq-p-vol").oninput = function () {
      if (!armed) return;
      audio.volume = Number(this.value);
      saveState(!audio.paused);
    };
    document.getElementById("kq-p-seek").oninput = function () {
      if (!armed || !audio.duration) return;
      audio.currentTime = audio.duration * Number(this.value) / 1000;
      saveState(!audio.paused);
    };
    audio.ontimeupdate = function () {
      if (!audio.duration) return;
      document.getElementById("kq-p-seek").value = String(Math.floor(audio.currentTime / audio.duration * 1000));
      saveState(!audio.paused);
    };
    audio.onended = function () { playAt(idx + 1); };
    document.getElementById("kq-p-lib").onclick = openLib;
  }

  async function loadTracks() {
    var id = await uid();
    if (!id) { list = []; setEnabled(false); return; }
    var { data } = await sb().from("tracks").select("*").eq("user_id", id).order("created_at", { ascending: false });
    list = data || [];
    setEnabled(list.length > 0);
    title();
  }

  async function resume() {
    if (empty()) return;
    var raw = localStorage.getItem("kq-music-state");
    if (!raw) return;
    try {
      var st = JSON.parse(raw);
      var i = 0;
      list.forEach(function (t, n) { if (t.id === st.id) i = n; });
      if (st.vol) document.getElementById("kq-p-vol").value = String(st.vol);
      if (audio) audio.volume = Number(st.vol || 0.8);
      await playAt(i, st.t || 0, !!st.playing);
      if (!st.playing && audio) audio.pause();
      document.getElementById("kq-p-play").textContent = (st.playing && audio && !audio.paused) ? "❚❚" : "▶";
    } catch (e) {}
  }

  async function openLib() {
    var host = document.getElementById("kq-music-lib");
    if (!host) {
      host = document.createElement("div");
      host.id = "kq-music-lib";
      document.body.appendChild(host);
    }
    await loadTracks();
    host.innerHTML = '<div class="kq-lib-card"><h3>моя музыка</h3>' +
      '<div class="kq-skins">' + SKINS.map(function (s) {
        return '<button type="button" data-skin="'+s+'" class="'+(skin()===s?"on":"")+'">'+s+'</button>';
      }).join("") + "</div>" +
      '<input type="file" id="kq-music-file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,.mp3,.m4a,.ogg,.wav">' +
      '<p class="hint">mp3 / m4a / ogg / wav · до 15 МБ</p>' +
      '<div class="kq-lib-list"></div>' +
      '<button type="button" id="kq-lib-x">закрыть</button></div>';
    host.style.display = "flex";
    host.querySelector("#kq-lib-x").onclick = function () { host.style.display = "none"; };
    host.querySelectorAll("[data-skin]").forEach(function (b) {
      b.onclick = function () { setSkin(b.getAttribute("data-skin")); openLib(); };
    });
    var box = host.querySelector(".kq-lib-list");
    if (!list.length) {
      box.innerHTML = "<p class='hint'>пока пусто — выбери файл</p>";
    }
    list.forEach(function (t, i) {
      var row = document.createElement("div");
      row.className = "kq-lib-row";
      row.innerHTML = "<span></span><button type='button'>▶</button><button type='button'>имя</button><button type='button'>удалить</button>";
      row.querySelector("span").textContent = t.title;
      row.children[1].onclick = function () { playAt(i); };
      row.children[2].onclick = async function () {
        var n = prompt("название", t.title);
        if (!n) return;
        await sb().from("tracks").update({ title: n }).eq("id", t.id);
        openLib();
      };
      row.children[3].onclick = async function () {
        await sb().storage.from("user-audio").remove([t.path]);
        await sb().from("tracks").delete().eq("id", t.id);
        if (audio) audio.pause();
        localStorage.removeItem("kq-music-state");
        openLib();
      };
      box.appendChild(row);
    });
    host.querySelector("#kq-music-file").onchange = async function () {
      var f = this.files && this.files[0];
      if (!f) return;
      if (f.size > MAX) { alert("файл больше 15 МБ"); return; }
      if (!OK.test(f.name)) { alert("только mp3 m4a ogg wav"); return; }
      var id = await uid();
      var path = id + "/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_");
      var up = await sb().storage.from("user-audio").upload(path, f, { contentType: f.type || "audio/mpeg" });
      if (up.error) { alert(up.error.message); return; }
      await sb().from("tracks").insert({ user_id: id, title: f.name.replace(/\.[^.]+$/, ""), path: path, bytes: f.size });
      openLib();
      await loadTracks();
    };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    bar(); bind();
    await loadTracks();
    await resume();
  });
})();
