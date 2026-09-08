"use client";

import { useParams } from "next/navigation";
import { GitMerge } from "lucide-react";
import { PageShell } from "@repowise-dev/ui/shared/page-shell";
import { ChangeAnalyserInterface } from "@/components/change-analyser/change-analyser-interface";

export default function ChangeAnalyserPage() {
  const params = useParams<{ id: string }>();
  const repoId = params.id;

  return (
    <PageShell
      title="Change Analyser"
      icon={<GitMerge className="h-5 w-5 text-[var(--color-accent-primary)]" />}
      description="Analyse the code you intend to change, the symbols and contracts involved, downstream dependencies, reviewers, and tests that need attention."
    >
      <ChangeAnalyserInterface repoId={repoId} />
    </PageShell>
  );
}
