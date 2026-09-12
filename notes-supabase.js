const SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co"; const SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw"; const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
const OWNER_ID = "4923abc5-5c86-48c2-904b-a267c2e21703";

const OWNER_SLUG = "kinqsy";
function getU() {
    var u = new URLSearchParams(location.search).get("u");
    return (u && u.trim()) ? u.trim() : OWNER_SLUG;
}
function menuUrl(page) {
    return page + "?u=" + encodeURIComponent(getU());
}
function fixMenu() {
    var map = {
        "nav-home": "index.html",
        "nav-notes": "notes.html",
        "nav-dreams": "dreams.html",
        "nav-quotes": "quotes.html",
        "nav-about": "about.html"
    };
    Object.keys(map).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.href = menuUrl(map[id]);
    });
}
var viewedUserId = null;
async function resolveViewedUser() {
    fixMenu();
    var slug = getU();
    var label = document.getElementById("notes-user-label");
    if (label) label.textContent = "notes · @" + slug;
    var res = await supabaseClient.from("profiles").select("id, display_name").ilike("display_name", slug).maybeSingle();
    if (!res.data && slug.toLowerCase() === OWNER_SLUG) {
        res = await supabaseClient.from("profiles").select("id, display_name").eq("id", OWNER_ID).maybeSingle();
    }
    viewedUserId = res.data ? res.data.id : (slug.toLowerCase() === OWNER_SLUG ? OWNER_ID : null);
    return viewedUserId;
}


function formatAuthor(name, userId) {
    if (userId && String(userId) === OWNER_ID) {
        return '<span class="author-badge">✦ kinqsy</span>';
    }
    return escapeHtml(name || "гость");
}
function dayKey(dateStr) { const d = new Date(dateStr); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return y + "-" + m + "-" + day; }
async function loadComments(postId) { const { data, error } = await supabaseClient .from("comments") .select("*") .eq("post_id", postId) .order("created_at", { ascending: true });
if (error) {
    console.error(error);
    return [];
}
return data || [];
}
async function countReactions(filter) { const { data, error } = await supabaseClient .from("reactions") .select("reaction") .match(filter);
if (error) {
    console.error(error);
    return { heart: 0, broken: 0 };
}

let heart = 0;
let broken = 0;
(data || []).forEach(function (r) {
    if (r.reaction === "heart") heart += 1;
    if (r.reaction === "broken") broken += 1;
});
return { heart: heart, broken: broken };
}
async function addReaction(payload) { const { error } = await supabaseClient.from("reactions").insert(payload); if (error) { alert("Ошибка: " + error.message); return false; } return true; }
function reactionsHtml(counts, kind, id) {
  return (
    '<div class="reactions" data-kind="' + kind + '" data-id="' + id + '">' +
      '<button type="button" class="react-btn" data-reaction="heart" aria-label="heart">' +
        '<svg class="react-ico" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 21s-6.7-4.2-9.3-8.2C.7 9.7 2.2 6 5.5 6c1.8 0 3.1 1 3.9 2.1C10.2 7 11.5 6 13.3 6c3.3 0 4.8 3.7 2.8 6.8C18.7 16.8 12 21 12 21z"/></svg> ' +
        counts.heart +
      "</button>" +
      '<button type="button" class="react-btn" data-reaction="broken" aria-label="broken">' +
        '<svg class="react-ico" viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 21s-6.7-4.2-9.3-8.2C.7 9.7 2.2 6 5.5 6c1.8 0 3.1 1 3.9 2.1L12 12l.5-1.2C13.3 9.7 14.6 6 17.3 6c3.3 0 4.8 3.7 2.8 6.8C18.7 16.8 12 21 12 21zM12 12l-2 5 2-1 2 1-2-5z"/></svg> ' +
        counts.broken +
      "</button>" +
    "</div>"
  );
}
async function renderComments(comments) { if (!comments.length) { return '<div class="comment-meta">пока нет комментариев</div>'; }
const parts = [];
for (const c of comments) {
    const counts = await countReactions({ comment_id: c.id });
    parts.push(
        '<div class="comment">' +
            '<div class="comment-meta">' +
                formatAuthor(c.author_name, c.user_id) +
                " · " +
                new Date(c.created_at).toLocaleDateString("en-GB") +
            "</div>" +
            "<div>" + escapeHtml(c.content) + "</div>" +
            '<div class="comment-reactions">' +
                reactionsHtml(counts, "comment", c.id) +
            "</div>" +
        "</div>"
    );
}
return parts.join("");
}
function reactionKey(kind, id) { return "rx:" + kind + ":" + id; }
function bindReactions(root) { root.querySelectorAll(".reactions").forEach(function (box) { const kind = box.getAttribute("data-kind"); const id = box.getAttribute("data-id"); const key = reactionKey(kind, id); const already = localStorage.getItem(key);
    box.querySelectorAll(".react-btn").forEach(function (btn) {
        if (already) {
            btn.disabled = true;
            btn.style.opacity = "0.55";
        }

        btn.onclick = async function () {
            if (localStorage.getItem(key)) {
                alert("Уже есть реакция");
                return;
            }

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                alert("Сначала войди (★)");
                return;
            }

            const reaction = btn.getAttribute("data-reaction");
            const payload = {
                reaction: reaction,
                user_id: session.user.id
            };
            if (kind === "post") payload.post_id = Number(id);
            if (kind === "comment") payload.comment_id = Number(id);

            const ok = await addReaction(payload);
            if (!ok) return;

            localStorage.setItem(key, reaction);

            const filter = kind === "post"
                ? { post_id: Number(id) }
                : { comment_id: Number(id) };

            const counts = await countReactions(filter);
            box.outerHTML = reactionsHtml(counts, kind, id);
            bindReactions(root);
        };
    });
});
}
async function renderNotes(posts) { const feed = document.getElementById("feed"); if (!feed) return;
if (!posts.length) {
    feed.innerHTML = '<div class="empty">no notes yet.</div>';
    return;
}

                                   

feed.innerHTML = "";

for (const post of posts) {
    const article = document.createElement("article");
    article.className = "post";
    article.id = "post-" + post.id;
    var bgKey = post.post_bg ? post.post_bg : "glass";
if (bgKey === "pink") article.style.background = "rgba(240, 201, 214, 0.45)";
else if (bgKey === "lilac") article.style.background = "rgba(200, 180, 220, 0.4)";
else if (bgKey === "dark") article.style.background = "rgba(30, 20, 28, 0.55)";
else if (bgKey === "cream") article.style.background = "rgba(255, 248, 240, 0.5)";
else if (bgKey === "clear") article.style.background = "rgba(255, 255, 255, 0.08)";

    let mediaHtml = "";
    if (post.media_url) {
        mediaHtml = '<div class="post-media"><img src="' + post.media_url + '" alt=""></div>';
    }

    const comments = await loadComments(post.id);
    const postCounts = await countReactions({ post_id: post.id });
    const commentsHtml = await renderComments(comments);

    article.innerHTML =
        '<div class="post-date">' +
            new Date(post.created_at).toLocaleDateString("en-GB") +
        '</div>' +
        '<h2 class="post-title" style="font-family:' + escapeHtml(post.title_font ? post.title_font : "Georgia, serif") + ';color:' + escapeHtml(post.title_color ? post.title_color : "#1a0f14") + '">' + escapeHtml(post.title || "") + '</h2>' +
    mediaHtml +
    '<div class="post-content" style="font-family:' + escapeHtml(post.body_font ? post.body_font : "Georgia, serif") + ';color:' + escapeHtml(post.body_color ? post.body_color : "#1a0f14") + '">' + escapeHtml(post.content || "") + '</div>' +
        reactionsHtml(postCounts, "post", post.id) +
        '<div class="post-footer-row">' +
    '<div class="post-footer">comments · ' + comments.length + '</div>' +
    '<button type="button" class="post-owner-btn" aria-label="menu">⋯</button>' +
'</div>' +
        '<div class="comments">' +
            '<div class="comments-list">' + commentsHtml + '</div>' +
            '<form class="comment-form">' +
                '<textarea name="content" placeholder="комментарий" maxlength="500" required></textarea>' +
                '<button type="submit">отправить</button>' +
            '</form>' +
        '</div>';

    const form = article.querySelector(".comment-form");
    const list = article.querySelector(".comments-list");
    const footer = article.querySelector(".post-footer");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const textInput = form.querySelector('[name="content"]');
        const content = textInput.value.trim();
        const submitBtn = form.querySelector("button");

        if (!content) {
            alert("Напиши комментарий");
            return;
        }

        submitBtn.disabled = true;

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            submitBtn.disabled = false;
            alert("Войди через ★ чтобы комментировать");
            return;
        }
        let author_name = "user";
        try {
            const pr = await supabaseClient.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle();
            if (pr.data && pr.data.display_name) author_name = pr.data.display_name;
        } catch (e) {}
const { error } = await supabaseClient.from("comments").insert({
    post_id: post.id,
    author_name: author_name,
    content: content,
    user_id: session.user.id
});

        submitBtn.disabled = false;

        if (error) {
            alert("Ошибка: " + error.message);
            return;
        }

        textInput.value = "";
        const fresh = await loadComments(post.id);
        list.innerHTML = await renderComments(fresh);
        footer.textContent = "comments · " + fresh.length;
        bindReactions(article);
    });

    bindReactions(article);
    article.dataset.postId = String(post.id);
article.dataset.userId = post.user_id ? String(post.user_id) : "";
bindPostOwnerActions(article, post);
    feed.appendChild(article);
}

if (location.hash) {
    var el = document.querySelector(location.hash);
    if (el) {
        setTimeout(function () {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
    }
}
}
function applyFilters() { const all = window.__allNotes || []; const qInput = document.getElementById("notes-search"); const dInput = document.getElementById("notes-date");
const q = qInput ? qInput.value.trim().toLowerCase() : "";
const day = dInput ? dInput.value : "";

let list = all;

if (day) {
    var parts = day.trim().split(".");
    var want = "";
    if (parts.length === 3) {
        want = parts[2] + "-" + parts[1].padStart(2, "0") + "-" + parts[0].padStart(2, "0");
    } else {
        want = day.trim();
    }
    list = list.filter(function (p) {
        return dayKey(p.created_at) === want;
    });
}

if (q) {
    list = list.filter(function (p) {
        const title = String(p.title || "").toLowerCase();
        const content = String(p.content || "").toLowerCase();
        return title.indexOf(q) !== -1 || content.indexOf(q) !== -1;
    });
}

renderNotes(list);
}
async function loadNotes() {
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = '<div class="empty">loading...</div>';

    const uid = await resolveViewedUser();
    if (!uid) {
        feed.innerHTML = '<div class="empty">профиль не найден</div>';
        window.__allNotes = [];
        applyFilters();
        return;
    }

    let { data, error } = await supabaseClient
        .from("posts")
        .select("*")
        .eq("category", "notes")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

    if (error) {
        feed.innerHTML = '<div class="empty">Supabase error: ' + error.message + '</div>';
        console.error(error);
        return;
    }

    // старые посты без user_id — только в дневнике kinqsy
    if ((!data || !data.length) && getU().toLowerCase() === OWNER_SLUG) {
        const all = await supabaseClient
            .from("posts")
            .select("*")
            .eq("category", "notes")
            .order("created_at", { ascending: false });
        if (!all.error) {
            data = (all.data || []).filter(function (p) {
                return !p.user_id || String(p.user_id) === String(uid);
            });
        }
    }

    window.__allNotes = data || [];
    applyFilters();
}
function setupFilters() { const qInput = document.getElementById("notes-search"); const dInput = document.getElementById("notes-date"); const clearBtn = document.getElementById("notes-date-clear");
if (qInput) qInput.addEventListener("input", applyFilters);
if (dInput) dInput.addEventListener("change", applyFilters);
if (clearBtn) {
    clearBtn.addEventListener("click", function () {
        if (dInput) dInput.value = "";
        applyFilters();
    });
}
}
var activePostMenu = null;
async function canEditPost(post) {
  var { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return false;
  var uid = String(session.user.id);
  if (post.user_id && String(post.user_id) === uid) return true;
  if (typeof OWNER_ID !== "undefined" && uid === String(OWNER_ID)) return true;
  return false;
}
function hidePostMenu() { var menu = document.getElementById("post-menu"); if (menu) menu.classList.remove("open"); activePostMenu = null; }
function showPostMenuNearFooter(article, post) { var menu = document.getElementById("post-menu"); if (!menu) return;
var footer = article.querySelector(".post-footer-row");
if (!footer) {
    footer = article.querySelector(".post-footer");
}
if (!footer) return;

activePostMenu = post;
menu.classList.add("open");

var rect = footer.getBoundingClientRect();
var menuW = 160;
var left = rect.right - menuW;
var top = rect.top;
if (left < 8) left = 8;
if (left + menuW > window.innerWidth - 8) {
    left = window.innerWidth - menuW - 8;
}
if (top + 90 > window.innerHeight) {
    top = Math.max(8, rect.bottom - 90);
}

menu.style.left = left + "px";
menu.style.top = top + "px";
}
function bindPostOwnerActions(article, post) { var btn = article.querySelector(".post-owner-btn"); if (!btn) return;
btn.addEventListener("click", async function (e) {
    e.preventDefault();
    e.stopPropagation();
    var ok = await canEditPost(post);
    if (!ok) {
        alert("Войди через ★");
        return;
    }
    if (activePostMenu && String(activePostMenu.id) === String(post.id)) {
        hidePostMenu();
        return;
    }
    showPostMenuNearFooter(article, post);
});
}

document.addEventListener("click", function (e) { var menu = document.getElementById("post-menu"); if (!menu || !menu.classList.contains("open")) return; if (e.target.closest("#post-menu")) return; if (e.target.closest(".post-owner-btn")) return; hidePostMenu(); });
var delBtn = document.getElementById("post-menu-delete"); var editBtn = document.getElementById("post-menu-edit");
if (delBtn) { delBtn.onclick = async function () { if (!activePostMenu) return; if (!confirm("Удалить пост?")) return; var { error } = await supabaseClient.from("posts").delete().eq("id", activePostMenu.id); hidePostMenu(); if (error) { alert(error.message); return; } loadNotes(); }; }
if (editBtn) {
    editBtn.onclick = function () {
        if (!activePostMenu) return;
        var post = activePostMenu;
        hidePostMenu();
        if (typeof window.openNotesEdit === "function") {
            window.openNotesEdit(post);
        }
    };
}
window.loadNotes = loadNotes;
loadNotes(); setupFilters();
