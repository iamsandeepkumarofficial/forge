import {
  fetchGithubStatus,
  listGithubRepos,
  openGithubOAuthPopup,
  startGithubOAuth,
  type GithubRepoSummary
} from "../lib/github-api.js";
import { ConnectProjectError } from "../lib/projects-api.js";

export function githubErrorMessage(err: unknown): string {
  if (err instanceof ConnectProjectError) {
    return err.help ? `${err.message}. ${err.help}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function authorizeGithub(): Promise<
  | {
      login: string;
    }
  | { error: string }
> {
  const url = await startGithubOAuth(window.location.pathname || "/");
  const result = await openGithubOAuthPopup(url);
  if (!result.ok) {
    return { error: result.error || "GitHub authorization failed" };
  }
  return { login: result.login ?? "connected" };
}

export async function bootstrapGithubStatus(): Promise<{
  configured: boolean;
  login: string | null;
  needsAuthorize: boolean;
  error?: string;
}> {
  const status = await fetchGithubStatus();
  if (!status.configured) {
    return {
      configured: false,
      login: null,
      needsAuthorize: false,
      error:
        "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET on the server."
    };
  }
  if (!status.connected) {
    return { configured: true, login: null, needsAuthorize: true };
  }
  return { configured: true, login: status.login, needsAuthorize: false };
}

export async function fetchGithubRepoPage(options: {
  query: string;
  page: number;
}): Promise<{
  page: number;
  hasMore: boolean;
  repos: GithubRepoSummary[];
}> {
  return listGithubRepos({
    q: options.query || undefined,
    page: options.page
  });
}
