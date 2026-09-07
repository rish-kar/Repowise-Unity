import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/api/repos";
import { getOverviewSummary } from "@/lib/api/overview";
import { getArchitectureView } from "@/lib/api/c4";
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

  const curriculum = buildTutorCurriculum({
    repoId: id,
    repoName: repo.name,
    defaultBranch: repo.default_branch,
    ...(repo.head_commit ? { headCommit: repo.head_commit } : {}),
    overview,
    architecture,
  });

  return <TutorInterface repoId={id} curriculum={curriculum} />;
}
