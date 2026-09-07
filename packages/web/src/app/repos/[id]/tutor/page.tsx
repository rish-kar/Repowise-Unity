import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/api/repos";
import { getOverviewSummary } from "@/lib/api/overview";
import { getArchitectureView } from "@/lib/api/c4";
import { getFileContent } from "@/lib/api/files";
import { TutorInterface } from "@/components/tutor/tutor-interface";
import { buildTutorCurriculum } from "@/components/tutor/tutor-curriculum";

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

  const [overview, architecture] = await Promise.all([
    safeFetch(() => getOverviewSummary(id)),
    safeFetch(() => getArchitectureView(id)),
  ]);

  // Tutor teaches inside its own surface. Pull a small, deterministic set of
  // source files from the local checkout so lessons can show real excerpts
  // rather than redirecting the learner to Files/Architecture/Docs.
  const rankedNodes = [...(architecture?.nodes ?? [])]
    .filter((node) => node.file_path && !node.is_test)
    .sort((a, b) => b.pagerank - a.pagerank);

  const sourcePaths = uniquePaths([
    ...(architecture?.entry_points ?? []),
    ...(architecture?.nodes.filter((node) => node.is_entry_point).map((node) => node.file_path) ?? []),
    ...(architecture?.entry_candidates ?? []),
    ...(architecture?.tour.map((step) => step.target_path) ?? []),
    ...(overview?.onboarding_targets.map((target) => target.path) ?? []),
    ...(overview?.top_hotspots.map((hotspot) => hotspot.file_path) ?? []),
    ...rankedNodes.map((node) => node.file_path),
  ]).slice(0, 12);

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

  return <TutorInterface repoId={id} curriculum={curriculum} />;
}
