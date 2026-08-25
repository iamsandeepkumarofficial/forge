import {
  BASE_URL,
  ConnectProjectError,
  formatBytes,
  N_1024,
  N_800,
  pocToken,
  type ProjectSummary
} from "./shared.js";
import {
  CONNECT_ERROR_MAP,
  parseApiErrorText,
  rethrowAsConnectError,
  throwConnectMappedError,
  uploadErrorMap
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
        "Content-Type": "application/json",
        Authorization: `Bearer ${pocToken()}`
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

export async function uploadProject(file: File): Promise<{
  projectId: string;
}> {
  if (!file) {
    throw new ConnectProjectError("No file selected for upload", {
      code: "NO_FILE",
      help: "Please select a ZIP archive file first."
    });
  }
  if (file.size > N_800 * N_1024 * N_1024) {
    throw new ConnectProjectError(
      `File too large: ${formatBytes(file.size)} exceeds the maximum allowed size of 800MB`,
      {
        code: "FILE_TOO_LARGE",
        help: "Please compress your project into a smaller ZIP archive (max 800MB)."
      }
    );
  }
  if (!file.name.endsWith(".zip")) {
    throw new ConnectProjectError(
      "Invalid file type: only ZIP archives (.zip) are supported",
      {
        code: "INVALID_FILE_TYPE",
        help: "Please compress your project into a ZIP file before uploading."
      }
    );
  }
  try {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${BASE_URL}/api/projects/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pocToken()}`
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text();
      const parsed = parseApiErrorText({
        errorText,
        fallbackMessage: "Failed to upload project"
      });
      throwConnectMappedError({
        ...parsed,
        map: uploadErrorMap(formatBytes(file.size))
      });
    }
    return response.json();
  } catch (error) {
    rethrowAsConnectError({ error, prefix: "Upload failed" });
  }
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/projects`, {
      headers: {
        Authorization: `Bearer ${pocToken()}`
      }
    });
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
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${pocToken()}`
      }
    });
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
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${pocToken()}`
      }
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
