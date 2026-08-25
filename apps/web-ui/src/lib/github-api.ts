import { pocToken, runnerUrl, userEmailHeader } from "./tool-runner.js";
import { ConnectProjectError } from "./projects-api.js";

const N_204 = 204;
const N_500 = 500;

const BASE_URL = runnerUrl();
function authHeaders(json = true): HeadersInit {
  return {
    Authorization: `Bearer ${pocToken()}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...userEmailHeader()
  };
}
export type GithubOAuthStatus = {
  configured: boolean;
  connected: boolean;
  login: string | null;
};
export type GithubRepoSummary = {
  id: number;
  fullName: string;
  name: string;
  ownerLogin: string;
  private: boolean;
  description: string | null;
  htmlUrl: string;
  updatedAt: string | null;
  defaultBranch: string | null;
};
export async function fetchGithubStatus(): Promise<GithubOAuthStatus> {
  const response = await fetch(`${BASE_URL}/api/github/status`, {
    headers: authHeaders(false)
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "Failed to load GitHub connection status";
    try {
      const err = JSON.parse(text) as {
        error?: string;
        help?: string;
      };
      message = [err.error, err.help].filter(Boolean).join(". ") || message;
    } catch {
      void 0;
    }
    throw new ConnectProjectError(message);
  }
  return response.json();
}
export async function startGithubOAuth(
  returnTo = "/"
): Promise<string> {
  const params = new URLSearchParams({ returnTo });
  const response = await fetch(`${BASE_URL}/api/github/oauth/start?${params}`, {
    headers: authHeaders(false)
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "Failed to start GitHub authorization";
    try {
      const err = JSON.parse(text) as {
        error?: string;
        help?: string;
      };
      message = [err.error, err.help].filter(Boolean).join(". ") || message;
    } catch {
      void 0;
    }
    throw new ConnectProjectError(message);
  }
  const data = (await response.json()) as {
    url: string;
  };
  if (!data.url) {
    throw new ConnectProjectError("GitHub authorization URL missing");
  }
  return data.url;
}
export async function listGithubRepos(options?: {
  q?: string;
  page?: number;
}): Promise<{
  repos: GithubRepoSummary[];
  page: number;
  perPage: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options?.q) params.set("q", options.q);
  if (options?.page) params.set("page", String(options.page));
  const response = await fetch(`${BASE_URL}/api/github/repos?${params}`, {
    headers: authHeaders(false)
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "Failed to list GitHub repositories";
    try {
      const err = JSON.parse(text) as {
        error?: string;
        help?: string;
      };
      message = [err.error, err.help].filter(Boolean).join(". ") || message;
    } catch {
      void 0;
    }
    throw new ConnectProjectError(message);
  }
  return response.json();
}
export async function disconnectGithubOAuth(): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/github/oauth`, {
    method: "DELETE",
    headers: authHeaders(false)
  });
  if (!response.ok && response.status !== N_204) {
    throw new ConnectProjectError("Failed to disconnect GitHub");
  }
}
const OAUTH_MESSAGE_TYPE = "forge-github-oauth";
export function openGithubOAuthPopup(authorizeUrl: string): Promise<{
  ok: boolean;
  login?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const width = 600;
    const height = 750;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const popup = window.open(
      authorizeUrl,
      "forge-github-oauth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );
    if (!popup) {
      resolve({
        ok: false,
        error: "Popup blocked. Allow popups for this site and try again."
      });
      return;
    }
    let settled = false;
    const finish = (result: {
      ok: boolean;
      login?: string;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(closedTimer);
      try {
        popup.close();
      } catch {
        void 0;
      }
      resolve(result);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        ok?: boolean;
        login?: string;
        error?: string;
      };
      if (data?.type !== OAUTH_MESSAGE_TYPE) return;
      finish({
        ok: Boolean(data.ok),
        login: data.login,
        error: data.error
      });
    };
    window.addEventListener("message", onMessage);
    const closedTimer = window.setInterval(() => {
      if (popup.closed) {
        finish({ ok: false, error: "GitHub authorization was cancelled." });
      }
    }, N_500);
  });
}
export { OAUTH_MESSAGE_TYPE };
