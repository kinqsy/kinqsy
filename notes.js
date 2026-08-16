alert("JS WORKS");
const url = "https://rgkfegdtxaojceknnzlr.supabase.co";
const key = "sb_publishable_uK7zrVyq8AlHpoj13pGQ6g_q3L47Akw";
const client = window.supabase.createClient(url, key);
console.log(client);
alert("SUPABASE CLIENT WORKS");
