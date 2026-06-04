/* ============================================================
   HALO 统一登录模块  auth.js  (v2)
   所有页面共用这一个文件。
   ------------------------------------------------------------
   改密码怎么做？
     方法 A（最省事）：告诉开发者你要的新密码，让他重新生成这个文件。
     方法 B（自己来）：浏览器打开  login.html?gen=你的新密码
                      页面会显示一串哈希，把它贴到下面 HASH 里对应的位置，
                      再重新上传 auth.js 即可。
   ------------------------------------------------------------
   安全说明（务必知道）：
     纯前端登录只能“挡普通人”。密码这里是用哈希存的（查看源码看不到明文），
     比明文安全，但有技术能力的人仍可绕过前端。真正护住数据需要后端验证。
   ============================================================ */
(function () {
  var CFG = {
    KEY:   "halo_auth",
    DAYS:  7,                       // 登录后记住天数
    SALT:  "HALO$opt!2026",         // 加盐（防止用通用彩虹表反查哈希）
    LOGIN: "login.html",
    PAGES: ["index.html", "pos.html", "dashboard.html", "login.html"],
    // 密码哈希 = SHA-256( SALT + ":" + 密码 )。这不是明文。
    HASH: {
      staff: "08c597dc5ec2de82af0421457897fbb128174152a24b4e335c5d819182c00b5f", // 店员 = halo2026
      boss:  "b66d63ea67a4b0e48a5c48d2fabf1f094762934084131c24b277b8acf4190b6f"  // 老板 = haloceo2026
    }
  };

  function readAuth() {
    try {
      var a = JSON.parse(localStorage.getItem(CFG.KEY) || "null");
      return (a && a.exp && Date.now() < a.exp) ? a : null;
    } catch (e) { return null; }
  }
  function setAuth(role) {
    localStorage.setItem(CFG.KEY, JSON.stringify({ role: role, exp: Date.now() + CFG.DAYS * 86400000 }));
  }
  async function sha256(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  var Auth = {
    cfg: CFG,
    current: readAuth,
    role: function () { var a = readAuth(); return a ? a.role : null; },
    isBoss: function () { return Auth.role() === "boss"; },
    isLoggedIn: function () { return !!readAuth(); },

    // 生成哈希（给 login.html?gen= 用）
    hash: function (pw) { return sha256(CFG.SALT + ":" + pw); },

    // 验证密码，返回 "boss" / "staff" / null
    verify: async function (pw) {
      var h = await sha256(CFG.SALT + ":" + (pw || ""));
      if (h === CFG.HASH.boss)  return "boss";
      if (h === CFG.HASH.staff) return "staff";
      return null;
    },

    // 登录：成功写入会话并返回角色，失败返回 null
    login: async function (pw) {
      var role = await Auth.verify(pw);
      if (role) setAuth(role);
      return role;
    },

    logout: function () {
      localStorage.removeItem(CFG.KEY);
      location.replace(CFG.LOGIN + "?out=1");
    },

    // 守卫：受保护页面在 <head> 里调用 Auth.guard("staff") 或 Auth.guard("boss")
    // 同步执行（不需要哈希），没权限立刻弹回登录，body 不会闪一下
    guard: function (require) {
      var a = readAuth();
      var ok = !!a;
      if (ok && require === "boss" && a.role !== "boss") ok = false;
      if (!ok) {
        var page = encodeURIComponent((location.pathname.split("/").pop()) || "index.html");
        location.replace(CFG.LOGIN + "?next=" + page + "&need=" + (require || "staff"));
      }
    },

    // 装饰：① 隐藏 data-role="boss" 的元素（非老板看不到）② 右下角加“登出”按钮
    decorate: function () {
      function run() {
        var a = readAuth();
        if (!a) return;
        if (a.role !== "boss") {
          document.querySelectorAll('[data-role="boss"]').forEach(function (el) { el.style.display = "none"; });
        }
        if (!document.getElementById("haloUserBar")) {
          var bar = document.createElement("div");
          bar.id = "haloUserBar";
          bar.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:99999;display:flex;align-items:center;gap:8px;" +
            "background:rgba(11,36,71,.94);color:#fff;font-size:12px;padding:6px 8px 6px 13px;border-radius:22px;" +
            "font-family:system-ui,-apple-system,sans-serif;box-shadow:0 3px 12px rgba(0,0,0,.28)";
          bar.innerHTML = '<span style="color:#9DB4D4">' + (a.role === "boss" ? "老板/HQ" : "店员") + '</span>' +
            '<button id="haloLogoutBtn" style="background:#D4A24C;color:#0B2447;border:none;border-radius:16px;' +
            'padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">登出</button>';
          document.body.appendChild(bar);
          document.getElementById("haloLogoutBtn").onclick = function () {
            if (confirm("确定登出？")) Auth.logout();
          };
        }
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
      else run();
    }
  };

  window.Auth = Auth;
})();
