document.body.insertAdjacentHTML(
    "afterbegin",
    "<div style='position:fixed;top:50px;left:0;z-index:99999;background:red;color:white;padding:10px'>JS WORKS</div>"
);
const SUPABASE_URL = "https://rgkfegdtxaojceknnzlr.supabase.co";
const SUPABASE_KEY = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


async function loadPosts() {

    const feed = document.querySelector(".feed");

    feed.innerHTML = `
        <div class="empty">
            loading...
        </div>
    `;


    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", {
            ascending: false
        });


    if (error) {

        console.error(error);

        feed.innerHTML = `
            <div class="empty">
                couldn't load notes.
            </div>
        `;

        return;
    }


    if (!data || data.length === 0) {

        feed.innerHTML = `
            <div class="empty">
                no notes yet.
            </div>
        `;

        return;
    }


    feed.innerHTML = "";


    data.forEach(post => {

        const article = document.createElement("article");

        article.className = "post";


        const date = new Date(post.created_at);

        const formattedDate =
            date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });


        article.innerHTML = `

            <div class="post-date">
                ${formattedDate}
            </div>

            <h2 class="post-title">
                ${escapeHTML(post.title || "")}
            </h2>

            <div class="post-content">
                ${escapeHTML(post.content || "")}
            </div>

            ${
                post.media_url
                ?
                `<img
                    class="post-image"
                    src="${escapeAttribute(post.media_url)}"
                    alt=""
                    loading="lazy"
                >`
                :
                ""
            }

            <div class="post-footer">
                comments · 0
            </div>

        `;


        feed.appendChild(article);

    });

}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {

    return String(value)
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


loadPosts();
console.log("KINQSY NOTES JS LOADED");
