"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { api, type GenerationJob, type Project } from "@/lib/api";
import { download } from "@/lib/studio";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
export default function BuilderPage() {
  const { projectId } = useParams<{ projectId: string }>(),
    router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/login");
    },
  });
  const [project, setProject] = useState<Project>(),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [job, setJob] = useState<GenerationJob | null>(null);
  const request = useRef<AbortController | null>(null);
  const demoCreation = useRef<Promise<Project> | null>(null);
  const load = useCallback(async () => {
    const result = await api.getProject(projectId);
    setProject(result);
  }, [projectId]);
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    if (projectId === "demo") {
      demoCreation.current ??= api.createProject({
        name: "Demo Restaurant",
        description: "A restaurant website brief",
        initialPrompt:
          "Create a warm restaurant website with seasonal menu, story and reservation enquiry form.",
      });
      void demoCreation.current
        .then((p) => {
          if (active) router.replace(`/builder/${p.id}`);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    } else
      void api
        .getProject(projectId)
        .then((p) => {
          if (active) setProject(p);
        })
        .catch((e: Error) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [projectId, status, router]);
  async function generate(prompt: string) {
    const token = session?.user?.accessToken;
    if (!token || request.current) {
      setError("Your session is unavailable. Sign in again to generate.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setError("");
    setWorking(true);
    try {
      let current = await api.generate(
        projectId,
        prompt,
        token,
        controller.signal,
      );
      setJob(current);
      while (["queued", "running"].includes(current.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        controller.signal.throwIfAborted();
        current = await api.getGenerationJob(
          projectId,
          current.id,
          token,
          controller.signal,
        );
        setJob(current);
      }
      if (current.status === "cancelled") return;
      if (current.status !== "completed")
        throw new Error(current.error || current.message);
      await load();
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (request.current === controller) {
        request.current = null;
        setWorking(false);
      }
    }
  }
  async function revise(prompt: string) {
    if (working) return;
    setError("");
    setWorking(true);
    setJob({
      id: `revision-${Date.now()}`,
      projectId,
      status: "running",
      stage: "code",
      progress: 0,
      message:
        "Applying your revision through the existing AI service. This endpoint does not report intermediate progress.",
    });
    try {
      await api.revise(projectId, prompt);
      await load();
      setJob((current) =>
        current
          ? {
              ...current,
              status: "completed",
              stage: "complete",
              progress: 100,
              message:
                "AI revision saved. Review the new version in the preview.",
            }
          : null,
      );
    } catch (e) {
      setError((e as Error).message);
      setJob((current) =>
        current
          ? { ...current, status: "failed", message: (e as Error).message }
          : null,
      );
    } finally {
      setWorking(false);
    }
  }
  async function cancel() {
    if (!job) return;
    try {
      setJob(
        await api.cancelGenerationJob(
          projectId,
          job.id,
          session?.user?.accessToken,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!project || project.id !== projectId || status !== "authenticated")
    return (
      <main className="sc-workspace-loading">
        <Sparkles className="sc-pulse" />
        <h1>
          {error ? "Unable to open project" : "Opening your creative space…"}
        </h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button
              className="sc-btn sc-btn-dark"
              onClick={() => location.reload()}
            >
              Retry
            </button>
            <a href="/dashboard">Back to projects</a>
          </>
        )}
      </main>
    );
  return (
    <StudioWorkspace
      key={projectId}
      id={projectId}
      name={project.name}
      initialPrompt={project.initialPrompt}
      website={project.websites[0]?.generatedCode}
      project={project}
      working={working}
      job={job}
      error={error}
      onGenerate={generate}
      onRevise={revise}
      onCancel={() => void cancel()}
      onDeploy={(provider) => api.deploy(projectId, provider)}
      onServerExport={async () => {
        try {
          download(
            await api.exportProject(projectId),
            `${project.name}-server.zip`,
          );
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    />
  );
}
