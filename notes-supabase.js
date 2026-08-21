const SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
const SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadComments(postId) {
    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }
    return data || [];
}

function renderComments(comments) {
    if (!comments.length) {
        return '<div class="comment-meta">пока нет комментариев</div>';
    }

    return comments.map(function (c) {
        return (
            '<div class="comment">' +
                '<div class="comment-meta">' +
                    escapeHtml(c.author_name) +
                    " · " +
                    new Date(c.created_at).toLocaleDateString("en-GB") +
                "</div>" +
                "<div>" + escapeHtml(c.content) + "</div>" +
            "</div>"
        );
    }).join("");
}

async function submitComment(postId, formEl, listEl) {
    const nameInput = formEl.querySelector('[name="author_name"]');
    const textInput = formEl.querySelector('[name="content"]');
    const btn = formEl.querySelector("button");

    const author_name = nameInput.value.trim();
    const content = textInput.value.trim();

    if (!author_name || !content) {
        alert("Напиши имя и комментарий");
        return;
    }

    btn.disabled = true;

    const { error } = await supabaseClient.from("comments").insert({
        post_id: postId,
        author_name: author_name,
        content: content
    });

    btn.disabled = false;

    if (error) {
        alert("Ошибка: " + error.message);
        return;
    }

    textInput.value = "";
    const comments = await loadComments(postId);
    listEl.innerHTML = renderComments(comments);
}

async function loadComments(postId) {
    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }
    return data || [];
}

function renderComments(comments) {
    if (!comments.length) {
        return '<div class="comment-meta">пока нет комментариев</div>';
    }

    return comments.map(function (c) {
        return (
            '<div class="comment">' +
                '<div class="comment-meta">' +
                    escapeHtml(c.author_name) +
                    " · " +
                    new Date(c.created_at).toLocaleDateString("en-GB") +
                "</div>" +
                "<div>" + escapeHtml(c.content) + "</div>" +
            "</div>"
        );
    }).join("");
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadNotes() {
    const feed = document.getElementById("feed");
    if (!feed) return;

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

    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="empty">no notes yet.</div>';
        return;
    }

    feed.innerHTML = "";

    for (const post of data) {
        const article = document.createElement("article");
        article.className = "post";
        article.dataset.postId = post.id;

        let mediaHtml = "";
        if (post.media_url) {
            mediaHtml = '<div class="post-media"><img src="' + post.media_url + '" alt=""></div>';
        }

        const comments = await loadComments(post.id);

        article.innerHTML =
            '<div class="post-date">' +
                new Date(post.created_at).toLocaleDateString("en-GB") +
            '</div>' +
            '<h2 class="post-title">' + (post.title || "") + '</h2>' +
            mediaHtml +
            '<div class="post-content">' + (post.content || "") + '</div>' +
            '<div class="post-footer">comments · ' + comments.length + '</div>' +
            '<div class="comments">' +
                '<div class="comments-list">' + renderComments(comments) + '</div>' +
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

            const { error } = await supabaseClient.from("comments").insert({
                post_id: post.id,
                author_name: author_name,
                content: content
            });

            submitBtn.disabled = false;

            if (error) {
                alert("Ошибка: " + error.message);
                return;
            }

            textInput.value = "";
            const comments = await loadComments(post.id);
            list.innerHTML = renderComments(comments);
            footer.textContent = "comments · " + comments.length;
        });

        feed.appendChild(article);
    }
}

async function loadComments(postId) {
    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }
    return data || [];
}

function renderComments(comments) {
    if (!comments.length) {
        return '<div class="comment-meta">пока нет комментариев</div>';
    }

    return comments.map(function (c) {
        return (
            '<div class="comment">' +
                '<div class="comment-meta">' +
                    escapeHtml(c.author_name) +
                    " · " +
                    new Date(c.created_at).toLocaleDateString("en-GB") +
                "</div>" +
                "<div>" + escapeHtml(c.content) + "</div>" +
            "</div>"
        );
    }).join("");
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function loadNotes() {
    const feed = document.getElementById("feed");
    if (!feed) return;

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

    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="empty">no notes yet.</div>';
        return;
    }

    feed.innerHTML = "";

    for (const post of data) {
        const article = document.createElement("article");
        article.className = "post";

        let mediaHtml = "";
        if (post.media_url) {
            mediaHtml = '<div class="post-media"><img src="' + post.media_url + '" alt=""></div>';
        }

        const comments = await loadComments(post.id);

        article.innerHTML =
            '<div class="post-date">' +
                new Date(post.created_at).toLocaleDateString("en-GB") +
            '</div>' +
            '<h2 class="post-title">' + (post.title || "") + '</h2>' +
            mediaHtml +
            '<div class="post-content">' + (post.content || "") + '</div>' +
            '<div class="post-footer">comments · ' + comments.length + '</div>' +
            '<div class="comments">' +
                '<div class="comments-list">' + renderComments(comments) + '</div>' +
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

            const { error } = await supabaseClient.from("comments").insert({
                post_id: post.id,
                author_name: author_name,
                content: content
            });

            submitBtn.disabled = false;

            if (error) {
                alert("Ошибка: " + error.message);
                return;
            }

            textInput.value = "";
            const comments = await loadComments(post.id);
            list.innerHTML = renderComments(comments);
            footer.textContent = "comments · " + comments.length;
        });

        feed.appendChild(article);
    }
}

async function loadComments(postId) {
    const { data, error } = await supabaseClient
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }
    return data || [];
}

function renderComments(comments) {
    if (!comments.length) {
        return '<div class="comment-meta">пока нет комментариев</div>';
    }

    return comments.map(function (c) {
        return (
            '<div class="comment">' +
                '<div class="comment-meta">' +
                    escapeHtml(c.author_name) +
                    " · " +
                    new Date(c.created_at).toLocaleDateString("en-GB") +
                "</div>" +
                "<div>" + escapeHtml(c.content) + "</div>" +
            "</div>"
        );
    }).join("");
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

loadNotes();
