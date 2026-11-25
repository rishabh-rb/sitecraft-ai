import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { generateProject } from "./orchestrator.js";

export type GenerationJob = {
  id: string;
  projectId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: string;
  progress: number;
  message: string;
  error?: string;
  result?: Awaited<ReturnType<typeof generateProject>>;
};

const stages = ["planner", "content", "ui-designer", "image", "code", "qa"];
const jobs = new Map<string, { job: GenerationJob; events: EventEmitter; cancelled: boolean }>();

function update(id: string, patch: Partial<GenerationJob>) {
  const record = jobs.get(id);
  if (!record) return;
  record.job = { ...record.job, ...patch };
  record.events.emit("update", record.job);
}

export function getGenerationJob(id: string, projectId: string): GenerationJob | undefined {
  const record = jobs.get(id);
  return record?.job.projectId === projectId ? record.job : undefined;
}

export function subscribeGenerationJob(id: string, projectId: string, listener: (job: GenerationJob) => void): () => void {
  const record = jobs.get(id);
  if (!record || record.job.projectId !== projectId) return () => undefined;
  record.events.on("update", listener);
  return () => record.events.off("update", listener);
}

export function cancelGenerationJob(id: string, projectId: string): GenerationJob | undefined {
  const record = jobs.get(id);
  if (!record || record.job.projectId !== projectId) return undefined;
  record.cancelled = true;
  if (record.job.status === "queued") update(id, { status: "cancelled", message: "Generation cancelled." });
  return record.job;
}

export function startGenerationJob(projectId: string, prompt: string, onComplete?: (result: Awaited<ReturnType<typeof generateProject>>) => Promise<void>): GenerationJob {
  const id = randomUUID();
  const record = {
    job: { id, projectId, status: "queued" as const, stage: "queued", progress: 0, message: "Generation queued." },
    events: new EventEmitter(),
    cancelled: false
  };
  jobs.set(id, record);
  void (async () => {
    update(id, { status: "running", message: "Starting generation pipeline." });
    try {
      const result = await generateProject(projectId, prompt, {
        isCancelled: () => record.cancelled,
        onStage: (stage) => update(id, {
          stage,
          progress: Math.round((stages.indexOf(stage) / stages.length) * 90),
          message: `${stage} agent is working.`
        })
      });
      if (record.cancelled) update(id, { status: "cancelled", message: "Generation cancelled." });
      else {
        await onComplete?.(result);
        update(id, { status: "completed", stage: "complete", progress: 100, message: "Website generated successfully.", result });
      }
    } catch (error) {
      if (record.cancelled || error instanceof Error && error.message === "Generation cancelled.") {
        update(id, { status: "cancelled", message: "Generation cancelled." });
      } else {
        update(id, { status: "failed", message: "Generation failed.", error: error instanceof Error ? error.message : "Generation failed." });
      }
    }
  })();
  setTimeout(() => jobs.delete(id), 60 * 60 * 1000).unref();
  return record.job;
}
