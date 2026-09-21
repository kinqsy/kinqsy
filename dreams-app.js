(function () {
  var SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
  var SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";
  var sb = window.__kinqsy_sb || (window.__kinqsy_sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, storageKey: "kinqsy-auth" }
  }));
  var OWNER_ID = "4923abc5-5c86-48c2-904b-a267c2e21703";
  var OWNER_SLUG = "kinqsy";
  var viewedUserId = null;
  var editingPostId = null;
  var pendingDeletePostId = null;
  var pendingDeleteComment = null;

  function escapeHtml(t) {
    return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function getU() {
    if (window.Kinqsy) return Kinqsy.getU();
    var u = new URLSearchParams(location.search).get("u");
    return (u && u.trim()) ? u.trim() : OWNER_SLUG;
  }
  async function currentUserId() {
    var res = await sb.auth.getSession();
    return res.data && res.data.session ? res.data.session.user.id : null;
  }
  function formatAuthor(name, userId) {
    if (userId && String(userId) === OWNER_ID) {
      return '<span class="author-badge">kinqsy</span>';
    }
    return escapeHtml(name || "гость");
  }

  async function resolveViewed() {
    var slug = getU();
    var el = document.getElementById("dreams-user-label");
    if (el) el.textContent = "dreams · @" + slug;
    if (window.Kinqsy) Kinqsy.fixMenu();
    var res = await sb.from("profiles").select("id").ilike("display_name", slug).maybeSingle();
    if (!res.data && slug.toLowerCase() === OWNER_SLUG) {
      res = await sb.from("profiles").select("id").eq("id", OWNER_ID).maybeSingle();
    }
    viewedUserId = res.data ? res.data.id : (slug.toLowerCase() === OWNER_SLUG ? OWNER_ID : null);
    return viewedUserId;
  }

  async function loadComments(postId) {
    var { data } = await sb.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    return data || [];
  }
  async function loadReactions(postId) {
    try {
      var { data } = await sb.from("reactions").select("reaction").eq("post_id", postId);
      var heart = 0, broken = 0;
      (data || []).forEach(function (r) {
        if (r.reaction === "heart") heart++;
        if (r.reaction === "broken") broken++;
      });
      return { heart: heart, broken: broken };
    } catch (e) {
      return { heart: 0, broken: 0 };
    }
  }
  function reactionsHtml(c, id) {
    return '<div class="reactions" data-id="' + id + '">' +
      '<button type="button" class="react-btn" data-reaction="heart">' +
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg> ' +
      c.heart + "</button>" +
      '<button type="button" class="react-btn" data-reaction="broken">' +
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-6.7-4.2-9.3-8.2C.7 9.7 2.2 6 5.5 6c1.8 0 3.1 1 3.9 2.1L12 12l.5-1.2C13.3 9.7 14.6 6 17.3 6c3.3 0 4.8 3.7 2.8 6.8C18.7 16.8 12 21 12 21zM12 12l-2 5 2-1 2 1-2-5z"/></svg> ' +
      c.broken + "</button></div>";
  }

  async function canEditPost(post) {
    var uid = await currentUserId();
    if (!uid) return false;
    if (post.user_id && String(post.user_id) === String(uid)) return true;
    if (String(uid) === String(OWNER_ID)) return true;
    return false;
  }

  function openEdit(post) {
    editingPostId = post.id;
    document.getElementById("edit-title").value = post.title || "";
    document.getElementById("edit-content").value = post.content || "";
    document.getElementById("edit-media-url").value = post.media_url || "";
    if (post.title_font) document.getElementById("edit-title-font").value = post.title_font;
    if (post.body_font) document.getElementById("edit-body-font").value = post.body_font;
    if (post.title_color) document.getElementById("edit-title-color").value = post.title_color;
    if (post.body_color) document.getElementById("edit-body-color").value = post.body_color;
    document.getElementById("edit-title-size").value = post.title_size || 29;
    document.getElementById("edit-body-size").value = post.body_size || 17;
    document.getElementById("edit-error").textContent = "";
    updateEditPreview();
    document.getElementById("edit-overlay").classList.add("open");
  }

  function updateComposePreview() {
    var t = document.getElementById("compose-live-title");
    var b = document.getElementById("compose-live-body");
    t.textContent = document.getElementById("compose-title").value || "заголовок…";
    b.textContent = document.getElementById("compose-content").value || "текст…";
    t.style.fontFamily = document.getElementById("compose-title-font").value;
    t.style.color = document.getElementById("compose-title-color").value;
    b.style.fontFamily = document.getElementById("compose-body-font").value;
    b.style.color = document.getElementById("compose-body-color").value;
    t.style.fontSize = (document.getElementById("compose-title-size").value || 29) + "px";
    b.style.fontSize = (document.getElementById("compose-body-size").value || 17) + "px";
  }
  function updateEditPreview() {
    var t = document.getElementById("edit-live-title");
    var b = document.getElementById("edit-live-body");
    t.textContent = document.getElementById("edit-title").value || "заголовок…";
    b.textContent = document.getElementById("edit-content").value || "текст…";
    t.style.fontFamily = document.getElementById("edit-title-font").value;
    t.style.color = document.getElementById("edit-title-color").value;
    b.style.fontFamily = document.getElementById("edit-body-font").value;
    b.style.color = document.getElementById("edit-body-color").value;
    t.style.fontSize = (document.getElementById("edit-title-size").value || 29) + "px";
    b.style.fontSize = (document.getElementById("edit-body-size").value || 17) + "px";
  }

  ["compose-title", "compose-content", "compose-title-font", "compose-body-font", "compose-title-color", "compose-body-color", "compose-title-size", "compose-body-size"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateComposePreview);
      el.addEventListener("change", updateComposePreview);
    }
  });
  ["edit-title", "edit-content", "edit-title-font", "edit-body-font", "edit-title-color", "edit-body-color", "edit-title-size", "edit-body-size"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateEditPreview);
      el.addEventListener("change", updateEditPreview);
    }
  });

  document.getElementById("compose-media-url").oninput = function () {
    var u = this.value.trim();
    var img = document.getElementById("compose-preview");
    if (u) { img.style.display = "block"; img.src = u; }
    else { img.style.display = "none"; }
  };
  document.getElementById("compose-media-file").onchange = async function () {
    var file = this.files && this.files[0];
    if (!file) return;
    var uid = await currentUserId();
    if (!uid) {
      document.getElementById("compose-error").textContent = "нужен вход";
      return;
    }
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    var path = uid + "/" + Date.now() + "." + ext;
    var up = await sb.storage.from("media").upload(path, file, { upsert: true });
    if (up.error) {
      if (file.size < 1.2 * 1024 * 1024) {
        var reader = new FileReader();
        reader.onload = function () {
          document.getElementById("compose-media-url").value = reader.result;
          var img = document.getElementById("compose-preview");
          img.style.display = "block";
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      } else {
        document.getElementById("compose-error").textContent = up.error.message;
      }
      return;
    }
    var pub = sb.storage.from("media").getPublicUrl(path);
    document.getElementById("compose-media-url").value = pub.data.publicUrl;
    var img = document.getElementById("compose-preview");
    img.style.display = "block";
    img.src = pub.data.publicUrl;
  };

  async function makePost(post) {
    var article = document.createElement("article");
    article.className = "post";
    article.id = "post-" + post.id;

    var titleStyle = "font-family:" + escapeHtml(post.title_font || "Georgia, serif") +
      ";color:" + escapeHtml(post.title_color || "#1a0f14") +
      ";font-size:" + (post.title_size || 29) + "px";
    var bodyStyle = "font-family:" + escapeHtml(post.body_font || "Georgia, serif") +
      ";color:" + escapeHtml(post.body_color || "#1a0f14") +
      ";font-size:" + (post.body_size || 17) + "px";

    var media = post.media_url
      ? '<div class="post-media ratio-landscape"><img src="' + escapeHtml(post.media_url) + '" alt="" loading="lazy"></div>'
      : "";
    var comments = await loadComments(post.id);
    var rcounts = await loadReactions(post.id);
    var can = await canEditPost(post);

    var commentsHtml = comments.map(function (c) {
      return '<div class="comment" data-cid="' + c.id + '">' +
        '<div class="comment-meta">' + formatAuthor(c.author_name, c.user_id) +
        " · " + new Date(c.created_at).toLocaleDateString("en-GB") + "</div>" +
        '<div class="comment-body">' + escapeHtml(c.content) + "</div>" +
        (can ? '<button type="button" class="c-del" data-cid="' + c.id + '">удалить</button>' : "") +
        "</div>";
    }).join("");

    article.innerHTML =
      '<div class="post-date">' + new Date(post.created_at).toLocaleDateString("en-GB") + "</div>" +
      (post.title ? '<h2 class="post-title" style="' + titleStyle + '">' + escapeHtml(post.title) + "</h2>" : "") +
      media +
      (post.content ? '<div class="post-content" style="' + bodyStyle + '">' + escapeHtml(post.content) + "</div>" : "") +
      reactionsHtml(rcounts, post.id) +
      '<div class="post-footer">comments · ' + comments.length + '</div>' +
      (can ? '<div class="post-footer-row"><button type="button" class="post-owner-btn" aria-label="меню">⋯</button></div>' : "") +
      '<div class="comments">' + commentsHtml +
      '<form class="comment-form"><textarea name="content" placeholder="оставить комментарий" maxlength="500" required></textarea>' +
      '<button type="submit">отправить</button></form></div>';

    var menuBtn = article.querySelector(".post-owner-btn");
    if (menuBtn) {
      menuBtn.onclick = function (e) {
        e.stopPropagation();
        var menu = document.getElementById("post-menu");
        window.__menuPost = post;
        menu.classList.add("open");
        var r = menuBtn.getBoundingClientRect();
        menu.style.left = Math.min(r.left, window.innerWidth - 160) + "px";
        menu.style.top = (r.bottom + 4) + "px";
      };
    }

    article.querySelectorAll(".react-btn").forEach(function (btn) {
      btn.onclick = async function () {
        var uid = await currentUserId();
        if (!uid) {
          if (window.Kinqsy) Kinqsy.openAuth("login");
          return;
        }
        var reaction = btn.getAttribute("data-reaction");
        await sb.from("reactions").delete().eq("post_id", post.id).eq("user_id", uid);
        var { error } = await sb.from("reactions").insert({ post_id: post.id, user_id: uid, reaction: reaction });
        if (error) alert(error.message);
        else loadDreams();
      };
    });

    article.querySelectorAll(".c-del").forEach(function (btn) {
      btn.onclick = function () {
        pendingDeleteComment = { id: btn.getAttribute("data-cid"), postId: post.id };
        document.getElementById("del-c-modal").classList.add("open");
      };
    });

    var form = article.querySelector(".comment-form");
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var content = form.querySelector('[name="content"]').value.trim();
      if (!content) return;
      var uid = await currentUserId();
      if (!uid) {
        if (window.Kinqsy) Kinqsy.openAuth("login");
        return;
      }
      var author_name = "user";
      var pr = await sb.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      if (pr.data && pr.data.display_name) author_name = pr.data.display_name;
      var { error } = await sb.from("comments").insert({
        post_id: post.id,
        author_name: author_name,
        content: content,
        user_id: uid
      });
      if (error) alert(error.message);
      else loadDreams();
    });


    var mediaBox = article.querySelector(".post-media");
    var mediaImg = article.querySelector(".post-media img");
    if (mediaImg && mediaBox) {
      function applyRatio() {
        var w = mediaImg.naturalWidth || 1;
        var h = mediaImg.naturalHeight || 1;
        var r = w / h;
        mediaBox.classList.remove("ratio-square", "ratio-landscape", "ratio-portrait");
        if (r > 1.15) mediaBox.classList.add("ratio-landscape");
        else if (r < 0.85) mediaBox.classList.add("ratio-portrait"); // вертикаль → квадрат
        else mediaBox.classList.add("ratio-square");
      }
      if (mediaImg.complete && mediaImg.naturalWidth) applyRatio();
      else mediaImg.onload = applyRatio;
    }

    return article;
  }

  async function loadDreams() {
    var feed = document.getElementById("feed");
    feed.innerHTML = '<div class="empty">loading...</div>';
    if (window.Kinqsy) Kinqsy.hideGate();
    var uid = await resolveViewed();
    if (!uid) {
      feed.innerHTML = '<div class="empty">профиль не найден</div>';
      return;
    }
    if (window.Kinqsy && Kinqsy.checkAccess) {
      var acc = await Kinqsy.checkAccess("dreams", uid);
      if (!acc.ok) {
        feed.innerHTML = "";
        Kinqsy.showGate({
          mode: acc.guest ? "guest" : "friends",
          guest: acc.guest,
          page: "dreams"
        });
        return;
      }
    }
    var { data, error } = await sb.from("posts").select("*").eq("category", "dreams").eq("user_id", uid).order("created_at", { ascending: false });
    if (error || !data || !data.length) {
      if (getU().toLowerCase() === OWNER_SLUG) {
        var all = await sb.from("posts").select("*").eq("category", "dreams").order("created_at", { ascending: false });
        data = (all.data || []).filter(function (p) {
          return !p.user_id || String(p.user_id) === String(uid);
        });
      }
    }
    if (!data || !data.length) {
      feed.innerHTML = '<div class="empty">пока нет снов — ★ написать</div>';
      return;
    }
    feed.innerHTML = "";
    for (var i = 0; i < data.length; i++) {
      feed.appendChild(await makePost(data[i]));
    }
  }

  document.getElementById("compose-close").onclick = function () {
    document.getElementById("compose-overlay").classList.remove("open");
  };
  document.getElementById("compose-publish").onclick = async function () {
    var err = document.getElementById("compose-error");
    err.textContent = "";
    var uid = await currentUserId();
    if (!uid) { err.textContent = "нужен вход"; return; }
    var title = document.getElementById("compose-title").value.trim();
    var content = document.getElementById("compose-content").value.trim();
    if (!title && !content) { err.textContent = "пустой пост"; return; }
    var media_url = document.getElementById("compose-media-url").value.trim();
    var payload = {
      title: title,
      content: content,
      category: "dreams",
      user_id: uid,
      title_font: document.getElementById("compose-title-font").value,
      body_font: document.getElementById("compose-body-font").value,
      title_color: document.getElementById("compose-title-color").value,
      body_color: document.getElementById("compose-body-color").value,
      title_size: Number(document.getElementById("compose-title-size").value || 29),
      body_size: Number(document.getElementById("compose-body-size").value || 17)
    };
    if (media_url) {
      payload.media_url = media_url;
      payload.media_type = /\.gif(\?|$)/i.test(media_url) ? "gif" : "image";
    }
    var { error } = await sb.from("posts").insert(payload);
    if (error) {
      var basic = { title: title, content: content, category: "dreams", user_id: uid };
      if (media_url) basic.media_url = media_url;
      var r2 = await sb.from("posts").insert(basic);
      if (r2.error) { err.textContent = r2.error.message; return; }
    }
    document.getElementById("compose-overlay").classList.remove("open");
    loadDreams();
  };

  document.getElementById("edit-close").onclick = function () {
    document.getElementById("edit-overlay").classList.remove("open");
    editingPostId = null;
  };
  document.getElementById("edit-save").onclick = async function () {
    var err = document.getElementById("edit-error");
    err.textContent = "";
    if (!editingPostId) return;
    var uid = await currentUserId();
    if (!uid) { err.textContent = "войди через ★"; return; }
    var payload = {
      title: document.getElementById("edit-title").value.trim(),
      content: document.getElementById("edit-content").value.trim(),
      title_font: document.getElementById("edit-title-font").value,
      body_font: document.getElementById("edit-body-font").value,
      title_color: document.getElementById("edit-title-color").value,
      body_color: document.getElementById("edit-body-color").value,
      title_size: Number(document.getElementById("edit-title-size").value || 29),
      body_size: Number(document.getElementById("edit-body-size").value || 17)
    };
    var mu = document.getElementById("edit-media-url").value.trim();
    if (mu) {
      payload.media_url = mu;
      payload.media_type = /\.gif(\?|$)/i.test(mu) ? "gif" : "image";
    }
    var res = await sb.from("posts").update(payload).eq("id", editingPostId).select("id");
    if (res.error || !res.data || !res.data.length) {
      var basic = { title: payload.title, content: payload.content };
      if (mu) basic.media_url = mu;
      var r2 = await sb.from("posts").update(basic).eq("id", editingPostId).select("id");
      if (r2.error) { err.textContent = r2.error.message; return; }
      if (!r2.data || !r2.data.length) {
        err.textContent = "не сохранилось (RLS / чужой пост)";
        return;
      }
    }
    document.getElementById("edit-overlay").classList.remove("open");
    editingPostId = null;
    loadDreams();
  };

  document.getElementById("post-menu-edit").onclick = function () {
    document.getElementById("post-menu").classList.remove("open");
    if (window.__menuPost) openEdit(window.__menuPost);
  };
  document.getElementById("post-menu-delete").onclick = function () {
    document.getElementById("post-menu").classList.remove("open");
    if (!window.__menuPost) return;
    pendingDeletePostId = window.__menuPost.id;
    document.getElementById("del-post-modal").classList.add("open");
  };
  document.addEventListener("click", function (e) {
    var menu = document.getElementById("post-menu");
    if (!menu.classList.contains("open")) return;
    if (e.target.closest("#post-menu") || e.target.closest(".post-owner-btn")) return;
    menu.classList.remove("open");
  });

  document.getElementById("del-post-no").onclick = function () {
    document.getElementById("del-post-modal").classList.remove("open");
    pendingDeletePostId = null;
  };
  document.getElementById("del-post-yes").onclick = async function () {
    if (!pendingDeletePostId) return;
    var { error } = await sb.from("posts").delete().eq("id", pendingDeletePostId);
    document.getElementById("del-post-modal").classList.remove("open");
    pendingDeletePostId = null;
    if (error) alert(error.message);
    else loadDreams();
  };

  document.getElementById("del-c-no").onclick = function () {
    document.getElementById("del-c-modal").classList.remove("open");
    pendingDeleteComment = null;
  };
  document.getElementById("del-c-yes").onclick = function () {
    document.getElementById("del-c-modal").classList.remove("open");
    document.getElementById("reason-error").textContent = "";
    document.querySelectorAll('input[name="reason"]').forEach(function (r) { r.checked = false; });
    document.getElementById("rules-detail").style.display = "none";
    document.getElementById("reason-other-box").style.display = "none";
    document.getElementById("reason-other-text").value = "";
    document.getElementById("del-reason-modal").classList.add("open");
  };

  document.querySelectorAll('input[name="reason"]').forEach(function (r) {
    r.onchange = function () {
      document.getElementById("rules-detail").style.display =
        r.value === "rules" && r.checked ? "block" : "none";
      document.getElementById("reason-other-box").style.display =
        r.value === "other" && r.checked ? "block" : "none";
    };
  });

  document.getElementById("reason-cancel").onclick = function () {
    document.getElementById("del-reason-modal").classList.remove("open");
    pendingDeleteComment = null;
  };

  document.getElementById("reason-submit").onclick = async function () {
    var err = document.getElementById("reason-error");
    err.textContent = "";
    var chosen = document.querySelector('input[name="reason"]:checked');
    if (!chosen) {
      err.textContent = "выбери причину";
      return;
    }
    if (chosen.value === "other") {
      var note = document.getElementById("reason-other-text").value.trim();
      if (!note) {
        err.textContent = "для «другая причина» нужен комментарий";
        return;
      }
    }
    if (!pendingDeleteComment) {
      err.textContent = "комментарий не выбран";
      return;
    }
    var cid = pendingDeleteComment.id;
    var del = await sb.from("comments").delete().eq("id", cid).select("id");
    if (del.error) {
      err.textContent = del.error.message;
      return;
    }
    if (!del.data || !del.data.length) {
      var del2 = await sb.from("comments").delete().eq("id", Number(cid)).select("id");
      if (del2.error) {
        err.textContent = del2.error.message;
        return;
      }
      if (!del2.data || !del2.data.length) {
        err.textContent = "не удалилось — проверь RLS на comments (delete для автора поста)";
        return;
      }
    }
    document.getElementById("del-reason-modal").classList.remove("open");
    pendingDeleteComment = null;
    loadDreams();
  };

  window.__openDreamCompose = function () {
    document.getElementById("compose-error").textContent = "";
    document.getElementById("compose-overlay").classList.add("open");
    updateComposePreview();
  };

  if (window.Kinqsy) {
    Kinqsy.init({
      onLoginSuccess: async function () {
        await loadDreams();
      },
      onStarLoggedIn: async function (uid) {
        if (viewedUserId && String(viewedUserId) !== String(uid)) {
          alert("Чужой дневник. Свой: dreams.html?u=ТВОЙ_НИК");
          return;
        }
        window.__openDreamCompose();
      }
    });
  }

  loadDreams();
})();
