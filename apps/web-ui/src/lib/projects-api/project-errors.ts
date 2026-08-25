import { ConnectProjectError, N_100 } from "./shared.js";

export function parseApiErrorText(options: {
  errorText: string;
  fallbackMessage: string;
}): {
  errorMessage: string;
  errorCode: string | undefined;
  helpText: string | undefined;
} {
  const { errorText, fallbackMessage } = options;
  let errorMessage = fallbackMessage;
  let errorCode: string | undefined;
  let helpText: string | undefined;
  try {
    const error = JSON.parse(errorText) as {
      error?: string;
      help?: string;
    };
    if (error.error) {
      errorMessage = error.error;
      errorCode = error.error;
      helpText = error.help || undefined;
    }
  } catch {
    errorMessage = `${fallbackMessage}: ${errorText.substring(0, N_100)}`;
  }
  return { errorMessage, errorCode, helpText };
}

export function throwConnectMappedError(options: {
  errorMessage: string;
  errorCode: string | undefined;
  helpText: string | undefined;
  map: Record<string, { code: string; help: string; retryAfter?: string }>;
}): never {
  const { errorMessage, errorCode, helpText, map } = options;
  const mapped = errorCode ? map[errorCode] : undefined;
  if (mapped) {
    throw new ConnectProjectError(errorMessage, {
      code: mapped.code,
      help: mapped.help,
      retryAfter: mapped.retryAfter
    });
  }
  throw new ConnectProjectError(errorMessage, {
    code: errorCode,
    help: helpText
  });
}

export function rethrowAsConnectError(options: {
  error: unknown;
  prefix: string;
}): never {
  const { error, prefix } = options;
  if (error instanceof ConnectProjectError) {
    throw error;
  }
  if (error instanceof Error) {
    throw new ConnectProjectError(`${prefix}: ${error.message}`, {
      code: "NETWORK_ERROR",
      help: "Check your internet connection and try again."
    });
  }
  throw new ConnectProjectError(`${prefix}: Unknown error occurred`, {
    code: "UNKNOWN_ERROR",
    help: "Please refresh the page and try again."
  });
}

export const CONNECT_ERROR_MAP: Record<
  string,
  { code: string; help: string; retryAfter?: string }
> = {
  "Project already connected": {
    code: "ALREADY_CONNECTED",
    help: "This repository is already connected to a project. Check your dashboard to manage existing connections."
  },
  already: {
    code: "ALREADY_CONNECTED",
    help: "This repository is already connected to a project. Check your dashboard to manage existing connections."
  },
  "Invalid GitHub URL": {
    code: "INVALID_URL",
    help: "Please provide a valid GitHub repository URL or slug (e.g., 'owner/repo' or 'https://github.com/owner/repo')"
  },
  github: {
    code: "INVALID_URL",
    help: "Please provide a valid GitHub repository URL or slug (e.g., 'owner/repo' or 'https://github.com/owner/repo')"
  },
  "GitHub API rate limit exceeded": {
    code: "RATE_LIMIT",
    help: "GitHub API rate limit exceeded. Please wait a moment and try again.",
    retryAfter: "30 seconds"
  },
  "rate limit": {
    code: "RATE_LIMIT",
    help: "GitHub API rate limit exceeded. Please wait a moment and try again.",
    retryAfter: "30 seconds"
  },
  "GitHub authentication required": {
    code: "AUTH_REQUIRED",
    help: "This repository is private. Please connect with a GitHub account that has access to this repository."
  },
  "Repository not found": {
    code: "NOT_FOUND",
    help: "The specified repository could not be found on GitHub. Please check the repository name and try again."
  }
};

export function uploadErrorMap(
  fileSizeLabel: string
): Record<string, { code: string; help: string }> {
  return {
    "File too large": {
      code: "FILE_TOO_LARGE",
      help: `The uploaded file (${fileSizeLabel}) exceeds the maximum allowed size of 800MB. Please compress your project further.`
    },
    "Invalid ZIP file": {
      code: "INVALID_ZIP",
      help: "The uploaded file is not a valid ZIP archive. Please ensure you're uploading a properly compressed ZIP file."
    },
    "Failed to process archive": {
      code: "STORAGE_ERROR",
      help: "Unable to store the uploaded archive. Please try again with a smaller file."
    },
    "No file uploaded": {
      code: "NO_FILE",
      help: "Please select a ZIP archive file to upload."
    }
  };
}
