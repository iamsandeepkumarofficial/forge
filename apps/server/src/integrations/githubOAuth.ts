import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Octokit } from "@octokit/rest";
import { GithubAccountRepository } from "../catalog/githubAccountRepository.js";

const N_10 = 10;
const N_100 = 100;
const N_15 = 15;
const N_16 = 16;
const N_30 = 30;
const N_4000 = 4000;
const N_50 = 50;
const N_60000 = 60000;

const OAUTH_SCOPES = ["read:user", "repo"].join(" ");
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
function requireOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
} {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const callbackUrl =
    process.env.GITHUB_OAUTH_CALLBACK_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT || N_4000}/api/github/oauth/callback`;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET."
    );
  }
  return { clientId, clientSecret, callbackUrl };
}
function stateSecret(): string {
  return (
    process.env.GITHUB_OAUTH_STATE_SECRET?.trim() || "forge-dev-oauth-state"
  );
}
export function isGithubOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim() &&
    process.env.GITHUB_CLIENT_SECRET?.trim()
  );
}
export function webUiOrigin(): string {
  return (
    process.env.FORGE_WEB_UI_ORIGIN?.trim() ||
    process.env.WEB_UI_ORIGIN?.trim() ||
    "http://127.0.0.1:5173"
  );
}
export function signOAuthState(payload: {
  userId: string;
  nonce: string;
  returnTo?: string;
}): string {
  const body = Buffer.from(
    JSON.stringify({
      userId: payload.userId,
      nonce: payload.nonce,
      returnTo: payload.returnTo || "/dashboard",
      ts: Date.now()
    }),
    "utf8"
  ).toString("base64url");
  const sig = createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}
export function verifyOAuthState(state: string): {
  userId: string;
  nonce: string;
  returnTo: string;
} {
  const [body, sig] = state.split(".");
  if (!body || !sig) {
    throw new Error("Invalid OAuth state");
  }
  const expected = createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state signature");
  }
  const parsed = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8")
  ) as {
    userId?: string;
    nonce?: string;
    returnTo?: string;
    ts?: number;
  };
  if (!parsed.userId || !parsed.nonce) {
    throw new Error("Invalid OAuth state payload");
  }
  if (
    typeof parsed.ts === "number" &&
    Date.now() - parsed.ts > N_15 * N_60000
  ) {
    throw new Error("OAuth state expired");
  }
  return {
    userId: parsed.userId,
    nonce: parsed.nonce,
    returnTo: parsed.returnTo || "/dashboard"
  };
}
export class GithubOAuthService {
  private accounts = new GithubAccountRepository();
  buildAuthorizeUrl(userId: string, returnTo?: string): string {
    const { clientId, callbackUrl } = requireOAuthConfig();
    const state = signOAuthState({
      userId,
      nonce: cryptoRandom(),
      returnTo
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("scope", OAUTH_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("allow_signup", "true");
    return url.toString();
  }
  async exchangeCodeAndStore(
    code: string,
    state: string
  ): Promise<{
    login: string;
    returnTo: string;
  }> {
    const { clientId, clientSecret, callbackUrl } = requireOAuthConfig();
    const verified = verifyOAuthState(state);
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl
        })
      }
    );
    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed (${tokenRes.status})`);
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };
    if (!tokenJson.access_token) {
      throw new Error(
        tokenJson.error_description ||
          tokenJson.error ||
          "GitHub did not return an access token"
      );
    }
    const octokit = new Octokit({ auth: tokenJson.access_token });
    const { data: user } = await octokit.users.getAuthenticated();
    await this.accounts.upsert({
      userId: verified.userId,
      githubUserId: String(user.id),
      githubLogin: user.login,
      accessToken: tokenJson.access_token,
      scope: tokenJson.scope ?? null,
      tokenType: tokenJson.token_type ?? "bearer"
    });
    return { login: user.login, returnTo: verified.returnTo };
  }
  async getStatus(userId: string): Promise<{
    configured: boolean;
    connected: boolean;
    login: string | null;
  }> {
    const configured = isGithubOAuthConfigured();
    if (!configured) {
      return { configured: false, connected: false, login: null };
    }
    const account = await this.accounts.getByUserId(userId);
    return {
      configured: true,
      connected: Boolean(account),
      login: account?.githubLogin ?? null
    };
  }
  async getAccessToken(userId: string): Promise<string | null> {
    const account = await this.accounts.getByUserId(userId);
    return account?.accessToken ?? null;
  }
  async disconnect(userId: string): Promise<void> {
    await this.accounts.deleteByUserId(userId);
  }
  async listRepos(
    userId: string,
    options?: {
      q?: string;
      page?: number;
      perPage?: number;
    }
  ): Promise<{
    repos: GithubRepoSummary[];
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    const account = await this.accounts.getByUserId(userId);
    if (!account) {
      throw new Error("GitHub account not connected");
    }
    const page = Math.max(1, options?.page ?? 1);
    const perPage = Math.min(N_50, Math.max(1, options?.perPage ?? N_30));
    const q = options?.q?.trim().toLowerCase() ?? "";
    const octokit = new Octokit({ auth: account.accessToken });
    if (q) {
      const matched: GithubRepoSummary[] = [];
      let scanPage = 1;
      let exhausted = false;
      while (
        matched.length < page * perPage &&
        !exhausted &&
        scanPage <= N_10
      ) {
        const { data } = await octokit.repos.listForAuthenticatedUser({
          page: scanPage,
          per_page: 100,
          sort: "updated",
          direction: "desc",
          affiliation: "owner,collaborator,organization_member"
        });
        for (const repo of data) {
          const hay =
            `${repo.full_name} ${repo.description ?? ""}`.toLowerCase();
          if (hay.includes(q)) matched.push(mapRepo(repo));
        }
        if (data.length < N_100) exhausted = true;
        scanPage += 1;
      }
      const start = (page - 1) * perPage;
      const slice = matched.slice(start, start + perPage);
      return {
        repos: slice,
        page,
        perPage,
        hasMore:
          start + perPage < matched.length ||
          (!exhausted && slice.length === perPage)
      };
    }
    const { data } = await octokit.repos.listForAuthenticatedUser({
      page,
      per_page: perPage,
      sort: "updated",
      direction: "desc",
      affiliation: "owner,collaborator,organization_member"
    });
    return {
      repos: data.map(mapRepo),
      page,
      perPage,
      hasMore: data.length === perPage
    };
  }
}
function mapRepo(repo: {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
  };
  private: boolean;
  description: string | null;
  html_url: string;
  updated_at: string | null;
  default_branch?: string;
}): GithubRepoSummary {
  return {
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    ownerLogin: repo.owner.login,
    private: repo.private,
    description: repo.description,
    htmlUrl: repo.html_url,
    updatedAt: repo.updated_at,
    defaultBranch: repo.default_branch ?? null
  };
}
function cryptoRandom(): string {
  return randomBytes(N_16).toString("hex");
}
