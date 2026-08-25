import { parseGithubSlug } from "@forge/core";
import { GithubOAuthService } from "../../integrations/githubOAuth.js";
export class GithubService {
  private oauth = new GithubOAuthService();
  parseSlug(raw: string): {
    owner: string;
    repo: string;
  } | null {
    return parseGithubSlug(raw);
  }
  async getAccessToken(userId: string): Promise<string | null> {
    return this.oauth.getAccessToken(userId);
  }
  validateSlugFormat(slug: string): string {
    const sanitized = slug.trim();
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(sanitized)) {
      throw new Error(
        'Invalid GitHub slug: expected "owner/repo" (letters, numbers, dots, hyphens, underscores).'
      );
    }
    if (!parseGithubSlug(sanitized)) {
      throw new Error('Invalid GitHub slug: expected "owner/repo".');
    }
    return sanitized;
  }
}
