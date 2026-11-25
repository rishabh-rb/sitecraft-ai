"use client";
/* Browser state is intentionally hydrated after mount; generated previews stay in isolated iframes. */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Globe,
  HelpCircle,
  History,
  Layers3,
  Loader2,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer2,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import type {
  Deployment,
  GeneratedWebsite,
  GenerationJob,
  Project,
} from "@/lib/api";
import {
  applyDesign,
  download,
  exportZip,
  previewDocument,
  printReport,
  readLocal,
  saveLocal,
  sectionList,
  updateSection,
} from "@/lib/studio";
import {
  defaultDesign,
  escapeHtml,
  inferTemplate,
  templates,
  templateWebsite,
  type DesignOptions,
} from "@/lib/templates";
import { DesignPanel } from "./DesignPanel";
import { AuditPanel } from "./AuditPanel";
import { ShareDialog } from "./ShareDialog";
import { Modal } from "./Modal";
import { Timeline } from "./Timeline";
import { VisualPrompt } from "./VisualPrompt";
import { toast } from "./ToastViewport";
import { LaunchReportPanel } from "@/components/builder/LaunchReportPanel";

type Snapshot = {
  id: string;
  html: string;
  label: string;
  at: string;
  design: DesignOptions;
  plan?: GeneratedWebsite["plan"];
};
type Draft = { snapshots: Snapshot[]; cursor: number; source: string };
type Props = {
  id: string;
  name: string;
  initialPrompt: string;
  website?: GeneratedWebsite;
  project?: Project;
  demo?: boolean;
  working?: boolean;
  job?: GenerationJob | null;
  error?: string;
  onGenerate?: (prompt: string) => Promise<void>;
  onRevise?: (prompt: string) => Promise<void>;
  onCancel?: () => void;
  onDeploy?: (
    provider: string,
  ) => Promise<{ success: boolean; deploymentUrl?: string; status: string }>;
  onServerExport?: () => Promise<void>;
};
function startDesign(website?: GeneratedWebsite): DesignOptions {
  return {
    ...defaultDesign,
    accent:
      website?.plan.colorPalette.primary?.match(/^#[a-f0-9]{6}$/i)?.[0] ||
      defaultDesign.accent,
    font: website?.plan.fontFamily.includes("Georgia") ? "Georgia" : "Arial",
    dark: website?.plan.theme === "dark",
  };
}

export function StudioWorkspace(props: Props) {
  const { id, demo = false, name, website: serverWebsite } = props;
  const key = `sitecraft-studio:${id}`;
  const [ready, setReady] = useState(false),
    [saved, setSaved] = useState(true),
    [draft, setDraft] = useState<Draft>({
      snapshots: [],
      cursor: 0,
      source: "",
    });
  const [prompt, setPrompt] = useState(props.initialPrompt),
    [revision, setRevision] = useState(""),
    [panel, setPanel] = useState("design"),
    [tab, setTab] = useState("preview"),
    [device, setDevice] = useState("desktop"),
    [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState(-1),
    [sectionTitle, setSectionTitle] = useState(""),
    [sectionCopy, setSectionCopy] = useState(""),
    [imageUrl, setImageUrl] = useState("");
  const [dialog, setDialog] = useState(""),
    [walkStep, setWalkStep] = useState(0),
    [present, setPresent] = useState(false),
    [collab, setCollab] = useState(false),
    [left, setLeft] = useState(288),
    [right, setRight] = useState(292),
    [file, setFile] = useState("index.html"),
    [notes, setNotes] = useState<Array<{ text: string; at: string }>>([]),
    [note, setNote] = useState("");
  const [demoJob, setDemoJob] = useState<GenerationJob | null>(null),
    [paused, setPaused] = useState(false),
    [shownJob, setShownJob] = useState<GenerationJob | null>(null),
    [deploying, setDeploying] = useState(false),
    [deployResult, setDeployResult] = useState<{
      status: string;
      deploymentUrl?: string;
    }>(),
    [provider, setProvider] = useState("vercel"),
    [busyExport, setBusyExport] = useState(false),
    [compare, setCompare] = useState(0),
    [mobilePanel, setMobilePanel] = useState("");
  const channel = useId();
  const iframe = useRef<HTMLIFrameElement>(null),
    lifetime = useRef(true),
    cancelDemo = useRef(false),
    pausedRef = useRef(false),
    draftRef = useRef(draft),
    hydrated = useRef(false),
    sourceRef = useRef(serverWebsite),
    drag = useRef<{ side: string; x: number; width: number } | null>(null);
  useEffect(() => {
    draftRef.current = draft;
    pausedRef.current = paused;
    sourceRef.current = serverWebsite;
  }, [draft, paused, serverWebsite]);
  const current = draft.snapshots[draft.cursor],
    html = current?.html || serverWebsite?.html || "",
    design = current?.design || startDesign(serverWebsite);
  const website = useMemo<GeneratedWebsite>(
    () => ({
      html,
      files: serverWebsite?.files || [],
      plan: current?.plan ||
        serverWebsite?.plan || {
          siteName: name,
          siteDescription: "A SiteCraft draft",
          pages: [],
          theme: "light",
          colorPalette: {},
          fontFamily: "Arial",
          features: [],
        },
      qa: serverWebsite?.qa,
    }),
    [html, serverWebsite, name, current?.plan],
  );
  const editedWebsite = useMemo(
    () => ({
      ...website,
      plan: {
        ...website.plan,
        colorPalette: {
          ...website.plan.colorPalette,
          primary: design.accent,
          ...(design.dark ? { text: "#f4f3ec", background: "#171c1b" } : {}),
        },
      },
    }),
    [website, design],
  );
  const sections = useMemo(
    () => (ready && html ? sectionList(html) : []),
    [ready, html],
  );
  const framed = useMemo(
    () =>
      ready && html ? previewDocument(html, channel, selecting, collab) : "",
    [ready, html, selecting, collab, channel],
  );
  const working = !!props.working || demoJob?.status === "running";
  const lastDeployment: Deployment | undefined =
    props.project?.deployments?.find(
      (d) => d.status === "READY" && d.deploymentUrl,
    );
  const publishedUrl =
    deployResult?.status.toUpperCase() === "READY"
      ? deployResult.deploymentUrl
      : lastDeployment?.deploymentUrl;

  const commit = useCallback(
    (
      next: string,
      label: string,
      nextDesign?: DesignOptions,
      plan?: GeneratedWebsite["plan"],
    ) => {
      setDraft((previous) => {
        if (previous.snapshots[previous.cursor]?.html === next) return previous;
        const snapshots = [
          ...previous.snapshots.slice(0, previous.cursor + 1),
          {
            id: `${Date.now()}-${Math.random()}`,
            html: next,
            label,
            at: new Date().toISOString(),
            design:
              nextDesign ||
              previous.snapshots[previous.cursor]?.design ||
              startDesign(sourceRef.current),
            plan:
              plan ||
              previous.snapshots[previous.cursor]?.plan ||
              sourceRef.current?.plan,
          },
        ].slice(-15);
        return { ...previous, snapshots, cursor: snapshots.length - 1 };
      });
    },
    [],
  );
  useEffect(() => {
    lifetime.current = true;
    const timer = setTimeout(() => {
      const saved = readLocal<Draft | null>(key, null);
      const source = serverWebsite?.html || "";
      const valid =
        saved &&
        typeof saved.cursor === "number" &&
        Number.isFinite(saved.cursor) &&
        Array.isArray(saved.snapshots) &&
        saved.snapshots.every(
          (s) =>
            typeof s.html === "string" &&
            s.design &&
            typeof s.label === "string",
        );
      const sameSource = valid && (!source || saved.source === source);
      const snapshots = sameSource
        ? saved.snapshots
        : source
          ? [
              ...(valid ? saved.snapshots : []),
              {
                id: `source-${Date.now()}`,
                html: source,
                label: demo ? "Starting template" : "Latest AI version",
                at: new Date().toISOString(),
                design: startDesign(serverWebsite),
                plan: serverWebsite?.plan,
              },
            ].slice(-15)
          : valid
            ? saved.snapshots
            : [];
      setDraft({
        snapshots,
        cursor: sameSource
          ? Math.max(0, Math.min(saved.cursor, snapshots.length - 1))
          : Math.max(0, snapshots.length - 1),
        source,
      });
      setNotes(readLocal(key + ":notes", []));
      const sizes = readLocal(key + ":panels", { left: 288, right: 292 });
      setLeft(Math.max(240, Math.min(400, sizes.left)));
      setRight(Math.max(260, Math.min(420, sizes.right)));
      setPrompt(readLocal(key + ":prompt", props.initialPrompt));
      setReady(true);
      hydrated.current = true;
      if (!readLocal("sitecraft-studio-onboarded", false))
        setDialog("walkthrough");
    }, 0);
    return () => {
      clearTimeout(timer);
      lifetime.current = false;
      cancelDemo.current = true;
    };
    // Each workspace is mounted with a project key. Subsequent server versions enter through the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const source = serverWebsite?.html || "";
    if (!hydrated.current || !source || source === draftRef.current.source)
      return;
    const timer = setTimeout(() => {
      commit(
        source,
        "New AI version",
        startDesign(serverWebsite),
        serverWebsite?.plan,
      );
      setDraft((d) => ({ ...d, source }));
    }, 0);
    return () => clearTimeout(timer);
  }, [serverWebsite, commit]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      const ok = saveLocal(key, draft);
      setSaved(ok);
      if (!ok)
        toast("Browser storage is full. Export your draft to keep it.", "info");
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, ready, key]);
  useEffect(() => {
    if (ready) saveLocal(key + ":prompt", prompt);
  }, [prompt, ready, key]);
  useEffect(() => {
    if (ready) saveLocal(key + ":panels", { left, right });
  }, [left, right, ready, key]);
  useEffect(() => {
    const job = demo ? demoJob : props.job;
    if (!paused || !working) {
      const timer = setTimeout(() => {
        setShownJob(job || null);
        if (!working) setPaused(false);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [demo, demoJob, props.job, paused, working]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      const delta = event.clientX - drag.current.x;
      if (drag.current.side === "left")
        setLeft(Math.max(240, Math.min(400, drag.current.width + delta)));
      else setRight(Math.max(260, Math.min(420, drag.current.width - delta)));
    };
    const stop = () => {
      drag.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
    };
  }, []);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (
        event.source !== iframe.current?.contentWindow ||
        event.data?.type !== "sitecraft-select" ||
        event.data.channel !== channel ||
        !Number.isInteger(event.data.index)
      )
        return;
      if (event.data.index >= 0 && event.data.index < sections.length) {
        setSelected(event.data.index);
        setPanel("section");
        setMobilePanel("inspector");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [sections.length, channel]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const section = sections[selected];
      setSectionTitle(section?.title || "");
      setSectionCopy(section?.text || "");
      setImageUrl(section?.image || "");
    }, 0);
    return () => clearTimeout(timer);
  }, [selected, sections]);
  const undo = useCallback(
    () => setDraft((d) => ({ ...d, cursor: Math.max(0, d.cursor - 1) })),
    [],
  );
  const redo = useCallback(
    () =>
      setDraft((d) => ({
        ...d,
        cursor: Math.min(d.snapshots.length - 1, d.cursor + 1),
      })),
    [],
  );
  async function generate() {
    if (working || !prompt.trim()) return;
    setPaused(false);
    if (!demo) {
      await props.onGenerate?.(prompt);
      return;
    }
    cancelDemo.current = false;
    setPaused(false);
    const stages = ["plan", "design", "images", "code", "quality"];
    for (let i = 0; i < stages.length; i++) {
      if (cancelDemo.current || !lifetime.current) return;
      setDemoJob({
        id: "local-demo",
        projectId: id,
        status: "running",
        stage: stages[i],
        progress: i * 20,
        message: [
          "Matching your idea to a curated template",
          "Applying a responsive visual direction",
          "Preparing template photography",
          "Rendering sections and interactions",
          "Preparing source-based quality checks",
        ][i],
      });
      for (let tick = 0; tick < 5; tick++) {
        await new Promise((r) => setTimeout(r, 140));
        while (pausedRef.current && !cancelDemo.current && lifetime.current)
          await new Promise((r) => setTimeout(r, 150));
        if (cancelDemo.current || !lifetime.current) return;
      }
    }
    const template = inferTemplate(prompt),
      generated = templateWebsite(template);
    commit(
      generated.html,
      `Template: ${template.industry}`,
      startDesign(generated),
      generated.plan,
    );
    setDemoJob({
      id: `local-demo-${Date.now()}`,
      projectId: id,
      status: "completed",
      stage: "complete",
      progress: 100,
      message: `${template.name} is ready to personalize. This is a template demo, not a live AI request.`,
    });
    setTab("preview");
    toast("Your template preview is ready");
  }
  const generateRef = useRef(generate);
  useEffect(() => {
    generateRef.current = generate;
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        /INPUT|TEXTAREA|SELECT/.test(target.tagName) ||
        target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void generateRef.current();
      } else if (
        !typing &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!typing && event.key.toLowerCase() === "p")
        setPresent((p) => !p);
      else if (event.key === "Escape") {
        setSelecting(false);
        setPresent(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [undo, redo]);
  function editSection(action: string, value = "") {
    if (selected < 0) return;
    commit(
      updateSection(html, selected, action, value),
      `${action === "copy" ? "Updated copy in" : action} ${sections[selected]?.title || "section"}`,
    );
    if (["remove", "up", "down", "duplicate"].includes(action)) setSelected(-1);
    toast("Section updated in your local draft");
  }
  async function revise(instruction = revision) {
    if (!instruction.trim() || working) return;
    if (demo) {
      toast(
        "Free-form AI revisions are available in your signed-in project. Use Design and Sections here for local edits.",
        "info",
      );
      return;
    }
    await props.onRevise?.(
      selected >= 0
        ? `In section "${sections[selected]?.title}": ${instruction}`
        : instruction,
    );
    setRevision("");
  }
  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied to clipboard");
    } catch {
      toast("Select the code and copy it manually", "info");
    }
  }
  function browserPreview() {
    const wrapper = `<!doctype html><html><head><title>${escapeHtml(name)} · SiteCraft preview</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0;display:block}</style></head><body><iframe title="Website preview" sandbox="allow-scripts allow-forms allow-popups" referrerpolicy="no-referrer" srcdoc="${escapeHtml(previewDocument(html, "browser", false, false))}"></iframe></body></html>`;
    const url = URL.createObjectURL(new Blob([wrapper], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function beginDrag(side: string, event: React.PointerEvent) {
    event.preventDefault();
    drag.current = {
      side,
      x: event.clientX,
      width: side === "left" ? left : right,
    };
    document.body.style.cursor = "col-resize";
  }
  function finishWalkthrough() {
    saveLocal("sitecraft-studio-onboarded", true);
    setDialog("");
  }
  const allFiles = [
    { path: "index.html", language: "html", content: html },
    ...website.files.filter((f) => f.path !== "index.html"),
  ];
  const activeFile = allFiles.find((f) => f.path === file) || allFiles[0];
  const hasReact = website.files.some((f) => /\.(tsx|jsx)$/.test(f.path));
  if (!ready)
    return (
      <div className="sc-workspace-loading">
        <Sparkles className="sc-pulse" />
        <p>Opening your creative space…</p>
        <div className="sc-skeleton" />
      </div>
    );
  return (
    <div
      className={`sc-studio ${present ? "is-presenting" : ""}`}
      style={
        {
          "--left-panel": `${left}px`,
          "--right-panel": `${right}px`,
        } as React.CSSProperties
      }
    >
      {!present && (
        <header className="sc-studio-header">
          <div className="sc-inline-actions">
            <Link
              href={demo ? "/" : "/dashboard"}
              className="sc-icon"
              aria-label="Back to projects"
            >
              <ChevronLeft size={20} />
            </Link>
            <Link href="/" className="sc-logo">
              <span>
                <Sparkles size={18} />
              </span>
              <span className="sc-studio-brand">SiteCraft AI</span>
            </Link>
            <span className="sc-header-divider" />
            <div>
              <b className="sc-project-name">
                {demo ? website.plan.siteName : name}
              </b>
              <span className="sc-small sc-muted">
                {demo ? "Interactive playground" : "Project workspace"}
              </span>
            </div>
            <span className="sc-tag sc-local-tag">Browser draft</span>
          </div>
          <div className="sc-inline-actions">
            <button
              className="sc-icon"
              aria-label="Undo"
              title="Undo · ⌘/Ctrl Z"
              disabled={!draft.cursor}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="sc-icon"
              aria-label="Redo"
              title="Redo · ⌘/Ctrl Shift Z"
              disabled={draft.cursor >= draft.snapshots.length - 1}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
            <button
              className="sc-icon"
              aria-label="Version history"
              onClick={() => {
                setPanel("history");
                setMobilePanel("inspector");
              }}
            >
              <History size={18} />
            </button>
            <button
              className="sc-icon"
              aria-label="Help and keyboard shortcuts"
              onClick={() => setDialog("walkthrough")}
            >
              <HelpCircle size={18} />
            </button>
            <button
              className="sc-btn sc-btn-outline sc-btn-sm"
              aria-label="Share"
              disabled={!html}
              onClick={() => setDialog("share")}
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
            <button
              className="sc-btn sc-btn-dark sc-btn-sm"
              aria-label="Export"
              disabled={!html}
              onClick={() => setDialog("export")}
            >
              <Download size={15} />
              <span>Export</span>
            </button>
            <button
              className="sc-btn sc-btn-coral sc-btn-sm"
              aria-label="Publish"
              disabled={demo || !serverWebsite}
              title={
                demo
                  ? "Sign in to deploy a generated project"
                  : "Deploy last saved server version"
              }
              onClick={() => setDialog("publish")}
            >
              <Globe size={15} />
              <span>Publish</span>
            </button>
          </div>
        </header>
      )}
      {props.error && (
        <div className="sc-studio-error" role="alert">
          {props.error}
        </div>
      )}
      {!present && (
        <div className="sc-mobile-workspace-nav">
          <button
            onClick={() =>
              setMobilePanel(mobilePanel === "brief" ? "" : "brief")
            }
          >
            <MessageSquare size={16} /> Brief
          </button>
          <button onClick={() => setMobilePanel("")}>
            <Eye size={16} /> Canvas
          </button>
          <button
            onClick={() =>
              setMobilePanel(mobilePanel === "inspector" ? "" : "inspector")
            }
          >
            <Settings2 size={16} /> Inspector
          </button>
        </div>
      )}
      <div className="sc-studio-body">
        <aside
          className={`sc-brief-panel ${mobilePanel === "brief" ? "is-mobile-open" : ""}`}
        >
          <div className="sc-panel-title">
            <Sparkles size={18} />
            <b>Your creative brief</b>
            <span className="sc-tag">{demo ? "Demo" : "AI"}</span>
          </div>
          <div className="sc-brief-scroll">
            <p className="sc-small sc-muted">
              {demo
                ? "Explore a curated template, then make real visual changes. No API keys needed."
                : "Give the agents a clear direction. Your existing AI providers handle the generation."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <label className="sc-field-label" htmlFor="studio-prompt">
                What are we creating?
              </label>
              <textarea
                id="studio-prompt"
                className="sc-input sc-prompt-input"
                rows={7}
                value={prompt}
                maxLength={10000}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                className="sc-btn sc-btn-coral sc-full"
                disabled={working || !prompt.trim()}
              >
                {working ? (
                  <Loader2 size={16} className="sc-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {working
                  ? "Creating…"
                  : demo
                    ? "Generate demo preview"
                    : "Generate website"}
              </button>
            </form>
            <button className="sc-text-btn" onClick={() => setDialog("prompt")}>
              <Settings2 size={14} /> Build a visual prompt
            </button>
            <div className="sc-prompt-suggestions">
              <span className="sc-field-label">A little inspiration</span>
              {[
                "A warm restaurant with a seasonal menu",
                "A minimal portfolio for a designer",
                "A bold SaaS landing page",
              ].map((s) => (
                <button key={s} onClick={() => setPrompt(s)}>
                  <Plus size={13} />
                  {s}
                </button>
              ))}
            </div>
            <Timeline
              job={shownJob}
              working={working}
              demo={demo}
              paused={paused}
              onPause={() => setPaused(!paused)}
              onCancel={
                demo
                  ? () => {
                      cancelDemo.current = true;
                      setPaused(false);
                      setDemoJob((j) =>
                        j
                          ? {
                              ...j,
                              status: "cancelled",
                              message:
                                "Demo cancelled. Your previous draft is safe.",
                            }
                          : null,
                      );
                    }
                  : props.job?.id.startsWith("revision-")
                    ? undefined
                    : props.onCancel
              }
              sections={sections.length}
            />
            <div className="sc-section-outline">
              <div className="sc-row-between">
                <span className="sc-field-label">Page outline</span>
                <b className="sc-small sc-muted">{sections.length}</b>
              </div>
              {sections.map((s) => (
                <button
                  className={selected === s.index ? "is-active" : ""}
                  key={s.index}
                  onClick={() => {
                    setSelected(s.index);
                    setPanel("section");
                    setSelecting(true);
                    setMobilePanel("inspector");
                  }}
                >
                  <Layers3 size={14} />
                  <span>{s.title}</span>
                  <span className="sc-small">0{s.index + 1}</span>
                </button>
              ))}
            </div>
            {props.project?.messages?.length ? (
              <details className="sc-conversation">
                <summary>
                  Previous conversation ({props.project.messages.length})
                </summary>
                {props.project.messages.slice(-6).map((m) => (
                  <div key={m.id}>
                    <b>{m.role}</b>
                    <p>{m.content}</p>
                  </div>
                ))}
              </details>
            ) : null}
          </div>
          <div className="sc-revision-box">
            <label htmlFor="revision" className="sc-small">
              <Sparkles size={14} /> Refine with AI
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void revise();
              }}
            >
              <textarea
                id="revision"
                rows={2}
                placeholder={
                  demo
                    ? "Sign in for live AI revisions"
                    : "Try ‘Make the hero more minimal’…"
                }
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
              />
              <button
                className="sc-icon"
                aria-label="Send AI revision"
                disabled={!revision.trim() || working}
                type="submit"
              >
                <Send size={17} />
              </button>
            </form>
          </div>
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize brief panel"
          tabIndex={0}
          className="sc-resizer"
          onPointerDown={(e) => beginDrag("left", e)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setLeft(Math.max(240, left - 16));
            if (e.key === "ArrowRight") setLeft(Math.min(400, left + 16));
          }}
        />
        <main className="sc-canvas">
          {shownJob?.status === "completed" && (
            <div key={shownJob.id} className="sc-completion" role="status">
              <Check size={18} />
              <b>Your preview is ready</b>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <i key={n} />
              ))}
            </div>
          )}
          <div className="sc-canvas-toolbar">
            <div className="sc-segmented">
              {[
                ["preview", Eye, "Preview"],
                ["code", Code2, "Code"],
                ["launch", ShieldCheck, "Launch"],
              ].map(([value, Icon, label]) => {
                const I = Icon as typeof Eye;
                return (
                  <button
                    key={String(value)}
                    className={tab === value ? "is-active" : ""}
                    onClick={() => setTab(String(value))}
                    aria-label={String(label)}
                  >
                    <I size={15} />
                    <span>{String(label)}</span>
                  </button>
                );
              })}
            </div>
            <div className="sc-inline-actions">
              {tab === "preview" && (
                <>
                  <div className="sc-device-controls">
                    {[
                      ["desktop", Monitor],
                      ["tablet", Tablet],
                      ["mobile", Smartphone],
                    ].map(([value, Icon]) => {
                      const I = Icon as typeof Monitor;
                      return (
                        <button
                          key={String(value)}
                          className={`sc-icon ${device === value ? "is-active" : ""}`}
                          aria-label={`${value} preview`}
                          aria-pressed={device === value}
                          onClick={() => setDevice(String(value))}
                        >
                          <I size={17} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="sc-header-divider" />
                  <button
                    className={`sc-icon ${selecting ? "is-active" : ""}`}
                    aria-label="Select preview section"
                    aria-pressed={selecting}
                    onClick={() => {
                      setSelecting(!selecting);
                      if (!selecting)
                        toast(
                          "Click a section in the preview to edit it",
                          "info",
                        );
                    }}
                  >
                    <MousePointer2 size={17} />
                  </button>
                </>
              )}
              <button
                className="sc-icon"
                aria-label="View in browser"
                disabled={!html}
                onClick={browserPreview}
              >
                <ExternalLink size={16} />
              </button>
              <button
                className="sc-icon"
                aria-label="Enter presentation mode"
                onClick={() => setPresent(true)}
              >
                <Maximize2 size={17} />
              </button>
            </div>
          </div>
          {present && (
            <button
              className="sc-exit-present sc-btn sc-btn-dark"
              onClick={() => setPresent(false)}
            >
              Exit presentation <X size={15} />
            </button>
          )}
          {tab === "preview" ? (
            <div className={`sc-preview-stage sc-device-${device}`}>
              <div className="sc-preview-address">
                <span className="sc-dot" />
                {demo ? "Local template preview" : name}{" "}
                <span>
                  {selecting
                    ? "Click a section to edit"
                    : "Interactive preview"}
                </span>
              </div>
              {html ? (
                <iframe
                  ref={iframe}
                  title="Website canvas"
                  srcDoc={framed}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="sc-empty sc-canvas-empty">
                  <div className="sc-empty-art">
                    <Layers3 size={44} />
                    <Sparkles size={24} />
                  </div>
                  <h2>A space for your next idea.</h2>
                  <p>
                    Describe the website in your creative brief, then generate
                    your first preview.
                  </p>
                  <button
                    className="sc-btn sc-btn-coral"
                    disabled={working}
                    onClick={() => void generate()}
                  >
                    <Sparkles size={17} /> Generate website
                  </button>
                </div>
              )}
            </div>
          ) : tab === "code" ? (
            <div className="sc-code-workspace">
              <div className="sc-file-tree">
                <strong>FILES</strong>
                {allFiles.map((f) => (
                  <button
                    className={activeFile?.path === f.path ? "is-active" : ""}
                    key={f.path}
                    onClick={() => setFile(f.path)}
                  >
                    <FileCode2 size={14} />
                    {f.path}
                  </button>
                ))}
              </div>
              <div className="sc-code-content">
                <header>
                  <span>{activeFile?.path}</span>
                  <div className="sc-inline-actions">
                    <button
                      className="sc-icon"
                      aria-label="Copy current file"
                      onClick={() => void copy(activeFile?.content || "")}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="sc-icon"
                      aria-label="Download current file"
                      onClick={() =>
                        download(
                          activeFile?.content || "",
                          activeFile?.path || "index.html",
                        )
                      }
                    >
                      <Download size={15} />
                    </button>
                  </div>
                </header>
                {activeFile?.path !== "index.html" && (
                  <p className="sc-code-notice">
                    Last generated source. Visual edits are included in
                    index.html.
                  </p>
                )}
                <pre tabIndex={0}>
                  <code>{activeFile?.content}</code>
                </pre>
              </div>
            </div>
          ) : props.project?.websites[0] ? (
            <div className="sc-launch-tab">
              <div className="sc-notice">
                Server Launch Score checks the last AI version. The inspector’s
                checks use your current browser draft.
              </div>
              <LaunchReportPanel
                projectId={id}
                artifactId={props.project.websites[0].id}
                version={props.project.websites[0].version}
                onPreview={() => setTab("preview")}
              />
            </div>
          ) : html ? (
            <div className="sc-launch-tab">
              <AuditPanel website={editedWebsite} />
              <div className="sc-publish-checklist">
                <h3>Ready to Publish checklist</h3>
                {[
                  "Replace all sample content",
                  "Review mobile layout and keyboard navigation",
                  "Connect and test form delivery",
                  "Verify links, images and business details",
                  "Export code and configure hosting",
                ].map((text) => (
                  <label key={text}>
                    <input
                      type="checkbox"
                      defaultChecked={readLocal(`${key}:check:${text}`, false)}
                      onChange={(e) =>
                        saveLocal(`${key}:check:${text}`, e.target.checked)
                      }
                    />
                    {text}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="sc-empty">
              Generate a preview to see its quality checks.
            </div>
          )}
          <footer className="sc-canvas-status">
            <span>
              <span className="sc-dot" />{" "}
              {html
                ? saved
                  ? "Browser draft · auto-saved locally"
                  : "Draft not saved · export to keep changes"
                : "Ready when you are"}
            </span>
            <span>
              {html
                ? `${(new TextEncoder().encode(html).length / 1024).toFixed(1)} KB · ${sections.length} sections`
                : ""}
            </span>
          </footer>
        </main>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector"
          tabIndex={0}
          className="sc-resizer"
          onPointerDown={(e) => beginDrag("right", e)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setRight(Math.min(420, right + 16));
            if (e.key === "ArrowRight") setRight(Math.max(260, right - 16));
          }}
        />
        <aside
          className={`sc-inspector ${mobilePanel === "inspector" ? "is-mobile-open" : ""}`}
        >
          <div className="sc-inspector-tabs">
            {[
              ["design", Palette, "Design"],
              ["section", Layers3, "Section"],
              ["audit", ShieldCheck, "Checks"],
              ["history", History, "History"],
              ["notes", MessageSquare, "Notes"],
            ].map(([value, Icon, label]) => {
              const I = Icon as typeof Palette;
              return (
                <button
                  key={String(value)}
                  className={panel === value ? "is-active" : ""}
                  aria-label={String(label)}
                  title={String(label)}
                  onClick={() => setPanel(String(value))}
                >
                  <I size={18} />
                  <span>{String(label)}</span>
                </button>
              );
            })}
          </div>
          <div className="sc-inspector-scroll">
            {!html ? (
              <div className="sc-empty">
                <Palette size={26} />
                <p>Your design controls will appear after generation.</p>
              </div>
            ) : panel === "design" ? (
              <>
                <DesignPanel
                  design={design}
                  onChange={(next, label) =>
                    commit(applyDesign(html, next, design.accent), label, next)
                  }
                />
                <div className="sc-inspector-content sc-language-panel">
                  <label className="sc-field-label" htmlFor="site-language">
                    Website language
                  </label>
                  <select
                    id="site-language"
                    className="sc-input"
                    value={design.language}
                    onChange={(e) => {
                      const language = e.target.value;
                      if (demo) {
                        const generated = templateWebsite(
                          inferTemplate(prompt),
                          { ...design, language },
                        );
                        commit(
                          generated.html,
                          `Language: ${language}`,
                          { ...design, language },
                          generated.plan,
                        );
                        toast(
                          "Template copy translated. Your previous draft remains in history.",
                        );
                      } else {
                        void revise(
                          `Translate all visible website text into ${language === "hi" ? "Hindi" : language === "es" ? "Spanish" : "English"}. Preserve design, functionality and structure. Set the HTML language correctly.`,
                        );
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी</option>
                    <option value="es">Español</option>
                  </select>
                  <p className="sc-small sc-muted">
                    {demo
                      ? "Loads translated template copy. Replaces local copy edits; undo is available."
                      : "Requests an AI revision of the saved server version."}
                  </p>
                </div>
              </>
            ) : panel === "audit" ? (
              <AuditPanel website={editedWebsite} />
            ) : panel === "section" ? (
              <div className="sc-inspector-content">
                <div className="sc-panel-heading">
                  <MousePointer2 size={17} />
                  <h3>Edit one little detail</h3>
                </div>
                {selected < 0 || !sections[selected] ? (
                  <>
                    <p className="sc-muted">
                      Select a section on the canvas or in the page outline.
                    </p>
                    <button
                      className="sc-btn sc-btn-outline sc-full"
                      onClick={() => {
                        setSelecting(true);
                        setMobilePanel("");
                      }}
                    >
                      Enable selection mode
                    </button>
                  </>
                ) : (
                  <>
                    <span className="sc-tag">
                      Section {selected + 1} / {sections.length}
                    </span>
                    <label className="sc-field-label" htmlFor="section-title">
                      Heading
                    </label>
                    <input
                      id="section-title"
                      className="sc-input"
                      value={sectionTitle}
                      onChange={(e) => setSectionTitle(e.target.value)}
                    />
                    <button
                      className="sc-text-btn"
                      onClick={() => editSection("title", sectionTitle)}
                    >
                      Apply heading
                    </button>
                    <label className="sc-field-label" htmlFor="section-copy">
                      First paragraph
                    </label>
                    <textarea
                      id="section-copy"
                      className="sc-input"
                      rows={4}
                      value={sectionCopy}
                      onChange={(e) => setSectionCopy(e.target.value)}
                    />
                    <div className="sc-inline-actions">
                      <button
                        className="sc-btn sc-btn-outline sc-btn-sm"
                        onClick={() => editSection("copy", sectionCopy)}
                      >
                        Save copy
                      </button>
                      <button
                        className="sc-text-btn"
                        disabled={working}
                        onClick={() =>
                          void revise(
                            "Rewrite the copy to be clear, concise and engaging. Keep factual meaning and avoid unsupported claims.",
                          )
                        }
                      >
                        <Sparkles size={14} /> AI rewrite
                      </button>
                    </div>
                    <label className="sc-field-label">Layout</label>
                    <div className="sc-preset-grid">
                      <button onClick={() => editSection("layout", "stack")}>
                        Stacked
                      </button>
                      <button onClick={() => editSection("layout", "reverse")}>
                        Reverse
                      </button>
                    </div>
                    <label className="sc-field-label">
                      Section background
                      <input
                        type="color"
                        defaultValue="#f5efe4"
                        aria-label="Section background color"
                        onChange={(e) => editSection("color", e.target.value)}
                      />
                    </label>
                    {sections[selected]?.image && (
                      <>
                        <label
                          className="sc-field-label"
                          htmlFor="section-image"
                        >
                          Image URL (HTTPS)
                        </label>
                        <input
                          id="section-image"
                          className="sc-input"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                        />
                        <button
                          className="sc-text-btn"
                          onClick={() => {
                            if (!/^https:\/\//.test(imageUrl))
                              toast("Enter an HTTPS image URL", "info");
                            else editSection("image", imageUrl);
                          }}
                        >
                          Replace image
                        </button>
                        <div className="sc-image-choices">
                          {templates.slice(0, 4).map((t) => (
                            <button
                              key={t.id}
                              aria-label={`Replace with ${t.industry} image`}
                              onClick={() => editSection("image", t.image)}
                            >
                              <Image
                                src={t.image}
                                alt={t.industry}
                                width={80}
                                height={80}
                                unoptimized
                              />
                            </button>
                          ))}
                        </div>
                        <button
                          className="sc-text-btn"
                          disabled={working}
                          onClick={() =>
                            void revise(
                              "Replace the main image in this section with a relevant high-quality visual. Preserve layout and add descriptive alt text.",
                            )
                          }
                        >
                          <Sparkles size={14} /> Ask AI for a replacement
                        </button>
                      </>
                    )}
                    <hr />
                    <div className="sc-section-actions">
                      <button onClick={() => editSection("duplicate")}>
                        <Copy size={15} /> Duplicate
                      </button>
                      <button
                        disabled={selected === 0}
                        onClick={() => editSection("up")}
                      >
                        <ArrowUp size={15} /> Move up
                      </button>
                      <button
                        disabled={selected >= sections.length - 1}
                        onClick={() => editSection("down")}
                      >
                        <ArrowDown size={15} /> Move down
                      </button>
                      <button
                        className="sc-danger"
                        onClick={() => editSection("remove")}
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>
                    <p className="sc-small sc-muted">
                      All changes are reversible with Undo.
                    </p>
                  </>
                )}
              </div>
            ) : panel === "history" ? (
              <div className="sc-inspector-content">
                <div className="sc-panel-heading">
                  <History size={17} />
                  <h3>A little evolution</h3>
                </div>
                <p className="sc-small sc-muted">
                  Up to 15 browser snapshots. Restoring changes the local draft.
                  Server versions remain unchanged.
                </p>
                <button
                  className="sc-btn sc-btn-outline sc-full"
                  disabled={draft.snapshots.length < 2}
                  onClick={() => {
                    setCompare(Math.max(0, draft.cursor - 1));
                    setDialog("compare");
                  }}
                >
                  Compare versions
                </button>
                <div className="sc-history-list">
                  {draft.snapshots.map((s, i) => (
                    <button
                      className={i === draft.cursor ? "is-active" : ""}
                      key={s.id}
                      onClick={() => setDraft((d) => ({ ...d, cursor: i }))}
                    >
                      <span>
                        {i === draft.cursor ? (
                          <Check size={15} />
                        ) : (
                          <RotateCcw size={15} />
                        )}
                      </span>
                      <div>
                        <b>
                          Version {i + 1}: {s.label}
                        </b>
                        <small>
                          {new Date(s.at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · Use locally
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
                {props.project && props.project.websites.length > 1 && (
                  <>
                    <h4>Saved AI versions</h4>
                    {props.project.websites.map((version) => (
                      <button
                        className="sc-text-btn"
                        key={version.id}
                        onClick={() =>
                          commit(
                            version.generatedCode.html,
                            `Restored AI v${version.version} locally`,
                            startDesign(version.generatedCode),
                            version.generatedCode.plan,
                          )
                        }
                      >
                        Use AI version {version.version} locally
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="sc-inspector-content">
                <div className="sc-panel-heading">
                  <MessageSquare size={17} />
                  <h3>Thoughts for later</h3>
                </div>
                <p className="sc-small sc-muted">
                  Project notes saved in this browser. This is not a shared
                  comment feed.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    const next = [
                      ...notes,
                      { text: note.trim(), at: new Date().toISOString() },
                    ];
                    setNotes(next);
                    saveLocal(key + ":notes", next);
                    setNote("");
                  }}
                >
                  <textarea
                    className="sc-input"
                    aria-label="Project note"
                    rows={3}
                    placeholder="A thought, a tweak, an idea…"
                    value={note}
                    maxLength={2000}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    className="sc-btn sc-btn-dark sc-full"
                    disabled={!note.trim()}
                  >
                    Add note
                  </button>
                </form>
                {notes.map((n, i) => (
                  <article className="sc-note" key={n.at}>
                    <p>{n.text}</p>
                    <small>{new Date(n.at).toLocaleString()}</small>
                    <button
                      className="sc-icon"
                      aria-label="Delete note"
                      onClick={() => {
                        const next = notes.filter((_, at) => at !== i);
                        setNotes(next);
                        saveLocal(key + ":notes", next);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
          <label className="sc-demo-collab">
            <Users size={15} />
            <span>Demo collaborators</span>
            <input
              type="checkbox"
              checked={collab}
              onChange={(e) => setCollab(e.target.checked)}
            />
          </label>
        </aside>
      </div>
      {dialog === "share" && (
        <ShareDialog
          website={editedWebsite}
          publishedUrl={publishedUrl}
          onClose={() => setDialog("")}
        />
      )}
      {dialog === "export" && (
        <Modal title="Your website. Your code." onClose={() => setDialog("")}>
          <p className="sc-muted">
            Take the current browser draft with you, or export the original AI
            source.
          </p>
          <div className="sc-export-options">
            <button onClick={() => download(html, `${name}.html`, "text/html")}>
              <FileCode2 />
              <span>
                <b>HTML website</b>
                <small>Current visual draft · Open in any browser</small>
              </span>
              <Download size={18} />
            </button>
            <button
              disabled={busyExport}
              onClick={async () => {
                setBusyExport(true);
                try {
                  await exportZip(editedWebsite, name);
                  toast("ZIP downloaded");
                } catch {
                  toast("Export failed. Try downloading HTML.", "info");
                } finally {
                  setBusyExport(false);
                }
              }}
            >
              <Layers3 />
              <span>
                <b>{busyExport ? "Preparing…" : "Complete ZIP"}</b>
                <small>Current HTML + last AI source files</small>
              </span>
              <Download size={18} />
            </button>
            <button
              onClick={() => {
                try {
                  printReport(editedWebsite);
                } catch (e) {
                  toast((e as Error).message, "info");
                }
              }}
            >
              <ShieldCheck />
              <span>
                <b>PDF quality report</b>
                <small>Source checks · Print or save as PDF</small>
              </span>
              <ExternalLink size={18} />
            </button>
            {hasReact ? (
              <button
                onClick={async () => {
                  const reactFiles = {
                    ...editedWebsite,
                    files: website.files.filter((f) =>
                      /\.(tsx|jsx|ts|js|json|css)$/.test(f.path),
                    ),
                  };
                  await exportZip(reactFiles, `${name}-react-source`);
                }}
              >
                <Code2 />
                <span>
                  <b>React source</b>
                  <small>Last AI source · Current draft included as HTML</small>
                </span>
                <Download size={18} />
              </button>
            ) : (
              <button
                onClick={async () => {
                  const react = `export default function SitePreview(){return <iframe title=${JSON.stringify(name)} style={{width:"100%",height:"100vh",border:0}} sandbox="allow-scripts allow-forms" srcDoc={${JSON.stringify(html)}} />;}`;
                  await exportZip(
                    {
                      ...editedWebsite,
                      files: [
                        {
                          path: "SitePreview.tsx",
                          language: "tsx",
                          content: react,
                        },
                        {
                          path: "README.md",
                          language: "markdown",
                          content:
                            "Drop SitePreview.tsx into an existing React application. It embeds the HTML draft in a sandboxed iframe; it is not a native component conversion.",
                        },
                      ],
                    },
                    `${name}-react-preview`,
                  );
                }}
              >
                <Code2 />
                <span>
                  <b>React preview component</b>
                  <small>Embeds this HTML in an existing React app</small>
                </span>
                <Download size={18} />
              </button>
            )}
            {props.onServerExport && (
              <button onClick={() => void props.onServerExport?.()}>
                <Download />
                <span>
                  <b>Original server ZIP</b>
                  <small>
                    Last saved AI version · Excludes local visual edits
                  </small>
                </span>
              </button>
            )}
          </div>
        </Modal>
      )}
      {dialog === "publish" && (
        <Modal title="Give your idea a home" onClose={() => setDialog("")}>
          <div className="sc-notice">
            Publishing uses the last AI version stored on the server. Download
            the current HTML or ZIP to deploy your browser edits manually.
          </div>
          <label className="sc-field-label" htmlFor="deploy-provider">
            Hosting provider
          </label>
          <select
            id="deploy-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="sc-input"
          >
            <option value="vercel">Vercel</option>
            <option value="netlify">Netlify</option>
          </select>
          <button
            className="sc-btn sc-btn-coral sc-full"
            disabled={deploying || !props.onDeploy}
            onClick={async () => {
              setDeploying(true);
              try {
                const result = await props.onDeploy?.(provider);
                if (result) setDeployResult(result);
              } catch (e) {
                toast((e as Error).message, "info");
              } finally {
                setDeploying(false);
              }
            }}
          >
            {deploying ? (
              <Loader2 size={17} className="sc-spin" />
            ) : (
              <Globe size={17} />
            )}
            {deploying ? "Sending to hosting…" : "Publish server version"}
          </button>
          {deployResult && (
            <div className="sc-deploy-result">
              <b>Status: {deployResult.status}</b>
              {deployResult.deploymentUrl && (
                <a
                  href={deployResult.deploymentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open hosting preview
                </a>
              )}
              <p className="sc-small sc-muted">
                Status returned by the deployment service. Refresh the project
                later for stored updates.
              </p>
            </div>
          )}
          {publishedUrl && (
            <a
              className="sc-text-btn"
              href={publishedUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Last ready deployment
            </a>
          )}
        </Modal>
      )}
      {dialog === "prompt" && (
        <Modal title="A good brief starts here" onClose={() => setDialog("")}>
          <VisualPrompt
            onApply={(text) => {
              setPrompt(text);
              setDialog("");
              toast("Your visual brief is ready to generate");
            }}
          />
        </Modal>
      )}
      {dialog === "compare" && (
        <Modal
          title="See how your idea evolved"
          wide
          onClose={() => setDialog("")}
        >
          <div className="sc-comparison">
            <div>
              <select
                className="sc-input"
                aria-label="Compare earlier version"
                value={compare}
                onChange={(e) => setCompare(Number(e.target.value))}
              >
                {draft.snapshots.map((s, i) => (
                  <option key={s.id} value={i}>
                    V{i + 1} · {s.label}
                  </option>
                ))}
              </select>
              <iframe
                title="Earlier version"
                srcDoc={draft.snapshots[compare]?.html}
                sandbox=""
              />
            </div>
            <div>
              <b className="sc-comparison-label">
                Current · V{draft.cursor + 1}
              </b>
              <iframe title="Current version" srcDoc={html} sandbox="" />
            </div>
          </div>
        </Modal>
      )}
      {dialog === "walkthrough" && (
        <Modal
          title="Welcome to your creative space"
          onClose={finishWalkthrough}
        >
          <div className="sc-walkthrough">
            <div className="sc-walk-steps">
              {[0, 1, 2, 3].map((n) => (
                <button
                  className={walkStep === n ? "is-active" : ""}
                  key={n}
                  aria-label={`Walkthrough step ${n + 1}`}
                  onClick={() => setWalkStep(n)}
                >
                  {n + 1}
                </button>
              ))}
            </div>
            <div className="sc-walk-icon">
              {walkStep === 0 ? (
                <MessageSquare />
              ) : walkStep === 1 ? (
                <Layers3 />
              ) : walkStep === 2 ? (
                <MousePointer2 />
              ) : (
                <Globe />
              )}
            </div>
            <h3>
              {
                [
                  "Start with your idea",
                  "Choose a starting point",
                  "Make the preview yours",
                  "Review, export and publish",
                ][walkStep]
              }
            </h3>
            <p>
              {
                [
                  "Describe what you need in the creative brief, or use the visual prompt builder. Use ⌘/Ctrl Enter to generate.",
                  "Explore eight templates from the gallery. In this playground, generation matches your idea to a curated starting point.",
                  "Click the selection tool, then a section to edit its copy, image and layout. Tune the palette and spacing in Design. Undo with ⌘/Ctrl Z.",
                  "Open Checks for source-based quality estimates. Compare browser versions, share a snapshot, export your code and deploy the last saved AI version.",
                ][walkStep]
              }
            </p>
            <div className="sc-shortcut-row">
              <kbd>⌘ / Ctrl Z</kbd> Undo <kbd>Shift + Z</kbd> Redo <kbd>P</kbd>{" "}
              Present <kbd>Esc</kbd> Exit
            </div>
            <div className="sc-row-between">
              <button className="sc-text-btn" onClick={finishWalkthrough}>
                Skip walkthrough
              </button>
              <button
                className="sc-btn sc-btn-coral"
                onClick={() =>
                  walkStep === 3
                    ? finishWalkthrough()
                    : setWalkStep(walkStep + 1)
                }
              >
                {walkStep === 3 ? "Let’s create" : "Next step"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
