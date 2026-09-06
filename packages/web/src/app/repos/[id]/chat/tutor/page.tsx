import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/api/repos";
import { TutorInterface } from "@/components/tutor/tutor-interface";

interface Props {
  params: Promise<{ id: string }>;
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

  return (
    <TutorInterface
      repoId={id}
      repoName={repo.name}
      defaultBranch={repo.default_branch}
      {...(repo.head_commit ? { headCommit: repo.head_commit } : {})}
    />
  );
}
