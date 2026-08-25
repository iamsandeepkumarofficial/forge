import "./env.js";
import { createPreviewApp } from "./app.js";

const N_8081 = 8081;
const port = Number(process.env.PREVIEW_PLANE_PORT || N_8081);
const app = createPreviewApp();

app.listen(port, () => {
  process.stdout.write(`Forge preview-plane listening on ${port}\n`);
});
