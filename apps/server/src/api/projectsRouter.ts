import { Router, RequestHandler } from "express";
import { createLocalUserMiddleware, type AuthedRequest } from "./pocAuth.js";
import { ProjectService } from "../services/project/project.service.js";

const N_204 = 204;
const N_400 = 400;
const N_401 = 401;
const N_404 = 404;
const N_409 = 409;
const N_429 = 429;
const N_500 = 500;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
const router = Router();
const projectService = new ProjectService();
const pocAuth = createLocalUserMiddleware();
type ExpressArgs = Parameters<RequestHandler>;
router.use(pocAuth, async (...args: ExpressArgs) => {
  const [req, , next] = args;
  if (req.path === "/api/projects") {
    return next();
  }
  next();
});
const githubRateLimit: RequestHandler = (...args) => {
  const next = args[2];
  next();
};
router.post("/", pocAuth, async (req, res) => {
  const localPath =
    typeof req.body?.localPath === "string" ? req.body.localPath.trim() : "";
  const gitUrl =
    typeof req.body?.gitUrl === "string" ? req.body.gitUrl.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!localPath && !gitUrl) {
    return res.status(N_400).json({
      error: "localPath or gitUrl is required",
      help: "Provide an absolute local folder path, or a GitHub clone URL / owner/repo slug."
    });
  }
  if (localPath && gitUrl) {
    return res.status(N_400).json({
      error: "Provide only one of localPath or gitUrl"
    });
  }
  try {
    if (localPath) {
      const result = await projectService.connectLocalFolder({
        localPath,
        userId: (req as AuthedRequest).forgeUser.id,
        name: name || undefined
      });
      return res.json(result);
    }
    const result = await projectService.connectGitUrl(
      gitUrl,
      (req as AuthedRequest).forgeUser.id
    );
    return res.json(result);
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (
      /Local folder path|does not exist|not a directory|Failed to copy/i.test(
        message
      )
    ) {
      return res.status(N_400).json({ error: message });
    }
    if (message.includes("already")) {
      return res.status(N_409).json({ error: message });
    }
    return res.status(N_400).json({ error: message || "An error occurred" });
  }
});
router.post("/github", pocAuth, githubRateLimit, async (req, res) => {
  const { github } = req.body;
  if (!github) {
    return res.status(N_400).json({
      error:
        "GitHub slug is required. Please provide a valid GitHub repository URL or repository slug.",
      help: "Example: 'octocat/Hello-World' or 'https://github.com/octocat/Hello-World'"
    });
  }
  let slug = github;
  if (github.startsWith("https://github.com/")) {
    const match = github.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      slug = `${match[1]}/${match[2]}`;
    }
  }
  if (!slug) {
    return res.status(N_400).json({
      error:
        "Invalid GitHub URL. Please provide a valid repository URL or slug.",
      help: "Supported formats:\n  - Repository slug: 'owner/repo'\n  - GitHub URL: 'https://github.com/owner/repo'"
    });
  }
  try {
    const result = await projectService.connectGithub(
      slug,
      (req as AuthedRequest).forgeUser.id
    );
    res.json(result);
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message.includes("already")) {
      return res.status(N_409).json({
        error: "Project already connected",
        help: `The repository "${slug}" is already connected to a project. You can view and manage this project in your dashboard.`
      });
    }
    if (message && message.includes("Invalid GitHub slug")) {
      return res.status(N_400).json({
        error: message,
        help: "Repository slugs can only contain lowercase letters, numbers, hyphens, and underscores."
      });
    }
    if (message && message.includes("GitHub API rate limit")) {
      return res.status(N_429).json({
        error: "GitHub API rate limit exceeded",
        help: "You've made too many GitHub API requests. Please wait a moment and try again.",
        retryAfter: "30 seconds"
      });
    }
    if (message && message.includes("authentication")) {
      return res.status(N_401).json({
        error: "GitHub authentication required",
        help: "This repository is private. Please connect with a GitHub account that has access to this repository."
      });
    }
    if (message && message.includes("GitHub repository not found")) {
      return res.status(N_404).json({
        error: "Repository not found",
        help: "The specified repository could not be found on GitHub. Please check the repository name and try again."
      });
    }
    return res.status(N_400).json({
      error: message || "An error occurred",
      help: "Please ensure the repository is public or you have proper authentication. Check your GitHub credentials if this repository is private."
    });
  }
});
router.get("/", pocAuth, async (req, res) => {
  try {
    const projects = await projectService.listProjects(
      (req as AuthedRequest).forgeUser.id
    );
    res.json(projects);
  } catch (_error: unknown) {
    return res.status(N_500).json({
      error: "Failed to list projects",
      help: "Unable to retrieve your projects. Please try again later."
    });
  }
});
router.get("/:projectId", pocAuth, async (req, res) => {
  const projectId = Array.isArray(req.params.projectId)
    ? req.params.projectId[0]
    : req.params.projectId;
  if (!projectId) {
    return res.status(N_400).json({ error: "Project ID is required" });
  }
  try {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(N_404).json({
        error: "Project not found",
        help: "The requested project does not exist or you don't have access to it."
      });
    }
    res.json(project);
  } catch (error: unknown) {
    const message = errorMessage(error);
    return res.status(N_400).json({
      error: message,
      help: "Unable to retrieve project details. Please try again."
    });
  }
});
router.delete("/:projectId", pocAuth, async (req, res) => {
  const projectId = Array.isArray(req.params.projectId)
    ? req.params.projectId[0]
    : req.params.projectId;
  if (!projectId) {
    return res.status(N_400).json({ error: "Project ID is required" });
  }
  try {
    await projectService.deleteProject(
      projectId,
      (req as AuthedRequest).forgeUser.id
    );
    res.status(N_204).end();
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message && message.includes("not found")) {
      return res.status(N_404).json({
        error: "Project not found",
        help: "The requested project does not exist or you don't have access to it."
      });
    }
    return res.status(N_400).json({
      error: message || "Failed to delete project",
      help: "Unable to delete the project. Please try again."
    });
  }
});
router.get("/:projectId/parameters", pocAuth, async (req, res) => {
  const projectId = String(req.params.projectId ?? "");
  try {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(N_404).json({ error: "Project not found" });
    }
    const { ParameterRepository } =
      await import("../catalog/parameterRepository.js");
    const paramRepo = new ParameterRepository();
    const parameters = await paramRepo.listProjectParameters(projectId);
    res.json({
      parameters: parameters.map((p) => ({
        key: p.key,
        value: p.secret ? "••••••••" : p.value,
        secret: p.secret
      }))
    });
  } catch (error: unknown) {
    res.status(N_400).json({ error: errorMessage(error) });
  }
});
router.put("/:projectId/parameters", pocAuth, async (req, res) => {
  const projectId = String(req.params.projectId ?? "");
  const key = typeof req.body?.key === "string" ? req.body.key.trim() : "";
  const value = typeof req.body?.value === "string" ? req.body.value : "";
  const secret = Boolean(req.body?.secret);
  if (!key) {
    return res.status(N_400).json({ error: "key is required" });
  }
  try {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(N_404).json({ error: "Project not found" });
    }
    const { ParameterRepository } =
      await import("../catalog/parameterRepository.js");
    const paramRepo = new ParameterRepository();
    const saved = await paramRepo.upsertProjectParameter({
      projectId,
      key,
      value,
      secret
    });
    res.json({
      key: saved.key,
      value: saved.secret ? "••••••••" : saved.value,
      secret: saved.secret
    });
  } catch (error: unknown) {
    res.status(N_400).json({ error: errorMessage(error) });
  }
});
router.delete("/:projectId/parameters/:key", pocAuth, async (req, res) => {
  const projectId = String(req.params.projectId ?? "");
  try {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      return res.status(N_404).json({ error: "Project not found" });
    }
    const { ParameterRepository } =
      await import("../catalog/parameterRepository.js");
    const paramRepo = new ParameterRepository();
    await paramRepo.deleteProjectParameter(projectId, String(req.params.key));
    res.status(N_204).end();
  } catch (error: unknown) {
    res.status(N_400).json({ error: errorMessage(error) });
  }
});
export function createProjectsRouter(): Router {
  return router;
}
