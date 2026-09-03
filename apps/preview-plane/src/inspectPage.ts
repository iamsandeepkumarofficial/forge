export const INSPECT_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Forge preview</title>
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; }
      #app { display: block; border: 0; width: 100%; height: 100vh; }
      #hl {
        display: none;
        position: fixed;
        pointer-events: none;
        z-index: 2147483646;
        border: 2px solid #2563eb;
        background: rgba(37, 99, 235, 0.12);
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <iframe id="app"></iframe>
    <div id="hl"></div>
    <script src="/__forge/inspect.js"></script>
  </body>
</html>
`;

export const INSPECT_JS = `(() => {
  const app = document.getElementById("app");
  const hl = document.getElementById("hl");
  const params = new URLSearchParams(location.search);
  const src = params.get("src") || "/";
  let inspecting = params.get("mode") === "comment";
  app.src = src;

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    if (el.id) return "#" + el.id;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let name = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        name += "." + Array.from(node.classList).slice(0, 2).join(".");
      }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter(
          (c) => c.tagName === node.tagName
        );
        if (same.length > 1) name += ":nth-of-type(" + (same.indexOf(node) + 1) + ")";
      }
      parts.unshift(name);
      node = parent;
      if (node && node.tagName === "BODY") break;
    }
    return parts.join(" > ");
  }

  function highlight(el) {
    if (!el || !inspecting) {
      hl.style.display = "none";
      return;
    }
    const rect = el.getBoundingClientRect();
    hl.style.display = "block";
    hl.style.left = rect.left + "px";
    hl.style.top = rect.top + "px";
    hl.style.width = rect.width + "px";
    hl.style.height = rect.height + "px";
  }

  function postDev(payload) {
    payload.ts = Date.now();
    window.parent.postMessage(payload, "*");
  }

  function stringifyArg(v) {
    if (v === undefined) return "undefined";
    if (v === null) return "null";
    var t = typeof v;
    if (t === "string") return v;
    if (t === "number" || t === "boolean") return String(v);
    if (t === "function") return "[function " + (v.name || "anonymous") + "]";
    try {
      return JSON.stringify(v);
    } catch (err) {
      return String(v);
    }
  }

  function hookConsole(win) {
    if (!win || !win.console || win.__forgeDevtoolsHooked) return;
    win.__forgeDevtoolsHooked = true;
    var levels = ["log", "info", "warn", "error", "debug"];
    levels.forEach(function (level) {
      var orig = win.console[level]
        ? win.console[level].bind(win.console)
        : function () {};
      win.console[level] = function () {
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
          args.push(stringifyArg(arguments[i]));
        }
        postDev({ type: "forge-devtools-console", level: level, args: args });
        return orig.apply(win.console, arguments);
      };
    });
    win.addEventListener("error", function (e) {
      postDev({
        type: "forge-devtools-console",
        level: "error",
        args: [e.message || "Error"],
        stack: e.error && e.error.stack ? String(e.error.stack) : ""
      });
    });
    win.addEventListener("unhandledrejection", function (e) {
      postDev({
        type: "forge-devtools-console",
        level: "error",
        args: ["Unhandled rejection: " + stringifyArg(e.reason)]
      });
    });
    var origFetch = win.fetch;
    if (typeof origFetch === "function") {
      win.fetch = function (input, init) {
        var started = Date.now();
        var url =
          typeof input === "string"
            ? input
            : input && input.url
              ? String(input.url)
              : "";
        var method = (init && init.method) || (input && input.method) || "GET";
        return origFetch.apply(win, arguments).then(
          function (res) {
            postDev({
              type: "forge-devtools-network",
              method: String(method).toUpperCase(),
              url: url,
              status: res.status,
              duration: Date.now() - started
            });
            return res;
          },
          function (err) {
            postDev({
              type: "forge-devtools-network",
              method: String(method).toUpperCase(),
              url: url,
              status: 0,
              error: String(err),
              duration: Date.now() - started
            });
            throw err;
          }
        );
      };
    }
    var XHR = win.XMLHttpRequest;
    if (XHR && XHR.prototype) {
      var open = XHR.prototype.open;
      var send = XHR.prototype.send;
      XHR.prototype.open = function (method, url) {
        this.__forgeMethod = method;
        this.__forgeUrl = url;
        return open.apply(this, arguments);
      };
      XHR.prototype.send = function () {
        var xhr = this;
        var started = Date.now();
        xhr.addEventListener("loadend", function () {
          postDev({
            type: "forge-devtools-network",
            method: String(xhr.__forgeMethod || "GET").toUpperCase(),
            url: String(xhr.__forgeUrl || ""),
            status: xhr.status,
            duration: Date.now() - started
          });
        });
        return send.apply(xhr, arguments);
      };
    }
  }

  function walkDom(el, depth) {
    if (!el || el.nodeType !== 1 || depth > 5) return null;
    var kids = [];
    var children = el.children || [];
    var max = Math.min(children.length, 24);
    for (var i = 0; i < max; i++) {
      var child = walkDom(children[i], depth + 1);
      if (child) kids.push(child);
    }
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      className:
        el.className && typeof el.className === "string"
          ? el.className.slice(0, 80)
          : "",
      children: kids
    };
  }

  function hookApp() {
    try {
      if (app.contentWindow) hookConsole(app.contentWindow);
    } catch (err) {}
  }

  function bindDoc(doc) {
    doc.addEventListener(
      "mousemove",
      (e) => {
        if (!inspecting) return;
        highlight(doc.elementFromPoint(e.clientX, e.clientY));
      },
      true
    );
    doc.addEventListener(
      "click",
      (e) => {
        if (!inspecting) return;
        e.preventDefault();
        e.stopPropagation();
        const el = e.target;
        if (!(el instanceof Element)) return;
        const text = (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120);
        const r = el.getBoundingClientRect();
        const root = el.closest("section,article,main,[role='main'],body") || el;
        window.parent.postMessage(
          {
            type: "forge-inspect-pick",
            url: doc.location.href,
            selector: cssPath(el),
            tag: el.tagName.toLowerCase(),
            text,
            ariaLabel: (el.getAttribute("aria-label") || "").trim(),
            href: typeof el.href === "string" ? el.href : "",
            nearby: (root.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            viewport: { w: window.innerWidth, h: window.innerHeight }
          },
          "*"
        );
      },
      true
    );
  }

  function shot(rect) {
    return new Promise((resolve, reject) => {
      const doc = app.contentDocument;
      if (!doc || !doc.documentElement) {
        reject(new Error("Preview is not ready"));
        return;
      }
      const vw = Math.max(doc.documentElement.clientWidth, 1);
      const vh = Math.max(doc.documentElement.clientHeight, 1);
      let html;
      try {
        html = new XMLSerializer().serializeToString(doc.documentElement);
      } catch (err) {
        reject(err);
        return;
      }
      if (html.indexOf("xmlns=") === -1) {
        html = html.replace("<html", '<html xmlns="http://www.w3.org/1999/xhtml"');
      }
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        vw +
        '" height="' +
        vh +
        '"><foreignObject width="100%" height="100%">' +
        html +
        "</foreignObject></svg>";
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        const sx = rect ? Math.max(0, rect.x) : 0;
        const sy = rect ? Math.max(0, rect.y) : 0;
        const sw = rect ? Math.min(rect.w, vw - sx) : vw;
        const sh = rect ? Math.min(rect.h, vh - sy) : vh;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Screenshot failed"));
      };
      img.src = url;
    });
  }

  function postNav() {
    try {
      var href =
        app.contentDocument && app.contentDocument.location
          ? app.contentDocument.location.href
          : "";
      if (href) {
        window.parent.postMessage({ type: "forge-inspect-nav", url: href }, "*");
      }
    } catch (err) {}
  }

  app.addEventListener("load", () => {
    try {
      if (app.contentDocument) bindDoc(app.contentDocument);
    } catch {
      void 0;
    }
    hookApp();
    postNav();
    window.parent.postMessage({ type: "forge-inspect-ready" }, "*");
  });
  hookApp();
  window.parent.postMessage({ type: "forge-inspect-ready" }, "*");

  window.addEventListener("message", (e) => {
    if (!e.data) return;
    if (e.data.type === "forge-inspect-set") {
      inspecting = Boolean(e.data.on);
      if (!inspecting) hl.style.display = "none";
      return;
    }
    if (e.data.type === "forge-devtools-dom") {
      try {
        var root =
          app.contentDocument && app.contentDocument.documentElement;
        window.parent.postMessage(
          { type: "forge-devtools-dom-result", tree: walkDom(root, 0) },
          "*"
        );
      } catch (err) {
        window.parent.postMessage(
          { type: "forge-devtools-dom-result", error: String(err) },
          "*"
        );
      }
      return;
    }
    if (e.data.type === "forge-devtools-eval") {
      var expr = typeof e.data.expr === "string" ? e.data.expr : "";
      try {
        var result = app.contentWindow.eval(expr);
        window.parent.postMessage(
          {
            type: "forge-devtools-console",
            level: "log",
            args: [stringifyArg(result)],
            source: "eval"
          },
          "*"
        );
      } catch (err) {
        window.parent.postMessage(
          {
            type: "forge-devtools-console",
            level: "error",
            args: [String(err && err.message ? err.message : err)],
            source: "eval"
          },
          "*"
        );
      }
      return;
    }
    if (e.data.type !== "forge-inspect-shot") return;
    const rect = e.data.rect;
    const run = function () {
      shot(rect)
        .then(function (dataUrl) {
          window.parent.postMessage(
            { type: "forge-inspect-shot-result", dataUrl: dataUrl },
            "*"
          );
        })
        .catch(function (err) {
          window.parent.postMessage(
            {
              type: "forge-inspect-shot-result",
              error: String(err && err.message ? err.message : err)
            },
            "*"
          );
        });
    };
    if (app.contentDocument && app.contentDocument.readyState === "complete") {
      run();
      return;
    }
    app.addEventListener("load", run, { once: true });
  });
})();
`;

export const CLEAR_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Clear</title>
  </head>
  <body>
    <script>
      (function () {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {}
        try {
          var cookies = document.cookie.split(";");
          for (var i = 0; i < cookies.length; i++) {
            var name = cookies[i].split("=")[0].trim();
            if (!name) continue;
            document.cookie =
              name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        } catch (e) {}
        parent.postMessage({ type: "forge-preview-cleared" }, "*");
      })();
    </script>
  </body>
</html>
`;

export function inspectAsset(
  url: string | undefined
): "html" | "js" | "clear" | null {
  const path = (url ?? "/").split("?")[0];
  if (path === "/__forge/inspect" || path === "/__forge/inspect/") return "html";
  if (path === "/__forge/inspect.js") return "js";
  if (path === "/__forge/clear" || path === "/__forge/clear/") return "clear";
  return null;
}
