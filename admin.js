(function () {
  var OWNER = "4923abc5-5c86-48c2-904b-a267c2e21703";
  var sb = window.__kinqsy_sb;
  var me = { ok: false, role: null, permissions: [] };
  var section = "overview";
  var selected = null;

  var NAV = [
    ["overview", "Обзор", null],
    ["reports", "Жалобы", "reports.read"],
    ["feedback", "Обратная связь", "feedback.read"],
    ["quotes", "Цитаты", "quotes.read"],
    ["users", "Пользователи", "users.read"],
    ["content", "Контент", "content.delete"],
    ["team", "Команда", "staff.manage"],
    ["audit", "Журнал", "audit.read"],
    ["settings", "Настройки", "settings.read"]
  ];

  function can(p) {
    if (!me.ok) return false;
    if (me.role === "owner") return true;
    return me.permissions.indexOf(p) >= 0;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function setMsg(t, err) {
    var el = document.getElementById("msg");
    el.className = err ? "err" : "muted";
    el.textContent = t || "";
  }
  function ask(title, text) {
    return new Promise(function (resolve) {
      var m = document.getElementById("confirm");
      document.getElementById("c-title").textContent = title;
      document.getElementById("c-text").textContent = text;
      m.classList.add("open");
      document.getElementById("c-yes").onclick = function () { m.classList.remove("open"); resolve(true); };
      document.getElementById("c-no").onclick = function () { m.classList.remove("open"); resolve(false); };
    });
  }

  async function boot() {
    var session = await sb.auth.getSession();
    var user = session.data && session.data.session && session.data.session.user;
    if (!user) {
      document.getElementById("gate").style.display = "block";
      document.getElementById("app").style.display = "none";
      return;
    }
    var who = await sb.rpc("admin_whoami");
    if (who.error) {
      setMsg("Кабинет ещё не подключён. Примени миграцию 20261015_admin_cabinet.sql. " + who.error.message, true);
      me = { ok: String(user.id) === OWNER, role: String(user.id) === OWNER ? "owner" : null, permissions: [] };
    } else {
      me = who.data || { ok: false };
    }
    if (!me.ok) {
      document.getElementById("gate").style.display = "block";
      document.getElementById("gate").textContent = "Нет доступа к кабинету.";
      document.getElementById("app").style.display = "none";
      return;
    }
    document.getElementById("gate").style.display = "none";
    document.getElementById("app").style.display = "grid";
    document.getElementById("role").textContent = me.role || "";
    renderNav();
    await open("overview");
  }

  function renderNav() {
    var nav = document.getElementById("nav");
    nav.innerHTML = "";
    NAV.forEach(function (item) {
      if (item[2] && !can(item[2])) return;
      var b = document.createElement("button");
      b.className = "nav-btn" + (section === item[0] ? " active" : "");
      b.textContent = item[1];
      b.onclick = function () { open(item[0]); };
      nav.appendChild(b);
    });
  }

  async function open(name) {
    section = name;
    selected = null;
    renderNav();
    var box = document.getElementById("work");
    box.innerHTML = '<div class="muted">загрузка…</div>';
    try {
      if (name === "overview") await overview(box);
      else if (name === "reports") await reports(box);
      else if (name === "feedback") await feedback(box, ["idea", "bug", "other"]);
      else if (name === "quotes") await feedback(box, ["quote"]);
      else if (name === "users") await users(box);
      else if (name === "content") await content(box);
      else if (name === "team") await team(box);
      else if (name === "audit") await audit(box);
      else if (name === "settings") await settings(box);
    } catch (e) {
      box.innerHTML = '<div class="err">' + esc(e.message || e) + '</div>';
    }
  }

  async function overview(box) {
    var reportsN = "—", ideasN = "—", quotesN = "—";
    if (can("reports.read")) {
      var r = await sb.from("gossip_reports").select("id", { count: "exact", head: true }).eq("status", "new");
      reportsN = r.error ? "—" : (r.count || 0);
    }
    if (can("feedback.read")) {
      var f = await sb.from("admin_feedback").select("id", { count: "exact", head: true }).eq("status", "new").neq("kind", "quote");
      ideasN = f.error ? "—" : (f.count || 0);
    }
    if (can("quotes.read")) {
      var q = await sb.from("admin_feedback").select("id", { count: "exact", head: true }).eq("status", "new").eq("kind", "quote");
      quotesN = q.error ? "—" : (q.count || 0);
    }
    var auditHtml = "";
    if (can("audit.read")) {
      var a = await sb.from("admin_audit").select("action,target,created_at").order("created_at", { ascending: false }).limit(8);
      auditHtml = (a.data || []).map(function (x) {
        return '<div class="row"><span>' + esc(x.action) + ' · ' + esc(x.target || "") + '</span><span class="muted">' + esc(x.created_at || "") + '</span></div>';
      }).join("") || '<div class="empty">журнал пуст</div>';
    }
    box.innerHTML =
      '<div class="queue">' +
      '<div class="glass">новые жалобы: ' + reportsN + '</div>' +
      '<div class="glass">обращения: ' + ideasN + '</div>' +
      '<div class="glass">цитаты: ' + quotesN + '</div>' +
      '</div><h3>последние действия</h3>' + auditHtml;
  }

  async function reports(box) {
    var res = await sb.from("gossip_reports").select("*").order("created_at", { ascending: false }).limit(100);
    if (res.error) throw res.error;
    var rows = res.data || [];
    box.innerHTML = '<div class="filters"><input id="q" placeholder="поиск"><select id="st"><option value="">все статусы</option><option>new</option><option>in_progress</option><option>escalated</option><option>resolved</option><option>rejected</option></select></div><div id="list" class="queue"></div><div id="detail" class="detail"></div>';
    function draw() {
      var q = document.getElementById("q").value.toLowerCase();
      var st = document.getElementById("st").value;
      var list = rows.filter(function (x) {
        return (!st || x.status === st) && (!q || String(x.reason || "").toLowerCase().indexOf(q) >= 0 || String(x.note || "").toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById("list").innerHTML = list.map(function (x) {
        return '<button class="row" data-id="' + esc(x.id) + '"><span>' + esc(x.reason) + ' · ' + esc(x.target_type || "post") + '</span><span class="status">' + esc(x.status || "new") + '</span></button>';
      }).join("") || '<div class="empty">очередь пуста</div>';
      document.querySelectorAll("#list [data-id]").forEach(function (el) {
        el.onclick = function () { showReport(el.getAttribute("data-id"), rows); };
      });
    }
    document.getElementById("q").oninput = draw;
    document.getElementById("st").onchange = draw;
    draw();
  }

  async function showReport(id, rows) {
    var item = rows.filter(function (x) { return x.id === id; })[0];
    var ctx = await sb.rpc("report_context", { p_id: id });
    var c = ctx.data || {};
    document.getElementById("detail").innerHTML =
      '<div class="glass"><div class="muted">' + esc(item.id) + '</div>' +
      '<p>' + esc(item.reason) + ' · ' + esc(item.created_at) + '</p>' +
      '<p>' + esc(item.note || "без пояснения") + '</p>' +
      '<p>контекст: ' + esc(c.title || "") + '<br>' + esc(c.excerpt || "") + '</p>' +
      '<p class="muted">автор не раскрывается для anon/alias</p>' +
      '<select id="rs"><option>new</option><option>in_progress</option><option>escalated</option><option>resolved</option><option>rejected</option></select>' +
      '<textarea id="rn" placeholder="внутренняя заметка">' + esc(item.staff_note || "") + '</textarea>' +
      '<button id="rsave">сохранить</button></div>';
    document.getElementById("rs").value = item.status || "new";
    document.getElementById("rsave").onclick = async function () {
      var r = await sb.rpc("report_set", {
        p_id: id,
        p_status: document.getElementById("rs").value,
        p_note: document.getElementById("rn").value,
        p_assignee: null
      });
      setMsg(r.error ? r.error.message : "сохранено", !!r.error);
      if (!r.error) open("reports");
    };
  }

  async function feedback(box, kinds) {
    var res = await sb.from("admin_feedback").select("*").in("kind", kinds).order("created_at", { ascending: false }).limit(100);
    if (res.error) throw res.error;
    var rows = res.data || [];
    box.innerHTML = '<div class="filters"><input id="q" placeholder="поиск"><select id="st"><option value="">все</option><option>new</option><option>review</option><option>accepted</option><option>rejected</option><option>published</option></select></div><div id="list" class="queue"></div><div id="detail" class="detail"></div>';
    function draw() {
      var q = document.getElementById("q").value.toLowerCase();
      var st = document.getElementById("st").value;
      var list = rows.filter(function (x) {
        return (!st || x.status === st) && (!q || String(x.text || "").toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById("list").innerHTML = list.map(function (x) {
        return '<button class="row" data-id="' + esc(x.id) + '"><span>' + esc(x.kind) + ' · ' + esc((x.text || "").slice(0, 80)) + '</span><span class="status">' + esc(x.status) + '</span></button>';
      }).join("") || '<div class="empty">пусто</div>';
      document.querySelectorAll("#list [data-id]").forEach(function (el) {
        el.onclick = function () {
          var item = rows.filter(function (x) { return x.id === el.getAttribute("data-id"); })[0];
          document.getElementById("detail").innerHTML =
            '<div class="glass"><p>' + esc(item.text) + '</p>' +
            '<p class="muted">автор: ' + esc(item.author || "не указан") + ' · источник: ' + esc(item.source || "не указан") + '</p>' +
            '<p class="muted">' + esc(item.url || "") + '</p>' +
            '<select id="fs"><option>new</option><option>review</option><option>accepted</option><option>rejected</option><option>published</option></select>' +
            '<textarea id="fn">' + esc(item.note || "") + '</textarea><button id="fsave">сохранить</button></div>';
          document.getElementById("fs").value = item.status;
          document.getElementById("fsave").onclick = async function () {
            var r = await sb.rpc("feedback_set", { p_id: item.id, p_status: document.getElementById("fs").value, p_note: document.getElementById("fn").value });
            setMsg(r.error ? r.error.message : "сохранено", !!r.error);
            if (!r.error) open(section);
          };
        };
      });
    }
    document.getElementById("q").oninput = draw;
    document.getElementById("st").onchange = draw;
    draw();
  }

  async function users(box) {
    box.innerHTML = '<div class="filters"><input id="uq" placeholder="имя"><button id="us">найти</button></div><div id="list" class="queue"></div>';
    async function run() {
      var r = await sb.rpc("users_lookup", { p_q: document.getElementById("uq").value });
      if (r.error) { document.getElementById("list").innerHTML = '<div class="err">' + esc(r.error.message) + '</div>'; return; }
      document.getElementById("list").innerHTML = (r.data || []).map(function (x) {
        return '<div class="row"><span>' + esc(x.display_name || "без имени") + '</span><span class="muted">' + esc(x.id) + '</span></div>';
      }).join("") || '<div class="empty">ничего</div>';
    }
    document.getElementById("us").onclick = run;
    run();
  }

  async function content(box) {
    box.innerHTML = '<div class="glass"><p>Удаление поста по id. Только при разрешении content.delete. Приватные сообщения отсюда не открываются.</p><input id="pid" placeholder="id поста"><button id="del">удалить</button></div>';
    document.getElementById("del").onclick = async function () {
      if (!(await ask("Удалить пост?", "Это действие запишется в журнал и не отменяется из кабинета."))) return;
      var r = await sb.rpc("content_delete_post", { p_id: Number(document.getElementById("pid").value) });
      setMsg(r.error ? r.error.message : "удалено", !!r.error);
    };
  }

  async function team(box) {
    if (!can("staff.manage")) { box.innerHTML = '<div class="empty">нет доступа</div>'; return; }
    var res = await sb.from("staff_members").select("user_id,role,status").order("created_at", { ascending: false });
    box.innerHTML = '<div class="glass"><input id="uid" placeholder="uuid сотрудника"><select id="role"><option>admin</option><option>moderator</option><option>curator</option></select><button id="add">назначить</button></div><div id="list" class="queue"></div>';
    document.getElementById("list").innerHTML = (res.data || []).map(function (x) {
      return '<div class="row"><span>' + esc(x.role) + ' · ' + esc(x.status) + '<br><span class="muted">' + esc(x.user_id) + '</span></span><button data-id="' + esc(x.user_id) + '">отозвать</button></div>';
    }).join("") || '<div class="empty">сотрудников нет</div>';
    document.getElementById("add").onclick = async function () {
      var r = await sb.rpc("staff_assign", { p_user: document.getElementById("uid").value, p_role: document.getElementById("role").value });
      setMsg(r.error ? r.error.message : "назначено", !!r.error);
      if (!r.error) open("team");
    };
    document.querySelectorAll("#list button[data-id]").forEach(function (b) {
      b.onclick = async function () {
        if (!(await ask("Отозвать доступ?", "Сотрудник потеряет кабинет."))) return;
        var r = await sb.rpc("staff_revoke", { p_user: b.getAttribute("data-id") });
        setMsg(r.error ? r.error.message : "отозвано", !!r.error);
        if (!r.error) open("team");
      };
    });
  }

  async function audit(box) {
    var r = await sb.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(80);
    if (r.error) throw r.error;
    box.innerHTML = (r.data || []).map(function (x) {
      return '<div class="row"><span>' + esc(x.action) + ' · ' + esc(x.target || "") + '</span><span class="muted">' + esc(x.created_at) + '</span></div>';
    }).join("") || '<div class="empty">журнал пуст</div>';
  }

  async function settings(box) {
    box.innerHTML = '<div class="glass"><p>Роль владельца зафиксирована сервером. Сотрудники не могут назначить себя владельцем.</p><p class="muted">Скрытие и удаление контента доступны только при отдельных разрешениях. Личные сообщения из кабинета не открываются.</p></div>';
  }

  document.getElementById("logout").onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
  boot();
})();
