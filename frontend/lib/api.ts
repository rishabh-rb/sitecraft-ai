import type { LaunchReport } from "@sitecraft/ml";

export type GeneratedFile = {
  path: string;
  language: string;
  content: string;
};

export type GeneratedWebsite = {
  html: string;
  files: GeneratedFile[];
  plan: {
    siteName: string;
    siteDescription: string;
    pages: Array<{ name: string; slug: string; pageType: string; sections: string[] }>;
    theme: string;
    colorPalette: Record<string, string>;
    fontFamily: string;
    features: string[];
  };
  qa?: {
    passed: boolean;
    score: number;
    issues: Array<{ severity: "error" | "warning" | "info"; message: string; file?: string }>;
  };
};

export type ChatMessage = {
  id: string;
  projectId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type GenerationStep = {
  id: string;
  agent: string;
  userPrompt: string;
  status: "started" | "completed" | "failed";
  input?: unknown;
  output?: unknown;
  error?: string;
  createdAt: string;
};

export type Deployment = {
  id: string;
  projectId: string;
  provider: string;
  deploymentUrl?: string;
  deploymentId?: string;
  status: "PENDING" | "BUILDING" | "READY" | "ERROR";
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  userId?: string;
  name: string;
  description: string;
  initialPrompt: string;
  status: "draft" | "generating" | "ready" | "failed";
  framework: string;
  createdAt: string;
  updatedAt: string;
  websites: Array<{
    id: string;
    title: string;
    description: string;
    theme: string;
    generatedCode: GeneratedWebsite;
    version: number;
  }>;
  generations: GenerationStep[];
  messages: ChatMessage[];
  deployments?: Deployment[];
};

export type ConfigStatus = {
  gemini: boolean;
  openai: boolean;
  openrouter: boolean;
  bynara: boolean;
  database: boolean;
  auth: boolean;
  googleOAuth: boolean;
  unsplash: boolean;
  vercel: boolean;
  netlify: boolean;
  activeProvider: string;
  activeModel: string;
};

export type GenerationJob = {
  id: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: string;
  progress: number;
  message: string;
  error?: string;
  result?: { website: GeneratedWebsite; qa: GeneratedWebsite["qa"]; provider: string };
};

export type UserProfile = {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  bio?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminStats = {
  totalUsers: number;
  totalProjects: number;
  totalWebsites: number;
  totalGenerations: number;
  totalTokens: number;
  estimatedCost: number;
  successfulGenerations: number;
  failedGenerations: number;
  runningGenerations: number;
  userGrowth: Array<{ date: string; count: number }>;
  projectGrowth: Array<{ date: string; count: number }>;
  generationTimeline: Array<{ date: string; success: number; failed: number; running: number }>;
  agentUsage: Array<{ agent: string; count: number; percentage: number }>;
  providerDistribution: Array<{ provider: string; count: number; tokens: number; estimatedCost: number }>;
  modelDistribution: Array<{ model: string; count: number; tokens: number }>;
  activeUsers: number;
  newUsers: number;
  popularSearches: Array<{ query: string; count: number }>;
  activityTimeline: Array<{ date: string; count: number }>;
};

export type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  projectsCount?: number;
  generationsCount?: number;
};

export type AdminProject = {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string | null;
  name: string;
  description: string;
  initialPrompt: string;
  status: string;
  framework: string;
  websitesCount?: number;
  generationsCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminWebsite = {
  id: string;
  projectId: string;
  projectName?: string;
  userEmail?: string;
  title: string;
  theme: string;
  version: number;
  pagesCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminGeneration = {
  id: string;
  projectId: string;
  projectName?: string;
  userId?: string;
  userEmail?: string;
  agent: string;
  userPrompt: string;
  status: string;
  tokenUsage?: number;
  createdAt: string;
};

export type AdminDeployment = {
  id: string;
  projectId: string;
  projectName?: string;
  userEmail?: string;
  provider: string;
  deploymentUrl?: string;
  deploymentId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BackendHealth = {
  service: string;
  provider: string;
  model: string;
  database: "connected" | "unavailable";
  storage: "postgresql" | "local";
  message: string;
};

export type SearchHistory = {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string | null;
  query: string;
  source: string;
  createdAt: string;
};

export type AdminDatabaseTables = {
  users: AdminUser;
  projects: AdminProject;
  websites: AdminWebsite;
  generations: AdminGeneration;
  deployments: AdminDeployment;
  "search-history": SearchHistory;
};

export type AdminDatabasePage<Row> = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminDatabaseSnapshot<Result> = {
  result: Result;
  source: "postgresql";
  refreshedAt: string;
};

import { getSession } from "next-auth/react";

function getBackendUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (configured && (typeof window === "undefined" || process.env.NODE_ENV === "production")) {
    return configured.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:4000`;
  }
  return "http://localhost:4000";
}

type CustomSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  accessToken?: string;
};

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, sessionToken?: string): Promise<T> {
  const accessToken = sessionToken ?? (await getSession())?.user?.accessToken;
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers
    },
    cache: "no-store"
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false || !data) {
    throw new ApiRequestError(data?.error?.message || `Request failed with ${response.status}`, response.status);
  }
  return data.data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    request<{ id: string; name?: string; email: string; role: string }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  health: () => request<BackendHealth>("/api/health"),
  getConfigStatus: () => request<ConfigStatus>("/api/config/status"),
  getProfile: () => request<UserProfile>("/api/auth/profile"),
  updateProfile: (body: { name: string; phone?: string; jobTitle?: string; location?: string; bio?: string }) =>
    request<UserProfile>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(body) }),
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (body: { name: string; description?: string; initialPrompt?: string }) =>
    request<Project>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  getLaunchReport: (id: string, signal?: AbortSignal) =>
    request<LaunchReport>(`/api/projects/${id}/launch-report`, { signal }),
  deleteProject: (id: string) => request<{ id: string }>(`/api/projects/${id}`, { method: "DELETE" }),
  generate: (projectId: string, prompt: string, accessToken?: string, signal?: AbortSignal) =>
    request<GenerationJob>(`/api/projects/${projectId}/generate`, {
      method: "POST",
      body: JSON.stringify({ prompt }),
      signal
    }, accessToken),
  getGenerationJob: (projectId: string, jobId: string, accessToken?: string, signal?: AbortSignal) =>
    request<GenerationJob>(`/api/projects/${projectId}/generation-jobs/${jobId}`, { signal }, accessToken),
  cancelGenerationJob: (projectId: string, jobId: string, accessToken?: string) =>
    request<GenerationJob>(`/api/projects/${projectId}/generation-jobs/${jobId}`, { method: "DELETE" }, accessToken),
  revise: (projectId: string, prompt: string) =>
    request<{ website: GeneratedWebsite; qa: GeneratedWebsite["qa"] }>(`/api/projects/${projectId}/revise`, {
      method: "POST",
      body: JSON.stringify({ prompt })
    }),
  deploy: (projectId: string, provider = "vercel") =>
    request<{ success: boolean; deploymentUrl?: string; deploymentId?: string; provider: string; status: string }>(`/api/projects/${projectId}/deploy`, {
      method: "POST",
      body: JSON.stringify({ provider })
    }),
  exportProject: async (projectId: string) => {
    const session = await getSession();
    const user = session?.user as CustomSessionUser | undefined;
    const headers: Record<string, string> = {};
    if (user?.accessToken) headers.Authorization = `Bearer ${user.accessToken}`;

    const response = await fetch(`${getBackendUrl()}/api/projects/${projectId}/export`, {
      headers,
      cache: "no-store"
    });
    if (!response.ok) throw new Error("ZIP export failed");
    return response.blob();
  },
  adminStats: () => request<AdminStats>("/api/admin/stats?dateRange=30d"),
  adminUsers: (search = "") => request<{ items: AdminUser[]; total: number }>("/api/admin/users?pageSize=50" + (search ? `&search=${encodeURIComponent(search)}` : "")),
  adminSearchHistory: () => request<{ items: SearchHistory[]; total: number }>("/api/admin/search-history?pageSize=50"),
  adminDatabaseStats: (accessToken: string, signal: AbortSignal) =>
    request<AdminDatabaseSnapshot<AdminStats>>("/api/admin/database", { signal }, accessToken),
  adminDatabaseRows: <Table extends keyof AdminDatabaseTables>(
    table: Table,
    page: number,
    search: string,
    accessToken: string,
    signal: AbortSignal
  ) => {
    const query = new URLSearchParams({ table, page: String(page), search });
    return request<AdminDatabaseSnapshot<AdminDatabasePage<AdminDatabaseTables[Table]>>>(
      `/api/admin/database?${query}`, { signal }, accessToken
    );
  }
};
