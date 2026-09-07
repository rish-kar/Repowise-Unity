import type { OverviewSummaryResponse } from "@repowise-dev/types/overview";
import type { ArchitectureView, ArchNode } from "@repowise-dev/ui/c4";
import { fileEntityPath } from "@repowise-dev/ui/shared/entity";

export interface TutorFact {
  label: string;
  value: string;
}

export interface TutorItem {
  title: string;
  detail?: string;
  meta?: string;
  href?: string;
}

export interface TutorSection {
  title: string;
  body: string;
  facts?: TutorFact[];
  items?: TutorItem[];
}

export interface TutorCheckpoint {
  question: string;
  answer: string;
}

export interface TutorLesson {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  objective: string;
  estimatedMinutes: number;
  sections: TutorSection[];
  checkpoint: TutorCheckpoint;
}

export interface TutorCurriculum {
  repoName: string;
  subtitle: string;
  status: string[];
  lessons: TutorLesson[];
}

interface BuildTutorCurriculumInput {
  repoId: string;
  repoName: string;
  defaultBranch: string;
  headCommit?: string;
  overview: OverviewSummaryResponse | null;
  architecture: ArchitectureView | null;
}

function fileHref(repoId: string, path: string): string {
  return fileEntityPath(`/repos/${repoId}`, path);
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function findBestNodeByPath(nodes: ArchNode[], path: string): ArchNode | undefined {
  return nodes
    .filter((node) => node.file_path === path)
    .sort((a, b) => b.pagerank - a.pagerank)[0];
}

function formatHealth(value: number | null | undefined): string {
  return value == null ? "Not measured" : `${value.toFixed(1)} / 10`;
}

export function buildTutorCurriculum({
  repoId,
  repoName,
  defaultBranch,
  headCommit,
  overview,
  architecture,
}: BuildTutorCurriculumInput): TutorCurriculum {
  const stats = overview?.stats;
  const languages = overview?.languages.map((item) => item.language) ?? architecture?.languages ?? [];
  const primaryLanguage = languages[0] ?? "Not identified";
  const nodes = architecture?.nodes ?? [];

  const indexedEntryPoints = unique([
    ...(architecture?.entry_points ?? []),
    ...nodes.filter((node) => node.is_entry_point).map((node) => node.file_path),
    ...(architecture?.entry_candidates ?? []),
  ]).slice(0, 6);

  const entryItems: TutorItem[] = indexedEntryPoints.map((path) => {
    const node = findBestNodeByPath(nodes, path);
    return {
      title: path,
      detail: node?.summary || "RepoWise identified this as a likely place where execution enters the system.",
      meta: [node?.language, node?.complexity, node?.is_entry_point ? "confirmed entry point" : "entry candidate"]
        .filter(Boolean)
        .join(" · "),
      href: fileHref(repoId, path),
    };
  });

  const layers = [...(architecture?.layers ?? [])].sort((a, b) => a.display_order - b.display_order);
  const layerItems: TutorItem[] = layers.slice(0, 8).map((layer) => ({
    title: layer.name,
    detail: layer.description || "A structural layer detected from the indexed dependency graph.",
    meta: `${layer.file_count.toLocaleString()} files${layer.health_score == null ? "" : ` · health ${layer.health_score.toFixed(1)}/10`}`,
    href: `/repos/${repoId}/architecture`,
  }));

  const layerByNode = new Map<string, string>();
  for (const layer of layers) {
    for (const nodeId of layer.node_ids) layerByNode.set(nodeId, layer.name);
  }
  const flows = new Map<string, { from: string; to: string; weight: number }>();
  for (const edge of architecture?.edges ?? []) {
    const from = layerByNode.get(edge.source);
    const to = layerByNode.get(edge.target);
    if (!from || !to || from === to) continue;
    const key = `${from}\u0000${to}`;
    const current = flows.get(key) ?? { from, to, weight: 0 };
    current.weight += Math.max(1, edge.weight || 1);
    flows.set(key, current);
  }
  const flowItems: TutorItem[] = [...flows.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((flow) => ({
      title: `${flow.from} → ${flow.to}`,
      detail: "One of the strongest cross-layer dependency paths in the current index.",
      meta: `${Math.round(flow.weight)} indexed connection weight`,
      href: `/repos/${repoId}/architecture`,
    }));

  const curatedTour = [...(architecture?.tour ?? [])].sort((a, b) => a.order - b.order);
  const fallbackTourPaths = unique([
    ...indexedEntryPoints,
    ...(overview?.onboarding_targets.map((target) => target.path) ?? []),
  ]).slice(0, 6);
  const tourItems: TutorItem[] = curatedTour.length
    ? curatedTour.slice(0, 8).map((step) => ({
        title: `${step.order}. ${step.title}`,
        detail: step.description,
        meta: [step.reason, step.kind || null].filter(Boolean).join(" · "),
        ...(step.target_path ? { href: fileHref(repoId, step.target_path) } : { href: `/repos/${repoId}/architecture` }),
      }))
    : fallbackTourPaths.map((path, index) => ({
        title: `${index + 1}. ${path}`,
        detail: findBestNodeByPath(nodes, path)?.summary || "Read this after the previous step to build context in dependency order.",
        meta: index === 0 ? "Start here" : "Continue here",
        href: fileHref(repoId, path),
      }));

  const rankedOnboarding = [...(overview?.onboarding_targets ?? [])].sort((a, b) => b.pagerank - a.pagerank);
  const rankedNodePaths = nodes
    .filter((node) => node.file_path && !node.is_test)
    .sort((a, b) => b.pagerank - a.pagerank)
    .map((node) => node.file_path!);
  const importantPaths = unique([
    ...rankedOnboarding.map((target) => target.path),
    ...rankedNodePaths,
  ]).slice(0, 7);
  const importantItems: TutorItem[] = importantPaths.map((path) => {
    const node = findBestNodeByPath(nodes, path);
    const onboarding = rankedOnboarding.find((target) => target.path === path);
    const percentile = node?.pagerank_percentile;
    return {
      title: path,
      detail: node?.summary || "RepoWise ranks this file highly for understanding how the repository fits together.",
      meta: percentile != null
        ? `Centrality percentile ${Math.round(percentile)}${onboarding ? " · onboarding target" : ""}`
        : onboarding
          ? "Ranked onboarding target"
          : "High structural importance",
      href: fileHref(repoId, path),
    };
  });

  const hotspotItems: TutorItem[] = (overview?.top_hotspots ?? []).slice(0, 6).map((hotspot) => ({
    title: hotspot.file_path,
    detail: "This file changes often, so understand its callers, tests, and ownership before editing it.",
    meta: `${hotspot.commit_count_90d} commits in 90d · bus factor ${hotspot.bus_factor}`,
    href: fileHref(repoId, hotspot.file_path),
  }));

  const decisionItems: TutorItem[] = (overview?.recent_decisions ?? []).slice(0, 5).map((decision) => ({
    title: decision.title,
    detail: `Status: ${decision.status}${decision.source ? ` · source: ${decision.source}` : ""}`,
    href: `/repos/${repoId}/decisions`,
  }));

  const largestLayer = [...layers].sort((a, b) => b.file_count - a.file_count)[0];
  const firstTour = curatedTour[0];
  const firstImportantPath = importantPaths[0];
  const firstHotspot = overview?.top_hotspots[0];

  const lessons: TutorLesson[] = [
    {
      id: "orientation",
      eyebrow: "1 · Orientation",
      title: "Understand what you are looking at",
      summary: "Start with scale, languages, documentation coverage, and the shape of the repository before reading individual files.",
      objective: "Build a mental model of the repository without opening code at random.",
      estimatedMinutes: 4,
      sections: [
        {
          title: "Repository snapshot",
          body: architecture?.project_description || `RepoWise has indexed ${repoName}. These figures tell you how large the system is and what kind of code you are about to learn.`,
          facts: [
            { label: "Files", value: stats ? stats.file_count.toLocaleString() : architecture ? architecture.total_files.toLocaleString() : "Unknown" },
            { label: "Symbols", value: stats ? stats.symbol_count.toLocaleString() : architecture ? architecture.total_symbols.toLocaleString() : "Unknown" },
            { label: "Modules", value: stats ? stats.module_count.toLocaleString() : layers.length.toLocaleString() },
            { label: "Primary language", value: primaryLanguage },
            { label: "Documentation", value: stats ? `${Math.round(stats.doc_coverage_pct)}% covered` : "Unknown" },
            { label: "Branch", value: defaultBranch },
          ],
        },
        {
          title: "Where to look",
          body: "Use RepoWise's Overview for the current state and Docs for indexed explanations. Tutor will now choose the order in which to inspect the code itself.",
          items: [
            { title: "Repository Overview", detail: "Scale, health, activity, and important repository signals.", href: `/repos/${repoId}/overview` },
            { title: "Documentation", detail: "Generated and indexed documentation tied back to source files.", href: `/repos/${repoId}/docs` },
          ],
        },
      ],
      checkpoint: {
        question: "Before moving on: what is the primary language in this repository?",
        answer: primaryLanguage,
      },
    },
    {
      id: "entry-points",
      eyebrow: "2 · Entry points",
      title: "Find where execution begins",
      summary: "Learn the files where commands, requests, jobs, or application startup enter the system.",
      objective: "Know where to begin tracing real behaviour instead of browsing folders alphabetically.",
      estimatedMinutes: 6,
      sections: [
        {
          title: "Start from these files",
          body: entryItems.length
            ? "RepoWise identified these entry points and candidates from the indexed architecture. Open them in this order and read their responsibilities before following dependencies inward."
            : "The current index did not identify a confident entry point. Open Architecture and inspect the highest-level nodes before continuing.",
          items: entryItems.length ? entryItems : [{ title: "Open Architecture", detail: "Inspect top-level nodes and likely entry points.", href: `/repos/${repoId}/architecture` }],
        },
      ],
      checkpoint: {
        question: "Which file should you inspect first when tracing execution?",
        answer: indexedEntryPoints[0] ?? "No entry point was identified by the current index; use the Architecture view to choose a top-level starting node.",
      },
    },
    {
      id: "layers",
      eyebrow: "3 · Architecture",
      title: "Understand the layers and how they connect",
      summary: "Move from individual files to the structural boundaries RepoWise detected across the repository.",
      objective: "Understand which parts own which responsibilities and the strongest dependency directions between them.",
      estimatedMinutes: 7,
      sections: [
        {
          title: "Detected layers",
          body: layerItems.length
            ? "These layers are ordered using RepoWise's architecture model. Read them top to bottom before drilling into implementation details."
            : "No curated layers are available yet. The Architecture view can still show files and dependency communities.",
          items: layerItems.length ? layerItems : [{ title: "Architecture map", detail: "Explore dependency communities and files.", href: `/repos/${repoId}/architecture` }],
        },
        ...(flowItems.length ? [{
          title: "Strong cross-layer flows",
          body: "These relationships are derived from indexed dependency edges. They show where understanding one layer requires understanding another.",
          items: flowItems,
        }] : []),
      ],
      checkpoint: {
        question: "Which detected layer contains the most files?",
        answer: largestLayer ? `${largestLayer.name} (${largestLayer.file_count.toLocaleString()} files)` : "No curated architecture layer is available in the current index.",
      },
    },
    {
      id: "code-tour",
      eyebrow: "4 · Guided tour",
      title: "Follow the code in a deliberate order",
      summary: "Use RepoWise's curated architecture tour, or a deterministic fallback, to move from outer behaviour toward implementation.",
      objective: "Learn the code in dependency order instead of opening unrelated files.",
      estimatedMinutes: 10,
      sections: [
        {
          title: "Your code tour",
          body: tourItems.length
            ? "Complete these steps in order. Each step comes from the current RepoWise index and points you at a concrete part of the repository."
            : "The index does not yet contain enough structure for a code tour. Re-index the repository, then return to Tutor.",
          items: tourItems,
        },
      ],
      checkpoint: {
        question: "What is the first stop in the guided code tour?",
        answer: firstTour ? firstTour.title : fallbackTourPaths[0] ?? "No tour step is available in the current index.",
      },
    },
    {
      id: "important-code",
      eyebrow: "5 · Core code",
      title: "Learn the structurally important code first",
      summary: "Focus on files with high graph importance and onboarding value before spending time on peripheral utilities.",
      objective: "Recognize the files that give you the most understanding per minute of reading.",
      estimatedMinutes: 8,
      sections: [
        {
          title: "High-value reading list",
          body: importantItems.length
            ? "RepoWise ranked these files using its graph and onboarding signals. They are strong candidates for building useful context quickly."
            : "No ranked onboarding targets are available yet. Use Knowledge Graph to inspect central files and symbols.",
          items: importantItems.length ? importantItems : [{ title: "Knowledge Graph", detail: "Inspect structurally central nodes.", href: `/repos/${repoId}/knowledge-graph` }],
        },
      ],
      checkpoint: {
        question: "Which file is currently the highest-priority reading target?",
        answer: firstImportantPath ?? "No ranked reading target is available in the current index.",
      },
    },
    {
      id: "change-safely",
      eyebrow: "6 · Context & risk",
      title: "Understand history and risk before you change code",
      summary: "Finish onboarding by learning which files are volatile, how healthy the repository is, and which decisions shaped the current design.",
      objective: "Know where extra caution, tests, and historical context are required before making a change.",
      estimatedMinutes: 8,
      sections: [
        {
          title: "Repository health signals",
          body: "These are deterministic signals from the current RepoWise index. They tell you where to slow down and investigate before editing.",
          facts: [
            { label: "Code health", value: formatHealth(overview?.health.average_health) },
            { label: "Hotspots", value: stats ? stats.hotspot_count.toLocaleString() : "Unknown" },
            { label: "Open findings", value: overview ? overview.health.open_findings.toLocaleString() : "Unknown" },
            { label: "Dead exports", value: stats ? stats.dead_export_count.toLocaleString() : "Unknown" },
            { label: "Doc coverage", value: stats ? `${Math.round(stats.doc_coverage_pct)}%` : "Unknown" },
            { label: "Knowledge silos", value: stats ? stats.silo_count.toLocaleString() : "Unknown" },
          ],
        },
        ...(hotspotItems.length ? [{
          title: "Files to treat carefully",
          body: "Hotspots are files with meaningful recent change activity. Read their tests, owners, and dependencies before changing them.",
          items: hotspotItems,
        }] : []),
        ...(decisionItems.length ? [{
          title: "Recent architectural decisions",
          body: "Read these before changing boundaries or behaviour; they explain why parts of the system look the way they do.",
          items: decisionItems,
        }] : []),
      ],
      checkpoint: {
        question: "Which file currently deserves the most caution from the hotspot list?",
        answer: firstHotspot?.file_path ?? decisionItems[0]?.title ?? "No hotspot was reported by the current index.",
      },
    },
  ];

  return {
    repoName,
    subtitle: "A system-led learning path generated from RepoWise's existing index and architecture graph. No AI provider is required.",
    status: [
      stats ? `${stats.file_count.toLocaleString()} files` : architecture ? `${architecture.total_files.toLocaleString()} files` : null,
      stats ? `${stats.symbol_count.toLocaleString()} symbols` : architecture ? `${architecture.total_symbols.toLocaleString()} symbols` : null,
      `${lessons.length} guided lessons`,
      defaultBranch,
      headCommit ? headCommit.slice(0, 7) : null,
    ].filter((value): value is string => Boolean(value)),
    lessons,
  };
}
