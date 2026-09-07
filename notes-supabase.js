const SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co"; const SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw"; const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
const OWNER_ID = "4923abc5-5c86-48c2-904b-a267c2e21703";

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
function reactionsHtml(counts, kind, id) { return ( '<div class="reactions" data-kind="' + kind + '" data-id="' + id + '">' + '<button type="button" class="react-btn" data-reaction="heart">❤️ ' + counts.heart + '</button>' + '<button type="button" class="react-btn" data-reaction="broken">💔 ' + counts.broken + '</button>' + '</div>' ); }
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
        '<h2 class="post-title">' + escapeHtml(post.title || "") + '</h2>' +
        mediaHtml +
        '<div class="post-content">' + escapeHtml(post.content || "") + '</div>' +
        reactionsHtml(postCounts, "post", post.id) +
        '<div class="post-footer-row">' +
    '<div class="post-footer">comments · ' + comments.length + '</div>' +
    '<button type="button" class="post-owner-btn" aria-label="menu">⋯</button>' +
'</div>' +
        '<div class="comments">' +
            '<div class="comments-list">' + commentsHtml + '</div>' +
            '<form class="comment-form">' +
                '<input name="author_name" type="text" placeholder="имя" maxlength="40" required>' +
                '<textarea name="content" placeholder="комментарий" maxlength="500" required></textarea>' +
                '<button type="submit">отправить</button>' +
            '</form>' +
        '</div>';

    const form = article.querySelector(".comment-form");
    const list = article.querySelector(".comments-list");
    const footer = article.querySelector(".post-footer");

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const nameInput = form.querySelector('[name="author_name"]');
        const textInput = form.querySelector('[name="content"]');
        const author_name = nameInput.value.trim();
        const content = textInput.value.trim();
        const submitBtn = form.querySelector("button");

        if (!author_name || !content) {
            alert("Напиши имя и комментарий");
            return;
        }

        submitBtn.disabled = true;

        const { data: { session } } = await supabaseClient.auth.getSession();
const { error } = await supabaseClient.from("comments").insert({
    post_id: post.id,
    author_name: author_name,
    content: content,
    user_id: session ? session.user.id : null
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
async function loadNotes() { const feed = document.getElementById("feed"); if (!feed) return;
feed.innerHTML = '<div class="empty">loading...</div>';

const { data, error } = await supabaseClient
    .from("posts")
    .select("*")
    .eq("category", "notes")
    .order("created_at", { ascending: false });

if (error) {
    feed.innerHTML = '<div class="empty">Supabase error: ' + error.message + '</div>';
    console.error(error);
    return;
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
async function canEditPost(post) { var { data: { session } } = await supabaseClient.auth.getSession(); if (!session) return false; if (post.user_id && String(post.user_id) === String(session.user.id)) return true; if (typeof OWNER_ID !== "undefined" && String(session.user.id) === String(OWNER_ID)) return true; return false; }
function hidePostMenu() { var menu = document.getElementById("post-menu"); if (menu) menu.classList.remove("open"); activePostMenu = null; }
function showPostMenuNearFooter(article, post) { var menu = document.getElementById("post-menu"); 
        function showPostMenuNearFooter(article, post) { var menu = document.getElementById("post-menu"); var footer = article.querySelector(".post-footer-row")  article.querySelector(".post-footer"); if (!menu  !footer) return;
activePostMenu = post;
menu.classList.add("open");

var rect = footer.getBoundingClientRect();
var menuW = 160;
var left = rect.right - menuW;
var top = rect.top;
if (left < 8) left = 8;
if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
if (top + 90 > window.innerHeight) top = Math.max(8, rect.bottom - 90);

menu.style.left = left + "px";
menu.style.top = top + "px";
}
function bindPostOwnerActions(article, post) { var btn = article.querySelector(".post-owner-btn"); if (!btn) return;
canEditPost(post).then(function (ok) {
    if (ok) btn.classList.add("show");
});

btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (activePostMenu && String(activePostMenu.id) === String(post.id)) {
        hidePostMenu();
        return;
    }
    showPostMenuNearFooter(article, post);
});
}
    
document.addEventListener("click", function (e) { var menu = document.getElementById("post-menu"); if (menu && menu.classList.contains("open") && !e.target.closest("#post-menu") && !e.target.closest(".post")) { hidePostMenu(); } });
var delBtn = document.getElementById("post-menu-delete");
var editBtn = document.getElementById("post-menu-edit");

if (delBtn) {
    delBtn.onclick = async function () {
        if (!activePostMenu) return;
        if (!confirm("Удалить пост?")) return;
        var { error } = await supabaseClient.from("posts").delete().eq("id", activePostMenu.id);
        hidePostMenu();
        if (error) { alert(error.message); return; }
        loadNotes();
    };
}

if (editBtn) {
    editBtn.onclick = async function () {
        if (!activePostMenu) return;
        var post = activePostMenu;
        hidePostMenu();
        var title = prompt("Заголовок", post.title || "");
        if (title === null) return;
        var content = prompt("Текст", post.content || "");
        if (content === null) return;
        var { error } = await supabaseClient.from("posts").update({
            title: title,
            content: content
        }).eq("id", post.id);
        if (error) { alert(error.message); return; }
        loadNotes();
    };
}

loadNotes();
setupFilters();
