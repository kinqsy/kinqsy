(function () {
  document.documentElement.classList.add("kq-wait");
  if (document.getElementById("kq-boot-style")) return;
  var s = document.createElement("style");
  s.id = "kq-boot-style";
  s.textContent = [
    "html.kq-wait body{overflow:hidden}",
    "html.kq-wait main,html.kq-wait #feed,html.kq-wait .about-page,html.kq-wait .notes-page,html.kq-wait .home-wrap{visibility:hidden!important}",
    "#kq-boot-loader{display:none;position:fixed;inset:0;z-index:9998;align-items:center;justify-content:center;background:rgba(26,15,20,.45);backdrop-filter:blur(18px)}",
    "html.kq-wait #kq-boot-loader{display:flex}",
    "#kq-boot-loader span{width:36px;height:36px;border-radius:50%;border:2px solid rgba(240,201,214,.25);border-top-color:#f0c9d6;animation:kqspin .8s linear infinite}",
    "@keyframes kqspin{to{transform:rotate(360deg)}}"
  ].join("");
  (document.head || document.documentElement).appendChild(s);
  function mount() {
    if (document.getElementById("kq-boot-loader")) return;
    var d = document.createElement("div");
    d.id = "kq-boot-loader";
    d.innerHTML = "<span></span>";
    document.body.appendChild(d);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
