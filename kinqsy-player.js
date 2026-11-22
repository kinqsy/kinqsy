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
  async function uid(requireSession) {
    var client = sb();
    if (!client) {
      if (requireSession) throw new Error("Не удалось подключиться к аккаунтам сайта. Обнови страницу и попробуй снова.");
      return null;
    }
    var s = await client.auth.getSession();
    if (requireSession && s.error) throw s.error;
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
      `<svg xmlns="http://www.w3.org/2000/svg" class="kq-cassette" viewBox="0 0 320 200" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="kq-shell" x2=".25" y2="1">
      <stop stop-color="#e5ebf2" stop-opacity=".52"/>
      <stop offset=".32" stop-color="#a9b6c3" stop-opacity=".19"/>
      <stop offset=".75" stop-color="#444b53" stop-opacity=".22"/>
      <stop offset="1" stop-color="#d9e1e9" stop-opacity=".4"/>
    </linearGradient>
    <linearGradient id="kq-chrome" x2=".2" y2="1">
      <stop stop-color="#f6f8fb"/><stop offset=".46" stop-color="#8f98a3"/>
      <stop offset=".54" stop-color="#4a515a"/><stop offset="1" stop-color="#d0d7df"/>
    </linearGradient>
    <pattern id="kq-grip" width="4" height="4" patternUnits="userSpaceOnUse">
      <path d="M1 0v4" stroke="#323a43" stroke-opacity=".32"/>
    </pattern>
    <g id="kq-screw">
      <circle r="4" fill="url(#kq-chrome)" stroke="#444b54" stroke-width=".75"/>
      <path d="M-2 0h4M0-2v4" stroke="#414850" stroke-width=".9"/>
    </g>
    <g id="kq-hub">
      <circle r="23" fill="#51565b" fill-opacity=".38" stroke="#a0a7ad" stroke-opacity=".7"/>
      <path d="M0-19v-4m-19 23h-4m36 17 3 3" stroke="#e1e6eb" stroke-width="2.5" stroke-linecap="round"/>
      <circle r="16" fill="url(#kq-chrome)" stroke="#d9e0e8"/>
      <circle r="10" fill="#252a30" stroke="#596471"/>
      <path d="M0-10v5M8.66-5 4.33-2.5M8.66 5 4.33 2.5M0 10V5M-8.66 5-4.33 2.5M-8.66-5-4.33-2.5" fill="none" stroke="#d6dde5" stroke-width="3"/>
    </g>
  </defs>
  <rect x="3" y="3" width="314" height="194" rx="9" fill="url(#kq-shell)" stroke="#7b8794" stroke-width="1.5"/>
  <rect x="6.5" y="6.5" width="307" height="187" rx="6" fill="none" stroke="#edf3fa" stroke-opacity=".67"/>
  <path d="M12 19h296M12 181h43m210 0h43M12 23v151m296-151v151" fill="none" stroke="#596571" stroke-opacity=".55"/>
  <path d="M23 28h274v19H23z" fill="url(#kq-grip)" stroke="#adb7c2" stroke-opacity=".65"/>
  <path d="M28 35h47m171 0h47M28 40h31m202 0h31" stroke="#f1f5fa" stroke-opacity=".6"/>
  <circle cx="83" cy="105" r="41" fill="#30363e" fill-opacity=".21" stroke="#68727d"/>
  <circle cx="237" cy="105" r="41" fill="#30363e" fill-opacity=".21" stroke="#68727d"/>
  <path d="M83 70h154a35 35 0 0 1 0 70H83a35 35 0 0 1 0-70Z" fill="#252a31" fill-opacity=".31" stroke="#a9b4c0"/>
  <circle cx="83" cy="105" r="31" fill="#373737" fill-opacity=".85" stroke="#727578"/>
  <circle cx="83" cy="105" r="27" fill="none" stroke="#17191c" stroke-opacity=".7"/>
  <circle cx="237" cy="105" r="26" fill="#363636" fill-opacity=".86" stroke="#74777b"/>
  <circle cx="237" cy="105" r="22" fill="none" stroke="#17191c" stroke-opacity=".7"/>
  <g transform="translate(83 105)"><g class="kq-cassette-hub"><use href="#kq-hub"/></g></g>
  <g transform="translate(237 105)"><g class="kq-cassette-hub"><use href="#kq-hub"/></g></g>
  <rect x="119" y="89" width="82" height="32" rx="5" fill="url(#kq-shell)" stroke="#c3ccd6" stroke-opacity=".75"/>
  <path d="M128 98h64m-54 0v7m11-7v5m11-5v10m11-10v5m11-5v7" fill="none" stroke="#e3eaf2" stroke-opacity=".68"/>
  <path d="M49 115 36 163l40 20h168l40-20-14-48" fill="none" stroke="#302f2d" stroke-width="2" stroke-opacity=".75"/>
  <circle cx="37" cy="163" r="7" fill="url(#kq-chrome)" stroke="#68737e"/>
  <circle cx="283" cy="163" r="7" fill="url(#kq-chrome)" stroke="#68737e"/>
  <path d="M65 194l13-42h164l13 42z" fill="url(#kq-shell)" stroke="#85919e" stroke-width="1.5"/>
  <path d="M69 191l12-36h158l12 36" fill="none" stroke="#f1f5fa" stroke-opacity=".57"/>
  <path d="M120 195v-16h80v16" fill="#20252a" fill-opacity=".88" stroke="#697581"/>
  <path d="M145 195v-12h30v12" fill="#b5bdc7" stroke="#515a65"/>
  <path d="M146 188h28" stroke="#ede8de" stroke-width="2"/>
  <path d="M88 194v-11h16v11m112 0v-11h16v11" fill="#252a30" stroke="#8995a2"/>
  <use href="#kq-screw" x="14" y="14"/><use href="#kq-screw" x="306" y="14"/>
  <use href="#kq-screw" x="14" y="186"/><use href="#kq-screw" x="306" y="186"/>
  <use href="#kq-screw" x="160" y="164"/>
</svg>` +
      '<button type="button" id="kq-p-prev" aria-label="Предыдущий трек" disabled>⟨</button>' +
      '<button type="button" id="kq-p-play" aria-label="Воспроизвести или приостановить" disabled>▶</button>' +
      '<button type="button" id="kq-p-next" aria-label="Следующий трек" disabled>⟩</button>' +
      '<span id="kq-p-title">Нет треков</span>' +
      '<input id="kq-p-seek" aria-label="Позиция воспроизведения" type="range" min="0" max="1000" value="0" disabled>' +
      '<input id="kq-p-vol" aria-label="Громкость" type="range" min="0" max="1" step="0.01" value="0.8" disabled>' +
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
      var titleElement = document.getElementById("kq-p-title");
      titleElement.textContent = "Нет треков";
      titleElement.removeAttribute("title");
      document.getElementById("kq-p-play").textContent = "▶";
      document.getElementById("kq-p-seek").value = "0";
    }
  }

  function title() {
    var t = document.getElementById("kq-p-title");
    t.textContent = empty() ? "Нет треков" : ((list[idx] && list[idx].title) || "трек");
    t.title = t.textContent;
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
    saveState(!audio.paused);
  }

  function bind() {
    audio = document.getElementById("kq-p-audio");
    audio.volume = Number(document.getElementById("kq-p-vol").value);
    var player = document.getElementById("kq-player");
    var playButton = document.getElementById("kq-p-play");
    ["playing", "pause", "waiting", "ended", "emptied"].forEach(function (eventName) {
      audio.addEventListener(eventName, function () {
        player.classList.toggle("playing", eventName === "playing" && !audio.paused);
        playButton.textContent = audio.paused || audio.ended ? "▶" : "❚❚";
      });
    });
    playButton.onclick = async function () {
      if (!armed) return;
      if (!audio.src) { await playAt(idx); return; }
      if (audio.paused) {
        try { await audio.play(); } catch (e) {}
      } else {
        audio.pause();
      }
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
    function place(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||host.classList.contains("kq-docked"))return;
      var v=viewport(),w=host.offsetWidth,h=host.offsetHeight;
      x=Math.max(v.x+8,Math.min(v.x+Math.max(8,v.w-w-8),x));
      y=Math.max(v.y+8,Math.min(v.y+Math.max(8,v.h-h-8),y));
      host.style.left=x+"px";host.style.top=y+"px";host.style.right="auto";host.style.bottom="auto";host.style.transform="none";
      return {x:x,y:y};
    }
    function fit() {
      if (host.classList.contains("kq-docked")) return;
      if (position) {
        place(position.x, position.y);
        return;
      }
      var v = viewport();
      place(v.x + (v.w - host.offsetWidth) / 2, v.y + v.h - host.offsetHeight - 8);
    }
    function reset(){position=null;try{localStorage.removeItem("kq-player-pos");}catch(ignore){}["left","top","right","bottom","transform"].forEach(function(p){host.style.removeProperty(p);});requestAnimationFrame(fit);}
    host.kqFitPosition=fit;host.kqResetPosition=reset;
    try {var saved=JSON.parse(localStorage.getItem("kq-player-pos")||"null");if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))position=saved;}catch(ignore){}
    drag.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();});
    drag.addEventListener("keydown",function(e){var steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
      if(e.key==="Home"){e.preventDefault();reset();return;}var step=steps[e.key];if(!step)return;e.preventDefault();var r=host.getBoundingClientRect();position=place(r.left+step[0],r.top+step[1])||position; if(position)persist();
    });
    drag.addEventListener("pointerdown",function(e){
      if(active || (e.button!=null&&e.button!==0)||host.classList.contains("kq-docked"))return;
      e.preventDefault();e.stopPropagation();var r=host.getBoundingClientRect();active={id:e.pointerId,x:e.clientX-r.left,y:e.clientY-r.top};
      try{drag.setPointerCapture(e.pointerId);}catch(ignore){}
      host.classList.add("kq-dragging");
    });
    drag.addEventListener("pointermove",function(e){if(!active||e.pointerId!==active.id)return;e.preventDefault();position=place(e.clientX-active.x,e.clientY-active.y)||position;});
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
      var authOpen = !!(doc && doc.querySelector("#auth-overlay.open"));
      var quoteOpen = !!(doc && doc.querySelector("#quote-modal.open"));
      host.classList.toggle("kq-auth-open", authOpen);
      host.classList.toggle("kq-quote-open", quoteOpen);
      if(doc && !authOpen && !quoteOpen){
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
    var current = list[idx];
    list = data || [];
    idx = current ? Math.max(0, list.findIndex(function (track) { return track.id === current.id; })) : 0;
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
      if (typeof st.vol === "number" && st.vol >= 0 && st.vol <= 1) {
        document.getElementById("kq-p-vol").value = String(st.vol);
        audio.volume = st.vol;
      }
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
    if (!host.firstChild) host.innerHTML = '<div class="kq-lib-card"><h3>моя музыка</h3>' +
      '<div class="kq-skins">' + SKINS.map(function (s) {
        return '<button type="button" data-skin="'+s+'" class="'+(skin()===s?"on":"")+'">'+s+'</button>';
      }).join("") + "</div>" +
      '<button type="button" id="kq-upload" aria-describedby="kq-upload-hint">＋ Добавить музыку</button>' +
      '<input hidden type="file" id="kq-music-file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,.mp3,.m4a,.ogg,.wav">' +
      '<p class="hint" id="kq-upload-hint">MP3, M4A, OGG, WAV, AAC · до 15 МБ</p>' +
      '<div class="kq-upload-feedback"><span id="kq-file-info"></span><span id="kq-upload-status" role="status"></span></div>' +
      '<div class="kq-lib-list"></div>' +
      '<button type="button" id="kq-p-reset">вернуть положение плеера</button> ' +
      '<button type="button" id="kq-lib-x">закрыть</button></div>';
    host.style.display = "flex";
    host.querySelector("#kq-p-reset").onclick=function(){var player=document.getElementById("kq-player");if(player.kqResetPosition)player.kqResetPosition();};
    host.querySelector("#kq-lib-x").onclick = function () { host.style.display = "none"; };
    host.querySelectorAll("[data-skin]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.skin === skin()));
      b.onclick = function () {
        setSkin(b.dataset.skin);
        host.querySelectorAll(".kq-skins button").forEach(function (option) {
          option.classList.toggle("on", option === b);
          option.setAttribute("aria-pressed", String(option === b));
        });
      };
    });
    renderLibrary(host);
    var picker = host.querySelector("#kq-music-file");
    var upload = host.querySelector("#kq-upload");
    upload.onclick = function () { if (!libraryBusy) picker.click(); };
    picker.onchange = uploadTrack;
  }

  function renderLibrary(host) {
    var box = host.querySelector(".kq-lib-list");
    box.replaceChildren();
    if (!list.length) {
      box.innerHTML = "<p class='hint'>Нет треков</p>";
    }
    list.forEach(function (t, i) {
      var row = document.createElement("div");
      row.className = "kq-lib-row";
      row.innerHTML = "<span></span><button type='button'>▶</button><button type='button'>имя</button><button type='button'>удалить</button>";
      row.querySelector("span").textContent = t.title;
      row.children[1].onclick = function () { playAt(i); };
      var input = document.createElement("input");
        input.setAttribute("aria-label", "Название трека");
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
  }

  async function uploadTrack() {
    if (libraryBusy) return;
    var f = this.files && this.files[0];
    if (!f) return;
    var status = document.getElementById("kq-upload-status");
    var info = document.getElementById("kq-file-info");
    info.textContent = f.name + " · " + new Intl.NumberFormat("ru").format(f.size) + " Б";
    if (!f.size || f.size > MAX || !OK.test(f.name)) {
      status.textContent = !f.size || f.size > MAX ? "Нужен непустой файл до 15 МБ." : "Выбери файл MP3, M4A, OGG, WAV или AAC.";
      this.value = "";
      return;
    }
    status.textContent = "Загрузка…";
    var button = document.getElementById("kq-upload");
    button.disabled = true;
    libraryBusy = true;
    var input = this;
    input.disabled = true;
    var fileUploaded = false;
    try {
      var id = await uid(true);
      if (!id) throw new Error("Для загрузки нужен вход");
      var path = id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + f.name.replace(/[^\w.-]+/g, "_");
      var up = await sb().storage.from("user-audio").upload(path, f, { contentType: f.type || "audio/mpeg", upsert: false });
      if (up.error) throw up.error;
      fileUploaded = true;
      var saved = await sb().from("tracks").insert({ user_id: id, title: f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "трек", path: path, bytes: f.size }).select("id").single();
      if (saved.error) throw saved.error;
      if (!saved.data || !saved.data.id) throw new Error("Запись трека не подтверждена");
      status.textContent = "Трек добавлен";
      await loadTracks();
      renderLibrary(document.getElementById("kq-music-lib"));
    } catch (error) {
      status.textContent = (fileUploaded ? "Файл загружен, но сохранение в библиотеке не подтверждено. Обнови библиотеку перед повторной загрузкой. " : "Не удалось загрузить трек. ") + (error.message || "ошибка соединения");
    } finally {
      button.disabled = false;
      input.disabled = false;
      input.value = "";
      libraryBusy = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    bar(); bind();
    await loadTracks();
    await resume();
  });
})();
