export const PICK_SCRIPT = `(() => {
  if (window.__forgeCancelPick) window.__forgeCancelPick();
  const hl = document.createElement("div");
  hl.setAttribute("data-forge-hl", "1");
  hl.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #2563eb;background:rgba(37,99,235,.12);display:none;box-sizing:border-box";
  document.documentElement.appendChild(hl);
  window.__forgePick = new Promise((resolve) => {
    const finish = (value) => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousemove", onMove, true);
      hl.remove();
      window.__forgeCancelPick = undefined;
      window.__forgePick = undefined;
      resolve(value);
    };
    const onMove = (event) => {
      const el = event.target;
      if (!(el instanceof Element) || el === hl) {
        hl.style.display = "none";
        return;
      }
      const r = el.getBoundingClientRect();
      hl.style.display = "block";
      hl.style.left = r.left + "px";
      hl.style.top = r.top + "px";
      hl.style.width = r.width + "px";
      hl.style.height = r.height + "px";
    };
    const onClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const el = event.target;
      if (!(el instanceof Element)) {
        finish(null);
        return;
      }
      finish(pickFromEl(el));
    };
    window.__forgeCancelPick = () => finish(null);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
  });
  return window.__forgePick;
  function pickFromEl(el) {
    const r = el.getBoundingClientRect();
    const root = el.closest("section,article,main,[role='main'],body") || el;
    return {
      url: location.href,
      tag: el.tagName.toLowerCase(),
      selector: cssPath(el),
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120),
      ariaLabel: (el.getAttribute("aria-label") || "").trim(),
      href: typeof el.href === "string" ? el.href : "",
      nearby: (root.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      viewport: { w: window.innerWidth, h: window.innerHeight }
    };
  }
  function cssPath(el) {
    if (el.id) return "#" + el.id;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let name = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        name += "." + Array.from(node.classList).slice(0, 2).join(".");
      }
      parts.unshift(name);
      node = node.parentElement;
      if (node && node.tagName === "BODY") break;
    }
    return parts.join(" > ");
  }
})()`;

export const CANCEL_PICK_SCRIPT = `window.__forgeCancelPick && window.__forgeCancelPick()`;
