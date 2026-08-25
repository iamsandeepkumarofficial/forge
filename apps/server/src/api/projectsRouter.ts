import { Router, RequestHandler } from "express";
import multer from "multer";
import { createPocAuth, type AuthedRequest } from "./pocAuth.js";
import { ProjectService } from "../services/project/project.service.js";

const N_1024 = 1024;
const N_204 = 204;
const N_400 = 400;
const N_401 = 401;
const N_404 = 404;
const N_409 = 409;
const N_413 = 413;
const N_429 = 429;
const N_500 = 500;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
const router = Router();
const projectService = new ProjectService();
const pocAuth = createPocAuth(process.env.FORGE_POC_TOKEN || "");
const maxUploadBytes =
  parseInt(process.env.PROJECT_UPLOAD_MAX_MB || "800", 10) * N_1024 * N_1024;
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes }
}).single("file");
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
      const result = await projectService.connectLocalFolder(
        localPath,
        (req as AuthedRequest).forgeUser.id,
        name || undefined
      );
      return res.json(result);
    }
    const result = await projectService.connectGitUrl(
      gitUrl,
      (req as AuthedRequest).forgeUser.id
    );
    return res.json(result);
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (/Local folder path|does not exist|not a directory/i.test(message)) {
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
const handleUploadMiddleware: RequestHandler = (...args) => {
  const [req, res, next] = args;
  uploadSingle(req, res, (err: unknown) => {
    if (err) {
      const multerErr = err as {
        code?: string;
        message?: string;
      };
      if (multerErr.code === "LIMIT_FILE_SIZE") {
        return res.status(N_413).json({
          error: "File too large",
          help: `The uploaded file exceeds the maximum allowed size of ${process.env.PROJECT_UPLOAD_MAX_MB || "800"}MB. Please compress your project into a smaller ZIP archive.`
        });
      }
      return res.status(N_400).json({
        error: multerErr.message || "Upload failed",
        help: "Please ensure you're uploading a single ZIP archive file."
      });
    }
    next();
  });
};
router.post("/upload", pocAuth, handleUploadMiddleware, async (req, res) => {
  if (!req.file) {
    return res.status(N_400).json({
      error: "No file uploaded",
      help: "Please select a ZIP archive file to upload. Supported format: .zip"
    });
  }
  try {
    const result = await projectService.uploadArchive(
      req.file,
      (req as AuthedRequest).forgeUser.id
    );
    res.json(result);
  } catch (error: unknown) {
    const message = errorMessage(error);
    if (message && message.includes("large")) {
      return res.status(N_413).json({
        error: "File too large",
        help: `The uploaded file exceeds the maximum allowed size of 800MB. Please compress your project into a smaller ZIP archive.`
      });
    }
    if (message && message.includes("Invalid ZIP archive")) {
      return res.status(N_400).json({
        error: "Invalid ZIP file",
        help: "The uploaded file is not a valid ZIP archive. Please ensure you're uploading a properly compressed ZIP file."
      });
    }
    if (message && message.includes("File too large")) {
      return res.status(N_413).json({
        error: message,
        help: "Please compress your project into a smaller ZIP archive (max 800MB)."
      });
    }
    if (message && message.includes("Invalid file type")) {
      return res.status(N_400).json({
        error: "Unsupported file type",
        help: "Only ZIP archives (.zip) are supported. Please compress your project into a ZIP file."
      });
    }
    if (message && message.includes("Failed to store archive")) {
      const detail =
        typeof message === "string"
          ? message.replace(/^Failed to store archive:\s*/i, "").trim()
          : "";
      const looksLikeConnectivity =
        /ECONNREFUSED|ENOTFOUND|AggregateError|NetworkingError|connect|timeout|Unknown storage error/i.test(
          detail
        );
      return res.status(N_500).json({
        error: "Failed to process archive",
        help: looksLikeConnectivity
          ? `Object storage is unreachable (${process.env.OBJECT_STORE_ENDPOINT || "http://localhost:9000"}). Ensure MinIO is running and ports are published, then retry.${detail ? ` Details: ${detail}` : ""}`
          : `Unable to store the uploaded archive.${detail ? ` Details: ${detail}` : " Please try again."}`
      });
    }
    return res.status(N_400).json({
      error: message || "An error occurred",
      help: "Please ensure you're uploading a valid ZIP file within the size limit."
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
export function createProjectsRouter(): Router {
  return router;
}
