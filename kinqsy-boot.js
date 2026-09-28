(function () {
  document.documentElement.classList.add("kq-wait");
  if (document.getElementById("kq-boot-style")) return;
  var s = document.createElement("style");
  s.id = "kq-boot-style";
  s.textContent =
    "html.kq-wait::before{content:'';position:fixed;inset:0;z-index:99999;background:rgba(26,15,20,.55);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}" +
    "html.kq-wait::after{content:'';position:fixed;left:50%;top:50%;z-index:100000;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;border:2px solid rgba(240,201,214,.3);border-top-color:#f0c9d6;animation:kqspin .7s linear infinite}" +
    "@keyframes kqspin{to{transform:rotate(360deg)}}";
  (document.head || document.documentElement).appendChild(s);
})();
