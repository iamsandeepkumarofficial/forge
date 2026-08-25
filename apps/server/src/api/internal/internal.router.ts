import { Router } from "express";
import { ChatFeatureRepository } from "../../catalog/chatFeatureRepository.js";
import { ChatFeatureService } from "../../projects/chatFeatureService.js";
import { PreviewToolService } from "../../tools/preview.tool.js";
import { ToolService } from "../../tools/tool.service.js";
import { pocAuth } from "./auth.js";
import { mountChatRoutes } from "./chat.routes.js";
import { mountReposRoutes } from "./repos.routes.js";
import { mountSessionRoutes } from "./session.routes.js";
import { mountToolsRoutes } from "./tools.routes.js";
export function createInternalRouter(pocToken: string): Router {
  const router = Router();
  const chatFeatureRepo = new ChatFeatureRepository();
  const chatFeatureService = new ChatFeatureService(chatFeatureRepo);
  const previewTools = new PreviewToolService();
  const toolService = new ToolService({
    previewTools,
    chatFeatureRepo,
    chatFeatureService
  });
  router.use(pocAuth(pocToken));
  mountChatRoutes(router);
  mountReposRoutes(router);
  mountToolsRoutes(router, toolService);
  mountSessionRoutes(router);
  return router;
}
