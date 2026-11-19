(function () {
  var OWNER = "4923abc5-5c86-48c2-904b-a267c2e21703";
  var sb = window.__kinqsy_sb;
  var me = { ok: false, role: null, permissions: [] };
  var section = "overview";
  var selected = null;
  var reportFilter = "active";
  var REPORT_STATUS = { new: "Новая", in_progress: "В работе", escalated: "Передана старшему", resolved: "Рассмотрена", rejected: "Отклонена" };

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
    if (who.error || !who.data || !who.data.ok) {
      document.getElementById("gate").style.display = "block";
      document.getElementById("gate").textContent = who.error
        ? "Кабинет не подключён или нет доступа. " + who.error.message
        : "Нет доступа к кабинету.";
      document.getElementById("app").style.display = "none";
      return;
    }
    me = who.data;
    document.getElementById("gate").style.display = "none";
    document.getElementById("app").style.display = "grid";
    document.getElementById("role").textContent = me.role || "";
    renderNav();
    await open("overview");
  }

  function renderNav() {
    var nav = document.getElementById("nav");
    nav.innerHTML = "";
    var refresh = document.createElement("button");
    refresh.className = "nav-btn"; refresh.textContent = "Обновить";
    refresh.onclick = function () { open(section); };
    nav.appendChild(refresh);
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
    var assigned = "—";
    if (can("reports.read")) {
      var mine = await sb.from("gossip_reports").select("id", { count: "exact", head: true }).eq("assignee_id", (await sb.auth.getUser()).data.user.id);
      assigned = mine.error ? "—" : (mine.count || 0);
    }
    box.innerHTML =
      '<div class="queue">' +
      '<div class="glass">новые жалобы: ' + reportsN + '</div>' +
      '<div class="glass">обращения: ' + ideasN + '</div>' +
      '<div class="glass">цитаты: ' + quotesN + '</div>' +
      '<div class="glass">мои задачи: ' + assigned + '</div>' +
      '</div><h3>последние действия</h3>' + auditHtml;
  }

  async function reports(box) {
    var query = sb.from("gossip_reports").select("*");
    if (reportFilter === "active") query = query.in("status", ["new", "in_progress", "escalated"]);
    else if (reportFilter === "closed") query = query.in("status", ["resolved", "rejected"]);
    else if (reportFilter !== "all") query = query.eq("status", reportFilter);
    var res = await query.order("created_at", { ascending: false }).limit(100);
    if (res.error) throw res.error;
    var rows = res.data || [];
    box.innerHTML = '<div class="filters"><input id="q" placeholder="поиск"><select id="st"><option value="active">Незавершённые</option><option value="closed">Рассмотренные</option><option value="all">Все статусы</option><option value="new">Новые</option><option value="in_progress">В работе</option><option value="escalated">Переданные старшему</option><option value="resolved">Рассмотрены</option><option value="rejected">Отклонены</option></select></div><div id="list" class="queue"></div><div id="detail" class="detail"></div>';
    document.getElementById("st").value = reportFilter;
    function draw() {
      var q = document.getElementById("q").value.toLowerCase();
      var list = rows.filter(function (x) {
        return (!q || String(x.reason || "").toLowerCase().indexOf(q) >= 0 || String(x.note || "").toLowerCase().indexOf(q) >= 0);
      });
      document.getElementById("list").innerHTML = list.map(function (x) {
        return '<button class="row" data-id="' + esc(x.id) + '"><span>' + esc(x.reason) + ' · ' + esc(x.target_type || "post") + '</span><span class="status">' + esc(REPORT_STATUS[x.status] || x.status || "Новая") + '</span></button>';
      }).join("") || '<div class="empty">очередь пуста</div>';
      document.querySelectorAll("#list [data-id]").forEach(function (el) {
        el.onclick = function () { showReport(el.getAttribute("data-id"), rows); };
      });
    }
    document.getElementById("q").oninput = draw;
    document.getElementById("st").onchange = function () { reportFilter = this.value; open("reports"); };
    draw();
  }

  async function showReport(id, rows) {
    var item = rows.filter(function (x) { return x.id === id; })[0];
    var ctx = await sb.rpc("report_context", { p_id: id });
    if (ctx.error) { setMsg(ctx.error.message || "Не удалось загрузить контекст жалобы", true); return; }
    var c = ctx.data || {};
    document.getElementById("detail").innerHTML =
      '<div class="glass"><div class="muted">' + esc(item.id) + '</div>' +
      '<p>' + esc(item.reason) + ' · ' + esc(item.created_at) + '</p>' +
      '<p>' + esc(item.note || "без пояснения") + '</p>' +
      '<p>пост: ' + esc(item.post_id) + ' · ' + esc(c.category || "недоступен") + '</p>' +
      '<p>контекст: ' + esc(c.title || "") + '<br>' + esc(c.excerpt || "") + '</p>' +
      '<p class="muted">автор не раскрывается для anon/alias</p>' +
      '<select id="rs"><option value="new">Новая</option><option value="in_progress">В работе</option><option value="escalated">Передана старшему</option><option value="resolved">Рассмотрена</option><option value="rejected">Отклонена</option></select>' +
      '<input id="ra" placeholder="uuid ответственного, можно пусто">' +
      '<textarea id="rn" placeholder="внутренняя заметка">' + esc(item.staff_note || "") + '</textarea>' +
      '<button id="rsave">сохранить</button> <button id="rreject">Отклонить жалобу</button><p class="muted">Тестовую, случайную или неподтверждённую жалобу можно отклонить. Сам пост при этом не удаляется.</p></div>';
    document.getElementById("rs").value = item.status || "new";
    var saving = false;
    async function saveReport(status) {
      if (saving) return;
      saving = true;
      var save = document.getElementById("rsave"), reject = document.getElementById("rreject");
      save.disabled = reject.disabled = true;
      try {
        var note = document.getElementById("rn").value;
        if (status === "rejected" && !note.trim()) note = "Нарушение не подтверждено / тестовая или случайная жалоба";
        var r = await sb.rpc("report_set", {
          p_id: id, p_status: status, p_note: note,
          p_assignee: document.getElementById("ra").value || null
        });
        if (r.error) throw r.error;
        setMsg(status === "rejected" ? "Жалоба отклонена. Пост сохранён." : "сохранено", false);
        await open("reports");
      } catch (error) {
        setMsg(error.message || "Не удалось изменить жалобу", true);
      } finally {
        saving = false; save.disabled = reject.disabled = false;
      }
    }
    document.getElementById("rsave").onclick = function () { return saveReport(document.getElementById("rs").value); };
    document.getElementById("rreject").onclick = function () { return saveReport("rejected"); };
  }

  async function feedback(box, kinds) {
    var res = await sb.from("admin_feedback").select("*").in("kind", kinds).order("created_at", { ascending: false }).limit(100);
    if (res.error) throw res.error;
    var rows = res.data || [];
    box.innerHTML = '<div class="filters"><input id="q" placeholder="поиск"><select id="st"><option value="">все</option><option value="new">Новая</option><option value="review">На рассмотрении</option><option value="accepted">Принята</option><option value="rejected">Отклонена</option><option value="published">Опубликована</option></select></div><div id="list" class="queue"></div><div id="detail" class="detail"></div>';
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
            '<textarea id="fn">' + esc(item.note || "") + '</textarea><button id="fsave">сохранить</button>' +
            (item.kind === "quote" ? '<p class="muted">«Принята» — одобрена, но ещё не видна на Home. «Опубликована» — текст и имя автора доступны в подборке Home. Автор предложения и внутренние заметки не публикуются.</p><button id="fpublish">Опубликовать на Home</button> <button id="funpublish">Снять с Home</button>' : '') + '</div>';
          document.getElementById("fs").value = item.status;
          var saving = false;
          async function updateFeedback(status) {
            if (saving) return;
            saving = true;
            var buttons = ["fsave", "fpublish", "funpublish"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
            var disabledBefore = buttons.map(function (button) { return button.disabled; });
            buttons.forEach(function (button) { button.disabled = true; });
            try {
              if (item.kind === "quote" && status === "published" &&
                  !(await ask("Опубликовать цитату на Home?", "Текст цитаты и указанное имя автора станут доступны посетителям сайта."))) return;
              var result = await sb.rpc("feedback_set", { p_id: item.id, p_status: status, p_note: document.getElementById("fn").value });
              if (result.error) throw result.error;
              setMsg(status === "published" ? "Цитата опубликована. Home обновляет подборку в течение минуты." : "Статус сохранён", false);
              await open(section);
            } catch (error) {
              setMsg(error.message || "Не удалось сохранить статус", true);
            } finally {
              saving = false;
              buttons.forEach(function (button, i) { button.disabled = disabledBefore[i]; });
            }
          }
          document.getElementById("fsave").onclick = function () { return updateFeedback(document.getElementById("fs").value); };
          if (item.kind === "quote") {
            document.getElementById("fpublish").onclick = function () { return updateFeedback("published"); };
            document.getElementById("funpublish").onclick = function () { return updateFeedback("accepted"); };
            document.getElementById("funpublish").disabled = item.status !== "published";
          }
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
    box.innerHTML = '<div class="glass"><p>Удаление поста по id. Только при разрешении content.delete. Приватные сообщения отсюда не открываются.</p><input id="pid" placeholder="id поста"><label for="delete-reason">Причина удаления (5–1000 символов)</label><textarea id="delete-reason" maxlength="1000" placeholder="Какое правило нарушено"></textarea><button id="del">удалить</button></div>';
    var button = document.getElementById("del");
    button.onclick = async function () {
      if (button.disabled) return;
      var rawId = document.getElementById("pid").value.trim();
      var reason = document.getElementById("delete-reason").value.trim();
      if (!/^[1-9][0-9]*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
        setMsg("Укажи корректный положительный id поста", true); return;
      }
      var reasonLength = Array.from(reason).length;
      if (reasonLength < 5 || reasonLength > 1000) {
        setMsg("Укажи причину удаления: от 5 до 1000 символов", true); return;
      }
      button.disabled = true;
      try {
        if (!(await ask("Удалить пост?", "Пост " + rawId + ". Причина: " + reason + ". Действие запишется в журнал и не отменяется из кабинета."))) return;
        var r = await sb.rpc("content_delete_post", { p_id: Number(rawId), p_reason: reason });
        if (r.error) throw r.error;
        setMsg("удалено", false);
      } catch (error) {
        setMsg(error.message || "Не удалось удалить. Проверь соединение и журнал перед повторной попыткой.", true);
      } finally {
        button.disabled = false;
      }
    };
  }

  async function team(box) {
    if (!can("staff.manage")) { box.innerHTML = '<div class="empty">нет доступа</div>'; return; }
    var perms = ["reports.read","reports.update","reports.escalate","feedback.read","feedback.update","quotes.read","quotes.update","users.read","content.hide","content.delete","staff.manage","staff.manage_moderators","audit.read","settings.read"];
    var res = await sb.from("staff_members").select("user_id,role,status,created_at").order("created_at", { ascending: false });
    var sp = await sb.from("staff_permissions").select("user_id,permission");
    var by = {};
    (sp.data || []).forEach(function (x) { (by[x.user_id] = by[x.user_id] || []).push(x.permission); });
    box.innerHTML = '<div class="glass"><input id="uname" placeholder="имя существующего аккаунта"><button id="find">найти</button><div id="found" class="queue"></div><select id="role"><option>admin</option><option>moderator</option><option>curator</option></select><button id="add">назначить выбранного</button></div><div id="list" class="queue"></div>';
    var picked = null;
    document.getElementById("find").onclick = async function () {
      var r = await sb.rpc("users_lookup", { p_q: document.getElementById("uname").value });
      if (r.error) { document.getElementById("found").innerHTML = '<div class="err">' + esc(r.error.message) + '</div>'; return; }
      document.getElementById("found").innerHTML = (r.data || []).map(function (x) {
        return '<button class="row" data-id="' + esc(x.id) + '" data-name="' + esc(x.display_name || "") + '"><span>' + esc(x.display_name || "без имени") + '</span><span class="muted">выбрать</span></button>';
      }).join("") || '<div class="empty">аккаунт не найден</div>';
      document.querySelectorAll("#found [data-id]").forEach(function (el) {
        el.onclick = function () {
          picked = { id: el.getAttribute("data-id"), name: el.getAttribute("data-name") };
          setMsg("выбран " + picked.name);
        };
      });
    };
    document.getElementById("add").onclick = async function () {
      if (!picked) { setMsg("сначала найди существующий аккаунт", true); return; }
      if (!(await ask("Назначить " + picked.name + "?", "Роль и базовые разрешения сохранятся на сервере."))) return;
      var r = await sb.rpc("staff_assign", { p_user: picked.id, p_role: document.getElementById("role").value });
      setMsg(r.error ? r.error.message : "назначено", !!r.error);
      if (!r.error) open("team");
    };
    document.getElementById("list").innerHTML = (res.data || []).map(function (x) {
      var have = by[x.user_id] || [];
      var toggles = perms.map(function (p) {
        return '<label class="muted"><input type="checkbox" data-user="' + esc(x.user_id) + '" data-perm="' + esc(p) + '"' + (have.indexOf(p) >= 0 ? " checked" : "") + '> ' + esc(p) + '</label>';
      }).join(" ");
      return '<div class="glass"><div class="row"><span>' + esc(x.role) + ' · ' + esc(x.status) + '<br><span class="muted">' + esc(x.user_id) + '</span></span><button data-id="' + esc(x.user_id) + '">отозвать</button></div><div>' + toggles + '</div></div>';
    }).join("") || '<div class="empty">сотрудников нет</div>';
    document.querySelectorAll("#list button[data-id]").forEach(function (b) {
      b.onclick = async function () {
        if (!(await ask("Отозвать доступ?", "Сотрудник потеряет кабинет сразу, не только кнопку."))) return;
        var r = await sb.rpc("staff_revoke", { p_user: b.getAttribute("data-id") });
        setMsg(r.error ? r.error.message : "отозвано", !!r.error);
        if (!r.error) open("team");
      };
    });
    document.querySelectorAll("#list input[data-perm]").forEach(function (c) {
      c.onchange = async function () {
        var r = await sb.rpc("staff_set_perm", { p_user: c.getAttribute("data-user"), p_perm: c.getAttribute("data-perm"), p_on: c.checked });
        setMsg(r.error ? r.error.message : "разрешение обновлено", !!r.error);
      };
    });
  }

  async function audit(box) {
    var r = await sb.from("admin_audit").select("*").order("created_at", { ascending: false }).limit(80);
    if (r.error) throw r.error;
    box.innerHTML = (r.data || []).map(function (x) {
      return '<div class="row"><span>' + esc(x.action === "report.set" ? "Жалоба" : x.action) + ' · ' + esc(x.target || "") + (x.action === "report.set" && x.detail && typeof x.detail.status === "string" ? ' · ' + esc(REPORT_STATUS[x.detail.status] || x.detail.status) : '') + (x.detail && typeof x.detail.reason === "string" ? ' · ' + esc(x.detail.reason) : '') + '</span><span class="muted">' + esc(x.created_at) + '</span></div>';
    }).join("") || '<div class="empty">журнал пуст</div>';
  }

  async function settings(box) {
    box.innerHTML = '<div class="glass"><p>Роль владельца зафиксирована сервером. Сотрудники не могут назначить себя владельцем.</p><p class="muted">Скрытие и удаление контента доступны только при отдельных разрешениях. Личные сообщения из кабинета не открываются.</p></div>';
  }

  document.getElementById("logout").onclick = function () { sb.auth.signOut().then(function () { location.reload(); }); };
  boot();
})();


