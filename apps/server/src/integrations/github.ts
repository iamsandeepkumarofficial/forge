import { Octokit } from "@octokit/rest";
export class GitHubService {
  private client: Octokit;
  constructor(token: string) {
    this.client = new Octokit({ auth: token });
  }
  async createPr(params: {
    owner: string;
    repo: string;
    title: string;
    head: string;
    base: string;
    body: string;
  }): Promise<string> {
    const { data } = await this.client.pulls.create(params);
    return data.html_url;
  }
  async getPr(params: {
    owner: string;
    repo: string;
    prNumber: number;
  }): Promise<string> {
    const { data } = await this.client.pulls.get({
      owner: params.owner,
      repo: params.repo,
      pull_number: params.prNumber
    });
    return JSON.stringify(data, null, 2);
  }
}
