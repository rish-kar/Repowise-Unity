import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { FileDetailResponse } from "@repowise-dev/types/files";
import type { SymbolDetailResponse } from "@repowise-dev/types/symbols";
import { getRepo } from "@/lib/api/repos";
import { getOverviewSummary } from "@/lib/api/overview";
import { getArchitectureView } from "@/lib/api/c4";
import { getFileContent, getFileDetail } from "@/lib/api/files";
import { getExecutionFlows } from "@/lib/api/graph";
import { getSymbolDetail } from "@/lib/api/symbols";
import { TutorInterface } from "@/components/tutor/tutor-interface";
import { buildTutorCurriculum } from "@/components/tutor/tutor-curriculum";
import {
  collectTutorRelatedTests,
  enrichTutorCurriculum,
} from "@/components/tutor/tutor-enrichment";

interface Props {
  params: Promise<{ id: string }>;
}

async function safeFetch<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function uniquePaths(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const repo = await getRepo(id);
    return { title: `${repo.name} — Tutor` };
  } catch {
    return { title: "Tutor" };
  }
}

export default async function RepoTutorPage({ params }: Props) {
  const { id } = await params;

  let repo;
  try {
    repo = await getRepo(id);
  } catch {
    notFound();
  }

  const [overview, architecture, executionFlows] = await Promise.all([
    safeFetch(() => getOverviewSummary(id)),
    safeFetch(() => getArchitectureView(id)),
    safeFetch(() => getExecutionFlows(id, { top_n: 3, max_depth: 6 })),
  ]);

  // Keep enrichment bounded: Tutor teaches a small set of high-value files and
  // symbols in depth rather than turning page load into a repository crawl.
  const rankedNodes = [...(architecture?.nodes ?? [])]
    .filter((node) => node.file_path && !node.is_test)
    .sort((a, b) => b.pagerank - a.pagerank);

  const seedProductionPaths = uniquePaths([
    ...(architecture?.entry_points ?? []),
    ...(architecture?.nodes.filter((node) => node.is_entry_point).map((node) => node.file_path) ?? []),
    ...(architecture?.entry_candidates ?? []),
    ...(architecture?.tour.map((step) => step.target_path) ?? []),
    ...(overview?.onboarding_targets.map((target) => target.path) ?? []),
    ...(overview?.top_hotspots.map((hotspot) => hotspot.file_path) ?? []),
    ...rankedNodes.map((node) => node.file_path),
  ]).slice(0, 6);

  const relatedTests = collectTutorRelatedTests(architecture, seedProductionPaths, 4);

  // File detail already exposes indexed symbols and test/coverage metadata, so
  // reuse that endpoint instead of adding Tutor-specific backend APIs.
  const fileDetailEntries = await Promise.all(
    seedProductionPaths.map(async (path) => {
      const detail = await safeFetch(() => getFileDetail(id, path, { fields: "slim" }));
      return detail == null ? null : ([path, detail] as const);
    }),
  );
  const fileDetails = Object.fromEntries(
    fileDetailEntries.filter(
      (entry): entry is readonly [string, FileDetailResponse] => entry !== null,
    ),
  );

  // Prefer symbols that appear in RepoWise execution flows, then fill the
  // teaching set with complex functions/classes from the selected files.
  const flowSymbolIds = uniquePaths(
    executionFlows?.flows.flatMap((flow) => flow.trace) ?? [],
  );
  const fileSymbolIds = uniquePaths(
    Object.values(fileDetails).flatMap((detail) =>
      [...detail.symbols]
        .filter((symbol) => ["function", "method", "class", "interface", "struct"].includes(symbol.kind))
        .sort((a, b) => b.complexity_estimate - a.complexity_estimate)
        .map((symbol) => symbol.symbol_id),
    ),
  );
  const symbolIds = uniquePaths([...flowSymbolIds, ...fileSymbolIds]).slice(0, 10);

  const symbolDetailEntries = await Promise.all(
    symbolIds.map(async (symbolId) => {
      const detail = await safeFetch(() => getSymbolDetail(id, symbolId));
      return detail == null ? null : ([symbolId, detail] as const);
    }),
  );
  const symbolDetails = Object.fromEntries(
    symbolDetailEntries.filter(
      (entry): entry is readonly [string, SymbolDetailResponse] => entry !== null,
    ),
  );

  // Source excerpts now include production targets, related tests, and the
  // files behind taught callers/callees. The cap keeps this deterministic and
  // prevents large repositories from flooding a single Tutor request.
  const sourcePaths = uniquePaths([
    ...seedProductionPaths,
    ...relatedTests.map((test) => test.testPath),
    ...Object.values(symbolDetails).flatMap((detail) => [
      detail.symbol.file_path,
      ...detail.graph.callers.slice(0, 2).map((caller) => caller.file),
      ...detail.graph.callees.slice(0, 2).map((callee) => callee.file),
    ]),
    ...(overview?.top_hotspots.map((hotspot) => hotspot.file_path) ?? []),
  ]).slice(0, 20);

  const sourceEntries = await Promise.all(
    sourcePaths.map(async (path) => {
      const content = await safeFetch(() => getFileContent(id, path));
      return content == null ? null : ([path, content] as const);
    }),
  );
  const sourceContents = Object.fromEntries(
    sourceEntries.filter((entry): entry is readonly [string, string] => entry !== null),
  );

  const curriculum = buildTutorCurriculum({
    repoName: repo.name,
    defaultBranch: repo.default_branch,
    ...(repo.head_commit ? { headCommit: repo.head_commit } : {}),
    overview,
    architecture,
    sourceContents,
  });

  enrichTutorCurriculum({
    curriculum,
    architecture,
    fileDetails,
    symbolDetails,
    executionFlows,
    sourceContents,
    relatedTests,
  });

  return <TutorInterface repoId={id} curriculum={curriculum} />;
}
