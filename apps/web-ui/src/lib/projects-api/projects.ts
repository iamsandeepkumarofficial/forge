import {
  BASE_URL,
  ConnectProjectError,
  type ProjectSummary
} from "./shared.js";
import {
  CONNECT_ERROR_MAP,
  parseApiErrorText,
  rethrowAsConnectError,
  throwConnectMappedError
} from "./project-errors.js";

export async function connectProject(githubUrl: string): Promise<{
  projectId: string;
  alreadyConnected: boolean;
}> {
  if (!githubUrl || typeof githubUrl !== "string") {
    throw new ConnectProjectError(
      "Invalid GitHub URL: please provide a valid GitHub repository URL or slug",
      {
        code: "INVALID_GITHUB_URL",
        help: "Example: 'octocat/Hello-World' or 'https://github.com/octocat/Hello-World'"
      }
    );
  }
  try {
    const response = await fetch(`${BASE_URL}/api/projects/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ github: githubUrl })
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to connect project"
      });
      throwConnectMappedError({
        ...parsed,
        map: CONNECT_ERROR_MAP
      });
    }
    return response.json();
  } catch (error) {
    rethrowAsConnectError({
      error,
      prefix: "Failed to connect project"
    });
  }
}

export async function connectLocalProject(localPath: string): Promise<{
  projectId: string;
}> {
  const trimmed =
    typeof localPath === "string" ? localPath.trim() : "";
  if (!trimmed) {
    throw new ConnectProjectError("Local folder path is required", {
      code: "INVALID_LOCAL_PATH",
      help: "Provide an absolute path to a project folder on this machine."
    });
  }
  try {
    const response = await fetch(`${BASE_URL}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ localPath: trimmed })
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to connect local folder"
      });
      throwConnectMappedError({
        ...parsed,
        map: CONNECT_ERROR_MAP
      });
    }
    return response.json();
  } catch (error) {
    rethrowAsConnectError({
      error,
      prefix: "Failed to connect local folder"
    });
  }
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/projects`);
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to fetch projects"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
    return response.json();
  } catch (error) {
    rethrowAsConnectError({
      error,
      prefix: "Failed to fetch projects"
    });
  }
}

export async function fetchProject(projectId: string): Promise<ProjectSummary> {
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required", {
      code: "MISSING_PROJECT_ID",
      help: "Please provide a valid project ID."
    });
  }
  try {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}`);
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to fetch project"
      });
      if (
        parsed.errorCode === "Not found" ||
        parsed.errorCode === "NOT_FOUND"
      ) {
        throw new ConnectProjectError(parsed.errorMessage, {
          code: "NOT_FOUND",
          help: "The requested project does not exist or you don't have access to it."
        });
      }
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
    return response.json();
  } catch (error) {
    rethrowAsConnectError({
      error,
      prefix: "Failed to fetch project"
    });
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!projectId) {
    throw new ConnectProjectError("Project ID is required", {
      code: "MISSING_PROJECT_ID",
      help: "Please provide a valid project ID."
    });
  }
  try {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to delete project"
      });
      throw new ConnectProjectError(parsed.errorMessage, {
        code: parsed.errorCode,
        help: parsed.helpText
      });
    }
  } catch (error) {
    rethrowAsConnectError({
      error,
      prefix: "Failed to delete project"
    });
  }
}
