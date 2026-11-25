import dotenv from "dotenv";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";
import { createHmac, timingSafeEqual } from "node:crypto";
import JSZip from "jszip";
import { z } from "zod";
import { createLaunchReport, createProvider, ProviderError } from "@sitecraft/ml";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  recordDeployment,
  recordApiUsage,
  getUserRole,
  AdminDatabaseUnavailableError,
  getDatabaseStatus,
  getAdminStats,
  listAdminUsers,
  getAdminUserDetail,
  updateUserRole,
  listAdminProjects,
  getAdminProjectDetail,
  listAdminWebsites,
  getAdminWebsiteDetail,
  listAdminGenerations,
  getAdminGenerationDetail,
  getAdminUsageAnalytics,
  listAdminDeployments,
  listAdminChats,
  getAdminRecentActivity,
  listAdminAuditLogs,
  listAdminSearchHistory,
  recordSearchHistory,
  registerUser,
  authenticateUser,
  updateUserPassword,
  getUserProfile,
  updateUserProfile,
  provisionGoogleUser
} from "./store.js";
import { createEmailOtpChallenge, resendOtpChallenge, verifyGoogleOtp } from "./auth-otp.js";
import { answerAuraChat, auraChatInputSchema } from "./aura-chat.js";
import { createProjectSchema, promptSchema } from "./validators.js";
import { generateProject, reviseProject } from "./orchestrator.js";
import { deployToVercel } from "./deployment/vercel.js";
import { deployToNetlify } from "./deployment/netlify.js";
import { cancelGenerationJob, getGenerationJob, startGenerationJob, subscribeGenerationJob } from "./generation-jobs.js";

// Load .env from workspace or root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const port = Number(process.env.BACKEND_PORT || 4000);
const provider = createProvider();
const requestBuckets = new Map<string, { startedAt: number; count: number }>();
const rateLimitRules: Array<{ match: RegExp; limit: number; windowMs: number }> = [
  { match: /^\/api\/auth\/(login|register|email|password-reset|google)/, limit: 12, windowMs: 60_000 },
  { match: /\/(generate|revise|aura\/chat)$/, limit: 20, windowMs: 60_000 }
];

const adminDatabaseQuery = z.object({
  table: z.enum(["users", "projects", "websites", "generations", "deployments", "search-history"]).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  search: z.string().trim().max(200).default("")
});
const adminDatabaseTables = {
  users: listAdminUsers,
  projects: listAdminProjects,
  websites: listAdminWebsites,
  generations: listAdminGenerations,
  deployments: listAdminDeployments,
  "search-history": listAdminSearchHistory
};

function isRateLimited(request: http.IncomingMessage, pathname: string): boolean {
  const rule = rateLimitRules.find((candidate) => candidate.match.test(pathname));
  if (!rule) return false;
  const address = request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
    || request.socket.remoteAddress
    || "unknown";
  const key = `${address}:${rule.match.source}`;
  const now = Date.now();
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= rule.windowMs) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > rule.limit;
}

function corsOrigin(request: http.IncomingMessage): string {
  const origin = request.headers.origin;
  const configured = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== "production") {
    configured.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
  return origin && configured.includes(origin) ? origin : configured[0]!;
}

function sendJson(request: http.IncomingMessage, response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin(request),
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

type AuthIdentity = { id: string; email: string; role: string; exp: number };

function authSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be configured in production.");
  return secret || "sitecraft-development-secret-change-me";
}

function issueAuthToken(identity: Omit<AuthIdentity, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...identity, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readAuthIdentity(request: http.IncomingMessage): AuthIdentity | undefined {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ")) return undefined;
  const [payload, signature] = value.slice(7).split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;
  try {
    const identity = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthIdentity;
    return identity.exp > Date.now() ? identity : undefined;
  } catch {
    return undefined;
  }

}

function isInternalAuthRequest(request: http.IncomingMessage): boolean {
  const provided = request.headers["x-sitecraft-internal"]?.toString();
  const expected = authSecret();
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function errorResponse(error: unknown): { code: string; message: string } {
  if (error instanceof z.ZodError) return { code: "INVALID_INPUT", message: error.issues[0]?.message || "Invalid input" };
  if (error instanceof ProviderError) return { code: error.code, message: error.message };
  return { code: "REQUEST_FAILED", message: error instanceof Error ? error.message : "Request failed" };
}

function errorStatus(error: unknown): number {
  if (error instanceof ProviderError) {
    if (error.code === "INVALID_API_KEY") return 401;
    if (error.code === "RATE_LIMIT") return 429;
    if (error.code === "TIMEOUT") return 504;
    if (error.code === "MODEL_UNAVAILABLE") return 503;
    if (error.code === "MALFORMED_RESPONSE") return 502;
    if (error.code === "OUTPUT_LIMIT") return 502;
    if (error.code === "API_FAILURE") return 502;
  }
  if (error instanceof z.ZodError) return 400;
  if (error instanceof Error && error.message.includes("already exists")) return 409;
  if (error instanceof Error && error.message.includes("Turnstile")) return 503;
  return 500;
}

async function validateTurnstile(request: http.IncomingMessage, token: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error("Cloudflare Turnstile is not configured.");

  const socketIp = request.socket.remoteAddress;
  const remoteIp = request.headers["cf-connecting-ip"]?.toString()
    || (socketIp && socketIp !== "::1" && socketIp !== "127.0.0.1" ? socketIp : undefined);
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Cloudflare Turnstile validation failed.");

  const result = (await response.json()) as { success?: boolean };
  if (!result.success) throw new Error("Cloudflare Turnstile validation failed.");
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": corsOrigin(request),
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    });
    response.end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);
  if (isRateLimited(request, url.pathname)) {
    return sendJson(request, response, 429, { success: false, error: { code: "RATE_LIMIT", message: "Too many requests. Please try again shortly." } });
  }
  const identity = readAuthIdentity(request);
  const userId = identity?.id;
  const userRole = identity?.role;

  const requireAuth = (): boolean => {
    if (!userId) {
      sendJson(request, response, 401, { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required. Please sign in." } });
      return false;
    }
    return true;
  };

  const requireAdmin = async (): Promise<boolean> => {
    if (!requireAuth()) return false;
    // The signed token carries the canonical email. Passing it through avoids
    // losing the email when the database lookup starts from a UUID.
    const role = await getUserRole(identity?.email || userId!);
    if (role !== "ADMIN") {
      sendJson(request, response, 403, { success: false, error: { code: "FORBIDDEN", message: "Admin access required." } });
      return false;
    }
    return true;
  };

  const authorizeProject = async (projectId: string) => {
    if (!requireAuth()) return undefined;
    const project = await getProject(projectId, userId, userRole);
    if (!project) {
      sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Project not found" } });
    }
    return project;
  };

  try {
    // Health and configuration check endpoint
    if (request.method === "GET" && url.pathname === "/api/health") {
      const database = await getDatabaseStatus();
      return sendJson(request, response, 200, {
        success: true,
        data: {
          service: "sitecraft-backend",
          provider: provider.config.provider,
          model: provider.config.model,
          database: database.connected ? "connected" : "unavailable",
          storage: database.storage,
          message: provider.config.message || "SiteCraft AI engine operational."
        }
      });
    }

    // Config integration status for dashboard settings
    if (request.method === "GET" && url.pathname === "/api/config/status") {
      const database = await getDatabaseStatus();
      return sendJson(request, response, 200, {
        success: true,
        data: {
          gemini: Boolean(process.env.GEMINI_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY?.startsWith("sk-or-v1-")),
          bynara: process.env.BYNARA_ENABLED?.trim().toLowerCase() !== "false" && Boolean(process.env.BYNARA_API_KEY),
          database: database.connected,
          auth: Boolean(process.env.AUTH_SECRET),
          googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
          unsplash: Boolean(process.env.UNSPLASH_ACCESS_KEY),
          vercel: Boolean(process.env.VERCEL_TOKEN),
          netlify: Boolean(process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID),
          activeProvider: provider.config.provider,
          activeModel: provider.config.model
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/aura/chat") {
      const body = auraChatInputSchema.parse(await readBody(request));
      const result = await answerAuraChat(body, () => createProvider({
        ...process.env,
        OPENAI_API_KEY: "",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ||
          (process.env.OPENAI_API_KEY?.startsWith("sk-or-v1-") ? process.env.OPENAI_API_KEY : "") || "",
        AI_PROVIDER: "openrouter",
        AI_TEMPERATURE: "0.2",
        AI_MAX_TOKENS: "1200",
        OPENROUTER_MAX_TOKENS: "1200"
      }, { budgetMs: 20_000, attemptTimeoutMs: 7_000 }));
      return sendJson(request, response, 200, { success: true, data: result });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {
      const body = z.object({ name: z.string().trim().min(1).max(100), email: z.string().email(), password: z.string().min(8).max(128) }).parse(await readBody(request));
      const user = await registerUser(body);
      return sendJson(request, response, 201, { success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const body = z.object({
        email: z.string().email(),
        password: z.string().min(1).max(128),
        turnstileToken: z.string().min(1)
      }).parse(await readBody(request));
      await validateTurnstile(request, body.turnstileToken);
      const user = await authenticateUser(body.email, body.password);
      if (!user) return sendJson(request, response, 401, { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
      return sendJson(request, response, 200, { success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, accessToken: issueAuthToken({ id: user.id, email: user.email, role: user.role }) } });
    }

    if (url.pathname === "/api/auth/profile" && request.method === "GET") {
      if (!userId) return sendJson(request, response, 401, { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
      const user = await getUserProfile(userId);
      if (!user) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Profile not found." } });
      return sendJson(request, response, 200, { success: true, data: user });
    }

    if (url.pathname === "/api/auth/profile" && request.method === "PATCH") {
      if (!userId) return sendJson(request, response, 401, { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required." } });
      const body = z.object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().trim().max(30).optional(),
        jobTitle: z.string().trim().max(100).optional(),
        location: z.string().trim().max(100).optional(),
        bio: z.string().trim().max(500).optional()
      }).parse(await readBody(request));
      const user = await updateUserProfile(userId, body);
      if (!user) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Profile not found." } });
      return sendJson(request, response, 200, { success: true, data: user });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/google/login") {
      if (!isInternalAuthRequest(request)) {
        return sendJson(request, response, 403, { success: false, error: { code: "FORBIDDEN", message: "Internal authentication required." } });
      }
      const body = z.object({
        email: z.string().email(),
        name: z.string().trim().max(100).nullable().optional(),
        image: z.string().url().nullable().optional()
      }).parse(await readBody(request));
      const user = await provisionGoogleUser(body);
      return sendJson(request, response, 200, {
        success: true,
        data: { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image, accessToken: issueAuthToken({ id: user.id, email: user.email, role: user.role }) }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/email/start") {
      const body = z.object({
        email: z.string().email(),
        turnstileToken: z.string().min(1)
      }).parse(await readBody(request));
      await validateTurnstile(request, body.turnstileToken);
      const challenge = await createEmailOtpChallenge(body.email);
      return sendJson(request, response, 200, { success: true, data: challenge });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/password-reset/start") {
      const body = z.object({
        email: z.string().email(),
        turnstileToken: z.string().min(1)
      }).parse(await readBody(request));
      await validateTurnstile(request, body.turnstileToken);
      const user = await getUserProfile(body.email);
      const challenge = user ? await createEmailOtpChallenge(body.email) : undefined;
      return sendJson(request, response, 200, {
        success: true,
        data: {
          message: "If an account exists for that email, a verification code has been sent.",
          ...(challenge ? { challengeId: challenge.challengeId } : {})
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/password-reset/complete") {
      const body = z.object({
        challengeId: z.string().uuid(),
        otp: z.string().regex(/^\d{6}$/),
        password: z.string().min(8).max(128)
      }).parse(await readBody(request));
      const user = await verifyGoogleOtp(body.challengeId, body.otp);
      const updated = await updateUserPassword(user.email, body.password);
      if (!updated) {
        return sendJson(request, response, 400, {
          success: false,
          error: { code: "PASSWORD_RESET_FAILED", message: "Unable to reset the password for this account." }
        });
      }
      return sendJson(request, response, 200, {
        success: true,
        data: { message: "Password reset successfully." }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/email/resend") {
      const body = z.object({ challengeId: z.string().uuid() }).parse(await readBody(request));
      const challenge = await resendOtpChallenge(body.challengeId);
      return sendJson(request, response, 200, { success: true, data: challenge });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/google/verify-otp") {
      const body = z.object({ challengeId: z.string().uuid(), otp: z.string().regex(/^\d{6}$/) }).parse(await readBody(request));
      try {
        const user = await verifyGoogleOtp(body.challengeId, body.otp);
        if (!user) return sendJson(request, response, 401, { success: false, error: { code: "INVALID_OTP", message: "Invalid verification code." } });
        return sendJson(request, response, 200, { success: true, data: { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image, accessToken: issueAuthToken({ id: user.id, email: user.email, role: user.role }) } });
      } catch (error) {
        return sendJson(request, response, 401, { success: false, error: { code: "INVALID_OTP", message: error instanceof Error ? error.message : "Invalid verification code." } });
      }
    }

    // -------------------------------------------------------------------------
    // ADMIN API ROUTES (/api/admin/*)
    // -------------------------------------------------------------------------
    if (parts[0] === "api" && parts[1] === "admin") {
      if (!(await requireAdmin())) return;

      const subRoute = parts[2];
      const resourceId = parts[3];
      const action = parts[4];

      if (subRoute === "database" && !resourceId && request.method === "GET") {
        const { table, page, search } = adminDatabaseQuery.parse(Object.fromEntries(url.searchParams));
        const result = table
          ? await adminDatabaseTables[table]({ page, pageSize: 20, search, postgresOnly: true })
          : await getAdminStats("30d", true);

        return sendJson(request, response, 200, {
          success: true,
          data: { result, source: "postgresql", refreshedAt: new Date().toISOString() }
        });
      }

      // 1. Overview Stats: GET /api/admin/stats
      if (subRoute === "stats" && request.method === "GET") {
        const dateRange = url.searchParams.get("dateRange") || undefined;
        const stats = await getAdminStats(dateRange);
        return sendJson(request, response, 200, { success: true, data: stats });
      }

      // 2. Recent Activity: GET /api/admin/activity
      if (subRoute === "activity" && request.method === "GET") {
        const limit = Number(url.searchParams.get("limit") || 10);
        const activity = await getAdminRecentActivity(limit);
        return sendJson(request, response, 200, { success: true, data: activity });
      }

      // 3. Audit Logs: GET /api/admin/audit-logs
      if (subRoute === "audit-logs" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 20);
        const logs = await listAdminAuditLogs({ page, pageSize });
        return sendJson(request, response, 200, { success: true, data: logs });
      }

      // 4. Search history: GET /api/admin/search-history
      if (subRoute === "search-history" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 20);
        const search = url.searchParams.get("search") || undefined;
        const history = await listAdminSearchHistory({ page, pageSize, search });
        return sendJson(request, response, 200, { success: true, data: history });
      }

      // 5. Users: GET /api/admin/users, GET /api/admin/users/:id, PATCH /api/admin/users/:id/role
      if (subRoute === "users") {
        if (!resourceId && request.method === "GET") {
          const page = Number(url.searchParams.get("page") || 1);
          const pageSize = Number(url.searchParams.get("pageSize") || 20);
          const search = url.searchParams.get("search") || undefined;
          const role = url.searchParams.get("role") || undefined;
          const dateRange = url.searchParams.get("dateRange") || undefined;
          const users = await listAdminUsers({ page, pageSize, search, role, dateRange });
          return sendJson(request, response, 200, { success: true, data: users });
        }

        if (resourceId && !action && request.method === "GET") {
          const user = await getAdminUserDetail(resourceId);
          if (!user) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "User not found" } });
          return sendJson(request, response, 200, { success: true, data: user });
        }

        if (resourceId && action === "role" && request.method === "PATCH") {
          const body = (await readBody(request)) as { role?: "USER" | "ADMIN" };
          if (!body?.role || !["USER", "ADMIN"].includes(body.role)) {
            return sendJson(request, response, 400, { success: false, error: { code: "INVALID_ROLE", message: "Role must be USER or ADMIN" } });
          }
          const result = await updateUserRole(userId!, resourceId, body.role);
          if (!result.success) {
            return sendJson(request, response, 400, { success: false, error: { code: "UPDATE_FAILED", message: result.error || "Failed to update role" } });
          }
          return sendJson(request, response, 200, { success: true, data: result.user });
        }
      }

      // 5. Projects: GET /api/admin/projects, GET /api/admin/projects/:id
      if (subRoute === "projects") {
        if (!resourceId && request.method === "GET") {
          const page = Number(url.searchParams.get("page") || 1);
          const pageSize = Number(url.searchParams.get("pageSize") || 20);
          const search = url.searchParams.get("search") || undefined;
          const status = url.searchParams.get("status") || undefined;
          const framework = url.searchParams.get("framework") || undefined;
          const uId = url.searchParams.get("userId") || undefined;
          const dateRange = url.searchParams.get("dateRange") || undefined;
          const projects = await listAdminProjects({ page, pageSize, search, status, framework, userId: uId, dateRange });
          return sendJson(request, response, 200, { success: true, data: projects });
        }

        if (resourceId && request.method === "GET") {
          const project = await getAdminProjectDetail(resourceId);
          if (!project) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Project not found" } });
          return sendJson(request, response, 200, { success: true, data: project });
        }
      }

      // 6. Websites: GET /api/admin/websites, GET /api/admin/websites/:id
      if (subRoute === "websites") {
        if (!resourceId && request.method === "GET") {
          const page = Number(url.searchParams.get("page") || 1);
          const pageSize = Number(url.searchParams.get("pageSize") || 20);
          const search = url.searchParams.get("search") || undefined;
          const theme = url.searchParams.get("theme") || undefined;
          const websites = await listAdminWebsites({ page, pageSize, search, theme });
          return sendJson(request, response, 200, { success: true, data: websites });
        }

        if (resourceId && request.method === "GET") {
          const website = await getAdminWebsiteDetail(resourceId);
          if (!website) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Website not found" } });
          return sendJson(request, response, 200, { success: true, data: website });
        }
      }

      // 7. Generations: GET /api/admin/generations, GET /api/admin/generations/:id
      if (subRoute === "generations") {
        if (!resourceId && request.method === "GET") {
          const page = Number(url.searchParams.get("page") || 1);
          const pageSize = Number(url.searchParams.get("pageSize") || 20);
          const search = url.searchParams.get("search") || undefined;
          const agent = url.searchParams.get("agent") || undefined;
          const status = url.searchParams.get("status") || undefined;
          const pId = url.searchParams.get("projectId") || undefined;
          const uId = url.searchParams.get("userId") || undefined;
          const dateRange = url.searchParams.get("dateRange") || undefined;
          const generations = await listAdminGenerations({ page, pageSize, search, agent, status, projectId: pId, userId: uId, dateRange });
          return sendJson(request, response, 200, { success: true, data: generations });
        }

        if (resourceId && request.method === "GET") {
          const generation = await getAdminGenerationDetail(resourceId);
          if (!generation) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Generation not found" } });
          return sendJson(request, response, 200, { success: true, data: generation });
        }
      }

      // 8. AI Usage: GET /api/admin/usage
      if (subRoute === "usage" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 20);
        const pProvider = url.searchParams.get("provider") || undefined;
        const model = url.searchParams.get("model") || undefined;
        const uId = url.searchParams.get("userId") || undefined;
        const dateRange = url.searchParams.get("dateRange") || undefined;
        const usage = await getAdminUsageAnalytics({ page, pageSize, provider: pProvider, model, userId: uId, dateRange });
        return sendJson(request, response, 200, { success: true, data: usage });
      }

      // 9. Deployments: GET /api/admin/deployments
      if (subRoute === "deployments" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 20);
        const pProvider = url.searchParams.get("provider") || undefined;
        const status = url.searchParams.get("status") || undefined;
        const search = url.searchParams.get("search") || undefined;
        const deployments = await listAdminDeployments({ page, pageSize, provider: pProvider, status, search });
        return sendJson(request, response, 200, { success: true, data: deployments });
      }

      // 10. Chats: GET /api/admin/chats
      if (subRoute === "chats" && request.method === "GET") {
        const page = Number(url.searchParams.get("page") || 1);
        const pageSize = Number(url.searchParams.get("pageSize") || 20);
        const search = url.searchParams.get("search") || undefined;
        const pId = url.searchParams.get("projectId") || undefined;
        const chats = await listAdminChats({ page, pageSize, search, projectId: pId });
        return sendJson(request, response, 200, { success: true, data: chats });
      }
    }

    // -------------------------------------------------------------------------
    // STANDARD USER API ROUTES
    // -------------------------------------------------------------------------
    if (request.method === "GET" && url.pathname === "/api/projects") {
      if (!requireAuth()) return;
      const projects = await listProjects(userId!, userRole);
      return sendJson(request, response, 200, { success: true, data: projects });
    }

    if (request.method === "POST" && url.pathname === "/api/projects") {
      if (!requireAuth()) return;
      const body = createProjectSchema.parse(await readBody(request));
      const project = await createProject({
        userId: userId!,
        name: body.name,
        description: body.description,
        initialPrompt: body.initialPrompt,
        framework: body.framework
      });
      return sendJson(request, response, 201, { success: true, data: project });
    }

    if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
      const projectId = parts[2];
      const action = parts[3];

      if (!action) {
        if (request.method === "GET") {
          const project = await authorizeProject(projectId);
          if (!project) return;
          return sendJson(request, response, 200, { success: true, data: project });
        }
        if (request.method === "DELETE") {
          const project = await authorizeProject(projectId);
          if (!project) return;
          await deleteProject(projectId);
          return sendJson(request, response, 200, { success: true, data: { id: projectId } });
        }
      }

      if (request.method === "GET" && action === "launch-report" && !parts[4]) {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const site = project.websites[0]?.generatedCode;
        if (!site) {
          return sendJson(request, response, 404, { success: false, error: { code: "NO_WEBSITE", message: "Generate a website first." } });
        }
        const targets = [];
        if (process.env.VERCEL_TOKEN) targets.push("Vercel");
        if (process.env.NETLIFY_AUTH_TOKEN && process.env.NETLIFY_SITE_ID) targets.push("Netlify");
        const report = createLaunchReport(site, site.launchBriefs ?? [project.initialPrompt], targets);
        return sendJson(request, response, 200, { success: true, data: report });
      }

      if (request.method === "POST" && action === "generate") {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const body = promptSchema.parse(await readBody(request));
        await recordSearchHistory(userId!, body.prompt, "generation");
        const job = startGenerationJob(projectId, body.prompt, async (result) => {
          await recordApiUsage(userId!, result.provider || provider.config.provider, provider.config.model, 1250);
        });
        return sendJson(request, response, 202, { success: true, data: job });
      }

      if (parts[3] === "generation-jobs" && parts[4]) {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const jobId = parts[4];
        const job = getGenerationJob(jobId, projectId);
        if (!job) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Generation job not found." } });
        if (!parts[5] && request.method === "DELETE") return sendJson(request, response, 200, { success: true, data: cancelGenerationJob(jobId, projectId) });
        if (!parts[5] && request.method === "GET") return sendJson(request, response, 200, { success: true, data: job });
      }

      if (parts[3] === "generation-jobs" && parts[4] && parts[5] === "events" && request.method === "GET") {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const jobId = parts[4];
        const job = getGenerationJob(jobId, projectId);
        if (!job) return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Generation job not found." } });
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": corsOrigin(request)
        });
        const write = (value: typeof job) => response.write(`data: ${JSON.stringify(value)}\n\n`);
        write(job);
        const unsubscribe = subscribeGenerationJob(jobId, projectId, (next) => {
          write(next);
          if (["completed", "failed", "cancelled"].includes(next.status)) {
            unsubscribe();
            response.end();
          }
        });
        request.on("close", () => {
          unsubscribe();
          if (!response.writableEnded) response.end();
        });
        return;
      }

      if (request.method === "POST" && action === "revise") {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const body = promptSchema.parse(await readBody(request));
        await recordSearchHistory(userId!, body.prompt, "revision");
        const result = await reviseProject(projectId, body.prompt);
        await recordApiUsage(userId!, provider.config.provider, provider.config.model, 650);
        return sendJson(request, response, 200, { success: true, data: result });
      }

      if (request.method === "GET" && action === "export") {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const website = project.websites[0];
        if (!website) return sendJson(request, response, 400, { success: false, error: { code: "NO_WEBSITE", message: "Generate a website first" } });

        const zip = new JSZip();
        for (const file of website.generatedCode.files) {
          zip.file(file.path, file.content);
        }
        zip.file("dist/index.html", website.generatedCode.html);

        const archive = await zip.generateAsync({ type: "nodebuffer" });
        response.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-site.zip"`,
          "Access-Control-Allow-Origin": corsOrigin(request),
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
        });
        response.end(archive);
        return;
      }

      if (request.method === "POST" && action === "deploy") {
        const project = await authorizeProject(projectId);
        if (!project) return;
        const body = (await readBody(request)) as { provider?: string };
        const deployProvider = body.provider || "vercel";
        const latestWebsite = project.websites[0];

        if (!latestWebsite) {
          return sendJson(request, response, 400, {
            success: false,
            error: { code: "NO_WEBSITE", message: "Cannot deploy a project without generated website code." }
          });
        }

        let deployResult;
        if (deployProvider === "netlify") {
          deployResult = await deployToNetlify(project.name, latestWebsite.generatedCode.files);
        } else {
          deployResult = await deployToVercel(project.name, latestWebsite.generatedCode.files);
        }

        if (deployResult.success) {
          await recordDeployment(projectId, {
            provider: deployResult.provider,
            deploymentUrl: deployResult.deploymentUrl,
            deploymentId: deployResult.deploymentId,
            status: deployResult.status
          });
        }

        return sendJson(request, response, deployResult.success ? 200 : 400, {
          success: deployResult.success,
          data: deployResult,
          ...(deployResult.error ? { error: { code: "DEPLOYMENT_FAILED", message: deployResult.error } } : {})
        });
      }
    }

    return sendJson(request, response, 404, { success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  } catch (error) {
    if (error instanceof AdminDatabaseUnavailableError) {
      return sendJson(request, response, 503, {
        success: false,
        error: { code: "DATABASE_UNAVAILABLE", message: error.message }
      });
    }
    const failure = errorResponse(error);
    console.error(JSON.stringify({
      event: "request_failed",
      path: url.pathname,
      error: failure,
      ...(error instanceof ProviderError ? { provider: error.provider, model: error.model, status: error.status } : {})
    }));
    return sendJson(request, response, errorStatus(error), { success: false, error: failure });
  }
});

server.listen(port, () => {
  console.log(JSON.stringify({
    event: "backend_started",
    port,
    activeProvider: provider.config.provider,
    model: provider.config.model
  }));
  void getDatabaseStatus().then((database) => {
    console.log(JSON.stringify({
      event: "database_status",
      connected: database.connected,
      storage: database.storage,
      message: database.message
    }));
  });
  const databaseRetryTimer = setInterval(() => {
    void getDatabaseStatus();
  }, 30_000);
  databaseRetryTimer.unref();
});

const handleShutdown = () => {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000).unref();
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);
