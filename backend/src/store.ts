import dotenv from "dotenv";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { createDatabaseClient, describeDatabaseFailure } from "./database-connection.js";
import { DatabaseHealthMonitor } from "./database-health.js";
import type { GeneratedSitePayload } from "@sitecraft/ml";
import type {
  AdminAuditLogRecord,
  AdminStats,
  ApiUsageRecord,
  ChatMessageRecord,
  DeploymentRecord,
  GenerationRecord,
  PaginatedResult,
  ProjectRecord,
  RecentActivityItem,
  SearchHistoryRecord,
  StoreData,
  UserRecord,
  UserRole,
  WebsitePageRecord,
  WebsiteRecord
} from "./types.js";

// Load .env from current directory or parent directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const dataDir = path.resolve(process.env.SITECRAFT_DATA_DIR || path.join(process.cwd(), ".data"));
const dataFile = path.join(dataDir, "sitecraft.json");

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be configured in production. Local JSON storage is development-only.");
}

let prisma: PrismaClient | null = null;
let databaseInitializationError: unknown;
if (process.env.DATABASE_URL) {
  try {
    prisma = createDatabaseClient();
  } catch (error) {
    databaseInitializationError = error;
    console.warn("Could not initialize database client:", describeDatabaseFailure(error));
  }
}

let dbFailureLogged = false;
const DB_RETRY_INTERVAL = 30_000;
const DB_PROBE_TIMEOUT = 15_000;
let dbSyncInProgress = false;
let lastDbSyncAt = 0;
const DB_SYNC_INTERVAL = 5 * 60_000;
const scrypt = promisify(scryptCallback);
const databaseHealth = new DatabaseHealthMonitor(async () => {
  const rows = await prisma!.$queryRaw<Array<{ read_only: string }>>`SELECT current_setting('transaction_read_only') AS read_only`;
  if (rows[0]?.read_only === "on") throw new Error("Database is read-only.");
}, { timeoutMs: DB_PROBE_TIMEOUT, retryIntervalMs: DB_RETRY_INTERVAL, onFailure: logDbFailure });

type OtpChallengeRecord = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  providerId: string | null;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
};
const otpChallenges = new Map<string, OtpChallengeRecord>();

export async function upsertGoogleUser(input: Pick<OtpChallengeRecord, "id" | "email" | "name" | "image" | "providerId" | "codeHash" | "expiresAt">): Promise<OtpChallengeRecord> {
  const record: OtpChallengeRecord = { ...input, attempts: 0, consumedAt: null, createdAt: new Date() };
  if (isDbOnline()) {
    try {
      return await prisma!.otpChallenge.create({
        data: {
          id: record.id,
          email: record.email,
          name: record.name,
          image: record.image,
          providerId: record.providerId,
          codeHash: record.codeHash,
          expiresAt: record.expiresAt,
          attempts: record.attempts,
          consumedAt: record.consumedAt,
          createdAt: record.createdAt
        }
      });
    } catch (error) {
      markDbFailed(error);
    }
  }
  otpChallenges.set(record.id, record);
  return record;
}

export async function getUserForAuth(id: string): Promise<OtpChallengeRecord | undefined> {
  if (isDbOnline()) {
    try {
      return (await prisma!.otpChallenge.findUnique({ where: { id } })) ?? undefined;
    } catch (error) {
      markDbFailed(error);
    }
  }
  return otpChallenges.get(id);
}

export async function getLatestOtpChallenge(email: string): Promise<OtpChallengeRecord | undefined> {
  if (isDbOnline()) {
    try {
      return (await prisma!.otpChallenge.findFirst({
        where: { email, consumedAt: null },
        orderBy: { createdAt: "desc" }
      })) ?? undefined;
    } catch (error) {
      markDbFailed(error);
    }
  }
  return [...otpChallenges.values()]
    .filter((challenge) => challenge.email === email && !challenge.consumedAt)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
}

export async function incrementOtpAttempts(id: string, maxAttempts = 5): Promise<boolean> {
  if (isDbOnline()) {
    try {
      const result = await prisma!.otpChallenge.updateMany({
        where: { id, attempts: { lt: maxAttempts } },
        data: { attempts: { increment: 1 } }
      });
      return result.count === 1;
    } catch (error) {
      markDbFailed(error);
    }
  }
  const challenge = otpChallenges.get(id);
  if (!challenge || challenge.attempts >= maxAttempts) return false;
  challenge.attempts += 1;
  return true;
}

export async function consumeOtpChallenge(id: string): Promise<UserRecord | undefined> {
  const challenge = await getUserForAuth(id);
  if (!challenge) return undefined;
  const user = await findOrCreateGoogleUser(challenge);
  if (isDbOnline()) {
    try {
      await prisma!.otpChallenge.update({ where: { id }, data: { consumedAt: new Date() } });
    } catch (error) {
      markDbFailed(error);
    }
  } else {
    challenge.consumedAt = new Date();
  }
  return user;
}

async function findOrCreateGoogleUser(challenge: OtpChallengeRecord): Promise<UserRecord> {
  const now = new Date();
  if (isDbOnline()) {
    try {
      const user = await prisma!.user.upsert({
        where: { email: challenge.email },
        update: {
          ...(challenge.name !== null ? { name: challenge.name } : {}),
          ...(challenge.image !== null ? { image: challenge.image } : {}),
          emailVerified: now,
          updatedAt: now
        },
        create: {
          id: randomUUID(),
          email: challenge.email,
          name: challenge.name,
          image: challenge.image,
          emailVerified: now,
          createdAt: now,
          updatedAt: now
        }
      });
      return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role as UserRole, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
    } catch (error) {
      markDbFailed(error);
    }
  }
  const data = await load();
  if (!data.users) data.users = [];
  const existing = data.users.find((user) => user.email === challenge.email);
  if (existing) return existing;
  const user: UserRecord = { id: randomUUID(), name: challenge.name, email: challenge.email, image: challenge.image, role: "USER", createdAt: now.toISOString(), updatedAt: now.toISOString() };
  data.users.push(user);
  await save(data);
  return user;
}

export async function provisionGoogleUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<UserRecord> {
  return findOrCreateGoogleUser({
    id: randomUUID(),
    email: input.email,
    name: input.name ?? null,
    image: input.image ?? null,
    providerId: null,
    codeHash: "",
    expiresAt: new Date(0),
    attempts: 0,
    consumedAt: null,
    createdAt: new Date()
  });
}

function isDbOnline(): boolean {
  if (!prisma || !process.env.DATABASE_URL) return false;
  return databaseHealth.connected;
}

function markDbFailed(err: unknown) {
  databaseHealth.fail(err);
}

function logDbFailure(err: unknown) {
  if (dbFailureLogged) return;
  dbFailureLogged = true;
  const message = describeDatabaseFailure(err);
  console.warn(`PostgreSQL unavailable; using local file storage until retry: ${message}`);
}

export type DatabaseStatus = {
  configured: boolean;
  connected: boolean;
  storage: "postgresql" | "local";
  message: string;
};

/**
 * Performs a real database probe instead of treating DATABASE_URL as proof
 * that PostgreSQL is available. When the connection recovers, local fallback
 * records are copied into PostgreSQL before normal DB-backed reads resume.
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  if (!prisma || !process.env.DATABASE_URL) {
    const configured = Boolean(process.env.DATABASE_URL);
    return {
      configured,
      connected: false,
      storage: "local",
      message: configured ? describeDatabaseFailure(databaseInitializationError) : "DATABASE_URL is not configured."
    };
  }

  const recovered = !databaseHealth.connected;
  if (await databaseHealth.check()) {
    dbFailureLogged = false;
    if (recovered || Date.now() - lastDbSyncAt > DB_SYNC_INTERVAL) {
      await syncLocalStoreToDatabase();
    }
  }
  const connected = databaseHealth.connected;
  return {
    configured: true,
    connected,
    storage: connected ? "postgresql" : "local",
    message: connected ? "PostgreSQL connected." : describeDatabaseFailure(databaseHealth.error),
  };
}

/**
 * Imports records created while PostgreSQL was unavailable. The operation is
 * idempotent and maps local user IDs to existing database users by email so a
 * later recovery cannot create duplicate accounts.
 */
export async function syncLocalStoreToDatabase(): Promise<{ synced: boolean; users: number; projects: number }> {
  if (!prisma || dbSyncInProgress) return { synced: false, users: 0, projects: 0 };
  dbSyncInProgress = true;
  try {
    const data = await load();
    const users = data.users || [];
    const projects = data.projects || [];
    const userIdMap = new Map<string, string>();

    for (const user of users) {
      const email = normalizeEmail(user.email);
      const existing = await prisma.user.findUnique({ where: { email } });
      const values = {
        name: user.name ?? null,
        image: user.image ?? null,
        phone: user.phone ?? null,
        jobTitle: user.jobTitle ?? null,
        location: user.location ?? null,
        bio: user.bio ?? null,
        role: user.role === "ADMIN" ? "ADMIN" : "USER",
        updatedAt: new Date(user.updatedAt),
        ...(user.passwordHash ? { passwordHash: user.passwordHash } : {})
      };
      const saved = existing
        ? await prisma.user.update({ where: { id: existing.id }, data: values as any })
        : await prisma.user.create({
            data: {
              id: user.id,
              email,
              ...values,
              createdAt: new Date(user.createdAt)
            } as any
          });
      userIdMap.set(user.id, saved.id);
    }

    for (const project of projects) {
      let databaseUserId = userIdMap.get(project.userId);
      if (!databaseUserId) {
        const fallbackEmail = getEmailForUser(project.userId);
        const fallbackUser = await prisma.user.upsert({
          where: { email: fallbackEmail },
          update: { updatedAt: new Date() },
          create: {
            id: project.userId,
            email: fallbackEmail,
            name: fallbackEmail.split("@")[0],
            role: isConfiguredAdmin(fallbackEmail) ? "ADMIN" : "USER",
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt)
          }
        });
        databaseUserId = fallbackUser.id;
      }

      await prisma.project.upsert({
        where: { id: project.id },
        update: {
          userId: databaseUserId,
          name: project.name,
          description: project.description || "",
          initialPrompt: project.initialPrompt,
          status: projectStatusToDb(project.status),
          framework: project.framework,
          updatedAt: new Date(project.updatedAt)
        },
        create: {
          id: project.id,
          userId: databaseUserId,
          name: project.name,
          description: project.description || "",
          initialPrompt: project.initialPrompt,
          status: projectStatusToDb(project.status),
          framework: project.framework,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }
      });

      for (const website of project.websites || []) {
        await prisma.website.upsert({
          where: { id: website.id },
          update: {
            title: website.title,
            description: website.description || "",
            theme: website.theme,
            colorPalette: website.colorPalette as any,
            fontFamily: website.fontFamily,
            structure: website.structure as any,
            generatedCode: website.generatedCode as any,
            version: website.version,
            updatedAt: new Date(website.updatedAt)
          },
          create: {
            id: website.id,
            projectId: project.id,
            title: website.title,
            description: website.description || "",
            theme: website.theme,
            colorPalette: website.colorPalette as any,
            fontFamily: website.fontFamily,
            structure: website.structure as any,
            generatedCode: website.generatedCode as any,
            version: website.version,
            createdAt: new Date(website.createdAt),
            updatedAt: new Date(website.updatedAt)
          }
        });
      }

      for (const generation of project.generations || []) {
        await prisma.generation.upsert({
          where: { id: generation.id },
          update: {
            userPrompt: generation.userPrompt,
            agent: generation.agent,
            input: generation.input as any,
            output: generation.output as any,
            status: generationStatusToDb(generation.status),
            error: generation.error || null,
            tokenUsage: generation.tokenUsage || null
          },
          create: {
            id: generation.id,
            projectId: project.id,
            userPrompt: generation.userPrompt,
            agent: generation.agent,
            input: generation.input as any,
            output: generation.output as any,
            status: generationStatusToDb(generation.status),
            error: generation.error || null,
            tokenUsage: generation.tokenUsage || null,
            createdAt: new Date(generation.createdAt)
          }
        });
      }

      for (const message of project.messages || []) {
        await prisma.chatMessage.upsert({
          where: { id: message.id },
          update: { role: message.role, content: message.content },
          create: {
            id: message.id,
            projectId: project.id,
            role: message.role,
            content: message.content,
            createdAt: new Date(message.createdAt)
          }
        });
      }
    }

    for (const deployment of data.deployments || []) {
      await prisma.deployment.upsert({
        where: { id: deployment.id },
        update: {
          provider: deployment.provider,
          deploymentUrl: deployment.deploymentUrl || null,
          deploymentId: deployment.deploymentId || null,
          status: deployment.status,
          updatedAt: new Date(deployment.updatedAt)
        },
        create: {
          id: deployment.id,
          projectId: deployment.projectId,
          provider: deployment.provider,
          deploymentUrl: deployment.deploymentUrl || null,
          deploymentId: deployment.deploymentId || null,
          status: deployment.status,
          createdAt: new Date(deployment.createdAt),
          updatedAt: new Date(deployment.updatedAt)
        }
      });
    }

    lastDbSyncAt = Date.now();
    return { synced: true, users: users.length, projects: projects.length };
  } catch (error) {
    markDbFailed(error);
    return { synced: false, users: 0, projects: 0 };
  } finally {
    dbSyncInProgress = false;
  }
}

async function load(): Promise<StoreData> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreData;
  } catch {
    return { users: [], projects: [], deployments: [], apiUsage: [], auditLogs: [], searchHistory: [] };
  }
}

async function save(data: StoreData): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(data, null, 2));
}

function getEmailForUser(userId: string): string {
  const normalized = userId.trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  const safeUserId = normalized.replace(/[^a-z0-9._-]/g, "-") || "demo-user";
  return `${safeUserId}@sitecraft.local`;
}

function mapWebsite(record: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  theme: string;
  colorPalette: unknown;
  fontFamily: string;
  structure: unknown;
  generatedCode: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: { WebsitePage?: number };
}): WebsiteRecord {
  const generatedCode = record.generatedCode as WebsiteRecord["generatedCode"];
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    description: record.description || "",
    theme: record.theme,
    colorPalette: record.colorPalette as WebsiteRecord["colorPalette"],
    fontFamily: record.fontFamily,
    structure: record.structure as WebsiteRecord["structure"],
    generatedCode,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    qa: (generatedCode as GeneratedSitePayload & { qa?: WebsiteRecord["qa"] })?.qa,
    pagesCount: record._count?.WebsitePage ?? 0
  };
}

export async function ensureUser(userId: string, role?: string): Promise<string> {
  const now = new Date();
  const email = getEmailForUser(userId);
  const isAdmin = isConfiguredAdmin(email) || role === "admin" || role === "ADMIN";

  if (isDbOnline() && prisma) {
    try {
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (existing) return existing.id;

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          id: userId,
          name: userId.split("@")[0] || userId,
          email,
          role: isAdmin ? "ADMIN" : "USER",
          createdAt: now,
          updatedAt: now
        },
        update: {
          name: userId.split("@")[0] || userId,
          updatedAt: now,
          ...(isAdmin ? { role: "ADMIN" } : {})
        }
      });
      return user.id;
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  if (!data.users) data.users = [];
  let user = data.users.find((u) => u.email === email || u.id === userId);
  if (!user) {
    user = {
      id: userId,
      name: userId.split("@")[0] || userId,
      email,
      role: isAdmin ? "ADMIN" : "USER",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    data.users.push(user);
    await save(data);
  }
  return user.id;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isConfiguredAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS || "admin@sitecraft.ai")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalizeEmail(email));
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey);
}

export async function registerUser(data: { name: string; email: string; password: string }): Promise<UserRecord> {
  const email = normalizeEmail(data.email);
  const passwordHash = await hashPassword(data.password);
  const now = new Date();
  const id = randomUUID();

  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.create({
        data: {
          id,
          name: data.name.trim(),
          email,
          passwordHash,
          role: isConfiguredAdmin(email) ? "ADMIN" : "USER",
          createdAt: now,
          updatedAt: now
        }
      });
      return { id: user.id, name: user.name, email: user.email, role: isConfiguredAdmin(email) ? "ADMIN" : user.role as UserRole, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") throw new Error("An account with this email already exists.");
      markDbFailed(err);
    }
  }

  const dataFileState = await load();
  if (!dataFileState.users) dataFileState.users = [];
  if (dataFileState.users.some((user) => user.email === email)) throw new Error("An account with this email already exists.");
  const user: UserRecord = {
    id,
    name: data.name.trim(),
    email,
    passwordHash,
    role: isConfiguredAdmin(email) ? "ADMIN" : "USER",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  dataFileState.users.push(user);
  await save(dataFileState);
  return user;
}

export async function authenticateUser(emailInput: string, password: string): Promise<UserRecord | undefined> {
  const email = normalizeEmail(emailInput);
  const bootstrapPassword = process.env.ADMIN_PASSWORD;

  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user && isConfiguredAdmin(email) && bootstrapPassword && password === bootstrapPassword) {
        await registerUser({ name: "Administrator", email, password: bootstrapPassword });
        const provisioned = await prisma.user.findUnique({ where: { email } });
        if (provisioned?.passwordHash && await verifyPassword(password, provisioned.passwordHash)) {
          return {
            id: provisioned.id,
            name: provisioned.name,
            email: provisioned.email,
            role: "ADMIN",
            createdAt: provisioned.createdAt.toISOString(),
            updatedAt: provisioned.updatedAt.toISOString()
          };
        }
      }
      if (user?.passwordHash && await verifyPassword(password, user.passwordHash)) {
        const isAdmin = isConfiguredAdmin(user.email);
        if (isAdmin && user.role !== "ADMIN") {
          await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN", updatedAt: new Date() } });
        }
        return { id: user.id, name: user.name, email: user.email, role: isAdmin ? "ADMIN" : user.role as UserRole, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
      }

      return undefined;
    } catch (err) {
      markDbFailed(err);
    }
  }

  const dataFileState = await load();
  let user = dataFileState.users?.find((candidate) => candidate.email === email);
  if (!user && isConfiguredAdmin(email) && bootstrapPassword && password === bootstrapPassword) {
    const provisioned = await registerUser({ name: "Administrator", email, password: bootstrapPassword });
    user = provisioned;
  }
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return undefined;
  return user ? { ...user, role: isConfiguredAdmin(email) ? "ADMIN" : user.role } : undefined;
}

export async function updateUserPassword(emailInput: string, password: string): Promise<boolean> {
  const email = normalizeEmail(emailInput);
  const passwordHash = await hashPassword(password);
  const now = new Date();

  if (isDbOnline() && prisma) {
    try {
      const result = await prisma.user.updateMany({
        where: { email },
        data: { passwordHash, updatedAt: now }
      });
      return result.count === 1;
    } catch (err) {
      markDbFailed(err);
    }
  }

  const dataFileState = await load();
  const user = dataFileState.users?.find((candidate) => candidate.email === email);
  if (!user) return false;
  user.passwordHash = passwordHash;
  user.updatedAt = now.toISOString();
  await save(dataFileState);
  return true;
}

export async function getUserProfile(emailInput: string): Promise<UserRecord | undefined> {
  const email = normalizeEmail(emailInput);
  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return undefined;
      return {
        id: user.id, name: user.name, email: user.email, image: user.image,
        phone: user.phone, jobTitle: user.jobTitle, location: user.location, bio: user.bio,
        role: user.role as UserRole, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString()
      };
    } catch (error) {
      markDbFailed(error);
    }
  }
  const data = await load();
  const existing = data.users?.find((user) => user.email === email);
  if (existing) return existing;
  const now = new Date().toISOString();
  const user: UserRecord = { id: randomUUID(), email, name: null, role: "USER", createdAt: now, updatedAt: now };
  data.users = [...(data.users || []), user];
  await save(data);
  return user;
}

export async function updateUserProfile(emailInput: string, updates: { name: string; phone?: string; jobTitle?: string; location?: string; bio?: string }): Promise<UserRecord | undefined> {
  const email = normalizeEmail(emailInput);
  const values = {
    name: updates.name.trim(),
    phone: updates.phone?.trim() || null,
    jobTitle: updates.jobTitle?.trim() || null,
    location: updates.location?.trim() || null,
    bio: updates.bio?.trim() || null
  };
  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.update({ where: { email }, data: { ...values, updatedAt: new Date() } });
      return {
        id: user.id, name: user.name, email: user.email, image: user.image,
        phone: user.phone, jobTitle: user.jobTitle, location: user.location, bio: user.bio,
        role: user.role as UserRole, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString()
      };
    } catch (error) {
      if ((error as { code?: string }).code === "P2025") return undefined;
      markDbFailed(error);
    }
  }
  const data = await load();
  const user = data.users?.find((candidate) => candidate.email === email);
  if (!user) {
    const now = new Date().toISOString();
    const created: UserRecord = { id: randomUUID(), email, ...values, role: "USER", createdAt: now, updatedAt: now };
    data.users = [...(data.users || []), created];
    await save(data);
    return created;
  }
  Object.assign(user, values, { updatedAt: new Date().toISOString() });
  await save(data);
  return user;
}

export async function getUserRole(userIdOrEmail: string): Promise<UserRole> {
  const email = getEmailForUser(userIdOrEmail);
  if (isConfiguredAdmin(userIdOrEmail)) return "ADMIN";

  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userIdOrEmail }, { email }] },
        select: { email: true, role: true }
      });
      if (user) return isConfiguredAdmin(user.email) ? "ADMIN" : user.role as UserRole;
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const user = data.users?.find((u) => u.email === email || u.id === userIdOrEmail);
  return user ? (isConfiguredAdmin(user.email) ? "ADMIN" : user.role) : "USER";
}

type ProjectStatusDb = "DRAFT" | "GENERATING" | "READY" | "FAILED";
type ProjectStatusApp = ProjectRecord["status"];
type GenerationStatusDb = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";

function projectStatusToDb(status: ProjectStatusApp): ProjectStatusDb {
  return status.toUpperCase() as ProjectStatusDb;
}

function projectStatusFromDb(status: string): ProjectStatusApp {
  return status.toLowerCase() as ProjectStatusApp;
}

function generationStatusToDb(status: GenerationRecord["status"]): GenerationStatusDb {
  switch (status) {
    case "started":
    case "RUNNING":
      return "RUNNING";
    case "completed":
    case "SUCCESS":
      return "SUCCESS";
    default:
      return "FAILED";
  }
}

function generationStatusFromDb(status: string): GenerationRecord["status"] {
  switch (status) {
    case "RUNNING":
      return "started";
    case "SUCCESS":
      return "completed";
    default:
      return "failed";
  }
}

// -----------------------------------------------------------------------------
// STANDARD APPLICATION QUERIES
// -----------------------------------------------------------------------------

export async function listProjects(userId: string, role?: string): Promise<ProjectRecord[]> {
  const isAdmin = role === "admin" || role === "ADMIN";
  if (isDbOnline() && prisma) {
    try {
      const projects = (await prisma.project.findMany({
        where: isAdmin ? {} : { userId },
        orderBy: { updatedAt: "desc" },
        include: {
          Website: { orderBy: { version: "desc" } },
          Generation: { orderBy: { createdAt: "desc" } },
          ChatMessage: { orderBy: { createdAt: "asc" } },
          Deployment: { orderBy: { createdAt: "desc" } }
        }
      }) as any[]) as Array<{
        id: string;
        userId: string;
        name: string;
        description: string | null;
        initialPrompt: string;
        status: string;
        framework: string;
        createdAt: Date;
        updatedAt: Date;
        Website: Array<any>;
        Generation: Array<any>;
        ChatMessage: Array<any>;
        Deployment: Array<any>;
      }>;

      return projects.map((project) => ({
        id: project.id,
        userId: project.userId,
        name: project.name,
        description: project.description || "",
        initialPrompt: project.initialPrompt,
        status: projectStatusFromDb(project.status),
        framework: project.framework,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        websites: project.Website.map(mapWebsite),
        generations: project.Generation.map((generation: any) => ({
          id: generation.id,
          agent: generation.agent,
          userPrompt: generation.userPrompt,
          status: generationStatusFromDb(generation.status),
          input: generation.input,
          output: generation.output,
          error: generation.error || undefined,
          createdAt: generation.createdAt.toISOString()
        })),
        messages: project.ChatMessage.map((message: any) => ({
          id: message.id,
          role: message.role as ChatMessageRecord["role"],
          content: message.content,
          createdAt: message.createdAt.toISOString()
        })),
        deployments: (project.Deployment || []).map((dep: any) => ({
          id: dep.id,
          projectId: dep.projectId,
          provider: dep.provider,
          deploymentUrl: dep.deploymentUrl || undefined,
          deploymentId: dep.deploymentId || undefined,
          status: dep.status,
          createdAt: dep.createdAt.toISOString(),
          updatedAt: dep.updatedAt.toISOString()
        }))
      }));
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const list = data.projects || [];
  return isAdmin ? list : list.filter((p) => p.userId === userId);
}

export async function getProject(id: string, userId?: string, role?: string): Promise<ProjectRecord | undefined> {
  const isAdmin = role === "admin" || role === "ADMIN";
  if (isDbOnline() && prisma) {
    try {
      const where = isAdmin ? { id } : userId ? { id, userId } : { id };
      const project = (await prisma.project.findFirst({
        where,
        include: {
          Website: { orderBy: { version: "desc" } },
          Generation: { orderBy: { createdAt: "desc" } },
          ChatMessage: { orderBy: { createdAt: "asc" } },
          Deployment: { orderBy: { createdAt: "desc" } }
        }
      }) as any | null) as {
        id: string;
        userId: string;
        name: string;
        description: string | null;
        initialPrompt: string;
        status: string;
        framework: string;
        createdAt: Date;
        updatedAt: Date;
        Website: Array<any>;
        Generation: Array<any>;
        ChatMessage: Array<any>;
        Deployment: Array<any>;
      } | null;

      if (project) {
        return {
          id: project.id,
          userId: project.userId,
          name: project.name,
          description: project.description || "",
          initialPrompt: project.initialPrompt,
          status: projectStatusFromDb(project.status),
          framework: project.framework,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          websites: project.Website.map(mapWebsite),
          generations: project.Generation.map((generation: any) => ({
            id: generation.id,
            agent: generation.agent,
            userPrompt: generation.userPrompt,
            status: generationStatusFromDb(generation.status),
            input: generation.input,
            output: generation.output,
            error: generation.error || undefined,
            createdAt: generation.createdAt.toISOString()
          })),
          messages: project.ChatMessage.map((message: any) => ({
            id: message.id,
            role: message.role as ChatMessageRecord["role"],
            content: message.content,
            createdAt: message.createdAt.toISOString()
          })),
          deployments: (project.Deployment || []).map((dep: any) => ({
            id: dep.id,
            projectId: dep.projectId,
            provider: dep.provider,
            deploymentUrl: dep.deploymentUrl || undefined,
            deploymentId: dep.deploymentId || undefined,
            status: dep.status,
            createdAt: dep.createdAt.toISOString(),
            updatedAt: dep.updatedAt.toISOString()
          }))
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const project = (data.projects || []).find((item) => item.id === id);
  if (!project) return undefined;
  if (!isAdmin && userId && project.userId !== userId) return undefined;
  return project;
}

export async function createProject(data: {
  userId: string;
  name: string;
  description?: string;
  initialPrompt: string;
  framework?: string;
}): Promise<ProjectRecord> {
  const now = new Date();
  const validUserId = await ensureUser(data.userId);

  if (isDbOnline() && prisma) {
    try {
      const created = await prisma.project.create({
        data: {
          id: randomUUID(),
          userId: validUserId,
          name: data.name,
          description: data.description || "",
          initialPrompt: data.initialPrompt,
          status: projectStatusToDb("draft"),
          framework: data.framework || "nextjs-react-tailwind",
          createdAt: now,
          updatedAt: now
        }
      });
      return {
        id: created.id,
        userId: created.userId,
        name: created.name,
        description: created.description || "",
        initialPrompt: created.initialPrompt,
        status: "draft",
        framework: created.framework,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        websites: [],
        generations: [],
        messages: [],
        deployments: []
      };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const store = await load();
  const record: ProjectRecord = {
    id: randomUUID(),
    userId: data.userId,
    name: data.name,
    description: data.description || "",
    initialPrompt: data.initialPrompt,
    status: "draft",
    framework: data.framework || "nextjs-react-tailwind",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    websites: [],
    generations: [],
    messages: [],
    deployments: []
  };
  if (!store.projects) store.projects = [];
  store.projects.unshift(record);
  await save(store);
  return record;
}

export async function updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | undefined> {
  const now = new Date();
  if (isDbOnline() && prisma) {
    try {
      const data: Record<string, unknown> = { updatedAt: now };
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.initialPrompt !== undefined) data.initialPrompt = updates.initialPrompt;
      if (updates.status !== undefined) data.status = projectStatusToDb(updates.status);
      if (updates.framework !== undefined) data.framework = updates.framework;

      await prisma.project.update({ where: { id }, data });
      return getProject(id);
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const project = (data.projects || []).find((item) => item.id === id);
  if (!project) return undefined;
  Object.assign(project, updates, { updatedAt: now.toISOString() });
  await save(data);
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (isDbOnline() && prisma) {
    try {
      await prisma.project.delete({ where: { id } });
      return true;
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const initial = (data.projects || []).length;
  data.projects = (data.projects || []).filter((item) => item.id !== id);
  if (data.projects.length !== initial) {
    await save(data);
    return true;
  }
  return false;
}

export async function addGeneration(
  id: string,
  generation: Omit<GenerationRecord, "id" | "createdAt">
): Promise<GenerationRecord | undefined> {
  if (isDbOnline() && prisma) {
    try {
      const project = await prisma.project.findUnique({ where: { id } });
      if (project) {
        const record = await prisma.generation.create({
          data: {
            id: randomUUID(),
            projectId: id,
            agent: generation.agent,
            userPrompt: generation.userPrompt,
            status: generationStatusToDb(generation.status),
            input: generation.input as never,
            output: generation.output as never,
            error: generation.error,
            tokenUsage: generation.tokenUsage,
            createdAt: new Date()
          }
        });
        return {
          id: record.id,
          agent: record.agent,
          userPrompt: record.userPrompt,
          status: generationStatusFromDb(record.status),
          input: record.input,
          output: record.output,
          error: record.error || undefined,
          tokenUsage: record.tokenUsage || undefined,
          createdAt: record.createdAt.toISOString()
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }
  const data = await load();
  const project = (data.projects || []).find((item) => item.id === id);
  if (!project) return undefined;
  if (!project.generations) project.generations = [];
  const record: GenerationRecord = { ...generation, id: randomUUID(), createdAt: new Date().toISOString() };
  project.generations.push(record);
  project.updatedAt = new Date().toISOString();
  await save(data);
  return record;
}

export async function addMessage(id: string, role: ChatMessageRecord["role"], content: string): Promise<ChatMessageRecord | undefined> {
  if (isDbOnline() && prisma) {
    try {
      const project = await prisma.project.findUnique({ where: { id } });
      if (project) {
        const record = await prisma.chatMessage.create({
          data: { id: randomUUID(), projectId: id, role, content }
        });
        return {
          id: record.id,
          role: record.role as ChatMessageRecord["role"],
          content: record.content,
          createdAt: record.createdAt.toISOString()
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }
  const data = await load();
  const project = (data.projects || []).find((item) => item.id === id);
  if (!project) return undefined;
  if (!project.messages) project.messages = [];
  const message: ChatMessageRecord = { id: randomUUID(), role, content, createdAt: new Date().toISOString() };
  project.messages.push(message);
  project.updatedAt = new Date().toISOString();
  await save(data);
  return message;
}

export async function saveWebsite(
  id: string,
  website: Omit<WebsiteRecord, "id" | "projectId" | "createdAt" | "updatedAt" | "version"> & { version?: number }
): Promise<WebsiteRecord | undefined> {
  if (isDbOnline() && prisma) {
    try {
      const project = await prisma.project.findUnique({ where: { id }, include: { Website: { orderBy: { version: "desc" } } } });
      if (project) {
        const existing = project.Website[0];
        const now = new Date();
        const record = await prisma.website.create({
          data: {
            id: randomUUID(),
            projectId: id,
            title: website.title,
            description: website.description,
            theme: website.theme,
            colorPalette: website.colorPalette as never,
            fontFamily: website.fontFamily,
            structure: website.structure as never,
            generatedCode: website.generatedCode as never,
            version: website.version ?? (existing?.version ?? 0) + 1,
            createdAt: now,
            updatedAt: now
          }
        });

        // Also create WebsitePage records if pages exist in structure
        const pages = website.structure?.pages || [];
        for (let i = 0; i < pages.length; i++) {
          const p = pages[i];
          await prisma.websitePage.create({
            data: {
              id: randomUUID(),
              websiteId: record.id,
              name: p.name || `Page ${i + 1}`,
              slug: p.slug || (i === 0 ? "/" : `/${p.name.toLowerCase()}`),
              pageType: p.pageType || "standard",
              content: p as never,
              order: i,
              createdAt: now,
              updatedAt: now
            }
          });
        }

        await prisma.project.update({ where: { id }, data: { status: projectStatusToDb("ready"), updatedAt: now } });
        return mapWebsite(record);
      }
    } catch (err) {
      markDbFailed(err);
    }
  }
  const data = await load();
  const project = (data.projects || []).find((item) => item.id === id);
  if (!project) return undefined;
  if (!project.websites) project.websites = [];
  const existing = project.websites[0];
  const now = new Date().toISOString();
  const record: WebsiteRecord = {
    ...website,
    id: existing?.id || randomUUID(),
    projectId: id,
    version: website.version ?? (existing?.version ?? 0) + 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  project.websites = [record];
  project.status = "ready";
  project.updatedAt = now;
  await save(data);
  return record;
}

export async function recordDeployment(
  projectId: string,
  deployment: {
    provider: string;
    deploymentUrl?: string;
    deploymentId?: string;
    status: "PENDING" | "BUILDING" | "READY" | "ERROR";
  }
): Promise<DeploymentRecord> {
  const now = new Date();
  if (isDbOnline() && prisma) {
    try {
      const record = await prisma.deployment.create({
        data: {
          id: randomUUID(),
          projectId,
          provider: deployment.provider,
          deploymentUrl: deployment.deploymentUrl || null,
          deploymentId: deployment.deploymentId || null,
          status: deployment.status as any,
          createdAt: now,
          updatedAt: now
        }
      });
      return {
        id: record.id,
        projectId: record.projectId,
        provider: record.provider,
        deploymentUrl: record.deploymentUrl || undefined,
        deploymentId: record.deploymentId || undefined,
        status: record.status as any,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    } catch (err) {
      markDbFailed(err);
    }
  }
  const data = await load();
  const record: DeploymentRecord = {
    id: randomUUID(),
    projectId,
    provider: deployment.provider,
    deploymentUrl: deployment.deploymentUrl,
    deploymentId: deployment.deploymentId,
    status: deployment.status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  if (!data.deployments) data.deployments = [];
  data.deployments.push(record);
  const proj = (data.projects || []).find((p) => p.id === projectId);
  if (proj) {
    if (!proj.deployments) proj.deployments = [];
    proj.deployments.unshift(record);
  }
  await save(data);
  return record;
}

export async function recordApiUsage(
  userId: string,
  provider: string,
  model?: string,
  tokens?: number,
  estimatedCost?: number
): Promise<ApiUsageRecord> {
  const now = new Date();
  const validUserId = await ensureUser(userId);

  if (isDbOnline() && prisma) {
    try {
      const record = await prisma.apiUsage.create({
        data: {
          id: randomUUID(),
          userId: validUserId,
          provider,
          model: model || null,
          tokens: tokens || 0,
          estimatedCost: estimatedCost || (tokens ? (tokens / 1000) * 0.0003 : 0),
          createdAt: now
        }
      });
      return {
        id: record.id,
        userId: record.userId,
        provider: record.provider,
        model: record.model || undefined,
        tokens: record.tokens || undefined,
        estimatedCost: record.estimatedCost || undefined,
        createdAt: record.createdAt.toISOString()
      };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const store = await load();
  const record: ApiUsageRecord = {
    id: randomUUID(),
    userId: validUserId,
    provider,
    model,
    tokens: tokens || 0,
    estimatedCost: estimatedCost || (tokens ? (tokens / 1000) * 0.0003 : 0),
    createdAt: now.toISOString()
  };
  if (!store.apiUsage) store.apiUsage = [];
  store.apiUsage.push(record);
  await save(store);
  return record;
}

// -----------------------------------------------------------------------------
// ADMIN DASHBOARD & ANALYTICS QUERIES
// -----------------------------------------------------------------------------

function parseDateRangeFilter(dateRange?: string): Date | undefined {
  if (!dateRange || dateRange === "all") return undefined;
  const now = new Date();
  switch (dateRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d":
    case "7days":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
    case "30days":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
    case "90days":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

export class AdminDatabaseUnavailableError extends Error {
  constructor() {
    super("PostgreSQL records are temporarily unavailable.");
  }
}

export async function getAdminStats(dateRange?: string, postgresOnly = false): Promise<AdminStats> {
  const startDate = parseDateRangeFilter(dateRange);
  const dateFilter = startDate ? { createdAt: { gte: startDate } } : {};

  if (prisma && (postgresOnly || isDbOnline())) {
    try {
      const [
        totalUsers,
        newUserCount,
        totalProjects,
        totalWebsites,
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        runningGenerations,
        usageAggregate,
        usersList,
        projectsList,
        generationsList,
        usageList,
        searchList,
        activeUserCount
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: dateFilter }),
        prisma.project.count({ where: dateFilter }),
        prisma.website.count({ where: dateFilter }),
        prisma.generation.count({ where: dateFilter }),
        prisma.generation.count({ where: { ...dateFilter, status: "SUCCESS" } }),
        prisma.generation.count({ where: { ...dateFilter, status: "FAILED" } }),
        prisma.generation.count({ where: { ...dateFilter, status: "RUNNING" } }),
        prisma.apiUsage.aggregate({
          where: dateFilter,
          _sum: { tokens: true, estimatedCost: true }
        }),
        prisma.user.findMany({ where: dateFilter, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
        prisma.project.findMany({ where: dateFilter, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
        prisma.generation.findMany({ where: dateFilter, select: { agent: true, status: true, createdAt: true, tokenUsage: true } }),
        prisma.apiUsage.findMany({ where: dateFilter, select: { provider: true, model: true, tokens: true, estimatedCost: true } }),
        prisma.searchHistory.findMany({ where: dateFilter, select: { query: true, createdAt: true } }),
        prisma.user.count({ where: { updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } })
      ]);

      // Timeline aggregations by date (YYYY-MM-DD)
      const userGrowthMap = new Map<string, number>();
      for (const u of usersList) {
        const d = u.createdAt.toISOString().slice(0, 10);
        userGrowthMap.set(d, (userGrowthMap.get(d) || 0) + 1);
      }

      const projectGrowthMap = new Map<string, number>();
      for (const p of projectsList) {
        const d = p.createdAt.toISOString().slice(0, 10);
        projectGrowthMap.set(d, (projectGrowthMap.get(d) || 0) + 1);
      }

      const genTimelineMap = new Map<string, { success: number; failed: number; running: number }>();
      const agentMap = new Map<string, number>();
      for (const g of generationsList) {
        const d = g.createdAt.toISOString().slice(0, 10);
        const existing = genTimelineMap.get(d) || { success: 0, failed: 0, running: 0 };
        if (g.status === "SUCCESS") existing.success += 1;
        else if (g.status === "FAILED") existing.failed += 1;
        else existing.running += 1;
        genTimelineMap.set(d, existing);

        const agentName = g.agent || "other";
        agentMap.set(agentName, (agentMap.get(agentName) || 0) + 1);
      }

      // Provider & Model distribution
      const providerMap = new Map<string, { count: number; tokens: number; estimatedCost: number }>();
      const modelMap = new Map<string, { count: number; tokens: number }>();
      for (const u of usageList) {
        const p = u.provider || "gemini";
        const curP = providerMap.get(p) || { count: 0, tokens: 0, estimatedCost: 0 };
        curP.count += 1;
        curP.tokens += u.tokens || 0;
        curP.estimatedCost += u.estimatedCost || 0;
        providerMap.set(p, curP);

        const m = u.model || "default";
        const curM = modelMap.get(m) || { count: 0, tokens: 0 };
        curM.count += 1;
        curM.tokens += u.tokens || 0;
        modelMap.set(m, curM);
      }

      const totalGenCount = generationsList.length || 1;
      const agentUsage = Array.from(agentMap.entries()).map(([agent, count]) => ({
        agent,
        count,
        percentage: Math.round((count / totalGenCount) * 100)
      }));

      return {
        totalUsers,
        totalProjects,
        totalWebsites,
        totalGenerations,
        totalTokens: usageAggregate._sum.tokens || 0,
        estimatedCost: Number((usageAggregate._sum.estimatedCost || 0).toFixed(4)),
        successfulGenerations,
        failedGenerations,
        runningGenerations,
        userGrowth: Array.from(userGrowthMap.entries()).map(([date, count]) => ({ date, count })),
        projectGrowth: Array.from(projectGrowthMap.entries()).map(([date, count]) => ({ date, count })),
        generationTimeline: Array.from(genTimelineMap.entries()).map(([date, counts]) => ({ date, ...counts })),
        agentUsage,
        providerDistribution: Array.from(providerMap.entries()).map(([provider, data]) => ({ provider, ...data })),
        modelDistribution: Array.from(modelMap.entries()).map(([model, data]) => ({ model, ...data }))
        ,
        activeUsers: activeUserCount,
        newUsers: newUserCount,
        popularSearches: Array.from(searchList.reduce((map, item) => map.set(item.query, (map.get(item.query) || 0) + 1), new Map<string, number>()).entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([query, count]) => ({ query, count })),
        activityTimeline: Array.from(searchList.reduce((map, item) => {
          const date = item.createdAt.toISOString().slice(0, 10);
          map.set(date, (map.get(date) || 0) + 1);
          return map;
        }, new Map<string, number>()).entries()).map(([date, count]) => ({ date, count }))
      };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (postgresOnly) throw new AdminDatabaseUnavailableError();

  // Fallback calculations
  const data = await load();
  const users = data.users || [];
  const projects = data.projects || [];
  const websitesCount = projects.reduce((acc, p) => acc + (p.websites?.length || 0), 0);
  const allGens = projects.flatMap((p) => p.generations || []);
  const usage = data.apiUsage || [];
  const searchHistory = data.searchHistory || [];
  const totalTokens = usage.reduce((acc, u) => acc + (u.tokens || 0), 0);
  const estimatedCost = Number(usage.reduce((acc, u) => acc + (u.estimatedCost || 0), 0).toFixed(4));
  const successfulGenerations = allGens.filter((g) => g.status === "completed").length;
  const failedGenerations = allGens.filter((g) => g.status === "failed").length;
  const runningGenerations = allGens.filter((g) => g.status === "started").length;

  return {
    totalUsers: users.length,
    totalProjects: projects.length,
    totalWebsites: websitesCount,
    totalGenerations: allGens.length,
    totalTokens,
    estimatedCost,
    successfulGenerations,
    failedGenerations,
    runningGenerations,
    userGrowth: [],
    projectGrowth: [],
    generationTimeline: [],
    agentUsage: [],
    providerDistribution: [],
    modelDistribution: [],
    activeUsers: users.filter((user) => new Date(user.updatedAt).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000).length,
    newUsers: users.filter((user) => !startDate || new Date(user.createdAt) >= startDate).length,
    popularSearches: Array.from(searchHistory.reduce((map, item) => map.set(item.query, (map.get(item.query) || 0) + 1), new Map<string, number>()).entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([query, count]) => ({ query, count })),
    activityTimeline: Array.from(searchHistory.reduce((map, item) => {
      const date = item.createdAt.slice(0, 10);
      map.set(date, (map.get(date) || 0) + 1);
      return map;
    }, new Map<string, number>()).entries()).map(([date, count]) => ({ date, count }))
  };
}

export async function recordSearchHistory(userIdOrEmail: string, query: string, source = "website-builder"): Promise<void> {
  const normalizedQuery = query.trim().slice(0, 500);
  if (!normalizedQuery) return;
  const validUserId = await ensureUser(userIdOrEmail);
  if (isDbOnline() && prisma) {
    try {
      await prisma.searchHistory.create({
        data: { id: randomUUID(), userId: validUserId, query: normalizedQuery, source }
      });
      return;
    } catch (error) {
      markDbFailed(error);
    }
  }
  const data = await load();
  data.searchHistory = data.searchHistory || [];
  data.searchHistory.unshift({
    id: randomUUID(),
    userId: validUserId,
    userEmail: userIdOrEmail.includes("@") ? userIdOrEmail : undefined,
    query: normalizedQuery,
    source,
    createdAt: new Date().toISOString()
  });
  await save(data);
}

export async function listAdminSearchHistory(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<SearchHistoryRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where = params.search ? { query: { contains: params.search, mode: "insensitive" as const } } : {};
      const [total, records] = await Promise.all([
        prisma.searchHistory.count({ where }),
        prisma.searchHistory.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { User: { select: { email: true, name: true } } }
        })
      ]);
      return {
        items: records.map((record) => ({
          id: record.id,
          userId: record.userId,
          userEmail: record.User.email,
          userName: record.User.name,
          query: record.query,
          source: record.source,
          createdAt: record.createdAt.toISOString()
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1
      };
    } catch (error) {
      markDbFailed(error);
    }
  }
  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  let records = data.searchHistory || [];
  if (params.search) records = records.filter((record) => record.query.toLowerCase().includes(params.search!.toLowerCase()));
  return { items: records.slice(skip, skip + pageSize), total: records.length, page, pageSize, totalPages: Math.ceil(records.length / pageSize) || 1 };
}

export async function listAdminUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  dateRange?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<UserRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const startDate = parseDateRangeFilter(params.dateRange);

  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where: Record<string, unknown> = {};
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { email: { contains: params.search, mode: "insensitive" } }
        ];
      }
      if (params.role && params.role !== "all") {
        where.role = params.role.toUpperCase();
      }
      if (startDate) {
        where.createdAt = { gte: startDate };
      }

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true, name: true, email: true, image: true, role: true, createdAt: true, updatedAt: true,
            _count: { select: { Project: true, ApiUsage: true } },
            ApiUsage: !params.postgresOnly && { select: { tokens: true, estimatedCost: true } }
          }
        })
      ]);

      const items: UserRecord[] = users.map((u: any) => {
        const tokensUsed = (u.ApiUsage || []).reduce((acc: number, curr: any) => acc + (curr.tokens || 0), 0);
        const estimatedCost = Number((u.ApiUsage || []).reduce((acc: number, curr: any) => acc + (curr.estimatedCost || 0), 0).toFixed(4));
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          role: u.role as UserRole,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          projectsCount: u._count?.Project || 0,
          generationsCount: u._count?.ApiUsage || 0,
          tokensUsed,
          estimatedCost
        };
      });

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  let users = data.users || [];
  if (params.search) {
    const s = params.search.toLowerCase();
    users = users.filter((u) => u.email.toLowerCase().includes(s) || (u.name && u.name.toLowerCase().includes(s)));
  }
  if (params.role && params.role !== "all") {
    users = users.filter((u) => u.role === params.role?.toUpperCase());
  }
  const total = users.length;
  const items = users.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminUserDetail(userId: string): Promise<
  | (UserRecord & {
      projects: ProjectRecord[];
      usage: ApiUsageRecord[];
      auditLogs?: AdminAuditLogRecord[];
    })
  | undefined
> {
  if (isDbOnline() && prisma) {
    try {
      const user = await prisma.user.findFirst({
        where: { OR: [{ id: userId }, { email: userId }] },
        include: {
          Project: {
            include: {
              Website: true,
              Generation: true,
              Deployment: true
            },
            orderBy: { createdAt: "desc" }
          },
          ApiUsage: { orderBy: { createdAt: "desc" }, take: 50 },
          AdminAuditLogs: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      });

      if (user) {
        const tokensUsed = user.ApiUsage.reduce((acc, u) => acc + (u.tokens || 0), 0);
        const estimatedCost = Number(user.ApiUsage.reduce((acc, u) => acc + (u.estimatedCost || 0), 0).toFixed(4));
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role as UserRole,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          projectsCount: user.Project.length,
          generationsCount: user.Project.reduce((acc, p) => acc + p.Generation.length, 0),
          tokensUsed,
          estimatedCost,
          projects: user.Project.map((p: any) => ({
            id: p.id,
            userId: p.userId,
            name: p.name,
            description: p.description || "",
            initialPrompt: p.initialPrompt,
            status: projectStatusFromDb(p.status),
            framework: p.framework,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            websites: p.Website.map(mapWebsite),
            generations: [],
            messages: [],
            websitesCount: p.Website.length,
            generationsCount: p.Generation.length
          })),
          usage: user.ApiUsage.map((u) => ({
            id: u.id,
            userId: u.userId,
            provider: u.provider,
            model: u.model || undefined,
            tokens: u.tokens || undefined,
            estimatedCost: u.estimatedCost || undefined,
            createdAt: u.createdAt.toISOString()
          })),
          auditLogs: user.AdminAuditLogs.map((l) => ({
            id: l.id,
            adminUserId: l.adminUserId,
            action: l.action,
            targetType: l.targetType,
            targetId: l.targetId,
            metadata: l.metadata,
            createdAt: l.createdAt.toISOString()
          }))
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const user = data.users?.find((u) => u.id === userId || u.email === userId);
  if (!user) return undefined;
  const userProjects = (data.projects || []).filter((p) => p.userId === user.id);
  const userUsage = (data.apiUsage || []).filter((u) => u.userId === user.id);
  return {
    ...user,
    projectsCount: userProjects.length,
    generationsCount: userProjects.reduce((acc, p) => acc + (p.generations?.length || 0), 0),
    tokensUsed: userUsage.reduce((acc, u) => acc + (u.tokens || 0), 0),
    estimatedCost: Number(userUsage.reduce((acc, u) => acc + (u.estimatedCost || 0), 0).toFixed(4)),
    projects: userProjects,
    usage: userUsage
  };
}

export async function updateUserRole(
  adminUserId: string,
  targetUserId: string,
  newRole: "USER" | "ADMIN"
): Promise<{ success: boolean; user?: UserRecord; error?: string }> {
  const now = new Date();
  if (isDbOnline() && prisma) {
    try {
      const existing = await prisma.user.findFirst({
        where: { OR: [{ id: targetUserId }, { email: targetUserId }] }
      });
      if (!existing) return { success: false, error: "User not found" };

      const oldRole = existing.role;
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { role: newRole as any, updatedAt: now }
      });

      // Record Audit Log
      await createAuditLog({
        adminUserId,
        action: "UPDATE_USER_ROLE",
        targetType: "User",
        targetId: existing.id,
        metadata: { oldRole, newRole, targetEmail: existing.email }
      });

      return {
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          image: updated.image,
          role: updated.role as UserRole,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString()
        }
      };
    } catch (err) {
      markDbFailed(err);
      return { success: false, error: (err as Error).message };
    }
  }

  const data = await load();
  if (!data.users) data.users = [];
  const user = data.users.find((u) => u.id === targetUserId || u.email === targetUserId);
  if (!user) return { success: false, error: "User not found in local store" };
  const oldRole = user.role;
  user.role = newRole;
  user.updatedAt = now.toISOString();
  await save(data);

  await createAuditLog({
    adminUserId,
    action: "UPDATE_USER_ROLE",
    targetType: "User",
    targetId: user.id,
    metadata: { oldRole, newRole, targetEmail: user.email }
  });

  return { success: true, user };
}

export async function createAuditLog(entry: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: unknown;
}): Promise<AdminAuditLogRecord> {
  const now = new Date();
  if (isDbOnline() && prisma) {
    try {
      const validAdminId = await ensureUser(entry.adminUserId, "admin");
      const record = await prisma.adminAuditLog.create({
        data: {
          id: randomUUID(),
          adminUserId: validAdminId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata as never,
          createdAt: now
        }
      });
      return {
        id: record.id,
        adminUserId: record.adminUserId,
        action: record.action,
        targetType: record.targetType,
        targetId: record.targetId,
        metadata: record.metadata,
        createdAt: record.createdAt.toISOString()
      };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const store = await load();
  const record: AdminAuditLogRecord = {
    id: randomUUID(),
    adminUserId: entry.adminUserId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: entry.metadata,
    createdAt: now.toISOString()
  };
  if (!store.auditLogs) store.auditLogs = [];
  store.auditLogs.unshift(record);
  await save(store);
  return record;
}

export async function listAdminProjects(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  framework?: string;
  userId?: string;
  dateRange?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<ProjectRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const startDate = parseDateRangeFilter(params.dateRange);

  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where: Record<string, unknown> = {};
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { initialPrompt: { contains: params.search, mode: "insensitive" } },
          { User: { email: { contains: params.search, mode: "insensitive" } } }
        ];
      }
      if (params.status && params.status !== "all") {
        where.status = params.status.toUpperCase();
      }
      if (params.framework && params.framework !== "all") {
        where.framework = { contains: params.framework, mode: "insensitive" };
      }
      if (params.userId) {
        where.userId = params.userId;
      }
      if (startDate) {
        where.createdAt = { gte: startDate };
      }

      const [total, projects] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            User: { select: { id: true, name: true, email: true } },
            _count: { select: { Website: true, Generation: true, Deployment: true, ChatMessage: true } }
          }
        })
      ]);

      const items: ProjectRecord[] = projects.map((p: any) => ({
        id: p.id,
        userId: p.userId,
        userEmail: p.User?.email,
        userName: p.User?.name,
        name: p.name,
        description: p.description || "",
        initialPrompt: p.initialPrompt,
        status: projectStatusFromDb(p.status),
        framework: p.framework,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        websites: [],
        generations: [],
        messages: [],
        websitesCount: p._count?.Website || 0,
        generationsCount: p._count?.Generation || 0
      }));

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  let list = data.projects || [];
  if (params.search) {
    const s = params.search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(s) || p.initialPrompt.toLowerCase().includes(s));
  }
  if (params.status && params.status !== "all") {
    list = list.filter((p) => p.status === params.status?.toLowerCase());
  }
  const total = list.length;
  const items = list.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminProjectDetail(projectId: string): Promise<
  | (ProjectRecord & {
      user?: UserRecord;
      websitePages?: WebsitePageRecord[];
    })
  | undefined
> {
  if (isDbOnline() && prisma) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          User: true,
          Website: {
            include: {
              WebsitePage: { orderBy: { order: "asc" } }
            },
            orderBy: { version: "desc" }
          },
          Generation: { orderBy: { createdAt: "desc" } },
          ChatMessage: { orderBy: { createdAt: "asc" } },
          Deployment: { orderBy: { createdAt: "desc" } }
        }
      });

      if (project) {
        const websites = project.Website.map(mapWebsite);
        const websitePages: WebsitePageRecord[] = (project.Website[0]?.WebsitePage || []).map((p: any) => ({
          id: p.id,
          websiteId: p.websiteId,
          name: p.name,
          slug: p.slug,
          pageType: p.pageType,
          content: p.content,
          generatedCode: p.generatedCode,
          order: p.order,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        }));

        return {
          id: project.id,
          userId: project.userId,
          userEmail: project.User?.email,
          userName: project.User?.name ?? undefined,
          name: project.name,
          description: project.description || "",
          initialPrompt: project.initialPrompt,
          status: projectStatusFromDb(project.status),
          framework: project.framework,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          user: project.User ? {
            id: project.User.id,
            name: project.User.name,
            email: project.User.email,
            role: project.User.role as UserRole,
            createdAt: project.User.createdAt.toISOString(),
            updatedAt: project.User.updatedAt.toISOString()
          } : undefined,
          websites,
          websitePages,
          generations: project.Generation.map((g: any) => ({
            id: g.id,
            projectId: g.projectId,
            agent: g.agent,
            userPrompt: g.userPrompt,
            status: generationStatusFromDb(g.status),
            input: g.input,
            output: g.output,
            error: g.error || undefined,
            tokenUsage: g.tokenUsage || undefined,
            createdAt: g.createdAt.toISOString()
          })),
          messages: project.ChatMessage.map((m: any) => ({
            id: m.id,
            projectId: m.projectId,
            role: m.role as any,
            content: m.content,
            createdAt: m.createdAt.toISOString()
          })),
          deployments: project.Deployment.map((d: any) => ({
            id: d.id,
            projectId: d.projectId,
            provider: d.provider,
            deploymentUrl: d.deploymentUrl || undefined,
            deploymentId: d.deploymentId || undefined,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString()
          }))
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const project = data.projects?.find((p) => p.id === projectId);
  return project;
}

export async function listAdminWebsites(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  theme?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<WebsiteRecord & { projectName?: string; userEmail?: string }>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where: Record<string, unknown> = {};
      if (params.search) {
        where.OR = [
          { title: { contains: params.search, mode: "insensitive" } },
          { Project: { name: { contains: params.search, mode: "insensitive" } } },
          { Project: { User: { email: { contains: params.search, mode: "insensitive" } } } }
        ];
      }
      if (params.theme && params.theme !== "all") {
        where.theme = { contains: params.theme, mode: "insensitive" };
      }

      const [total, websites] = await Promise.all([
        prisma.website.count({ where }),
        prisma.website.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          omit: params.postgresOnly ? { generatedCode: true, structure: true, colorPalette: true } : undefined,
          include: {
            Project: { select: { name: true, User: { select: { email: true } } } },
            _count: { select: { WebsitePage: true } }
          }
        })
      ]);

      const items = websites.map((w: any) => ({
        ...mapWebsite(w),
        projectName: w.Project?.name,
        userEmail: w.Project?.User?.email,
        pagesCount: w._count?.WebsitePage || 0
      }));

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  const allWebsites = (data.projects || []).flatMap((p) =>
    (p.websites || []).map((w) => ({
      ...w,
      projectName: p.name,
      userEmail: p.userId,
      pagesCount: w.structure?.pages?.length || 1
    }))
  );
  const total = allWebsites.length;
  const items = allWebsites.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminWebsiteDetail(websiteId: string): Promise<
  | (WebsiteRecord & {
      projectName?: string;
      userEmail?: string;
      pages: WebsitePageRecord[];
    })
  | undefined
> {
  if (isDbOnline() && prisma) {
    try {
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
        include: {
          Project: { include: { User: true } },
          WebsitePage: { orderBy: { order: "asc" } }
        }
      });

      if (website) {
        return {
          ...mapWebsite(website),
          projectName: website.Project?.name,
          userEmail: website.Project?.User?.email,
          pages: website.WebsitePage.map((p: any) => ({
            id: p.id,
            websiteId: p.websiteId,
            name: p.name,
            slug: p.slug,
            pageType: p.pageType,
            content: p.content,
            generatedCode: p.generatedCode,
            order: p.order,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
          }))
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  for (const p of data.projects || []) {
    const w = (p.websites || []).find((site) => site.id === websiteId);
    if (w) {
      return {
        ...w,
        projectName: p.name,
        userEmail: p.userId,
        pages: (w.structure?.pages || []).map((page, idx) => ({
          id: `${w.id}-page-${idx}`,
          websiteId: w.id,
          name: page.name,
          slug: page.slug,
          pageType: page.pageType,
          content: page,
          order: idx,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt
        }))
      };
    }
  }
  return undefined;
}

export async function listAdminGenerations(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  agent?: string;
  status?: string;
  projectId?: string;
  userId?: string;
  dateRange?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<GenerationRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const startDate = parseDateRangeFilter(params.dateRange);

  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where: Record<string, unknown> = {};
      if (params.search) {
        where.OR = [
          { userPrompt: { contains: params.search, mode: "insensitive" } },
          { Project: { name: { contains: params.search, mode: "insensitive" } } },
          { Project: { User: { email: { contains: params.search, mode: "insensitive" } } } }
        ];
      }
      if (params.agent && params.agent !== "all") {
        where.agent = { contains: params.agent, mode: "insensitive" };
      }
      if (params.status && params.status !== "all") {
        where.status = params.status.toUpperCase();
      }
      if (params.projectId) {
        where.projectId = params.projectId;
      }
      if (params.userId) {
        where.Project = { userId: params.userId };
      }
      if (startDate) {
        where.createdAt = { gte: startDate };
      }

      const [total, generations] = await Promise.all([
        prisma.generation.count({ where }),
        prisma.generation.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          omit: params.postgresOnly ? { input: true, output: true, error: true } : undefined,
          include: {
            Project: { select: { id: true, name: true, User: { select: { id: true, email: true, name: true } } } }
          }
        })
      ]);

      const items: GenerationRecord[] = generations.map((g: any) => ({
        id: g.id,
        projectId: g.projectId,
        projectName: g.Project?.name,
        userId: g.Project?.User?.id,
        userEmail: g.Project?.User?.email,
        agent: g.agent,
        userPrompt: g.userPrompt,
        status: params.postgresOnly ? g.status : generationStatusFromDb(g.status),
        input: g.input,
        output: g.output,
        error: g.error || undefined,
        tokenUsage: g.tokenUsage ?? undefined,
        createdAt: g.createdAt.toISOString()
      }));

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  let gens = (data.projects || []).flatMap((p) =>
    (p.generations || []).map((g) => ({
      ...g,
      projectId: p.id,
      projectName: p.name,
      userId: p.userId,
      userEmail: p.userId
    }))
  );
  if (params.search) {
    const s = params.search.toLowerCase();
    gens = gens.filter((g) => g.userPrompt.toLowerCase().includes(s) || g.projectName?.toLowerCase().includes(s));
  }
  if (params.agent && params.agent !== "all") {
    gens = gens.filter((g) => g.agent.toLowerCase() === params.agent?.toLowerCase());
  }
  if (params.status && params.status !== "all") {
    gens = gens.filter((g) => g.status === params.status?.toLowerCase());
  }
  const total = gens.length;
  const items = gens.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminGenerationDetail(generationId: string): Promise<GenerationRecord | undefined> {
  if (isDbOnline() && prisma) {
    try {
      const g = await prisma.generation.findUnique({
        where: { id: generationId },
        include: {
          Project: { include: { User: true } }
        }
      });
      if (g) {
        return {
          id: g.id,
          projectId: g.projectId,
          projectName: g.Project?.name,
          userId: g.Project?.User?.id,
          userEmail: g.Project?.User?.email,
          agent: g.agent,
          userPrompt: g.userPrompt,
          status: generationStatusFromDb(g.status),
          input: g.input,
          output: g.output,
          error: g.error || undefined,
          tokenUsage: g.tokenUsage || undefined,
          createdAt: g.createdAt.toISOString()
        };
      }
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  for (const p of data.projects || []) {
    const g = (p.generations || []).find((gen) => gen.id === generationId);
    if (g) {
      return {
        ...g,
        projectId: p.id,
        projectName: p.name,
        userId: p.userId,
        userEmail: p.userId
      };
    }
  }
  return undefined;
}

export async function getAdminUsageAnalytics(params: {
  page?: number;
  pageSize?: number;
  provider?: string;
  model?: string;
  userId?: string;
  dateRange?: string;
}): Promise<PaginatedResult<ApiUsageRecord> & {
  summary: {
    totalRequests: number;
    totalTokens: number;
    averageTokensPerRequest: number;
    estimatedCost: number;
  };
  providerBreakdown: Array<{ provider: string; requests: number; tokens: number; cost: number }>;
  modelBreakdown: Array<{ model: string; requests: number; tokens: number }>;
  topUsers: Array<{ userId: string; userEmail: string; requests: number; tokens: number; cost: number }>;
}> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const startDate = parseDateRangeFilter(params.dateRange);

  if (isDbOnline() && prisma) {
    try {
      const where: Record<string, unknown> = {};
      if (params.provider && params.provider !== "all") where.provider = params.provider.toLowerCase();
      if (params.model && params.model !== "all") where.model = params.model;
      if (params.userId) where.userId = params.userId;
      if (startDate) where.createdAt = { gte: startDate };

      const [total, usageRecords, aggregate, allFiltered] = await Promise.all([
        prisma.apiUsage.count({ where }),
        prisma.apiUsage.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: { User: { select: { email: true, name: true } } }
        }),
        prisma.apiUsage.aggregate({
          where,
          _sum: { tokens: true, estimatedCost: true }
        }),
        prisma.apiUsage.findMany({
          where,
          select: { userId: true, provider: true, model: true, tokens: true, estimatedCost: true, User: { select: { email: true } } }
        })
      ]);

      const items: ApiUsageRecord[] = usageRecords.map((u: any) => ({
        id: u.id,
        userId: u.userId,
        userEmail: u.User?.email,
        userName: u.User?.name,
        provider: u.provider,
        model: u.model || undefined,
        tokens: u.tokens || undefined,
        estimatedCost: u.estimatedCost || undefined,
        createdAt: u.createdAt.toISOString()
      }));

      // Breakdowns
      const providerMap = new Map<string, { requests: number; tokens: number; cost: number }>();
      const modelMap = new Map<string, { requests: number; tokens: number }>();
      const userMap = new Map<string, { userId: string; userEmail: string; requests: number; tokens: number; cost: number }>();

      for (const entry of allFiltered) {
        // Provider
        const p = entry.provider || "gemini";
        const curP = providerMap.get(p) || { requests: 0, tokens: 0, cost: 0 };
        curP.requests += 1;
        curP.tokens += entry.tokens || 0;
        curP.cost += entry.estimatedCost || 0;
        providerMap.set(p, curP);

        // Model
        const m = entry.model || "default";
        const curM = modelMap.get(m) || { requests: 0, tokens: 0 };
        curM.requests += 1;
        curM.tokens += entry.tokens || 0;
        modelMap.set(m, curM);

        // User
        const uId = entry.userId;
        const curU = userMap.get(uId) || { userId: uId, userEmail: entry.User?.email || uId, requests: 0, tokens: 0, cost: 0 };
        curU.requests += 1;
        curU.tokens += entry.tokens || 0;
        curU.cost += entry.estimatedCost || 0;
        userMap.set(uId, curU);
      }

      const totalTokens = aggregate._sum.tokens || 0;
      const totalCost = Number((aggregate._sum.estimatedCost || 0).toFixed(4));
      const averageTokensPerRequest = total > 0 ? Math.round(totalTokens / total) : 0;

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        summary: {
          totalRequests: total,
          totalTokens,
          averageTokensPerRequest,
          estimatedCost: totalCost
        },
        providerBreakdown: Array.from(providerMap.entries()).map(([provider, d]) => ({ provider, ...d, cost: Number(d.cost.toFixed(4)) })),
        modelBreakdown: Array.from(modelMap.entries()).map(([model, d]) => ({ model, ...d })),
        topUsers: Array.from(userMap.values()).sort((a, b) => b.tokens - a.tokens).slice(0, 10).map((u) => ({ ...u, cost: Number(u.cost.toFixed(4)) }))
      };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const usage = data.apiUsage || [];
  const total = usage.length;
  const items = usage.slice(skip, skip + pageSize);
  const totalTokens = usage.reduce((acc, u) => acc + (u.tokens || 0), 0);
  const totalCost = Number(usage.reduce((acc, u) => acc + (u.estimatedCost || 0), 0).toFixed(4));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    summary: {
      totalRequests: total,
      totalTokens,
      averageTokensPerRequest: total > 0 ? Math.round(totalTokens / total) : 0,
      estimatedCost: totalCost
    },
    providerBreakdown: [],
    modelBreakdown: [],
    topUsers: []
  };
}

export async function listAdminDeployments(params: {
  page?: number;
  pageSize?: number;
  provider?: string;
  status?: string;
  search?: string;
  postgresOnly?: boolean;
}): Promise<PaginatedResult<DeploymentRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  if (prisma && (params.postgresOnly || isDbOnline())) {
    try {
      const where: Record<string, unknown> = {};
      if (params.provider && params.provider !== "all") where.provider = params.provider.toLowerCase();
      if (params.status && params.status !== "all") where.status = params.status.toUpperCase();
      if (params.search) {
        where.OR = [
          { deploymentUrl: { contains: params.search, mode: "insensitive" } },
          { deploymentId: { contains: params.search, mode: "insensitive" } },
          { Project: { name: { contains: params.search, mode: "insensitive" } } }
        ];
      }

      const [total, deployments] = await Promise.all([
        prisma.deployment.count({ where }),
        prisma.deployment.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: {
            Project: { select: { id: true, name: true, userId: true, User: { select: { email: true } } } }
          }
        })
      ]);

      const items: DeploymentRecord[] = deployments.map((d: any) => ({
        id: d.id,
        projectId: d.projectId,
        projectName: d.Project?.name,
        userId: d.Project?.userId,
        userEmail: d.Project?.User?.email,
        provider: d.provider,
        deploymentUrl: d.deploymentUrl || undefined,
        deploymentId: d.deploymentId || undefined,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      }));

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  if (params.postgresOnly) throw new AdminDatabaseUnavailableError();
  const data = await load();
  const deployments = data.deployments || [];
  const total = deployments.length;
  const items = deployments.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function listAdminChats(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  projectId?: string;
}): Promise<PaginatedResult<{
  projectId: string;
  projectName: string;
  userId: string;
  userEmail: string;
  messageCount: number;
  lastMessage?: ChatMessageRecord;
  lastActivity: string;
  messages: ChatMessageRecord[];
}>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  if (isDbOnline() && prisma) {
    try {
      const where: Record<string, unknown> = {
        ChatMessage: { some: {} }
      };
      if (params.projectId) where.id = params.projectId;
      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: "insensitive" } },
          { User: { email: { contains: params.search, mode: "insensitive" } } },
          { ChatMessage: { some: { content: { contains: params.search, mode: "insensitive" } } } }
        ];
      }

      const [total, projects] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { updatedAt: "desc" },
          include: {
            User: { select: { id: true, name: true, email: true } },
            ChatMessage: { orderBy: { createdAt: "asc" } }
          }
        })
      ]);

      const items = projects.map((p: any) => {
        const msgs = p.ChatMessage.map((m: any) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          createdAt: m.createdAt.toISOString()
        }));
        return {
          projectId: p.id,
          projectName: p.name,
          userId: p.userId,
          userEmail: p.User?.email || p.userId,
          messageCount: msgs.length,
          lastMessage: msgs[msgs.length - 1],
          lastActivity: p.updatedAt.toISOString(),
          messages: msgs
        };
      });

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const chatProjects = (data.projects || []).filter((p) => p.messages && p.messages.length > 0);
  const total = chatProjects.length;
  const items = chatProjects.slice(skip, skip + pageSize).map((p) => ({
    projectId: p.id,
    projectName: p.name,
    userId: p.userId,
    userEmail: p.userId,
    messageCount: p.messages.length,
    lastMessage: p.messages[p.messages.length - 1],
    lastActivity: p.updatedAt,
    messages: p.messages
  }));
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAdminRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
  const safeLimit = Math.min(50, Math.max(1, limit));

  if (isDbOnline() && prisma) {
    try {
      const [users, projects, generations, deployments] = await Promise.all([
        prisma.user.findMany({
          take: safeLimit,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, email: true, createdAt: true }
        }),
        prisma.project.findMany({
          take: safeLimit,
          orderBy: { createdAt: "desc" },
          include: { User: { select: { id: true, email: true, name: true } } }
        }),
        prisma.generation.findMany({
          take: safeLimit,
          orderBy: { createdAt: "desc" },
          include: { Project: { select: { id: true, name: true, User: { select: { id: true, email: true } } } } }
        }),
        prisma.deployment.findMany({
          take: safeLimit,
          orderBy: { createdAt: "desc" },
          include: { Project: { select: { id: true, name: true, User: { select: { id: true, email: true } } } } }
        })
      ]);

      const activities: RecentActivityItem[] = [
        ...users.map((u: any) => ({
          id: `user-${u.id}`,
          type: "user" as const,
          title: "New User Registered",
          subtitle: u.email,
          status: "SUCCESS",
          timestamp: u.createdAt.toISOString(),
          userId: u.id,
          userEmail: u.email
        })),
        ...projects.map((p: any) => ({
          id: `project-${p.id}`,
          type: "project" as const,
          title: `Project Created: ${p.name}`,
          subtitle: p.initialPrompt.slice(0, 80),
          status: p.status,
          timestamp: p.createdAt.toISOString(),
          projectId: p.id,
          projectName: p.name,
          userId: p.userId,
          userEmail: p.User?.email
        })),
        ...generations.map((g: any) => ({
          id: `gen-${g.id}`,
          type: "generation" as const,
          title: `Agent Executed: ${g.agent}`,
          subtitle: g.userPrompt.slice(0, 80),
          status: g.status,
          timestamp: g.createdAt.toISOString(),
          projectId: g.projectId,
          projectName: g.Project?.name,
          userId: g.Project?.User?.id,
          userEmail: g.Project?.User?.email
        })),
        ...deployments.map((d: any) => ({
          id: `dep-${d.id}`,
          type: "deployment" as const,
          title: `Cloud Deployment (${d.provider})`,
          subtitle: d.deploymentUrl || `Deployment ID: ${d.deploymentId || "Pending"}`,
          status: d.status,
          timestamp: d.createdAt.toISOString(),
          projectId: d.projectId,
          projectName: d.Project?.name,
          userId: d.Project?.User?.id,
          userEmail: d.Project?.User?.email
        }))
      ];

      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, safeLimit);
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const activities: RecentActivityItem[] = [];
  for (const u of data.users || []) {
    activities.push({
      id: `user-${u.id}`,
      type: "user",
      title: "New User Registered",
      subtitle: u.email,
      status: "SUCCESS",
      timestamp: u.createdAt,
      userId: u.id,
      userEmail: u.email
    });
  }
  for (const p of data.projects || []) {
    activities.push({
      id: `project-${p.id}`,
      type: "project",
      title: `Project Created: ${p.name}`,
      subtitle: p.initialPrompt.slice(0, 80),
      status: p.status.toUpperCase(),
      timestamp: p.createdAt,
      projectId: p.id,
      projectName: p.name,
      userId: p.userId
    });
  }
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, safeLimit);
}

export async function listAdminAuditLogs(params: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<AdminAuditLogRecord>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  if (isDbOnline() && prisma) {
    try {
      const [total, logs] = await Promise.all([
        prisma.adminAuditLog.count(),
        prisma.adminAuditLog.findMany({
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: { AdminUser: { select: { email: true, name: true } } }
        })
      ]);

      const items: AdminAuditLogRecord[] = logs.map((l: any) => ({
        id: l.id,
        adminUserId: l.adminUserId,
        adminEmail: l.AdminUser?.email,
        adminName: l.AdminUser?.name,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        metadata: l.metadata,
        createdAt: l.createdAt.toISOString()
      }));

      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    } catch (err) {
      markDbFailed(err);
    }
  }

  const data = await load();
  const logs = data.auditLogs || [];
  const total = logs.length;
  const items = logs.slice(skip, skip + pageSize);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}
