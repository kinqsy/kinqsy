(function () {
  if (window.top !== window) {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#" || /^https?:/i.test(href) || href.indexOf("mailto:") === 0) return;
      if (href.indexOf(".html") < 0) return;
      e.preventDefault();
      window.top.postMessage({ type: "kq-nav", path: href }, location.origin);
    });
    return;
  }
  if (!/kinqsy-keep\.html$/.test(location.pathname)) {
    var page = (location.pathname.split("/").pop() || "index.html") + location.search;
    location.replace("kinqsy-keep.html?p=" + encodeURIComponent(page));
    return;
  }
  var MAX = 15 * 1024 * 1024;
  var libraryBusy = false;
  var OK = /\.(mp3|m4a|ogg|wav|aac)$/i;
  var SKINS = ["standard", "mini", "vinyl", "cassette"];
  function sb() { return window.__kinqsy_sb; }
  async function uid() {
    if (!sb()) return null;
    var s = await sb().auth.getSession();
    return s.data && s.data.session && s.data.session.user && s.data.session.user.id;
  }
  function skin() {
    var s = localStorage.getItem("kq-player-skin") || "standard";
    if (s === "mini") return "mini";
    if (SKINS.indexOf(s) < 0) s = "standard";
    return s;
  }
  function setSkin(s) {
    localStorage.setItem("kq-player-skin", s);
    var el = document.getElementById("kq-player");
    if (el) { el.setAttribute("data-skin", s); if(el.kqFitPosition) requestAnimationFrame(el.kqFitPosition); }
  }

  function bar() {
    var el = document.getElementById("kq-player");
    if (el) return el;
    el = document.createElement("div");
    el.id = "kq-player";
    el.setAttribute("data-skin", skin());
    el.innerHTML =
      '<div class="kq-vinyl" aria-hidden="true"></div>' +
      '<i class="kq-reel l" aria-hidden="true"></i><i class="kq-reel r" aria-hidden="true"></i>' +
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
    setupDrag();
  }

  function setupDrag() {
    var host = document.getElementById("kq-player");
    if (!host || host.dataset.drag === "1") return;
    host.dataset.drag = "1";
    var drag = document.createElement("button"); drag.type="button";drag.id="kq-p-drag";drag.textContent="⠿";
    drag.title="Переместить плеер; стрелки — сдвиг, Home — вернуть положение";
    drag.setAttribute("aria-label","Переместить плеер"); host.insertBefore(drag,host.firstChild);
    var position = null, active = null;
    function persist() { try {localStorage.setItem("kq-player-pos",JSON.stringify(position));}catch(ignore){} }
    function viewport() {var v=window.visualViewport;return {x:v?v.offsetLeft:0,y:v?v.offsetTop:0,w:v?v.width:window.innerWidth,h:v?v.height:window.innerHeight};}
    function place(x,y,save) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||host.classList.contains("kq-docked"))return;
      var v=viewport(),w=host.offsetWidth,h=host.offsetHeight;
      x=Math.max(v.x+8,Math.min(v.x+Math.max(8,v.w-w-8),x));
      y=Math.max(v.y+8,Math.min(v.y+Math.max(8,v.h-h-8),y));
      position={x:x,y:y};
      host.style.left=x+"px";host.style.top=y+"px";host.style.right="auto";host.style.bottom="auto";host.style.transform="none";
      if(save)persist();
    }
    function fit(){if(host.classList.contains("kq-docked"))return;var r=host.getBoundingClientRect();place(position?position.x:r.left,position?position.y:r.top,false);}
    function reset(){position=null;try{localStorage.removeItem("kq-player-pos");}catch(ignore){}["left","top","right","bottom","transform"].forEach(function(p){host.style.removeProperty(p);});requestAnimationFrame(fit);}
    host.kqFitPosition=fit;host.kqResetPosition=reset;
    try {var saved=JSON.parse(localStorage.getItem("kq-player-pos")||"null");if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))position=saved;}catch(ignore){}
    drag.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();});
    drag.addEventListener("keydown",function(e){var steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
      if(e.key==="Home"){e.preventDefault();reset();return;}var step=steps[e.key];if(!step)return;e.preventDefault();var r=host.getBoundingClientRect();place(r.left+step[0],r.top+step[1],true);
    });
    drag.addEventListener("pointerdown",function(e){
      if(active || (e.button!=null&&e.button!==0)||host.classList.contains("kq-docked"))return;
      e.preventDefault();e.stopPropagation();var r=host.getBoundingClientRect();active={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};
      try{drag.setPointerCapture(e.pointerId);}catch(ignore){}
      host.classList.add("kq-dragging");
    });
    drag.addEventListener("pointermove",function(e){if(!active||e.pointerId!==active.id)return;e.preventDefault();place(e.clientX-active.x,e.clientY-active.y,false);});
    function end(e){if(!active||e.pointerId!==active.id)return;var id=active.id;active=null;host.classList.remove("kq-dragging");if(position)persist();try{drag.releasePointerCapture(id);}catch(ignore){} }
    ["pointerup","pointercancel","lostpointercapture"].forEach(function(type){drag.addEventListener(type,end);});
    window.addEventListener("resize",fit);if(window.visualViewport)window.visualViewport.addEventListener("resize",fit);
    if(window.ResizeObserver)new ResizeObserver(fit).observe(host);
    fit(); requestAnimationFrame(fit);
    setupOverlayDock(host);
  }

  // The audio lives in the parent shell. Reserve its own strip while a child
  // editor/dialog or a text field is active, rather than covering iframe controls.
  function setupOverlayDock(host) {
    var frame=document.getElementById("kq-frame"), observer=null, oldDoc=null;
    if(!frame)return;
    function afterFocus(){ setTimeout(update,0); }
    function update(){
      var doc;try{doc=frame.contentDocument;}catch(ignore){}var blocked=false;
      if(doc){
        blocked=[].some.call(doc.querySelectorAll(".auth-overlay.open,.modal-overlay.open,dialog[open],[role=dialog][aria-modal=true],#kq-sticker-pop"),function(e){var r=e.getBoundingClientRect();return r.width>0 && r.height>0 && doc.defaultView.getComputedStyle(e).visibility!=="hidden";});
        var focus=doc.activeElement;blocked=blocked||!!(focus&&focus.matches("input:not([type=button]):not([type=range]):not([type=color]),textarea,[contenteditable=true]"));
      }
      if(host.classList.contains("kq-docked")===blocked)return;
      host.classList.toggle("kq-docked",blocked);document.body.classList.toggle("kq-player-docked",blocked);
      if(!blocked&&host.kqFitPosition)requestAnimationFrame(host.kqFitPosition);
    }
    function bind(){
      if(observer)observer.disconnect();if(oldDoc){oldDoc.removeEventListener("focus",afterFocus,true);oldDoc.removeEventListener("blur",afterFocus,true);}
      try{oldDoc=frame.contentDocument;}catch(ignore){oldDoc=null;}
      if(oldDoc){observer=new MutationObserver(update);observer.observe(oldDoc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:["class","style","open","hidden","aria-modal"]});oldDoc.addEventListener("focus",afterFocus,true);oldDoc.addEventListener("blur",afterFocus,true);}
      update();
    }
    frame.addEventListener("load",bind);bind();
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
      '<p class="hint">mp3 / m4a / ogg / wav / aac · до 15 МБ</p>' +
      '<div class="kq-lib-list"></div>' +
      '<button type="button" id="kq-p-reset">вернуть положение плеера</button> ' +
      '<button type="button" id="kq-lib-x">закрыть</button></div>';
    host.style.display = "flex";
    host.querySelector("#kq-p-reset").onclick=function(){var player=document.getElementById("kq-player");if(player.kqResetPosition)player.kqResetPosition();};
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
      var input = document.createElement("input");
        input.value = t.title;
        input.maxLength = 80;
        row.replaceChild(input, row.children[2]);
        input.onblur = async function () {
          if (libraryBusy) return;
          var name = input.value.trim();
          if (!name || Array.from(name).length > 80) { input.value = t.title; return; }
          if (name === t.title) return;
          libraryBusy = true;
          input.disabled = true;
          try {
            var id = await uid();
            if (!id) throw new Error("Для изменения нужен вход");
            var result = await sb().from("tracks").update({ title: name }).eq("id", t.id).eq("user_id", id).select("id");
            if (result.error) throw result.error;
            if (!result.data || result.data.length !== 1) throw new Error("Трек не обновился: обнови библиотеку");
            t.title = name;
            await openLib();
          } catch (error) {
            input.value = t.title;
            alert("Не удалось переименовать трек: " + (error.message || "ошибка соединения"));
          } finally {
            input.disabled = false;
            libraryBusy = false;
          }
        };
      row.children[3].onclick = async function () {
        if (libraryBusy) return;
        libraryBusy = true;
        var button = this;
        button.disabled = true;
        var fileRemoved = false;
        try {
          var id = await uid();
          if (!id || typeof t.path !== "string" || t.path.split("/")[0] !== id) throw new Error("Нет доступа к файлу трека");
          var removed = await sb().storage.from("user-audio").remove([t.path]);
          if (removed.error) throw removed.error;
          fileRemoved = true;
          var deleted = await sb().from("tracks").delete().eq("id", t.id).eq("user_id", id).select("id");
          if (deleted.error) throw deleted.error;
          if (!deleted.data || deleted.data.length !== 1) throw new Error("Запись трека не удалена");
          if (audio) audio.pause();
          localStorage.removeItem("kq-music-state");
          await openLib();
        } catch (error) {
          alert((fileRemoved ? "Файл удалён, но завершить удаление из библиотеки не удалось. Обнови библиотеку перед повторной попыткой. " : "Не удалось удалить трек. ") + (error.message || "ошибка соединения"));
        } finally {
          button.disabled = false;
          libraryBusy = false;
        }
      };
      box.appendChild(row);
    });
    host.querySelector("#kq-music-file").onchange = async function () {
      if (libraryBusy) return;
      var f = this.files && this.files[0];
      if (!f) return;
      if (!f.size || f.size > MAX) { alert("нужен непустой файл не больше 15 МБ"); return; }
      if (!OK.test(f.name)) { alert("только mp3 m4a ogg wav aac"); return; }
      libraryBusy = true;
      var input = this;
      input.disabled = true;
      var fileUploaded = false;
      try {
        var id = await uid();
        if (!id) throw new Error("Для загрузки нужен вход");
        var path = id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + f.name.replace(/[^\\w.\\-]+/g, "_");
        var up = await sb().storage.from("user-audio").upload(path, f, { contentType: f.type || "audio/mpeg", upsert: false });
        if (up.error) throw up.error;
        fileUploaded = true;
        var saved = await sb().from("tracks").insert({ user_id: id, title: f.name.replace(/\\.[^.]+$/, "").slice(0, 80) || "трек", path: path, bytes: f.size }).select("id").single();
        if (saved.error) throw saved.error;
        if (!saved.data || !saved.data.id) throw new Error("Запись трека не подтверждена");
        await openLib();
      } catch (error) {
        alert((fileUploaded ? "Файл загружен, но сохранение в библиотеке не подтверждено. Обнови библиотеку перед повторной загрузкой. " : "Не удалось загрузить трек. ") + (error.message || "ошибка соединения"));
      } finally {
        input.disabled = false;
        input.value = "";
        libraryBusy = false;
      }
    };
  }

  document.addEventListener("DOMContentLoaded", async function () {
    bar(); bind();
    await loadTracks();
    await resume();
  });
})();
