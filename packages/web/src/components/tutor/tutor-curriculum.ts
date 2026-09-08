import type { OverviewSummaryResponse } from "@repowise-dev/types/overview";
import type { ArchitectureView, ArchEdge, ArchLayer, ArchNode } from "@repowise-dev/ui/c4";

export interface TutorFact {
  label: string;
  value: string;
}

export interface TutorItem {
  title: string;
  detail?: string;
  meta?: string;
}

export interface TutorEvidence {
  title: string;
  path?: string;
  explanation: string;
  signals: string[];
  language?: string;
  lineStart?: number;
  lineEnd?: number;
  code?: string;
}

export interface TutorFlowStep {
  from: string;
  to: string;
  relation: string;
  explanation: string;
}

export interface TutorSection {
  title: string;
  body: string;
  facts?: TutorFact[];
  items?: TutorItem[];
  evidence?: TutorEvidence[];
  flow?: TutorFlowStep[];
}

export interface TutorCheckpoint {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
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
  repoName: string;
  defaultBranch: string;
  headCommit?: string;
  overview: OverviewSummaryResponse | null;
  architecture: ArchitectureView | null;
  sourceContents: Record<string, string>;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function findBestNodeByPath(nodes: ArchNode[], path: string): ArchNode | undefined {
  return nodes
    .filter((node) => node.file_path === path)
    .sort((a, b) => b.pagerank - a.pagerank)[0];
}

function uniqueNodesByPath(nodes: ArchNode[]): ArchNode[] {
  const seen = new Set<string>();
  const result: ArchNode[] = [];
  for (const node of nodes) {
    const key = node.file_path ?? node.id;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(node);
  }
  return result;
}

function formatHealth(value: number | null | undefined): string {
  return value == null ? "Not measured" : `${value.toFixed(1)} / 10`;
}

function edgeScore(edge: ArchEdge): number {
  return Math.max(1, edge.weight || 1) * Math.max(0.1, edge.confidence || 0.1);
}

function excerpt(
  sourceContents: Record<string, string>,
  path: string | null | undefined,
  node?: ArchNode,
): Pick<TutorEvidence, "language" | "lineStart" | "lineEnd" | "code"> {
  if (!path) return {};
  const source = sourceContents[path];
  if (!source) return {};

  const lines = source.split(/\r?\n/);
  const requestedStart = node?.line_range?.[0] ?? 1;
  const requestedEnd = node?.line_range?.[1] ?? requestedStart + 17;
  const start = Math.max(1, Math.min(requestedStart, Math.max(1, lines.length)));
  const end = Math.max(start, Math.min(requestedEnd, start + 17, lines.length));
  const code = lines.slice(start - 1, end).join("\n").trimEnd();

  if (!code) return {};
  return {
    language: node?.language ?? undefined,
    lineStart: start,
    lineEnd: end,
    code,
  };
}

function evidenceForNode(
  node: ArchNode,
  sourceContents: Record<string, string>,
  rationale: string,
): TutorEvidence {
  const signals = unique([
    node.node_type,
    node.complexity,
    node.pagerank_percentile > 0 ? `${Math.round(node.pagerank_percentile)}th percentile centrality` : null,
    `${node.in_degree} incoming dependencies`,
    `${node.out_degree} outgoing dependencies`,
    node.is_entry_point ? "entry point" : null,
    node.is_hotspot ? "hotspot" : null,
    node.has_doc ? "documented" : null,
    node.primary_owner ? `owner: ${node.primary_owner}` : null,
    ...node.tags.slice(0, 2),
  ]);

  return {
    title: node.name || node.file_path || "Indexed node",
    ...(node.file_path ? { path: node.file_path } : {}),
    explanation: node.summary || rationale,
    signals,
    ...excerpt(sourceContents, node.file_path, node),
  };
}

function evidenceForPath(
  path: string,
  nodes: ArchNode[],
  sourceContents: Record<string, string>,
  rationale: string,
): TutorEvidence {
  const node = findBestNodeByPath(nodes, path);
  if (node) return evidenceForNode(node, sourceContents, rationale);
  return {
    title: path.split("/").at(-1) ?? path,
    path,
    explanation: rationale,
    signals: ["indexed source file"],
    ...excerpt(sourceContents, path),
  };
}

function makeCheckpoint(
  question: string,
  correct: string,
  distractors: string[],
  explanation: string,
  position = 1,
): TutorCheckpoint {
  const fallbacks = [
    "Not identified by the current index",
    "A test-only path",
    "An external dependency",
    "The repository default branch",
  ];
  const alternatives = unique([...distractors, ...fallbacks]).filter((value) => value !== correct).slice(0, 3);
  const options = alternatives;
  const correctIndex = Math.max(0, Math.min(position, options.length));
  options.splice(correctIndex, 0, correct);
  return { question, options, correctIndex, explanation };
}

function layerForNode(layers: ArchLayer[], nodeId: string): ArchLayer | undefined {
  return layers.find((layer) => layer.node_ids.includes(nodeId));
}

function buildTrace(
  nodes: ArchNode[],
  edges: ArchEdge[],
  start: ArchNode | undefined,
): { nodes: ArchNode[]; flow: TutorFlowStep[] } {
  if (!start) return { nodes: [], flow: [] };
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>([start.id]);
  const traceNodes = [start];
  const flow: TutorFlowStep[] = [];
  let current = start;

  for (let depth = 0; depth < 4; depth += 1) {
    const nextEdge = edges
      .filter((edge) => edge.source === current.id && !visited.has(edge.target))
      .filter((edge) => {
        const target = nodeById.get(edge.target);
        return target && !target.is_test;
      })
      .sort((a, b) => edgeScore(b) - edgeScore(a))[0];
    if (!nextEdge) break;
    const target = nodeById.get(nextEdge.target);
    if (!target) break;

    flow.push({
      from: current.name || current.file_path || current.id,
      to: target.name || target.file_path || target.id,
      relation: nextEdge.edge_type,
      explanation: `RepoWise indexed this as a ${nextEdge.direction} ${nextEdge.edge_type} relationship with weight ${Math.round(nextEdge.weight)} and ${Math.round(nextEdge.confidence * 100)}% confidence.`,
    });
    traceNodes.push(target);
    visited.add(target.id);
    current = target;
  }

  return { nodes: traceNodes, flow };
}

export function buildTutorCurriculum({
  repoName,
  defaultBranch,
  headCommit,
  overview,
  architecture,
  sourceContents,
}: BuildTutorCurriculumInput): TutorCurriculum {
  const stats = overview?.stats;
  const languages = overview?.languages.map((item) => item.language) ?? architecture?.languages ?? [];
  const primaryLanguage = languages[0] ?? "Not identified";
  const nodes = architecture?.nodes ?? [];
  const edges = architecture?.edges ?? [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const layers = [...(architecture?.layers ?? [])].sort((a, b) => a.display_order - b.display_order);

  const indexedEntryPoints = unique([
    ...(architecture?.entry_points ?? []),
    ...nodes.filter((node) => node.is_entry_point).map((node) => node.file_path),
    ...(architecture?.entry_candidates ?? []),
  ]).slice(0, 5);

  const entryEvidence = indexedEntryPoints.map((path) =>
    evidenceForPath(
      path,
      nodes,
      sourceContents,
      "RepoWise identified this file as a likely execution boundary. Read the excerpt and then follow its strongest outgoing relationships below.",
    ),
  );

  const entryNeighborhood: TutorFlowStep[] = [];
  for (const path of indexedEntryPoints.slice(0, 3)) {
    const entryNode = findBestNodeByPath(nodes, path);
    if (!entryNode) continue;
    const strongest = edges
      .filter((edge) => edge.source === entryNode.id)
      .sort((a, b) => edgeScore(b) - edgeScore(a))
      .slice(0, 2);
    for (const edge of strongest) {
      const target = nodeById.get(edge.target);
      if (!target) continue;
      entryNeighborhood.push({
        from: entryNode.name || path,
        to: target.name || target.file_path || target.id,
        relation: edge.edge_type,
        explanation: `${entryNode.name || path} reaches ${target.name || target.file_path || target.id} through an indexed ${edge.edge_type} edge. This is the first dependency to understand after the entry boundary.`,
      });
    }
  }

  const layerItems: TutorItem[] = layers.slice(0, 8).map((layer) => {
    const representatives = layer.node_ids
      .map((id) => nodeById.get(id))
      .filter((node): node is ArchNode => Boolean(node))
      .sort((a, b) => b.pagerank - a.pagerank)
      .slice(0, 3)
      .map((node) => node.file_path || node.name);
    return {
      title: layer.name,
      detail: layer.description || "A structural layer detected from the indexed dependency graph.",
      meta: `${layer.file_count.toLocaleString()} files${layer.health_score == null ? "" : ` · health ${layer.health_score.toFixed(1)}/10`}${representatives.length ? ` · examples: ${representatives.join(", ")}` : ""}`,
    };
  });

  const crossLayerFlow: TutorFlowStep[] = [];
  const seenLayerPairs = new Set<string>();
  for (const edge of [...edges].sort((a, b) => edgeScore(b) - edgeScore(a))) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;
    const sourceLayer = layerForNode(layers, source.id);
    const targetLayer = layerForNode(layers, target.id);
    if (!sourceLayer || !targetLayer || sourceLayer.id === targetLayer.id) continue;
    const pair = `${sourceLayer.id}:${targetLayer.id}`;
    if (seenLayerPairs.has(pair)) continue;
    seenLayerPairs.add(pair);
    crossLayerFlow.push({
      from: `${sourceLayer.name} · ${source.name}`,
      to: `${targetLayer.name} · ${target.name}`,
      relation: edge.edge_type,
      explanation: `This concrete ${edge.edge_type} edge is evidence for the ${sourceLayer.name} → ${targetLayer.name} dependency direction.`,
    });
    if (crossLayerFlow.length >= 6) break;
  }

  const layerEvidence = uniqueNodesByPath(
    layers.flatMap((layer) =>
      layer.node_ids
        .map((id) => nodeById.get(id))
        .filter((node): node is ArchNode => Boolean(node))
        .sort((a, b) => b.pagerank - a.pagerank)
        .slice(0, 1),
    ),
  )
    .slice(0, 5)
    .map((node) =>
      evidenceForNode(
        node,
        sourceContents,
        `This is a representative high-centrality node for the ${layerForNode(layers, node.id)?.name ?? "detected"} layer.`,
      ),
    );

  const rankedOnboarding = [...(overview?.onboarding_targets ?? [])].sort((a, b) => b.pagerank - a.pagerank);
  const rankedNodes = uniqueNodesByPath(
    nodes
      .filter((node) => node.file_path && !node.is_test)
      .sort((a, b) => b.pagerank - a.pagerank),
  );
  const importantPaths = unique([
    ...rankedOnboarding.map((target) => target.path),
    ...rankedNodes.map((node) => node.file_path),
  ]).slice(0, 6);
  const importantEvidence = importantPaths.map((path) => {
    const node = findBestNodeByPath(nodes, path);
    const onboarding = rankedOnboarding.find((target) => target.path === path);
    const rationale = onboarding
      ? `RepoWise selected this as an onboarding target with graph score ${onboarding.pagerank.toFixed(4)}. It is worth learning early because many other parts of the repository depend on the context it provides.`
      : "This file ranks highly in the dependency graph, so understanding it gives you context for a disproportionate amount of the repository.";
    return evidenceForPath(path, nodes, sourceContents, rationale);
  });

  const firstEntryNode = indexedEntryPoints[0]
    ? findBestNodeByPath(nodes, indexedEntryPoints[0])
    : rankedNodes[0];
  const trace = buildTrace(nodes, edges, firstEntryNode);
  const traceEvidence = trace.nodes
    .filter((node) => node.file_path)
    .map((node, index) =>
      evidenceForNode(
        node,
        sourceContents,
        index === 0
          ? "This is the starting boundary for the trace."
          : "This node is the next strongest dependency in the deterministic execution trace.",
      ),
    );

  const hotspotEvidence: TutorEvidence[] = (overview?.top_hotspots ?? []).slice(0, 5).map((hotspot) => {
    const node = findBestNodeByPath(nodes, hotspot.file_path);
    const base = node
      ? evidenceForNode(
          node,
          sourceContents,
          "This file changes frequently. Understand its dependency neighborhood and ownership before editing it.",
        )
      : evidenceForPath(
          hotspot.file_path,
          nodes,
          sourceContents,
          "This file changes frequently. Understand its dependency neighborhood and ownership before editing it.",
        );
    return {
      ...base,
      signals: unique([
        ...base.signals,
        `${hotspot.commit_count_90d} commits / 90d`,
        `bus factor ${hotspot.bus_factor}`,
      ]),
    };
  });

  const decisionItems: TutorItem[] = (overview?.recent_decisions ?? []).slice(0, 5).map((decision) => ({
    title: decision.title,
    detail: `This recorded decision is ${decision.status}. Treat it as design context before changing the related boundary or behaviour.`,
    meta: unique([decision.source ? `source: ${decision.source}` : null, `staleness ${decision.staleness_score.toFixed(2)}`]).join(" · "),
  }));

  const largestLayer = [...layers].sort((a, b) => b.file_count - a.file_count)[0];
  const firstImportantPath = importantPaths[0] ?? "No ranked file was identified";
  const firstHotspot = overview?.top_hotspots[0]?.file_path;
  const traceEnd = trace.nodes.at(-1);

  const lessons: TutorLesson[] = [
    {
      id: "orientation",
      eyebrow: "1 · Orientation",
      title: "Build the system picture",
      summary: "Tutor starts by turning repository statistics and architecture metadata into a mental model you can use before touching code.",
      objective: "Be able to describe what kind of system this is, its scale, its major technologies, and its broad structural shape.",
      estimatedMinutes: 5,
      sections: [
        {
          title: "What this repository is",
          body: architecture?.project_description || `RepoWise has indexed ${repoName}. The measurements below are the foundation for the rest of the course; Tutor will use them to decide what you read next.`,
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
          title: "Technology and boundaries",
          body: "These are not links to other RepoWise features. They are the indexed facts Tutor uses to explain the environment surrounding the codebase.",
          items: [
            ...(languages.length ? [{ title: "Languages", detail: languages.join(", "), meta: "Detected from indexed files" }] : []),
            ...(architecture?.frameworks?.length ? [{ title: "Frameworks", detail: architecture.frameworks.join(", "), meta: "Detected by RepoWise architecture indexing" }] : []),
            ...(architecture?.external_systems?.length ? [{ title: "External systems", detail: architecture.external_systems.slice(0, 6).map((system) => system.display_name || system.name).join(", "), meta: "Dependencies outside the repository boundary" }] : []),
            ...(layers.length ? [{ title: "Structural layers", detail: layers.map((layer) => layer.name).join(" → "), meta: "Ordered from the architecture graph" }] : []),
          ],
        },
      ],
      checkpoint: makeCheckpoint(
        "Which language should you expect to see most often while learning this repository?",
        primaryLanguage,
        languages.slice(1, 4),
        `RepoWise reports ${primaryLanguage} as the primary language in the current index.`,
        1,
      ),
    },
    {
      id: "entry-points",
      eyebrow: "2 · Entry points",
      title: "Learn where behaviour enters the system",
      summary: "Instead of telling you to open Files or Architecture, Tutor shows the indexed entry boundaries, their source excerpts, and their immediate dependencies here.",
      objective: "Recognize the first files and symbols involved when the application, request, command, or job begins executing.",
      estimatedMinutes: 8,
      sections: [
        {
          title: "Entry boundaries — taught in place",
          body: entryEvidence.length
            ? "Read each explanation and source excerpt. The signals are taken from RepoWise's graph, so you can see why Tutor selected the file without leaving this lesson."
            : "The current index has no confident entry boundary. Tutor will use the highest-centrality production node as the fallback starting point.",
          evidence: entryEvidence.length
            ? entryEvidence
            : firstEntryNode
              ? [evidenceForNode(firstEntryNode, sourceContents, "Fallback starting point selected by graph centrality.")]
              : [],
        },
        ...(entryNeighborhood.length
          ? [{
              title: "What those entry points touch first",
              body: "Follow these relationships in order. They are concrete edges from the indexed graph, not a generic description of how applications usually work.",
              flow: entryNeighborhood,
            }]
          : []),
      ],
      checkpoint: makeCheckpoint(
        "Which indexed file is the best first boundary to inspect when tracing behaviour?",
        indexedEntryPoints[0] ?? firstEntryNode?.file_path ?? firstEntryNode?.name ?? "No entry boundary identified",
        [...indexedEntryPoints.slice(1, 4), ...importantPaths.slice(0, 2)],
        "Tutor chooses the first confirmed/ranked entry point before moving inward through dependency edges.",
        2,
      ),
    },
    {
      id: "layers",
      eyebrow: "3 · Architecture",
      title: "Understand responsibility boundaries",
      summary: "Tutor explains the detected layers, shows representative code from them, and demonstrates concrete cross-layer relationships.",
      objective: "Know which part of the system owns which responsibility and which dependency directions matter most.",
      estimatedMinutes: 9,
      sections: [
        {
          title: "Layer responsibilities",
          body: layerItems.length
            ? "Read the layer descriptions as a responsibility map. The representative files named in each row are high-centrality examples, not destinations you must navigate to."
            : "The index does not contain curated layers, so Tutor will rely on graph centrality and the guided trace in the next lesson.",
          items: layerItems,
        },
        ...(layerEvidence.length
          ? [{
              title: "Representative code",
              body: "These excerpts let you connect the abstract layer names to actual implementation without leaving Tutor.",
              evidence: layerEvidence,
            }]
          : []),
        ...(crossLayerFlow.length
          ? [{
              title: "How responsibilities cross boundaries",
              body: "Each row is backed by a real dependency edge between nodes assigned to different layers.",
              flow: crossLayerFlow,
            }]
          : []),
      ],
      checkpoint: makeCheckpoint(
        "Which detected layer owns the largest portion of the repository?",
        largestLayer ? `${largestLayer.name} (${largestLayer.file_count.toLocaleString()} files)` : "No curated layer is available",
        layers.filter((layer) => layer.id !== largestLayer?.id).slice(0, 3).map((layer) => `${layer.name} (${layer.file_count.toLocaleString()} files)`),
        largestLayer
          ? `${largestLayer.name} is the largest detected layer with ${largestLayer.file_count.toLocaleString()} files.`
          : "The current index does not expose curated architecture layers.",
        1,
      ),
    },
    {
      id: "code-tour",
      eyebrow: "4 · Execution trace",
      title: "Trace one concrete path through the code",
      summary: "Tutor follows the strongest indexed dependency edges from an entry boundary and teaches every stop inside this page.",
      objective: "Be able to narrate one real path through the system from its starting boundary into deeper implementation.",
      estimatedMinutes: 12,
      sections: [
        {
          title: "The path",
          body: trace.flow.length
            ? "This trace is deterministic: at each step Tutor follows the strongest unvisited outgoing production dependency from the previous node."
            : "The graph does not expose enough outgoing relationships for a multi-step trace, so Tutor shows the strongest available starting evidence instead.",
          flow: trace.flow,
        },
        {
          title: "Read each stop with context",
          body: "For every stop, read the indexed summary, dependency signals, and source excerpt. This is the teaching material; opening another RepoWise page is not required.",
          evidence: traceEvidence,
        },
      ],
      checkpoint: makeCheckpoint(
        "Where does the guided trace end after following the strongest indexed path?",
        traceEnd?.name || traceEnd?.file_path || "No multi-step trace is available",
        trace.nodes.slice(0, -1).map((node) => node.name || node.file_path || node.id).slice(0, 3),
        trace.flow.length
          ? `The deterministic trace ends at ${traceEnd?.name || traceEnd?.file_path}. Review the edge sequence above to see how it got there.`
          : "The current graph does not contain enough outgoing edges to form a multi-step trace.",
        2,
      ),
    },
    {
      id: "important-code",
      eyebrow: "5 · Core code",
      title: "Learn the code that gives the most context",
      summary: "Tutor converts RepoWise graph ranking into an inline reading lesson: what each important file does, why it matters, and what its source looks like.",
      objective: "Recognize the files that unlock the most understanding and explain why RepoWise considers them structurally important.",
      estimatedMinutes: 10,
      sections: [
        {
          title: "High-value reading set",
          body: importantEvidence.length
            ? "Work through these in order. Centrality, incoming/outgoing dependency counts, onboarding rank, and source excerpts are shown together so you do not have to assemble the story yourself."
            : "The current index does not expose ranked onboarding targets or production nodes.",
          evidence: importantEvidence,
        },
        {
          title: "How to interpret the ranking",
          body: "High centrality means a node sits in an important position in the dependency graph. Incoming dependencies tell you how much code relies on it; outgoing dependencies tell you how much context it relies on. Tutor combines those signals with onboarding ranking rather than simply choosing the largest file.",
        },
      ],
      checkpoint: makeCheckpoint(
        "Which file is currently Tutor's highest-priority core reading target?",
        firstImportantPath,
        importantPaths.slice(1, 4),
        `${firstImportantPath} appears first after combining RepoWise onboarding targets with graph centrality.`,
        1,
      ),
    },
    {
      id: "change-safely",
      eyebrow: "6 · Change safely",
      title: "Learn where a newcomer should be cautious",
      summary: "The final lesson turns health, change history, ownership, and architectural decisions into practical guidance before your first modification.",
      objective: "Know which files need extra investigation, tests, and historical context before you edit them.",
      estimatedMinutes: 9,
      sections: [
        {
          title: "Risk picture",
          body: "These measurements are deterministic RepoWise signals. They tell you where uncertainty and change cost are likely to be higher.",
          facts: [
            { label: "Code health", value: formatHealth(overview?.health.average_health) },
            { label: "Hotspots", value: stats ? stats.hotspot_count.toLocaleString() : "Unknown" },
            { label: "Open findings", value: overview ? overview.health.open_findings.toLocaleString() : "Unknown" },
            { label: "Dead exports", value: stats ? stats.dead_export_count.toLocaleString() : "Unknown" },
            { label: "Doc coverage", value: stats ? `${Math.round(stats.doc_coverage_pct)}%` : "Unknown" },
            { label: "Knowledge silos", value: stats ? stats.silo_count.toLocaleString() : "Unknown" },
          ],
        },
        ...(hotspotEvidence.length
          ? [{
              title: "Files to understand before editing",
              body: "Tutor shows the hotspot source and graph signals directly. Frequent change plus a low bus factor is a reason to slow down, find tests, and understand ownership before modifying the file.",
              evidence: hotspotEvidence,
            }]
          : []),
        ...(decisionItems.length
          ? [{
              title: "Design context you should carry forward",
              body: "These recent decisions explain constraints a newcomer could otherwise accidentally undo. Read the summaries as part of the lesson rather than as a redirect list.",
              items: decisionItems,
            }]
          : []),
      ],
      checkpoint: makeCheckpoint(
        firstHotspot
          ? "Which indexed file currently deserves the most caution because of recent change activity?"
          : "What should you check before changing a structurally important file?",
        firstHotspot ?? "Its dependencies, tests, ownership, health, and recorded design decisions",
        firstHotspot
          ? (overview?.top_hotspots ?? []).slice(1, 4).map((hotspot) => hotspot.file_path)
          : ["Only its filename", "Only its line count", "Only the default branch"],
        firstHotspot
          ? `${firstHotspot} is the first current hotspot in RepoWise's indexed change-history signals.`
          : "Safe changes require more than source reading: use dependency, test, ownership, health, and decision context together.",
        2,
      ),
    },
  ];

  return {
    repoName,
    subtitle: "A deterministic teaching course built from RepoWise's index, dependency graph, source files, health signals, and history. Lessons are taught inside Tutor; no AI provider is required.",
    status: [
      stats ? `${stats.file_count.toLocaleString()} files` : architecture ? `${architecture.total_files.toLocaleString()} files` : null,
      stats ? `${stats.symbol_count.toLocaleString()} symbols` : architecture ? `${architecture.total_symbols.toLocaleString()} symbols` : null,
      `${lessons.length} taught lessons`,
      `${Object.keys(sourceContents).length} source files loaded`,
      defaultBranch,
      headCommit ? headCommit.slice(0, 7) : null,
    ].filter((value): value is string => Boolean(value)),
    lessons,
  };
}
