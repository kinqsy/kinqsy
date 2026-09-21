(function () {
  var MAX = 15 * 1024 * 1024;
  var OK = /\.(mp3|m4a|ogg|wav|aac)$/i;
  function sb() { return window.__kinqsy_sb; }
  async function uid() {
    var s = await sb().auth.getSession();
    return s.data && s.data.session && s.data.session.user && s.data.session.user.id;
  }

  function bar() {
    var el = document.getElementById("kq-player");
    if (el) return el;
    el = document.createElement("div");
    el.id = "kq-player";
    el.innerHTML =
      '<button type="button" id="kq-p-prev">⟨</button>' +
      '<button type="button" id="kq-p-play">▶</button>' +
      '<button type="button" id="kq-p-next">⟩</button>' +
      '<span id="kq-p-title">музыка</span>' +
      '<input id="kq-p-seek" type="range" min="0" max="1000" value="0">' +
      '<input id="kq-p-vol" type="range" min="0" max="1" step="0.01" value="0.8">' +
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

  function title() {
    var t = document.getElementById("kq-p-title");
    t.textContent = (list[idx] && list[idx].title) || "музыка";
  }

  async function urlFor(track) {
    var { data } = await sb().storage.from("user-audio").createSignedUrl(track.path, 3600);
    return data && data.signedUrl;
  }

  async function playAt(i) {
    if (!list.length) return;
    idx = (i + list.length) % list.length;
    var src = await urlFor(list[idx]);
    if (!src) return;
    audio.src = src;
    var saved = Number(localStorage.getItem("kq-music-pos-" + list[idx].id) || 0);
    audio.currentTime = saved || 0;
    await audio.play();
    document.getElementById("kq-p-play").textContent = "❚❚";
    title();
  }

  function bind() {
    audio = document.getElementById("kq-p-audio");
    document.getElementById("kq-p-play").onclick = function () {
      if (!audio.src) { playAt(idx); return; }
      if (audio.paused) { audio.play(); this.textContent = "❚❚"; }
      else { audio.pause(); this.textContent = "▶"; }
    };
    document.getElementById("kq-p-prev").onclick = function () { playAt(idx - 1); };
    document.getElementById("kq-p-next").onclick = function () { playAt(idx + 1); };
    document.getElementById("kq-p-vol").oninput = function () { audio.volume = Number(this.value); };
    document.getElementById("kq-p-seek").oninput = function () {
      if (audio.duration) audio.currentTime = audio.duration * Number(this.value) / 1000;
    };
    audio.ontimeupdate = function () {
      if (!audio.duration) return;
      document.getElementById("kq-p-seek").value = String(Math.floor(audio.currentTime / audio.duration * 1000));
      if (list[idx]) localStorage.setItem("kq-music-pos-" + list[idx].id, String(Math.floor(audio.currentTime)));
    };
    audio.onended = function () { playAt(idx + 1); };
    document.getElementById("kq-p-lib").onclick = openLib;
  }

  async function loadTracks() {
    var id = await uid();
    if (!id) { list = []; return; }
    var { data } = await sb().from("tracks").select("*").eq("user_id", id).order("created_at", { ascending: false });
    list = data || [];
    title();
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
      '<input type="file" id="kq-music-file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,.mp3,.m4a,.ogg,.wav">' +
      '<p class="hint">mp3 / m4a / ogg / wav · до 15 МБ</p>' +
      '<div class="kq-lib-list"></div>' +
      '<button type="button" id="kq-lib-x">закрыть</button></div>';
    host.style.display = "flex";
    host.querySelector("#kq-lib-x").onclick = function () { host.style.display = "none"; };
    var box = host.querySelector(".kq-lib-list");
    list.forEach(function (t, i) {
      var row = document.createElement("div");
      row.className = "kq-lib-row";
      row.innerHTML = "<span></span><button type='button'>▶</button><button type='button'>переименовать</button><button type='button'>удалить</button>";
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
        if (list[idx] && list[idx].id === t.id) audio.pause();
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
    };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    bar(); bind();
    await loadTracks();
  });
})();
