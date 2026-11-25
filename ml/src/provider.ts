import { createHash } from "node:crypto";
import type { ProviderConfig } from "./types.js";

export interface JsonProvider {
  config: ProviderConfig;
  generateJson<T>(prompt: string, schemaName: string, options?: { systemPrompt: string }): Promise<T | null>;
}

type AgentName = "planner" | "ui" | "content" | "code" | "qa";

const agentModelEnvKeys: Record<AgentName, keyof NodeJS.ProcessEnv> = {
  planner: "PLANNER_MODEL",
  ui: "UI_MODEL",
  content: "CONTENT_MODEL",
  code: "CODE_MODEL",
  qa: "QA_MODEL",
};

const defaultNvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultNvidiaModel = "nvidia/nemotron-3-super-120b-a12b";
const defaultBynaraBaseUrl = "https://router.bynara.id/v1";
const defaultBynaraModel = "laguna-s-2.1";
const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1";
const defaultOpenRouterModel = "google/gemini-2.5-flash";
const requestTimeoutMs = 60_000;
const stageTokenBudgets: Record<string, number> = { planner: 2048, content: 3072, ui: 1536, code: 8192, qa: 1024 };
// Rejected credentials stay disabled across generation instances for five minutes.
// Hashes include the endpoint, so rotating a key or changing a router unblocks it.
const rejectedCredentials = new Map<string, number>();

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function rejectCredential(id: string): void {
  for (const [key, expires] of rejectedCredentials) {
    if (expires <= Date.now()) rejectedCredentials.delete(key);
  }
  if (rejectedCredentials.size >= 128) rejectedCredentials.delete(rejectedCredentials.keys().next().value!);
  rejectedCredentials.set(id, Date.now() + 5 * 60_000);
}

export class ProviderError extends Error {
  code:
    | "INVALID_API_KEY"
    | "RATE_LIMIT"
    | "TIMEOUT"
    | "MODEL_UNAVAILABLE"
    | "OUTPUT_LIMIT"
    | "MALFORMED_RESPONSE"
    | "API_FAILURE";
  status?: number;
  provider: "bynara" | "nvidia" | "gemini" | "openai" | "openrouter" | "local";
  model: string;

  constructor(
    code:
      | "INVALID_API_KEY"
      | "RATE_LIMIT"
      | "TIMEOUT"
      | "MODEL_UNAVAILABLE"
      | "OUTPUT_LIMIT"
      | "MALFORMED_RESPONSE"
      | "API_FAILURE",
    message: string,
    status: number | undefined,
    provider: "bynara" | "nvidia" | "gemini" | "openai" | "openrouter" | "local",
    model: string,
    cause?: unknown,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.provider = provider;
    this.model = model;
    this.name = "ProviderError";
    if (cause !== undefined) {
      this.cause = cause as Error;
    }
  }
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function geminiKeysFromEnv(env: NodeJS.ProcessEnv): string[] {
  return Array.from(new Set(
    [env.GEMINI_API_KEY, ...(env.GEMINI_API_KEYS || "").split(/[\s,]+/)]
      .map(trimEnv)
      .filter((value): value is string => Boolean(value)),
  ));
}

function modelEnvKeyFor(schemaName: string): string {
  const envKey = agentModelEnvKeys[schemaName as AgentName];
  return typeof envKey === "string" ? envKey : "AI_MODEL";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function isModelUnavailableMessage(message: string): boolean {
  return /model.*(not found|not available|unavailable|does not exist|invalid|unsupported)/i.test(message) || /unknown model/i.test(message);
}

function parseResponseText(responseText: string): unknown | null {
  if (!responseText.trim()) return null;
  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
}

function errorMessageFromResponse(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const error = record.error as Record<string, unknown> | undefined;
  const message =
    typeof error?.message === "string"
      ? error.message
      : typeof record.message === "string"
        ? record.message
        : undefined;
  return (message?.trim() || fallback).replace(/https?:\/\/\S+/gi, "[provider dashboard]");
}

function apiFailure(providerName: string, model: string, error: unknown): ProviderError {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed/i.test(message) || /network/i.test(message)) {
    return new ProviderError(
      "API_FAILURE",
      `${providerName} request failed due to a network error.`,
      undefined,
      providerName.toLowerCase() as "bynara" | "nvidia" | "gemini" | "openai" | "openrouter" | "local",
      model,
      error,
    );
  }
  return new ProviderError("API_FAILURE", `${providerName} request failed: ${message}`, undefined, providerName.toLowerCase() as "bynara" | "nvidia" | "gemini" | "openai" | "openrouter" | "local", model, error);
}

interface ProviderCallArgs {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  schemaName: string;
  providerName?: "openai" | "openrouter";
  systemPrompt?: string;
  run?: { signal: AbortSignal; timeoutMs: number };
}

function chatMessages(args: ProviderCallArgs) {
  return [
    ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
    { role: "user", content: args.prompt }
  ];
}

async function callNvidiaChatCompletions<T>(args: ProviderCallArgs): Promise<T | null> {
  type NimsResponse = { choices?: Array<{ message?: { content?: string } }> } | null;
  const endpoint = new URL("chat/completions", args.baseUrl.endsWith("/") ? args.baseUrl : `${args.baseUrl}/`);
  const configEnv = modelEnvKeyFor(args.schemaName);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
        },
        body: JSON.stringify({
          model: args.model,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          response_format: { type: "json_object" },
          messages: chatMessages(args),
        }),
        signal: controller.signal,
      });
      const responseText = await response.text();
      const payload = parseResponseText(responseText) as NimsResponse;
      if (!response.ok) {
        const errorMessage = errorMessageFromResponse(payload, responseText || `Request failed with ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new ProviderError("INVALID_API_KEY", "NVIDIA API key is not authorized. Check NVIDIA_API_KEY in .env.", response.status, "nvidia", args.model);
        }
        if (response.status === 429) {
          if (attempt < 2) {
            const retryAfterSeconds = Number(response.headers.get("retry-after") ?? 0);
            await sleep(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000 * 2 ** attempt);
            continue;
          }
          throw new ProviderError("RATE_LIMIT", `NVIDIA rate limit reached for model "${args.model}".`, response.status, "nvidia", args.model);
        }
        if (response.status === 404 || isModelUnavailableMessage(errorMessage)) {
          throw new ProviderError(
            "MODEL_UNAVAILABLE",
            `NVIDIA model "${args.model}" is not available. ${errorMessage} Update ${configEnv} or NVIDIA_MODEL in .env to a supported NVIDIA model.`,
            response.status,
            "nvidia",
            args.model,
          );
        }
        if ([500, 502, 503, 504].includes(response.status) && attempt < 2) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new ProviderError("API_FAILURE", `NVIDIA request failed (${response.status}). ${errorMessage}`, response.status, "nvidia", args.model);
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new ProviderError("MALFORMED_RESPONSE", "NVIDIA returned a malformed response without message content.", response.status, "nvidia", args.model);
      }
      const parsed = extractJson(content);
      if (parsed === null) {
        throw new ProviderError("MALFORMED_RESPONSE", "NVIDIA returned malformed JSON.", response.status, "nvidia", args.model);
      }
      return parsed as T | null;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (isAbortError(error)) {
        throw new ProviderError("TIMEOUT", `NVIDIA request timed out after ${Math.round(requestTimeoutMs / 1000)} seconds.`, undefined, "nvidia", args.model, error);
      }
      lastError = error;
      if (attempt < 2) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw apiFailure("NVIDIA", args.model, error);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw apiFailure("NVIDIA", args.model, lastError ?? new Error("Unknown NVIDIA error"));
}

async function callBynaraRouter<T>(args: ProviderCallArgs): Promise<T | null> {
  type BynaraResponse = { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> } | null;
  const endpoint = new URL("chat/completions", args.baseUrl.endsWith("/") ? args.baseUrl : `${args.baseUrl}/`);
  let lastError: unknown;

  const attempts = args.run ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const signal = args.run?.signal ?? AbortSignal.timeout(requestTimeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`
        },
        body: JSON.stringify({
          model: args.model,
          messages: chatMessages(args),
          temperature: args.temperature,
          max_tokens: args.maxTokens
        }),
        signal
      });
      const responseText = await response.text();
      const payload = parseResponseText(responseText) as BynaraResponse;
      if (!response.ok) {
        const errorMessage = errorMessageFromResponse(payload, responseText || `Request failed with ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          const guidance = /telegram_required/i.test(errorMessage)
            ? "Join the required Telegram group/channel, then relink Bynara in its /settings page."
            : "Check that BYNARA_API_KEY is active and authorized for this account.";
          throw new ProviderError("INVALID_API_KEY", `Bynara rejected the request (${response.status}). ${errorMessage} ${guidance}`, response.status, "bynara", args.model);
        }
        if (response.status === 402 || response.status === 429) {
          throw new ProviderError("RATE_LIMIT", `Bynara limit reached for model "${args.model}". ${errorMessage}`, response.status, "bynara", args.model);
        }
        if ([500, 502, 503, 504].includes(response.status) && attempt < attempts - 1) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new ProviderError("API_FAILURE", `Bynara request failed (${response.status}). ${errorMessage}`, response.status, "bynara", args.model);
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (payload?.choices?.[0]?.finish_reason === "length" && extractJson(content ?? "") === null) {
        throw new ProviderError("OUTPUT_LIMIT", "Bynara reached its output token limit before completing the JSON response.", response.status, "bynara", args.model);
      }
      if (typeof content !== "string" || !content.trim()) {
        throw new ProviderError("MALFORMED_RESPONSE", "Bynara returned a response without message content.", response.status, "bynara", args.model);
      }
      const parsed = extractJson(content);
      if (parsed === null) {
        throw new ProviderError("MALFORMED_RESPONSE", "Bynara returned malformed JSON.", response.status, "bynara", args.model);
      }
      return parsed as T | null;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal.aborted || isAbortError(error)) {
        throw new ProviderError("TIMEOUT", `Bynara request timed out after ${(args.run?.timeoutMs ?? requestTimeoutMs) / 1000} seconds.`, undefined, "bynara", args.model, error);
      }
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw apiFailure("Bynara", args.model, error);
    }
  }
  throw apiFailure("Bynara", args.model, lastError ?? new Error("Unknown Bynara error"));
}

async function callGemini<T>(args: ProviderCallArgs): Promise<T | null> {
  type GeminiResponse = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> } | null;
  const configEnv = modelEnvKeyFor(args.schemaName);
  const attempts = args.run ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const signal = args.run?.signal ?? AbortSignal.timeout(requestTimeoutMs);
    try {
      const response = await fetch(`${args.baseUrl}/models/${args.model}:generateContent?key=${encodeURIComponent(args.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: args.prompt }] }],
          ...(args.systemPrompt ? { systemInstruction: { parts: [{ text: args.systemPrompt }] } } : {}),
          generationConfig: { temperature: args.temperature, maxOutputTokens: args.maxTokens, responseMimeType: "application/json" },
        }),
        signal,
      });
      const responseText = await response.text();
      const payload = parseResponseText(responseText) as GeminiResponse;
      if (!response.ok) {
        const errorMessage = errorMessageFromResponse(payload, responseText || `Request failed with ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new ProviderError("INVALID_API_KEY", "Gemini API key is not authorized. Check GEMINI_API_KEY in .env.", response.status, "gemini", args.model);
        }
        if (response.status === 404 || isModelUnavailableMessage(errorMessage)) {
          throw new ProviderError(
            "MODEL_UNAVAILABLE",
            `Gemini model "${args.model}" is not available. ${errorMessage}`,
            response.status,
            "gemini",
            args.model,
          );
        }
        if (isRetryableStatus(response.status) && attempt < attempts - 1) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        if (response.status === 429) {
          throw new ProviderError("RATE_LIMIT", "Gemini API rate limit reached. Retry later.", response.status, "gemini", args.model);
        }
        throw new ProviderError("API_FAILURE", `Gemini request failed (${response.status}). ${errorMessage}`, response.status, "gemini", args.model);
      }
      const text = payload?.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part?.text ?? "").join("")
        || (payload as any)?.choices?.[0]?.message?.content
        || "";
      const parsed = extractJson(text);
      if (parsed === null) {
        if (payload?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
          throw new ProviderError("OUTPUT_LIMIT", "Gemini reached its output token limit before completing the JSON response.", response.status, "gemini", args.model);
        }
        throw new ProviderError("MALFORMED_RESPONSE", "Gemini returned malformed JSON.", response.status, "gemini", args.model);
      }
      return parsed as T | null;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal.aborted || isAbortError(error)) {
        throw new ProviderError("TIMEOUT", `Gemini request timed out after ${(args.run?.timeoutMs ?? requestTimeoutMs) / 1000} seconds.`, undefined, "gemini", args.model, error);
      }
      if (attempt < attempts - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw apiFailure("Gemini", args.model, error);
    }
  }
  throw apiFailure("Gemini", args.model, new Error("Unknown Gemini error"));
}

async function callOpenAI<T>(args: ProviderCallArgs): Promise<T | null> {
  type OpenAIResponse = { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> } | null;
  const providerName = args.providerName || "openai";
  const displayName = providerName === "openrouter" ? "OpenRouter" : "OpenAI";
  const configEnv = modelEnvKeyFor(args.schemaName);
  const attempts = args.run ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const signal = args.run?.signal ?? AbortSignal.timeout(requestTimeoutMs);
    try {
      const endpoint = new URL("chat/completions", args.baseUrl.endsWith("/") ? args.baseUrl : `${args.baseUrl}/`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
          ...(providerName === "openrouter" ? {
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "SiteCraft AI",
          } : {}),
        },
        body: JSON.stringify({
          model: args.model,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
          response_format: { type: "json_object" },
          messages: chatMessages(args),
        }),
        signal,
      });
      const responseText = await response.text();
      const payload = parseResponseText(responseText) as OpenAIResponse;
      if (!response.ok) {
        const errorMessage = errorMessageFromResponse(payload, responseText || `Request failed with ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new ProviderError("INVALID_API_KEY", `${displayName} API key is not authorized. Check ${providerName === "openrouter" ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY"} in .env.`, response.status, providerName, args.model);
        }
        if (response.status === 404 || isModelUnavailableMessage(errorMessage)) {
          throw new ProviderError(
            "MODEL_UNAVAILABLE",
            `OpenAI model "${args.model}" is not available. ${errorMessage}`,
            response.status,
            providerName,
            args.model,
          );
        }
        if (isRetryableStatus(response.status) && attempt < attempts - 1) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        if (response.status === 429) {
          throw new ProviderError("RATE_LIMIT", `${displayName} rate limit reached.`, response.status, providerName, args.model);
        }
        throw new ProviderError("API_FAILURE", `${displayName} request failed (${response.status}). ${errorMessage}`, response.status, providerName, args.model);
      }
      const choice = payload?.choices?.[0];
      const content = choice?.message?.content;
      const parsed = extractJson(typeof content === "string" ? content : "");
      if (parsed === null) {
        const message = choice?.finish_reason === "length"
          ? `${displayName} reached its output token limit before completing the JSON response.`
          : `${displayName} returned malformed JSON.`;
        throw new ProviderError(choice?.finish_reason === "length" ? "OUTPUT_LIMIT" : "MALFORMED_RESPONSE", message, response.status, providerName, args.model);
      }
      return parsed as T | null;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal.aborted || isAbortError(error)) {
        throw new ProviderError("TIMEOUT", `${displayName} request timed out after ${(args.run?.timeoutMs ?? requestTimeoutMs) / 1000} seconds.`, undefined, providerName, args.model, error);
      }
      if (attempt < attempts - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw apiFailure(displayName, args.model, error);
    }
  }
  throw apiFailure(displayName, args.model, new Error("Unknown provider error"));
}

export function createProvider(
  env: NodeJS.ProcessEnv = process.env,
  limits?: { budgetMs: number; attemptTimeoutMs: number; codeAttemptTimeoutMs?: number }
): JsonProvider {
  const temperature = Number(env.AI_TEMPERATURE ?? 0.7);
  const maxTokens = positiveInteger(env.AI_MAX_TOKENS, 8192);
  const openRouterMaxTokens = Math.min(maxTokens, positiveInteger(env.OPENROUTER_MAX_TOKENS, maxTokens));
  const geminiKeys = geminiKeysFromEnv(env);
  const geminiKey = geminiKeys[0];
  const configuredOpenAiKey = trimEnv(env.OPENAI_API_KEY);
  const openRouterKey = trimEnv(env.OPENROUTER_API_KEY)
    || (configuredOpenAiKey?.startsWith("sk-or-v1-") ? configuredOpenAiKey : undefined);
  const openAiKey = configuredOpenAiKey?.startsWith("sk-or-v1-") ? undefined : configuredOpenAiKey;
  const bynaraKey = trimEnv(env.BYNARA_ENABLED)?.toLowerCase() === "false" ? undefined : trimEnv(env.BYNARA_API_KEY);
  const preferredProvider = trimEnv(env.AI_PROVIDER)?.toLowerCase() || "openrouter";

  const activeGeminiModel = trimEnv(env.AI_MODEL) || "gemini-3.6-flash";
  const activeOpenAiModel = trimEnv(env.AI_MODEL) || "gpt-4o";
  const activeOpenRouterModel = trimEnv(env.OPENROUTER_MODEL) || defaultOpenRouterModel;
  const activeBynaraModel = trimEnv(env.BYNARA_MODEL) || defaultBynaraModel;

  const configured = Boolean(geminiKey || openAiKey || openRouterKey || bynaraKey);

  // Determine active provider order based on preference or availability
  let primaryProviderName: "bynara" | "gemini" | "openai" | "openrouter" | "local" = "local";
  if (preferredProvider === "gemini" && geminiKey) {
    primaryProviderName = "gemini";
  } else if (preferredProvider === "openai" && openAiKey) {
    primaryProviderName = "openai";
  } else if (preferredProvider === "bynara" && bynaraKey) {
    primaryProviderName = "bynara";
  } else if (openRouterKey) {
    primaryProviderName = "openrouter";
  } else if (geminiKey) {
    primaryProviderName = "gemini";
  } else if (openAiKey) {
    primaryProviderName = "openai";
  } else if (bynaraKey) {
    primaryProviderName = "bynara";
  }

  const activeDefaultModel = primaryProviderName === "gemini"
    ? activeGeminiModel
    : primaryProviderName === "openai"
      ? activeOpenAiModel
      : primaryProviderName === "openrouter"
        ? activeOpenRouterModel
        : activeBynaraModel;

  const agentModels = Object.fromEntries(
    Object.entries(agentModelEnvKeys).map(([agent, envKey]) => [agent, trimEnv(env[envKey]) || activeDefaultModel]),
  ) as Record<AgentName, string>;

  const config: ProviderConfig = {
    provider: primaryProviderName,
    model: activeDefaultModel,
    temperature,
    maxTokens,
    agentModels,
    configured
  };
  const deadline = limits ? performance.now() + limits.budgetMs : Infinity;
  const unavailableKeys = new Set<string>();
  const unavailableModels = new Set<string>();
  const truncatedStages = new Set<string>();
  const malformedResponses = new Map<string, number>();

  function modelFor(schemaName: string, providerName: string): string {
    if (providerName === "gemini") return trimEnv(env.AI_MODEL) || "gemini-3.6-flash";
    if (providerName === "openai") return trimEnv(env.AI_MODEL) || "gpt-4o";
    if (providerName === "openrouter") return trimEnv(env.OPENROUTER_MODEL) || defaultOpenRouterModel;
    if (providerName === "bynara") return trimEnv(env.BYNARA_MODEL) || defaultBynaraModel;
    return config.agentModels[schemaName as AgentName] || config.model;
  }

  return {
    config,
    async generateJson<T>(prompt: string, schemaName: string, options?: { systemPrompt: string }): Promise<T | null> {
      type Remote = "gemini" | "openai" | "openrouter" | "bynara";
      const candidates: { provider: Remote; apiKey: string; keyIndex: number }[] = [];
      const add = (provider: Remote, apiKey: string | undefined, keyIndex = 0) => {
        if (apiKey && !candidates.some((candidate) => candidate.provider === provider && candidate.keyIndex === keyIndex)) candidates.push({ provider, apiKey, keyIndex });
      };
      const addGemini = () => geminiKeys.forEach((key, index) => add("gemini", key, index));
      if (primaryProviderName === "gemini") addGemini();
      if (primaryProviderName === "openai") add("openai", openAiKey);
      if (primaryProviderName === "bynara") add("bynara", bynaraKey);
      add("openrouter", openRouterKey);
      add("openai", openAiKey);
      add("bynara", bynaraKey);
      addGemini();

      const baseUrls: Record<Remote, string> = {
        gemini: "https://generativelanguage.googleapis.com/v1beta",
        openai: "https://api.openai.com/v1",
        openrouter: trimEnv(env.OPENROUTER_BASE_URL) || defaultOpenRouterBaseUrl,
        bynara: trimEnv(env.BYNARA_BASE_URL) || defaultBynaraBaseUrl,
      };
      let lastErr: unknown;
      for (const candidate of candidates) {
        const { provider, apiKey, keyIndex } = candidate;
        const model = modelFor(schemaName, provider);
        const keyId = provider + ":" + keyIndex;
        const modelId = keyId + ":" + model;
        const stageId = modelId + ":" + schemaName;
        const credentialId = createHash("sha256").update(JSON.stringify([provider, baseUrls[provider], apiKey])).digest("hex");
        if (unavailableKeys.has(keyId) || unavailableModels.has(modelId) || truncatedStages.has(stageId) ||
            (rejectedCredentials.get(credentialId) ?? 0) > Date.now()) continue;
        const ceiling = provider === "openrouter" ? openRouterMaxTokens : maxTokens;
        let outputTokens = Math.min(ceiling, stageTokenBudgets[schemaName] ?? 2048);
        for (let outputAttempt = 0; outputAttempt < 2; outputAttempt += 1) {
          const remaining = Math.floor(deadline - performance.now());
          if (remaining <= 0) break;
          const stageTimeout = schemaName === "code" ? limits?.codeAttemptTimeoutMs ?? limits?.attemptTimeoutMs : limits?.attemptTimeoutMs;
          const timeoutMs = Math.min(remaining, stageTimeout ?? requestTimeoutMs);
          const compactInstructions = `Return one complete JSON object within ${outputTokens} output tokens. Use concise values, no Markdown fences or commentary. For code, use compact source and only required files; never leave a string, file or JSON object unfinished.`;
          const args: ProviderCallArgs = {
            apiKey, model, prompt, temperature, schemaName,
            systemPrompt: outputAttempt ? [options?.systemPrompt, compactInstructions, "The previous response was truncated. Regenerate a shorter complete response from the original request."].filter(Boolean).join("\n\n") : options?.systemPrompt ?? compactInstructions,
            baseUrl: baseUrls[provider], maxTokens: outputTokens,
            providerName: provider === "openrouter" ? "openrouter" : undefined,
            // Centralise retries here so nested provider retries cannot outlive a stage.
            run: { signal: AbortSignal.timeout(timeoutMs), timeoutMs },
          };
          try {
            const call = provider === "gemini" ? callGemini : provider === "bynara" ? callBynaraRouter : callOpenAI;
            const result = await call<T>(args);
            if (result !== null) {
              malformedResponses.delete(modelId);
              return result;
            }
          } catch (error) {
            lastErr = error;
            if (error instanceof ProviderError) {
              if (error.code === "OUTPUT_LIMIT" && outputAttempt === 0 && performance.now() < deadline) {
                outputTokens = Math.min(ceiling, outputTokens * 2);
                console.warn(`Provider response truncated (${provider}/${schemaName}); retrying once with compact JSON and a ${outputTokens}-token limit.`);
                continue;
              }
              if (error.code === "OUTPUT_LIMIT") truncatedStages.add(stageId);
              if (error.code === "INVALID_API_KEY") rejectCredential(credentialId);
              if (error.code === "INVALID_API_KEY" || error.code === "TIMEOUT" || error.code === "RATE_LIMIT") unavailableKeys.add(keyId);
              if (error.code === "MODEL_UNAVAILABLE") unavailableModels.add(modelId);
              if (error.code === "MALFORMED_RESPONSE") {
                const failures = (malformedResponses.get(modelId) ?? 0) + 1;
                malformedResponses.set(modelId, failures);
                if (failures >= 2) unavailableModels.add(modelId);
              } else {
                malformedResponses.delete(modelId);
              }
            }
            console.warn(`Provider attempt failed (${provider}/${schemaName}):`, error instanceof Error ? error.message : String(error));
          }
          break;
        }
      }

      if (lastErr) throw lastErr;
      return null;
    },
  };
}
