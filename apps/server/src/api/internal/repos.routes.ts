import { Router } from "express";
import {
  cloneGithubRepo,
  listManagedRepos
} from "../../services/codebase/codebase.service.js";

const N_400 = 400;
const N_500 = 500;

export function mountReposRoutes(router: Router): void {
  router.get("/repos", async (_req, res) => {
    try {
      const { managedRoot, repos } = await listManagedRepos();
      res.json({ managedRoot, repos });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  });
  router.post("/repos/github", async (req, res) => {
    const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
    const shallow = Boolean(req.body?.shallow);
    if (!slug.trim()) {
      res
        .status(N_400)
        .json({ error: "slug required (e.g. octocat/Hello-World)" });
      return;
    }
    try {
      const result = await cloneGithubRepo(slug, { shallow });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(N_500).json({ error: message });
    }
  });
}
