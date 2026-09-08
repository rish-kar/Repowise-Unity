"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Flame, GitMerge, Plus } from "lucide-react";
import type { BlastRadiusResponse } from "@repowise-dev/types/blast-radius";
import { BlastRadiusResults } from "@repowise-dev/ui/blast-radius";
import { ReviewerSuggestions } from "@repowise-dev/ui/git/reviewer-suggestions";
import { FilePathPicker } from "@repowise-dev/ui/health/file-path-picker";
import { toFriendlyMessage } from "@repowise-dev/ui/lib/errors";
import { PageShell } from "@repowise-dev/ui/shared/page-shell";
import { Button } from "@repowise-dev/ui/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repowise-dev/ui/ui/card";
import { Skeleton } from "@repowise-dev/ui/ui/skeleton";
import { ImpactTab } from "@/components/risk/impact-tab";
import { analyzeBlastRadius } from "@/lib/api/blast-radius";
import { getHotspots, getReviewerSuggestions } from "@/lib/api/git";
import { searchNodes } from "@/lib/api/graph";

type ChangeMode = "existing" | "planned";

function ReviewersPanel({ repoId, files }: { repoId: string; files: string[] }) {
  const { data } = useSWR(
    files.length ? ["change-analyser-reviewers", repoId, files.join("\n")] : null,
    () =>
      getReviewerSuggestions(repoId, files, 8)
        .then((response) => response.suggestions)
        .catch(() => []),
    { revalidateOnFocus: false },
  );

  if (!data || data.length === 0) return null;

  return (
    <ReviewerSuggestions
      suggestions={data}
      subtitle={`Based on authorship and co-change history for ${files.length} integration ${files.length === 1 ? "point" : "points"}`}
    />
  );
}

function PlannedAdditionAnalyser({ repoId }: { repoId: string }) {
  const [plannedAddition, setPlannedAddition] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [maxDepth, setMaxDepth] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BlastRadiusResponse | null>(null);
  const [analyzedFiles, setAnalyzedFiles] = useState<string[]>([]);
  const [analyzedPlan, setAnalyzedPlan] = useState("");

  const { data: hotspotSuggestions, isLoading: hotspotSuggestionsLoading } = useSWR(
    `change-analyser-hotspots:${repoId}`,
    () => getHotspots(repoId, 8),
    { revalidateOnFocus: false },
  );

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
      const results = await searchNodes(repoId, query, 8);
      return results.map((item) => item.node_id);
    },
    [repoId],
  );

  const analyze = useCallback(async () => {
    const plan = plannedAddition.trim();
    if (!plan) {
      setError("Describe the code you plan to add.");
      return;
    }
    if (selected.length === 0) {
      setError("Add at least one existing integration point.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // Planned code does not exist in the index yet. Existing integration
      // points are the honest graph boundary for estimating downstream impact.
      const data = await analyzeBlastRadius(repoId, {
        changed_files: selected,
        max_depth: maxDepth,
      });
      setResult(data);
      setAnalyzedFiles(selected);
      setAnalyzedPlan(plan);
    } catch (err) {
      setError(toFriendlyMessage(err, "Analysis failed."));
    } finally {
      setLoading(false);
    }
  }, [maxDepth, plannedAddition, repoId, selected]);

  const useAllHotspots = () => {
    if (!hotspotSuggestions) return;
    addPaths(hotspotSuggestions.map((hotspot) => hotspot.file_path));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Planned addition</CardTitle>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Describe new code before it exists, then select the existing files it will connect to.
            RepoWise estimates the downstream blast radius through those integration points.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-1.5">
            <label
              htmlFor="change-analyser-plan"
              className="text-xs font-medium text-[var(--color-text-secondary)]"
            >
              What are you planning to add?
            </label>
            <textarea
              id="change-analyser-plan"
              value={plannedAddition}
              onChange={(event) => setPlannedAddition(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Example: Add a webhook handler for invoice-paid events and wire it into the billing service."
              className="w-full resize-y rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              Existing integration points
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Search the indexed repository, paste file paths, click a hotspot below, or{" "}
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
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-7 w-32 rounded-full" />
                ))}
              </div>
            )}

            {hotspotSuggestions && hotspotSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {hotspotSuggestions.map((hotspot) => (
                  <button
                    key={hotspot.file_path}
                    type="button"
                    onClick={() => addPaths([hotspot.file_path])}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs font-mono text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-primary)]"
                    title={hotspot.file_path}
                    aria-label={`Add ${hotspot.file_path} to integration points`}
                  >
                    <Flame className="h-3 w-3 text-[var(--color-warning)]" />
                    <span className="max-w-[260px] truncate">{hotspot.file_path}</span>
                    <Plus className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </div>
            )}

            <FilePathPicker
              selected={selected}
              onAdd={addPaths}
              onRemove={removePath}
              onSearch={searchFiles}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              Max depth
              <input
                type="number"
                min={1}
                max={10}
                value={maxDepth}
                onChange={(event) =>
                  setMaxDepth(Math.max(1, Math.min(10, Number(event.target.value))))
                }
                className="w-16 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                aria-label="Maximum dependency depth (1–10)"
              />
            </label>
            <Button onClick={() => void analyze()} disabled={loading} size="sm">
              {loading ? "Analyzing…" : "Analyze planned addition"}
            </Button>
            {selected.length > 0 && (
              <Button
                onClick={() => setSelected([])}
                disabled={loading}
                size="sm"
                variant="outline"
              >
                Clear
              </Button>
            )}
          </div>

          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Planned addition
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">{analyzedPlan}</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Estimated through {analyzedFiles.length} selected integration{" "}
            {analyzedFiles.length === 1 ? "point" : "points"}. Re-index after the new code exists
            for measured graph results.
          </p>
        </div>
      )}

      {result && (
        <BlastRadiusResults
          result={result}
          changedFiles={analyzedFiles}
          reviewersSlot={<ReviewersPanel repoId={repoId} files={analyzedFiles} />}
        />
      )}
    </div>
  );
}

export default function ChangeAnalyserPage() {
  const params = useParams<{ id: string }>();
  const repoId = params.id;
  const [mode, setMode] = useState<ChangeMode>("existing");

  return (
    <PageShell
      title="Change Analyser"
      icon={<GitMerge className="h-5 w-5 text-[var(--color-accent-primary)]" />}
      description="Estimate what a code change can affect before implementation, including direct dependencies, downstream impact, reviewers, and tests to run."
    >
      <div className="flex items-center gap-2" role="group" aria-label="Change analysis mode">
        <Button
          type="button"
          size="sm"
          variant={mode === "existing" ? "default" : "outline"}
          aria-pressed={mode === "existing"}
          onClick={() => setMode("existing")}
        >
          Existing change
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "planned" ? "default" : "outline"}
          aria-pressed={mode === "planned"}
          onClick={() => setMode("planned")}
        >
          Planned addition
        </Button>
      </div>

      {mode === "existing" ? (
        <ImpactTab repoId={repoId} />
      ) : (
        <PlannedAdditionAnalyser repoId={repoId} />
      )}
    </PageShell>
  );
}
