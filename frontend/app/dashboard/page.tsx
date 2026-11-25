"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FolderOpen,
  Globe,
  Grid2X2,
  Heart,
  LayoutTemplate,
  List,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { api, type Project } from "@/lib/api";
import { readLocal, saveLocal } from "@/lib/studio";
import {
  defaultDesign,
  inferTemplate,
  templates,
  templateWebsite,
  type DesignOptions,
} from "@/lib/templates";
import { Modal } from "@/components/studio/Modal";
import { VisualPrompt } from "@/components/studio/VisualPrompt";
import { toast } from "@/components/studio/ToastViewport";

export default function Dashboard() {
  const router = useRouter(),
    { data: session, status } = useSession({
      required: true,
      onUnauthenticated() {
        router.push("/login");
      },
    });
  const [projects, setProjects] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All projects"),
    [view, setView] = useState("grid"),
    [favorites, setFavorites] = useState<string[]>([]),
    [names, setNames] = useState<Record<string, string>>({}),
    [menu, setMenu] = useState(""),
    [dialog, setDialog] = useState(""),
    [target, setTarget] = useState<Project>(),
    [rename, setRename] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [prompt, setPrompt] = useState(""),
    [visual, setVisual] = useState(false),
    [localThumbs, setLocalThumbs] = useState<Record<string, string>>({}),
    [localEdited, setLocalEdited] = useState<Record<string, string>>({}),
    [templateDraft, setTemplateDraft] = useState<{
      templateId: string;
      options: Partial<DesignOptions>;
    }>();
  const userKey = `sitecraft-gallery:${session?.user?.email || "signed-out"}`;
  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const list = await api.listProjects();
        if (active) {
          setProjects(list);
          setError("");
          const thumbs: Record<string, string> = {};
          const edited: Record<string, string> = {};
          list.forEach((p) => {
            const draft = readLocal<{
              snapshots: { html: string; at?: string }[];
              cursor: number;
            } | null>(`sitecraft-studio:${p.id}`, null);
            if (draft?.snapshots[draft.cursor])
              thumbs[p.id] = draft.snapshots[draft.cursor].html;
            const at = draft?.snapshots[draft.cursor]?.at;
            if (at) edited[p.id] = at;
          });
          setLocalThumbs(thumbs);
          setLocalEdited(edited);
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [status, userKey]);
  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setTimeout(() => {
      setFavorites(readLocal(userKey + ":favorites", []));
      setNames(readLocal(userKey + ":names", {}));
      setView(readLocal(userKey + ":view", "grid"));
      const pendingTemplate = readLocal<{ templateId: string } | null>(
        "sitecraft-template-draft",
        null,
      );
      const templateId =
        new URLSearchParams(location.search).get("template") ||
        pendingTemplate?.templateId;
      if (templateId) {
        const template = templates.find((t) => t.id === templateId);
        if (template) {
          const saved = readLocal<{
            templateId: string;
            options: Partial<DesignOptions>;
            prompt?: string;
          } | null>("sitecraft-template-draft", null);
          setTemplateDraft({
            templateId,
            options: saved?.templateId === templateId ? saved.options : {},
          });
          setName(template.name);
          setPrompt(
            (saved?.templateId === templateId && saved.prompt) ||
              template.prompt,
          );
          setDialog("new");
          saveLocal("sitecraft-template-draft", null);
          history.replaceState(null, "", location.pathname);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [userKey, status]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu("");
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function refresh() {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  function favorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    saveLocal(userKey + ":favorites", next);
  }
  async function create() {
    if (!name.trim() || !prompt.trim() || busy) return;
    setBusy(true);
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: prompt.slice(0, 200),
        initialPrompt: prompt,
      });
      if (templateDraft) {
        const template = templates.find(
          (t) => t.id === templateDraft.templateId,
        )!;
        const website = templateWebsite(template, templateDraft.options);
        saveLocal(`sitecraft-studio:${project.id}`, {
          source: "",
          cursor: 0,
          snapshots: [
            {
              id: "template",
              html: website.html,
              plan: website.plan,
              label: "Template starting draft",
              at: new Date().toISOString(),
              design: {
                ...defaultDesign,
                ...templateDraft.options,
                accent: templateDraft.options.accent || template.accent,
              },
            },
          ],
        });
      }
      router.push(`/builder/${project.id}`);
    } catch (e) {
      toast((e as Error).message, "info");
      setBusy(false);
    }
  }
  async function duplicate(project: Project) {
    setMenu("");
    setBusy(true);
    try {
      const copy = await api.createProject({
        name: `${names[project.id] || project.name} copy`,
        description: project.description,
        initialPrompt: project.initialPrompt,
      });
      const original = readLocal<{
        snapshots: unknown[];
        cursor: number;
        source: string;
      } | null>(`sitecraft-studio:${project.id}`, null);
      const website = project.websites[0]?.generatedCode;
      if (original)
        saveLocal(`sitecraft-studio:${copy.id}`, { ...original, source: "" });
      else if (website)
        saveLocal(`sitecraft-studio:${copy.id}`, {
          source: "",
          cursor: 0,
          snapshots: [
            {
              id: "copy",
              html: website.html,
              plan: website.plan,
              label: "Copied browser draft",
              at: new Date().toISOString(),
              design: {
                ...defaultDesign,
                accent:
                  website.plan.colorPalette.primary || defaultDesign.accent,
              },
            },
          ],
        });
      setProjects((p) => [copy, ...p]);
      setLocalThumbs((t) => ({
        ...t,
        [copy.id]: localThumbs[project.id] || website?.html || "",
      }));
      toast("Brief duplicated. The preview copy is saved in this browser.");
    } catch (e) {
      toast((e as Error).message, "info");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!target) return;
    setBusy(true);
    try {
      await api.deleteProject(target.id);
      setProjects((p) => p.filter((x) => x.id !== target.id));
      setDialog("");
      toast("Project deleted");
    } catch (e) {
      toast((e as Error).message, "info");
    } finally {
      setBusy(false);
    }
  }
  const filtered = projects.filter((p) => {
    const industry = inferTemplate(p.initialPrompt || p.description).industry;
    return (
      `${names[p.id] || p.name} ${p.description} ${p.initialPrompt}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (category === "All projects" ||
        (category === "Favorites" && favorites.includes(p.id)) ||
        category === industry)
    );
  });
  const published = projects.filter((p) =>
    p.deployments?.some((d) => d.status === "READY"),
  ).length;
  if (status !== "authenticated")
    return (
      <main className="sc-workspace-loading">
        <Sparkles className="sc-pulse" />
        <p>Opening your workspace…</p>
      </main>
    );
  return (
    <div className="sc-dashboard">
      <aside className="sc-dashboard-sidebar">
        <Link href="/" className="sc-logo">
          <span>
            <Sparkles size={21} />
          </span>
          SiteCraft AI
        </Link>
        <span className="sc-sidebar-label">YOUR WORKSPACE</span>
        <nav>
          <Link className="is-active" href="/dashboard">
            <FolderOpen size={18} /> Projects<span>{projects.length}</span>
          </Link>
          <Link href="/templates">
            <LayoutTemplate size={18} /> Templates
          </Link>
          <Link href="/playground">
            <WandSparkles size={18} /> Playground
          </Link>
          <Link href="/showcase">
            <Globe size={18} /> Showcase
          </Link>
          <Link href="/dashboard/settings">
            <Settings size={18} /> Settings
          </Link>
        </nav>
        <div className="sc-sidebar-promo">
          <Sparkles size={24} />
          <b>A little inspiration?</b>
          <p>Explore a template. Your next idea might start there.</p>
          <Link href="/templates">Browse collection</Link>
        </div>
        <div className="sc-account">
          <span className="sc-avatar">
            {(session.user?.name ||
              session.user?.email ||
              "S")[0].toUpperCase()}
          </span>
          <div>
            <b>{session.user?.name || "Your workspace"}</b>
            <span>{session.user?.email}</span>
          </div>
          <button
            className="sc-icon"
            aria-label="Sign out"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="sc-dashboard-main">
        <header className="sc-dashboard-topbar">
          <span>
            <span className="sc-dot" /> Your creative workspace
          </span>
          <div className="sc-inline-actions">
            <Link href="/templates">Explore templates</Link>
            <button
              className="sc-icon"
              aria-label="Refresh projects"
              onClick={() => void refresh()}
            >
              <RefreshCcw size={17} className={loading ? "sc-spin" : ""} />
            </button>
          </div>
        </header>
        <div className="sc-dashboard-content">
          <div className="sc-dashboard-greeting">
            <div>
              <div className="sc-eyebrow">MAKE SOMETHING GOOD TODAY</div>
              <h1>
                Welcome back
                {session.user?.name
                  ? `, ${session.user.name.split(" ")[0]}`
                  : ""}
                <span>.</span>
              </h1>
              <p>A place for your ideas to take shape.</p>
            </div>
            <button
              className="sc-btn sc-btn-coral"
              onClick={() => {
                setName("");
                setPrompt("");
                setTemplateDraft(undefined);
                setDialog("new");
              }}
            >
              <Plus size={18} /> New project
            </button>
          </div>
          <div className="sc-stats-row">
            {[
              ["Your projects", projects.length, FolderOpen],
              [
                "Generated websites",
                projects.filter((p) => p.websites.length).length,
                LayersIcon,
              ],
              [
                "AI generation steps",
                projects.reduce((n, p) => n + p.generations.length, 0),
                Sparkles,
              ],
              ["Ready deployments", published, Globe],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Globe;
              return (
                <div key={String(label)}>
                  <I size={18} />
                  <span>{String(label)}</span>
                  <b>{String(value).padStart(2, "0")}</b>
                </div>
              );
            })}
          </div>
          <section className="sc-dashboard-banner">
            <div>
              <span className="sc-eyebrow">FROM “WHAT IF” TO “HERE IT IS”</span>
              <h2>Your next idea is a prompt away.</h2>
              <p>Start fresh or find your style in the template collection.</p>
            </div>
            <Link href="/templates" className="sc-btn sc-btn-outline">
              <LayoutTemplate size={17} /> Find a template
            </Link>
            <div className="sc-banner-art" aria-hidden>
              <div />
              <div />
              <Sparkles size={25} />
            </div>
          </section>
          <div className="sc-section-heading sc-project-heading">
            <div>
              <h2>
                Your projects <span>{projects.length}</span>
              </h2>
              <p>Saved projects and browser drafts, all in one place.</p>
            </div>
            <div className="sc-inline-actions">
              <div className="sc-search">
                <Search size={17} />
                <input
                  aria-label="Search projects"
                  placeholder="Find a project…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="sc-segmented">
                <button
                  className={view === "grid" ? "is-active" : ""}
                  aria-label="Grid view"
                  onClick={() => {
                    setView("grid");
                    saveLocal(userKey + ":view", "grid");
                  }}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  className={view === "list" ? "is-active" : ""}
                  aria-label="List view"
                  onClick={() => {
                    setView("list");
                    saveLocal(userKey + ":view", "list");
                  }}
                >
                  <List size={17} />
                </button>
              </div>
            </div>
          </div>
          <div className="sc-filter-chips sc-project-filters">
            {[
              "All projects",
              "Favorites",
              ...new Set(
                projects.map((p) => inferTemplate(p.initialPrompt).industry),
              ),
            ].map((c) => (
              <button
                key={c}
                className={category === c ? "is-active" : ""}
                onClick={() => setCategory(c)}
              >
                {c === "Favorites" && <Heart size={13} />}
                {c}
              </button>
            ))}
          </div>
          {error && (
            <div className="sc-error" role="alert">
              {error}
              <button className="sc-text-btn" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <div className="sc-grid-3">
              {[0, 1, 2].map((n) => (
                <div className="sc-project-skeleton" key={n}>
                  <div className="sc-skeleton" />
                  <div className="sc-skeleton" />
                  <div className="sc-skeleton" />
                </div>
              ))}
            </div>
          ) : filtered.length ? (
            <div
              className={`sc-project-gallery ${view === "list" ? "is-list" : ""}`}
            >
              {filtered.map((p) => {
                const preview =
                    localThumbs[p.id] || p.websites[0]?.generatedCode.html,
                  title = names[p.id] || p.name,
                  industry = inferTemplate(p.initialPrompt).industry;
                return (
                  <article className="sc-project-card" key={p.id}>
                    <Link
                      className="sc-thumb sc-project-thumb"
                      href={`/builder/${p.id}`}
                      aria-label={`Open ${title}`}
                    >
                      {preview ? (
                        <iframe
                          title={`${title} thumbnail`}
                          srcDoc={preview}
                          sandbox=""
                          tabIndex={-1}
                          loading="lazy"
                        />
                      ) : (
                        <div className="sc-project-placeholder">
                          <Sparkles size={30} />
                          <span>Your next great website</span>
                          <small>Brief ready to generate</small>
                        </div>
                      )}
                      <span
                        className={`sc-project-status ${p.status === "ready" ? "is-ready" : ""}`}
                      >
                        {localThumbs[p.id] ? "Browser draft" : p.status}
                      </span>
                    </Link>
                    <div className="sc-project-card-body">
                      <div className="sc-row-between">
                        <span className="sc-small sc-muted">{industry}</span>
                        <button
                          className={`sc-icon ${favorites.includes(p.id) ? "sc-favorited" : ""}`}
                          aria-label={`${favorites.includes(p.id) ? "Unfavorite" : "Favorite"} ${title}`}
                          aria-pressed={favorites.includes(p.id)}
                          onClick={() => favorite(p.id)}
                        >
                          <Heart
                            size={17}
                            fill={
                              favorites.includes(p.id) ? "currentColor" : "none"
                            }
                          />
                        </button>
                      </div>
                      <Link href={`/builder/${p.id}`}>
                        <h3>{title}</h3>
                      </Link>
                      <p>
                        {p.description ||
                          p.initialPrompt ||
                          "A fresh start for your next idea."}
                      </p>
                      <div className="sc-project-card-bottom">
                        <span
                          title={
                            localEdited[p.id]
                              ? "Last edited in this browser"
                              : "Last saved server update"
                          }
                        >
                          {localEdited[p.id] ? "Draft edited " : "Edited "}
                          {new Date(
                            localEdited[p.id] || p.updatedAt,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="sc-publish-badge">
                          {p.deployments?.some((d) => d.status === "READY")
                            ? "AI version published"
                            : "Unpublished"}
                        </span>
                        <div className="sc-project-menu">
                          <button
                            className="sc-icon"
                            aria-label={`Actions for ${title}`}
                            aria-expanded={menu === p.id}
                            onClick={() => setMenu(menu === p.id ? "" : p.id)}
                          >
                            <MoreHorizontal size={20} />
                          </button>
                          {menu === p.id && (
                            <div className="sc-dropdown">
                              <button
                                onClick={() => {
                                  setTarget(p);
                                  setRename(title);
                                  setDialog("rename");
                                  setMenu("");
                                }}
                              >
                                Rename in this browser
                              </button>
                              <button
                                disabled={busy}
                                onClick={() => void duplicate(p)}
                              >
                                <Copy size={14} /> Duplicate brief & local
                                preview
                              </button>
                              <button
                                className="sc-danger"
                                onClick={() => {
                                  setTarget(p);
                                  setDialog("delete");
                                  setMenu("");
                                }}
                              >
                                <Trash2 size={14} /> Delete project
                              </button>
                              <button onClick={() => setMenu("")}>
                                <X size={14} /> Close menu
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              <button
                className="sc-new-project-card"
                onClick={() => {
                  setDialog("new");
                  setTemplateDraft(undefined);
                }}
              >
                <span>
                  <Plus size={25} />
                </span>
                <b>Something new?</b>
                <p>Your next idea belongs here.</p>
              </button>
            </div>
          ) : (
            <div className="sc-empty">
              <div className="sc-empty-art">
                <FolderOpen size={55} />
                <Sparkles size={24} />
              </div>
              <h2>
                {projects.length
                  ? "No projects match just yet."
                  : "Your ideas have a new home."}
              </h2>
              <p>
                {projects.length
                  ? "Try a different filter or search."
                  : "Create your first brief, or start with a template you love."}
              </p>
              <button
                className="sc-btn sc-btn-coral"
                onClick={() =>
                  projects.length
                    ? (setSearch(""), setCategory("All projects"))
                    : setDialog("new")
                }
              >
                {projects.length
                  ? "Clear filters"
                  : "Create your first project"}
              </button>
            </div>
          )}
          <p className="sc-dashboard-footnote">
            Project statistics come from your account. Refreshes every 30
            seconds while this page is visible. Favorites, display names and
            visual drafts are stored in this browser.
          </p>
        </div>
      </main>
      {dialog === "new" && (
        <Modal
          title={
            templateDraft
              ? "Make this starting point yours"
              : "What would you like to create?"
          }
          onClose={() => setDialog("")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="sc-field-label" htmlFor="new-name">
              Project name
            </label>
            <input
              id="new-name"
              className="sc-input"
              autoFocus
              value={name}
              required
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="sc-field-label" htmlFor="new-prompt">
              Your website idea
            </label>
            <textarea
              id="new-prompt"
              className="sc-input"
              rows={5}
              value={prompt}
              required
              maxLength={10000}
              placeholder="A thoughtful portfolio for a photographer, with a gallery, about page and contact form…"
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button
              className="sc-text-btn"
              type="button"
              onClick={() => setVisual(!visual)}
            >
              <Settings size={14} /> {visual ? "Hide" : "Open"} visual prompt
              builder
            </button>
            {visual && (
              <div>
                <VisualPrompt
                  onApply={(p) => {
                    setPrompt(p);
                    setVisual(false);
                  }}
                />
              </div>
            )}
            <button
              className="sc-btn sc-btn-coral sc-full"
              disabled={busy || !name.trim() || !prompt.trim()}
            >
              {busy ? (
                <Loader2 size={17} className="sc-spin" />
              ) : (
                <Sparkles size={17} />
              )}
              {busy ? "Creating project…" : "Open in the studio"}
            </button>
            {templateDraft && (
              <p className="sc-small sc-muted">
                The template becomes a browser draft. Use Generate to create and
                save an AI version through the existing backend.
              </p>
            )}
          </form>
        </Modal>
      )}
      {dialog === "rename" && target && (
        <Modal title="A new name for your idea" onClose={() => setDialog("")}>
          <p className="sc-muted">
            Changes the display name in this browser. The server project name
            and server exports keep their original name.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rename.trim()) return;
              const next = { ...names, [target.id]: rename.trim() };
              setNames(next);
              saveLocal(userKey + ":names", next);
              setDialog("");
              toast("Display name updated");
            }}
          >
            <input
              className="sc-input"
              aria-label="Display name"
              autoFocus
              value={rename}
              maxLength={100}
              onChange={(e) => setRename(e.target.value)}
            />
            <button
              className="sc-btn sc-btn-dark sc-full"
              disabled={!rename.trim()}
            >
              Save display name
            </button>
          </form>
        </Modal>
      )}
      {dialog === "delete" && target && (
        <Modal title="Delete this project?" onClose={() => setDialog("")}>
          <p>
            This permanently removes “{names[target.id] || target.name}” from
            your account.
          </p>
          <div className="sc-inline-actions">
            <button
              className="sc-btn sc-btn-outline"
              onClick={() => setDialog("")}
            >
              Keep project
            </button>
            <button
              className="sc-btn sc-btn-coral"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
const LayersIcon = LayoutTemplate;
