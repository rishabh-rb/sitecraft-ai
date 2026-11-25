"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Database, ExternalLink, Search } from "lucide-react";
import { api, type AdminDatabaseTables } from "@/lib/api";
import { useAdminRefresh } from "./use-admin-refresh";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("en-IN", { timeStyle: "medium" });
const numberFormat = new Intl.NumberFormat("en-IN");

function dateCell(value: string) {
  return <time dateTime={value} className="whitespace-nowrap">{dateFormat.format(new Date(value))}</time>;
}

function identity(primary: string, secondary?: string | null) {
  return (
    <div className="min-w-36 max-w-64 break-words">
      <p className="font-semibold text-ink">{primary}</p>
      {secondary ? <p className="mt-0.5 text-xs text-ink/60">{secondary}</p> : null}
    </div>
  );
}

function statusBadge(value: string) {
  const label = value.toLowerCase();
  const tones: Record<string, string> = {
    admin: "bg-orange-100 text-orange-900",
    ready: "bg-teal/10 text-teal",
    success: "bg-teal/10 text-teal",
    failed: "bg-red-50 text-red-700",
    error: "bg-red-50 text-red-700",
    generating: "bg-amber-100 text-amber-900",
    building: "bg-amber-100 text-amber-900",
    running: "bg-amber-100 text-amber-900",
    pending: "bg-amber-100 text-amber-900"
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[label] ?? "bg-paper text-ink/70"}`}>
      {label}
    </span>
  );
}

function deploymentLink(value?: string) {
  if (!value || !/^https?:\/\//i.test(value)) return "—";
  return (
    <a href={value} target="_blank" rel="noopener noreferrer" title={value}
      className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-teal hover:underline">
      Open site <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

function defineTable<Table extends keyof AdminDatabaseTables>(
  table: Table,
  label: string,
  searchHint: string,
  columns: { label: string; render: (row: AdminDatabaseTables[Table]) => ReactNode }[]
) {
  return {
    table,
    label,
    searchHint,
    headings: columns.map((column) => column.label),
    async load(page: number, search: string, accessToken: string, signal: AbortSignal) {
      const snapshot = await api.adminDatabaseRows(table, page, search, accessToken, signal);
      return {
        ...snapshot,
        result: {
          ...snapshot.result,
          items: snapshot.result.items.map((row) => ({
            id: row.id,
            cells: columns.map((column) => column.render(row))
          }))
        }
      };
    }
  };
}

const tables = [
  defineTable("users", "Users", "Name or email", [
    { label: "User", render: (row) => identity(row.name || row.email, row.name ? row.email : null) },
    { label: "Role", render: (row) => statusBadge(row.role) },
    { label: "Projects", render: (row) => row.projectsCount ?? 0 },
    { label: "Joined", render: (row) => dateCell(row.createdAt) }
  ]),
  defineTable("projects", "Projects", "Name, prompt, or owner email", [
    { label: "Project", render: (row) => identity(row.name, row.framework) },
    { label: "Owner", render: (row) => row.userEmail || row.userName || row.userId },
    { label: "Status", render: (row) => statusBadge(row.status) },
    { label: "Websites", render: (row) => row.websitesCount ?? 0 },
    { label: "Created", render: (row) => dateCell(row.createdAt) }
  ]),
  defineTable("websites", "Websites", "Title, project, or owner email", [
    { label: "Website", render: (row) => identity(row.title, row.projectName) },
    { label: "Owner", render: (row) => row.userEmail ?? "—" },
    { label: "Theme", render: (row) => row.theme || "—" },
    { label: "Version", render: (row) => row.version },
    { label: "Created", render: (row) => dateCell(row.createdAt) }
  ]),
  defineTable("generations", "Generations", "Prompt, project, or owner email", [
    { label: "Agent", render: (row) => identity(row.agent, row.projectName) },
    { label: "Prompt", render: (row) => <p className="min-w-48 max-w-md break-words">{row.userPrompt}</p> },
    { label: "Status", render: (row) => statusBadge(row.status) },
    { label: "Tokens", render: (row) => row.tokenUsage?.toLocaleString("en-IN") ?? "—" },
    { label: "Created", render: (row) => dateCell(row.createdAt) }
  ]),
  defineTable("deployments", "Deployments", "Project name, URL, or deploy ID", [
    { label: "Project", render: (row) => identity(row.projectName || row.projectId, row.userEmail) },
    { label: "Provider", render: (row) => row.provider },
    { label: "Status", render: (row) => statusBadge(row.status) },
    { label: "URL", render: (row) => deploymentLink(row.deploymentUrl) },
    { label: "Created", render: (row) => dateCell(row.createdAt) }
  ]),
  defineTable("search-history", "Search history", "Search for a prompt", [
    { label: "Prompt", render: (row) => <p className="min-w-48 max-w-lg break-words font-medium text-ink">{row.query}</p> },
    { label: "User", render: (row) => identity(row.userName || row.userEmail || row.userId, row.userName ? row.userEmail : null) },
    { label: "Source", render: (row) => row.source },
    { label: "Created", render: (row) => dateCell(row.createdAt) }
  ])
];

type TableDefinition = (typeof tables)[number];
type RefreshProps = { accessToken: string; refreshVersion: number };

const controlClass = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40";

function RecordPage({
  definition, page, search, onPageChange, accessToken, refreshVersion
}: RefreshProps & {
  definition: TableDefinition;
  page: number;
  search: string;
  onPageChange: (page: number) => void;
}) {
  const load = useCallback((signal: AbortSignal) => definition.load(page, search, accessToken, signal), [definition, page, search, accessToken]);
  const { snapshot, error, refreshing } = useAdminRefresh(load, 15_000, refreshVersion);
  const data = snapshot?.result;
  const sourceLabel = error
    ? (snapshot ? "Last successful PostgreSQL read" : "No database results")
    : (snapshot ? "PostgreSQL · Auto-refresh every 15s" : "Connecting to PostgreSQL");

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-paper/50 px-4 py-2.5 text-xs text-ink/70 sm:px-6">
        <span className="flex items-center gap-2 font-medium" role="status">
          <span className={`h-2 w-2 rounded-full ${error ? "bg-amber-600" : snapshot ? "bg-teal" : "bg-ink/25"}`} aria-hidden />
          {sourceLabel}
        </span>
        {snapshot ? (
          <span className="tabular-nums">
            {refreshing ? "Refreshing…" : <>Last updated <time dateTime={snapshot.refreshedAt}>{timeFormat.format(new Date(snapshot.refreshedAt))}</time></>}
          </span>
        ) : null}
      </div>
      {error ? <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">{error}</p> : null}
      <div className="overflow-x-auto focus-visible:outline-teal" role="region" tabIndex={0} aria-label={`${definition.label} table`}>
        <table className="w-full min-w-[600px] text-left text-sm">
          <caption className="sr-only">{definition.label} records from PostgreSQL</caption>
          <thead className="border-b border-line text-xs font-semibold text-ink/65">
            <tr>{definition.headings.map((heading) => <th key={heading} scope="col" className="whitespace-nowrap px-4 py-3 sm:px-6">{heading}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line text-ink/75">
            {data?.items.map((row) => (
              <tr key={row.id} className="align-top even:bg-paper/40 hover:bg-paper">
                {row.cells.map((cell, index) => (
                  <td key={definition.headings[index]} className="px-4 py-3.5 sm:px-6">{cell}</td>
                ))}
              </tr>
            ))}
            {!data?.items.length ? (
              <tr>
                <td colSpan={definition.headings.length} className="px-4 py-10 text-center text-ink/60">
                  {data
                    ? (search ? "No records match your search." : "No records on this page.")
                    : (error ? "Database results could not be loaded." : "Loading records…")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink/70 sm:px-6">
        <p className="tabular-nums">
          Page {numberFormat.format(page)}
          {data ? ` · ${numberFormat.format(data.total)} ${data.total === 1 ? "record" : "records"}` : null}
        </p>
        <div className="flex gap-2" aria-label="Pagination">
          <button type="button" className={controlClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
          </button>
          <button type="button" className={controlClass} disabled={!data || page >= data.totalPages} onClick={() => onPageChange(page + 1)}>
            Next <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </footer>
    </>
  );
}

function TablePanel({ definition, ...refreshProps }: RefreshProps & { definition: TableDefinition }) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState({ search: "", page: 1 });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <h3 className="font-bold">{definition.label}</h3>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={(event) => {
          event.preventDefault();
          setQuery({ search: searchInput.trim(), page: 1 });
        }}>
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink/50" aria-hidden />
            <span className="sr-only">Search {definition.label.toLowerCase()}</span>
            <input type="search" className="h-9 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-sm focus-visible:outline-teal sm:w-64"
              maxLength={200} placeholder={definition.searchHint} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
          </label>
          <button className={controlClass} type="submit">Search</button>
          {query.search ? <button className={controlClass} type="button" onClick={() => {
            setSearchInput("");
            setQuery({ search: "", page: 1 });
          }}>Clear</button> : null}
        </form>
      </div>
      <RecordPage
        key={JSON.stringify(query)}
        definition={definition}
        page={query.page}
        search={query.search}
        onPageChange={(page) => setQuery({ ...query, page })}
        {...refreshProps}
      />
    </div>
  );
}

export function DatabaseExplorer(refreshProps: RefreshProps) {
  const [activeTable, setActiveTable] = useState(tables[0]);
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft" aria-labelledby="database-heading">
      <div className="px-4 pt-5 sm:px-6">
        <h2 id="database-heading" className="flex items-center gap-2 text-lg font-black">
          <Database className="h-5 w-5 text-teal" aria-hidden /> Database records
        </h2>
      </div>
      <div className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5" role="group" aria-label="Choose a database table">
        {tables.map((table) => {
          const active = activeTable.table === table.table;
          return (
            <button type="button" key={table.table} aria-pressed={active} onClick={() => setActiveTable(table)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold focus-visible:outline-teal ${active ? "border-teal text-teal" : "border-transparent text-ink/65 hover:text-ink"}`}>
              {table.label}
            </button>
          );
        })}
      </div>
      <TablePanel key={activeTable.table} definition={activeTable} {...refreshProps} />
    </section>
  );
}
