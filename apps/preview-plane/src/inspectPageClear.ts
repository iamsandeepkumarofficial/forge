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
