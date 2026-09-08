"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Braces,
  FileCode2,
  GitMerge,
  Network,
  Route,
  TestTube2,
} from "lucide-react";
import { ReviewerSuggestions } from "@repowise-dev/ui/git/reviewer-suggestions";
import { FilePathPicker } from "@repowise-dev/ui/health/file-path-picker";
import { EmptyState } from "@repowise-dev/ui/shared/empty-state";
import { Button } from "@repowise-dev/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repowise-dev/ui/ui/card";
import { toFriendlyMessage } from "@repowise-dev/ui/lib/errors";
import { analyzeBlastRadius } from "@/lib/api/blast-radius";
import { getFileContent, getFileDetail } from "@/lib/api/files";
import { getReviewerSuggestions } from "@/lib/api/git";
import { searchNodes } from "@/lib/api/graph";
import { getSymbolDetail } from "@/lib/api/symbols";
import {
  buildChangeAnalysisReport,
  type ChangeAnalysisReport,
  type LoadedChangeFile,
} from "./change-analysis";

export type ChangeMode = "existing" | "planned";

type ReviewerSuggestion = Awaited<ReturnType<typeof getReviewerSuggestions>>["suggestions"][number];

interface AnalysisState {
  report: ChangeAnalysisReport;
  reviewers: ReviewerSuggestion[];
}

const ANALYSIS_FILE_LIMIT = 12;
const SYMBOL_DETAIL_LIMIT_PER_FILE = 12;
const SYMBOL_KINDS = new Set(["function", "method", "class", "interface", "struct", "enum"]);

async function safeLoad<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

async function loadFileEvidence(repoId: string, path: string): Promise<LoadedChangeFile> {
  const [detail, source] = await Promise.all([
    safeLoad(() => getFileDetail(repoId, path, { fields: "slim" })),
    safeLoad(() => getFileContent(repoId, path)),
  ]);

  const symbolRows = [...(detail?.symbols ?? [])]
    .filter((symbol) => SYMBOL_KINDS.has(symbol.kind))
    .sort((a, b) => {
      const visibilityDelta = Number(b.visibility === "public") - Number(a.visibility === "public");
      if (visibilityDelta !== 0) return visibilityDelta;
      return b.complexity_estimate - a.complexity_estimate;
    })
    .slice(0, SYMBOL_DETAIL_LIMIT_PER_FILE);

  const symbolResults = await Promise.all(
    symbolRows.map((symbol) => safeLoad(() => getSymbolDetail(repoId, symbol.symbol_id))),
  );

  return {
    path,
    detail,
    source,
    symbols: symbolResults.filter((symbol): symbol is NonNullable<typeof symbol> => symbol !== null),
  };
}

function ModeButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function EvidencePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
      {children}
    </span>
  );
}

function ReportHeader({ report }: { report: ChangeAnalysisReport }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Change being analysed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{report.intent}</p>
        <div className="flex flex-wrap gap-2">
          <EvidencePill>{report.mode === "existing" ? "Existing change" : "Planned addition"}</EvidencePill>
          <EvidencePill>{report.selectedFiles.length} file{report.selectedFiles.length === 1 ? "" : "s"}</EvidencePill>
          <EvidencePill>Evidence: {report.evidenceCoverage}</EvidencePill>
          {report.structuralBreadth && (
            <EvidencePill>
              Structural breadth {report.structuralBreadth.score.toFixed(1)}/10 · {report.structuralBreadth.band}
            </EvidencePill>
          )}
        </div>
        <div className="space-y-1">
          {report.selectedFiles.map((path) => (
            <p key={path} className="break-all font-mono text-xs text-[var(--color-text-secondary)]">
              {path}
            </p>
          ))}
        </div>
        {report.structuralBreadth && (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Structural breadth is RepoWise graph evidence, not a probability that the change will break.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CurrentSurface({ report }: { report: ChangeAnalysisReport }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileCode2 className="h-4 w-4" /> Current code surface
        </CardTitle>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          What the selected files expose and call today, before reasoning about downstream impact.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {report.fileSurfaces.map((file) => (
          <div key={file.path} className="space-y-3 border-b border-[var(--color-border-subtle)] pb-5 last:border-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="break-all font-mono text-xs font-medium text-[var(--color-text-primary)]">{file.path}</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  {file.language ?? "language unavailable"}
                  {file.isEntryPoint ? " · entry point" : ""}
                  {file.healthScore != null ? ` · health ${file.healthScore.toFixed(1)}/10` : ""}
                  {file.isHotspot === true ? " · Git hotspot" : ""}
                </p>
              </div>
              {file.churnPercentile != null && <EvidencePill>churn p{Math.round(file.churnPercentile)}</EvidencePill>}
            </div>

            {file.endpoints.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  <Route className="h-3.5 w-3.5" /> Public HTTP surface
                </p>
                <div className="flex flex-wrap gap-2">
                  {file.endpoints.map((endpoint) => (
                    <EvidencePill key={`${file.path}:${endpoint.label}`}>{endpoint.label}</EvidencePill>
                  ))}
                </div>
              </div>
            )}

            {file.publicSymbols.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Public symbols</p>
                {file.publicSymbols.slice(0, 10).map((symbol) => (
                  <p key={`${file.path}:${symbol.name}:${symbol.signature}`} className="break-all font-mono text-xs text-[var(--color-text-secondary)]">
                    {symbol.signature || symbol.name}
                  </p>
                ))}
              </div>
            )}

            {file.observedCalls.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Observed calls in source</p>
                <div className="flex flex-wrap gap-1.5">
                  {file.observedCalls.map((call) => (
                    <EvidencePill key={`${file.path}:${call}`}>{call}</EvidencePill>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LikelySymbols({ report }: { report: ChangeAnalysisReport }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Braces className="h-4 w-4" /> Likely touched symbols
        </CardTitle>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Ranked against your change description using symbol names, signatures, documentation, callers, and callees.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {report.likelySymbols.length === 0 ? (
          <EmptyState
            title="No symbol evidence available"
            description="The index did not expose symbol-level data for the selected files. File-level dependencies are still shown below."
          />
        ) : (
          report.likelySymbols.map((symbol) => (
            <div key={symbol.symbolId} className="space-y-2 border-b border-[var(--color-border-subtle)] pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{symbol.name}</p>
                  <p className="break-all font-mono text-[11px] text-[var(--color-text-tertiary)]">
                    {symbol.filePath}:{symbol.line}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <EvidencePill>{symbol.kind}</EvidencePill>
                  <EvidencePill>{symbol.visibility}</EvidencePill>
                </div>
              </div>
              {symbol.signature && (
                <p className="break-all rounded-md bg-[var(--color-bg-elevated)] px-2.5 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                  {symbol.signature}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {symbol.reasons.map((reason) => (
                  <EvidencePill key={`${symbol.symbolId}:${reason}`}>{reason}</EvidencePill>
                ))}
              </div>
              {symbol.callees.length > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium">Calls:</span>{" "}
                  {symbol.callees.slice(0, 8).map((row) => row.name).join(", ")}
                  {symbol.calleeTotal > 8 ? ` +${symbol.calleeTotal - 8} more` : ""}
                </p>
              )}
              {symbol.callers.length > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium">Called by:</span>{" "}
                  {symbol.callers.slice(0, 8).map((row) => row.name).join(", ")}
                  {symbol.callerTotal > 8 ? ` +${symbol.callerTotal - 8} more` : ""}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ImpactPaths({ report }: { report: ChangeAnalysisReport }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Network className="h-4 w-4" /> Dependency consequences
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 pt-0 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            <ArrowDownToLine className="h-3.5 w-3.5" /> Files that depend directly on this change
          </p>
          {report.directDependents.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">No direct file dependents were present in the indexed graph.</p>
          ) : (
            report.directDependents.map((row) => (
              <div key={`${row.path}:${row.edgeType}`} className="space-y-0.5">
                <p className="break-all font-mono text-xs text-[var(--color-text-primary)]">{row.path}</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {row.edgeType}{row.importedNames.length ? ` · ${row.importedNames.join(", ")}` : ""}
                </p>
              </div>
            ))
          )}

          {report.transitiveAffected.length > 0 && (
            <div className="space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
              <p className="text-xs font-medium text-[var(--color-text-secondary)]">Further downstream</p>
              {report.transitiveAffected.slice(0, 20).map((row) => (
                <p key={`${row.path}:${row.depth}`} className="break-all font-mono text-xs text-[var(--color-text-secondary)]">
                  {row.path} <span className="font-sans text-[var(--color-text-tertiary)]">· depth {row.depth}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            <ArrowUpFromLine className="h-3.5 w-3.5" /> Dependencies the selected code relies on
          </p>
          {report.upstreamDependencies.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">No file dependencies were present in the indexed graph.</p>
          ) : (
            report.upstreamDependencies.slice(0, 24).map((row) => (
              <div key={`${row.path}:${row.edgeType}`} className="space-y-0.5">
                <p className="break-all font-mono text-xs text-[var(--color-text-primary)]">{row.path}</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {row.edgeType}{row.importedNames.length ? ` · ${row.importedNames.join(", ")}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TestsAndRisk({ report }: { report: ChangeAnalysisReport }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TestTube2 className="h-4 w-4" /> Tests to run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {report.tests.length > 0 ? (
            report.tests.slice(0, 24).map((test) => (
              <div key={`${test.repository_id}:${test.test_id}`} className="space-y-0.5">
                <p className="break-all font-mono text-xs text-[var(--color-text-primary)]">{test.test_file ?? test.test_id}</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {test.basis === "measured" ? "coverage-backed" : "graph-inferred"} · from {test.source_files.join(", ")}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-[var(--color-text-tertiary)]">
              No test recommendation was returned. Test evidence status: {report.testStatus}. This is not proof that no tests are required.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" /> What needs attention
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {report.riskFactors.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">No additional risk signal was available from the indexed evidence.</p>
          ) : (
            report.riskFactors.map((factor) => (
              <p key={factor} className="text-xs leading-5 text-[var(--color-text-secondary)]">• {factor}</p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ChangeAnalyserInterface({ repoId }: { repoId: string }) {
  const searchParams = useSearchParams();
  const seededFiles = useMemo(() => searchParams.getAll("file").filter(Boolean), [searchParams]);
  const [mode, setMode] = useState<ChangeMode>("existing");
  const [intent, setIntent] = useState("");
  const [selected, setSelected] = useState<string[]>(seededFiles);
  const [maxDepth, setMaxDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);

  const addPaths = useCallback((paths: string[]) => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const path of paths) {
        const trimmed = path.trim();
        if (trimmed) next.add(trimmed);
      }
      return [...next];
    });
  }, []);

  const removePath = useCallback((path: string) => {
    setSelected((previous) => previous.filter((candidate) => candidate !== path));
  }, []);

  const searchFiles = useCallback(
    async (query: string) => {
      const results = await searchNodes(repoId, query, 12);
      return results.map((result) => result.node_id);
    },
    [repoId],
  );

  const changeMode = (next: ChangeMode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setAnalysis(null);
  };

  const analyse = useCallback(async () => {
    const trimmedIntent = intent.trim();
    if (trimmedIntent.length < 5) {
      setError(mode === "existing" ? "Describe what you are changing, or paste the relevant diff." : "Describe what you are planning to add.");
      return;
    }
    if (selected.length === 0) {
      setError(mode === "existing" ? "Select at least one changed file." : "Select at least one existing integration point.");
      return;
    }
    if (selected.length > ANALYSIS_FILE_LIMIT) {
      setError(`Analyse at most ${ANALYSIS_FILE_LIMIT} files at a time so symbol evidence stays bounded.`);
      return;
    }

    const filesSnapshot = [...selected];
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const [files, blast, reviewerResponse] = await Promise.all([
        Promise.all(filesSnapshot.map((path) => loadFileEvidence(repoId, path))),
        safeLoad(() =>
          analyzeBlastRadius(repoId, {
            changed_files: filesSnapshot,
            max_depth: maxDepth,
          }),
        ),
        safeLoad(() => getReviewerSuggestions(repoId, filesSnapshot, 8)),
      ]);

      const report = buildChangeAnalysisReport({
        intent: trimmedIntent,
        mode,
        files,
        blast,
      });
      setAnalysis({ report, reviewers: reviewerResponse?.suggestions ?? [] });
    } catch (err) {
      setError(toFriendlyMessage(err, "Change analysis failed."));
    } finally {
      setLoading(false);
    }
  }, [intent, maxDepth, mode, repoId, selected]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Define the change</CardTitle>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            A file path alone only tells RepoWise structural blast radius. A real change analysis also needs the behavior you intend to modify.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center gap-2" role="group" aria-label="Change analysis mode">
            <ModeButton active={mode === "existing"} onClick={() => changeMode("existing")} disabled={loading}>
              Existing change
            </ModeButton>
            <ModeButton active={mode === "planned"} onClick={() => changeMode("planned")} disabled={loading}>
              Planned addition
            </ModeButton>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="change-analyser-intent" className="text-xs font-medium text-[var(--color-text-secondary)]">
              {mode === "existing" ? "What are you changing?" : "What are you planning to add?"}
            </label>
            <textarea
              id="change-analyser-intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              rows={5}
              maxLength={8000}
              placeholder={
                mode === "existing"
                  ? "Example: Change addMutations so the ZIP response includes the original preamble and postamble. You can also paste the relevant git diff here."
                  : "Example: Add a validation service before mutation generation and reject malformed SPTHY files with a 400 response."
              }
              className="w-full resize-y rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              {mode === "existing" ? "Changed files" : "Existing integration points"}
            </p>
            <FilePathPicker selected={selected} onAdd={addPaths} onRemove={removePath} onSearch={searchFiles} />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              Dependency depth
              <input
                type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(event) => setMaxDepth(Math.max(1, Math.min(10, Number(event.target.value))))}
                className="w-16 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                aria-label="Maximum dependency depth (1–10)"
              />
            </label>
            <Button size="sm" onClick={() => void analyse()} disabled={loading}>
              <GitMerge className="h-3.5 w-3.5" />
              {loading ? "Analysing code…" : "Analyse change"}
            </Button>
            {selected.length > 0 && (
              <Button size="sm" variant="outline" disabled={loading} onClick={() => setSelected([])}>
                Clear files
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </CardContent>
      </Card>

      {analysis && (
        <>
          <ReportHeader report={analysis.report} />
          <CurrentSurface report={analysis.report} />
          <LikelySymbols report={analysis.report} />
          <ImpactPaths report={analysis.report} />
          <TestsAndRisk report={analysis.report} />

          {analysis.reviewers.length > 0 && (
            <ReviewerSuggestions
              suggestions={analysis.reviewers}
              subtitle={`Based on authorship and co-change history for ${analysis.report.selectedFiles.length} selected file${analysis.report.selectedFiles.length === 1 ? "" : "s"}`}
            />
          )}

          {analysis.report.limitations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Evidence limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {analysis.report.limitations.map((limitation) => (
                  <p key={limitation} className="text-xs leading-5 text-[var(--color-text-tertiary)]">• {limitation}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
