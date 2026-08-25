export type WebSearchResult = {
  rank: number;
  title: string;
  url: string;
  snippet: string;
};
export type SearchProvider = {
  id: string;
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
};
export type WebSearchProviderConfig = {
  providerId: string;
  baseUrl?: string;
  apiKey?: string;
};
