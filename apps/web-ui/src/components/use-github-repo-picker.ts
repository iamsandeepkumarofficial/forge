import { useEffect, useMemo, useState } from "react";
import {
  disconnectGithubOAuth,
  type GithubRepoSummary
} from "../lib/github-api.js";
import {
  authorizeGithub,
  bootstrapGithubStatus,
  fetchGithubRepoPage,
  githubErrorMessage
} from "./github-repo-picker-api.js";

const N_250 = 250;

export function useGithubRepoPicker(options: {
  open: boolean;
  connectingSlug?: string | null;
}) {
  const { open, connectingSlug } = options;
  const [statusLogin, setStatusLogin] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), N_250);
    return () => window.clearTimeout(t);
  }, [query]);
  useGithubRepoEffects({
    open,
    statusLogin,
    debouncedQuery,
    setConfigured,
    setStatusLogin,
    setRepos,
    setError,
    setLoading,
    setAuthorizing,
    setPage,
    setHasMore
  });
  const title = useMemo(
    () => (statusLogin ? "Select a repository" : "Connect GitHub"),
    [statusLogin]
  );
  return {
    statusLogin,
    setStatusLogin,
    configured,
    repos,
    setRepos,
    query,
    setQuery,
    page,
    hasMore,
    loading,
    authorizing,
    error,
    title,
    busy: loading || authorizing || Boolean(connectingSlug),
    authorize: () =>
      void runAuthorize({ setAuthorizing, setError, setStatusLogin }),
    loadRepos: (nextPage: number, replace: boolean) =>
      void runLoadRepos({
        nextPage,
        replace,
        debouncedQuery,
        setLoading,
        setError,
        setPage,
        setHasMore,
        setRepos,
        setStatusLogin
      }),
    disconnect: () =>
      void disconnectGithubOAuth().then(() => {
        setStatusLogin(null);
        setRepos([]);
      })
  };
}

async function runAuthorize(options: {
  setAuthorizing: (v: boolean) => void;
  setError: (v: string | null) => void;
  setStatusLogin: (v: string | null) => void;
}) {
  options.setAuthorizing(true);
  options.setError(null);
  try {
    const result = await authorizeGithub();
    if ("error" in result) {
      options.setError(result.error);
      return;
    }
    options.setStatusLogin(result.login);
  } catch (err) {
    options.setError(githubErrorMessage(err));
  } finally {
    options.setAuthorizing(false);
  }
}

async function runLoadRepos(options: {
  nextPage: number;
  replace: boolean;
  debouncedQuery: string;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
  setPage: (v: number) => void;
  setHasMore: (v: boolean) => void;
  setRepos: React.Dispatch<React.SetStateAction<GithubRepoSummary[]>>;
  setStatusLogin: (v: string | null) => void;
}) {
  options.setLoading(true);
  options.setError(null);
  try {
    const result = await fetchGithubRepoPage({
      page: options.nextPage,
      query: options.debouncedQuery
    });
    options.setPage(result.page);
    options.setHasMore(result.hasMore);
    options.setRepos((prev) =>
      options.replace ? result.repos : [...prev, ...result.repos]
    );
  } catch (err) {
    const message = githubErrorMessage(err);
    if (message.toLowerCase().includes("not connected")) {
      options.setStatusLogin(null);
    }
    options.setError(message);
  } finally {
    options.setLoading(false);
  }
}

function useGithubStatusBootstrap(options: {
  open: boolean;
  setConfigured: (v: boolean) => void;
  setStatusLogin: (v: string | null) => void;
  setRepos: React.Dispatch<React.SetStateAction<GithubRepoSummary[]>>;
  setError: (v: string | null) => void;
  setLoading: (v: boolean) => void;
  setAuthorizing: (v: boolean) => void;
}) {
  const {
    open,
    setConfigured,
    setStatusLogin,
    setRepos,
    setError,
    setLoading,
    setAuthorizing
  } = options;
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await bootstrapGithubStatus();
        if (cancelled) return;
        setConfigured(status.configured);
        if (status.error) {
          setError(status.error);
          setStatusLogin(null);
          return;
        }
        if (status.needsAuthorize) {
          setStatusLogin(null);
          setRepos([]);
          await runAuthorize({ setAuthorizing, setError, setStatusLogin });
          return;
        }
        setStatusLogin(status.login);
      } catch (err) {
        if (!cancelled) setError(githubErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    setAuthorizing,
    setConfigured,
    setError,
    setLoading,
    setRepos,
    setStatusLogin
  ]);
}

function useGithubRepoListEffect(options: {
  open: boolean;
  statusLogin: string | null;
  debouncedQuery: string;
  setError: (v: string | null) => void;
  setLoading: (v: boolean) => void;
  setPage: (v: number) => void;
  setHasMore: (v: boolean) => void;
  setRepos: React.Dispatch<React.SetStateAction<GithubRepoSummary[]>>;
  setStatusLogin: (v: string | null) => void;
}) {
  const {
    open,
    statusLogin,
    debouncedQuery,
    setError,
    setLoading,
    setPage,
    setHasMore,
    setRepos,
    setStatusLogin
  } = options;
  useEffect(() => {
    if (!open || !statusLogin) return;
    void runLoadRepos({
      nextPage: 1,
      replace: true,
      debouncedQuery,
      setLoading,
      setError,
      setPage,
      setHasMore,
      setRepos,
      setStatusLogin
    });
  }, [
    open,
    statusLogin,
    debouncedQuery,
    setError,
    setHasMore,
    setLoading,
    setPage,
    setRepos,
    setStatusLogin
  ]);
}

function useGithubRepoEffects(options: {
  open: boolean;
  statusLogin: string | null;
  debouncedQuery: string;
  setConfigured: (v: boolean) => void;
  setStatusLogin: (v: string | null) => void;
  setRepos: React.Dispatch<React.SetStateAction<GithubRepoSummary[]>>;
  setError: (v: string | null) => void;
  setLoading: (v: boolean) => void;
  setAuthorizing: (v: boolean) => void;
  setPage: (v: number) => void;
  setHasMore: (v: boolean) => void;
}) {
  useGithubStatusBootstrap(options);
  useGithubRepoListEffect(options);
}
