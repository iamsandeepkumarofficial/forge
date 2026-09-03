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
