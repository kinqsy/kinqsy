const SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
const SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadPosts() {
    const feed = document.getElementById("feed") || document.querySelector(".feed");

    if (!feed) {
        console.error("Feed element not found");
        return;
    }

    feed.innerHTML = '<div class="empty">loading...</div>';

    const { data, error } = await supabase
        .from("posts")
        .select("*")
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

    data.forEach(function (post) {
        const article = document.createElement("article");
        article.className = "post";

        article.innerHTML =
            '<div class="post-date">' +
                new Date(post.created_at).toLocaleDateString("en-GB") +
            '</div>' +
            '<h2 class="post-title">' +
                (post.title || "") +
            '</h2>' +
            '<div class="post-content">' +
                (post.content || "") +
            '</div>' +
            '<div class="post-footer">' +
                'comments · 0' +
            '</div>';

        feed.appendChild(article);
    });
}

loadPosts();
