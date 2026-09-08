"use client";

/**
 * Impact view — the blast-radius analyzer. Type-to-search the file index (or
 * paste a PR diff), seed from top hotspots, pick a traversal depth, then render
 * the risk gauge, impact graph, and detail tables. Planned additions reuse the
 * same graph by treating their existing integration points as the change
 * boundary. The reviewer panel is a slot the host supplies or no-ops.
 *
 * Presentation + orchestration only: the host injects data fetching, the
 * analysis call, and the reviewer slot through an {@link ImpactAdapter}, so web
 * and hosted render the same view from one source.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Plus, Flame } from "lucide-react";
import type { BlastRadiusResponse } from "@repowise-dev/types/blast-radius";

import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { FilePathPicker } from "../health/file-path-picker";
import { BlastRadiusResults } from "./blast-radius-results";
import type { ImpactAdapter } from "./impact-adapter";
import { toFriendlyMessage } from "../lib/errors";

type AnalysisMode = "existing" | "planned";

export function ImpactView({
  adapter,
  initialFiles,
}: {
  adapter: ImpactAdapter;
  /**
   * Files to seed the selection with, and analyze on arrival.
   *
   * Nobody browses to this view: every route into it is a per-file CTA — the
   * "Blast Radius" button on a file card, "View blast radius for X" in the
   * symbol drawer. Both already know the path, and without this they landed on
   * an empty picker and asked the reader to retype the path they had just
   * clicked. Undefined keeps the blank analyzer, for a direct visit.
   */
  initialFiles?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialFiles ?? []);
  const [mode, setMode] = useState<AnalysisMode>("existing");
  const [plannedAddition, setPlannedAddition] = useState("");
  const [maxDepth, setMaxDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlastRadiusResponse | null>(null);
  // The changed-files snapshot the current result was analyzed for — feeds the
  // reviewer slot so editing the selection (before re-analyzing) doesn't churn it.
  const [analyzedFiles, setAnalyzedFiles] = useState<string[]>([]);
  const [analyzedMode, setAnalyzedMode] = useState<AnalysisMode>("existing");
  const [analyzedPlan, setAnalyzedPlan] = useState("");

  const { data: hotspotSuggestions, isLoading: hotspotSuggestionsLoading } = useSWR(
    `blast-radius-suggestions:${adapter.cacheKey}`,
    () => adapter.listHotspots(8),
    { revalidateOnFocus: false },
  );

  const addPaths = (paths: string[]) => {
    setSelected((prev) => {
      const set = new Set(prev);
      for (const p of paths) {
        const trimmed = p.trim();
        if (trimmed) set.add(trimmed);
      }
      return [...set];
    });
  };
  const removePath = (path: string) =>
    setSelected((prev) => prev.filter((p) => p !== path));
  const useAllHotspots = () => {
    if (!hotspotSuggestions) return;
    addPaths(hotspotSuggestions.map((h) => h.file_path));
  };

  const runAnalysis = useCallback(
    async (files: string[], requestedMode: AnalysisMode = mode) => {
      const plan = plannedAddition.trim();
      if (requestedMode === "planned" && !plan) {
        setError("Describe the code you plan to add.");
        return;
      }
      if (files.length === 0) {
        setError(
          requestedMode === "planned"
            ? "Add at least one existing integration point."
            : "Add at least one file path.",
        );
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        // New code is not in the index yet. For a planned addition, the selected
        // existing integration points are therefore the honest graph boundary:
        // analyzing their blast radius predicts what wiring the addition there
        // can affect without inventing nodes or edges that do not exist.
        const data = await adapter.analyze({ changedFiles: files, maxDepth });
        setResult(data);
        setAnalyzedFiles(files);
        setAnalyzedMode(requestedMode);
        setAnalyzedPlan(requestedMode === "planned" ? plan : "");
      } catch (err) {
        setError(toFriendlyMessage(err, "Analysis failed."));
      } finally {
        setLoading(false);
      }
    },
    [adapter, maxDepth, mode, plannedAddition],
  );

  const handleAnalyze = () => void runAnalysis(selected);
  const handleModeChange = (nextMode: AnalysisMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setResult(null);
  };

  // Analyze a seeded selection on arrival, so following a file card's "Blast
  // Radius" button lands on the answer rather than on a filled-in form still
  // waiting for a click. Keyed by the seed so navigating from one file to
  // another re-runs it, and guarded by a ref so re-renders (and the depth
  // control, which `runAnalysis` depends on) do not re-fire it. Seeded routes
  // always describe an existing file change, never a hypothetical addition.
  const seedKey = (initialFiles ?? []).join("\n");
  const analyzedSeed = useRef<string | null>(null);
  useEffect(() => {
    if (!seedKey || analyzedSeed.current === seedKey) return;
    analyzedSeed.current = seedKey;
    const files = seedKey.split("\n");
    setMode("existing");
    setSelected(files);
    void runAnalysis(files, "existing");
    // runAnalysis is deliberately not a dependency; see the ref guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Impact Analyzer</CardTitle>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Estimate the blast radius of an existing change or planned addition:
            direct and transitive risks, reviewer suggestions, and test gaps.
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center gap-2" role="group" aria-label="Impact analysis mode">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              aria-pressed={mode === "existing"}
              onClick={() => handleModeChange("existing")}
              disabled={loading}
            >
              Existing change
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "planned" ? "default" : "outline"}
              aria-pressed={mode === "planned"}
              onClick={() => handleModeChange("planned")}
              disabled={loading}
            >
              Planned addition
            </Button>
          </div>

          {mode === "planned" && (
            <div className="space-y-1.5">
              <label
                htmlFor="impact-planned-addition"
                className="text-xs font-medium text-[var(--color-text-secondary)]"
              >
                What are you planning to add?
              </label>
              <textarea
                id="impact-planned-addition"
                value={plannedAddition}
                onChange={(e) => setPlannedAddition(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Example: Add a webhook handler for invoice-paid events and wire it into the billing service."
                className="w-full resize-y rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
              />
              <p className="text-xs text-[var(--color-text-tertiary)]">
                New code is not in the repository graph yet. Select the existing files it will
                connect to below; RepoWise estimates impact through those integration points.
              </p>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-tertiary)]">
            {mode === "planned" ? (
              <>
                Type to search for integration points, paste a list of paths, click a hotspot
                below, or{" "}
              </>
            ) : (
              <>
                Type to search the file index, paste a list of paths (your PR diff), click a
                hotspot below, or{" "}
              </>
            )}
            <button
              type="button"
              onClick={useAllHotspots}
              className="underline underline-offset-2 hover:text-[var(--color-text-primary)]"
              disabled={!hotspotSuggestions || hotspotSuggestions.length === 0}
            >
              use top hotspots
            </button>
            .
          </p>

          {hotspotSuggestionsLoading && !hotspotSuggestions && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-32 rounded-full" />
              ))}
            </div>
          )}

          {hotspotSuggestions && hotspotSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hotspotSuggestions.map((h) => (
                <button
                  key={h.file_path}
                  type="button"
                  onClick={() => addPaths([h.file_path])}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs font-mono text-[var(--color-text-secondary)] hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-primary)] transition-colors"
                  title={h.file_path}
                  aria-label={`Add ${h.file_path} to ${mode === "planned" ? "integration points" : "changed files"}`}
                >
                  <Flame className="h-3 w-3 text-[var(--color-warning)]" />
                  <span className="truncate max-w-[260px]">{h.file_path}</span>
                  <Plus className="h-3 w-3 opacity-60" />
                </button>
              ))}
            </div>
          )}

          {mode === "planned" && (
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              Existing integration points
            </p>
          )}
          <FilePathPicker
            selected={selected}
            onAdd={addPaths}
            onRemove={removePath}
            onSearch={(q) => adapter.searchFiles(q)}
          />

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              Max depth
              <input
                type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(e) => setMaxDepth(Math.max(1, Math.min(10, Number(e.target.value))))}
                className="w-16 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                aria-label="Maximum dependency depth (1–10)"
              />
            </label>
            <Button onClick={handleAnalyze} disabled={loading} size="sm">
              {loading
                ? "Analyzing…"
                : mode === "planned"
                  ? "Analyze planned addition"
                  : "Analyze"}
            </Button>
            {selected.length > 0 && (
              <Button onClick={() => setSelected([])} disabled={loading} size="sm" variant="outline">
                Clear
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </CardContent>
      </Card>

      {result && analyzedMode === "planned" && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Planned addition
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">{analyzedPlan}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Estimated through {analyzedFiles.length} selected integration {analyzedFiles.length === 1 ? "point" : "points"}.
            The impact map treats those existing files as the change boundary; re-index after the
            new code exists for measured graph results.
          </p>
        </div>
      )}

      {result && (
        <BlastRadiusResults
          result={result}
          changedFiles={analyzedMode === "planned" ? analyzedFiles : selected}
          reviewersSlot={adapter.renderReviewers?.(analyzedFiles)}
        />
      )}
    </div>
  );
}
