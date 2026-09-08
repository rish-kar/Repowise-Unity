import type { ExecutionFlows } from "@repowise-dev/types/graph";
import type { FileDetailResponse } from "@repowise-dev/types/files";
import type { SymbolCallEntry, SymbolDetailResponse } from "@repowise-dev/types/symbols";
import type { ArchEdge, ArchitectureView, ArchNode } from "@repowise-dev/ui/c4";
import type {
  TutorCurriculum,
  TutorEvidence,
  TutorFlowStep,
  TutorItem,
  TutorSection,
} from "./tutor-curriculum";

export interface TutorExercise {
  id: string;
  prompt: string;
  instruction: string;
  acceptedAnswers: string[];
  hint: string;
  explanation: string;
}

export type TutorSectionWithExercises = TutorSection & {
  exercises?: TutorExercise[];
};

export interface TutorRelatedTest {
  testPath: string;
  targetPath: string;
  relation: string;
  source: "graph" | "convention";
}

interface EnrichTutorCurriculumInput {
  curriculum: TutorCurriculum;
  architecture: ArchitectureView | null;
  fileDetails: Record<string, FileDetailResponse>;
  symbolDetails: Record<string, SymbolDetailResponse>;
  executionFlows: ExecutionFlows | null;
  sourceContents: Record<string, string>;
  relatedTests: TutorRelatedTest[];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function pathStem(path: string): string {
  const filename = normalizePath(path).split("/").at(-1) ?? path;
  return filename
    .replace(/\.(test|spec)\.[^.]+$/i, "")
    .replace(/_test\.[^.]+$/i, "")
    .replace(/^test[_-]?/i, "")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
}

function lineExcerpt(
  sourceContents: Record<string, string>,
  path: string,
  startLine = 1,
  endLine = startLine + 19,
): Pick<TutorEvidence, "lineStart" | "lineEnd" | "code"> {
  const source = sourceContents[path];
  if (!source) return {};
  const lines = source.split(/\r?\n/);
  const start = Math.max(1, Math.min(startLine, Math.max(1, lines.length)));
  const end = Math.max(start, Math.min(endLine, start + 24, lines.length));
  const code = lines.slice(start - 1, end).join("\n").trimEnd();
  return code ? { lineStart: start, lineEnd: end, code } : {};
}

function addSection(
  curriculum: TutorCurriculum,
  lessonId: string,
  section: TutorSectionWithExercises,
): void {
  const lesson = curriculum.lessons.find((candidate) => candidate.id === lessonId);
  if (!lesson || lesson.sections.some((candidate) => candidate.title === section.title)) return;
  lesson.sections.push(section);
}

function callCount(detail: SymbolDetailResponse, direction: "callers" | "callees"): number {
  return direction === "callers"
    ? (detail.graph.caller_total ?? detail.graph.callers.length)
    : (detail.graph.callee_total ?? detail.graph.callees.length);
}

function signatureInputsOutputs(signature: string): { inputs: string; output: string } {
  const open = signature.indexOf("(");
  const close = signature.lastIndexOf(")");
  const inputs =
    open >= 0 && close > open
      ? signature.slice(open + 1, close).trim() || "no explicit parameters"
      : "parameters are not explicit in the indexed signature";

  if (close < 0) return { inputs, output: "return type is not explicit in the indexed signature" };
  const suffix = signature.slice(close + 1).trim();
  const match = suffix.match(/^(?:->|:)\s*([^={;]+)/);
  return {
    inputs,
    output: match?.[1]?.trim() || "return type is not explicit in the indexed signature",
  };
}

function symbolScore(detail: SymbolDetailResponse): number {
  const symbol = detail.symbol;
  const kindBoost = ["function", "method", "class", "interface", "struct"].includes(symbol.kind)
    ? 2
    : 0;
  return (
    kindBoost +
    (symbol.importance_score ?? 0) * 10 +
    Math.min(symbol.complexity_estimate, 20) / 10 +
    Math.min(callCount(detail, "callers") + callCount(detail, "callees"), 20) / 20
  );
}

function callFlow(
  from: SymbolCallEntry | SymbolDetailResponse,
  to: SymbolCallEntry | SymbolDetailResponse,
  relation: string,
  confidence?: number,
): TutorFlowStep {
  const fromName = "symbol" in from ? from.symbol.name : from.name;
  const toName = "symbol" in to ? to.symbol.name : to.name;
  return {
    from: fromName,
    to: toName,
    relation,
    explanation:
      confidence == null
        ? `${fromName} reaches ${toName} through the indexed symbol graph.`
        : `${fromName} reaches ${toName} through an indexed ${relation} edge at ${Math.round(confidence * 100)}% confidence.`,
  };
}

function buildSymbolTeaching(
  symbolDetails: Record<string, SymbolDetailResponse>,
  sourceContents: Record<string, string>,
): { evidence: TutorEvidence[]; flow: TutorFlowStep[]; exercises: TutorExercise[] } {
  const ranked = Object.values(symbolDetails)
    .filter((detail) => ["function", "method", "class", "interface", "struct"].includes(detail.symbol.kind))
    .sort((a, b) => symbolScore(b) - symbolScore(a))
    .slice(0, 6);

  const evidence: TutorEvidence[] = ranked.map((detail) => {
    const symbol = detail.symbol;
    const io = signatureInputsOutputs(symbol.signature);
    const callers = callCount(detail, "callers");
    const callees = callCount(detail, "callees");
    const role = symbol.docstring?.trim()
      ? symbol.docstring.trim().split(/\r?\n/)[0]!
      : `Indexed ${symbol.kind} in ${symbol.file_path}.`;
    return {
      title: `${symbol.kind} · ${symbol.qualified_name || symbol.name}`,
      path: symbol.file_path,
      explanation: `${role} Tutor reads the signature as inputs: ${io.inputs}; output: ${io.output}. It has ${callers} indexed caller${callers === 1 ? "" : "s"} and ${callees} indexed callee${callees === 1 ? "" : "s"}.`,
      language: symbol.language,
      signals: unique([
        symbol.signature,
        `${symbol.visibility} visibility`,
        `complexity ${symbol.complexity_estimate}`,
        `${callers} callers`,
        `${callees} callees`,
        detail.file_context.health_score == null
          ? null
          : `file health ${detail.file_context.health_score.toFixed(1)}/10`,
        detail.file_context.is_hotspot ? "hotspot file" : null,
      ]),
      ...lineExcerpt(sourceContents, symbol.file_path, symbol.start_line, symbol.end_line),
    };
  });

  const flow: TutorFlowStep[] = [];
  for (const detail of ranked.slice(0, 4)) {
    const caller = detail.graph.callers[0];
    const callee = detail.graph.callees[0];
    if (caller) flow.push(callFlow(caller, detail, caller.edge_type, caller.confidence));
    if (callee) flow.push(callFlow(detail, callee, callee.edge_type, callee.confidence));
  }

  const exercises: TutorExercise[] = [];
  for (const detail of ranked.slice(0, 2)) {
    const callerNames = unique(detail.graph.callers.map((caller) => caller.name));
    const calleeNames = unique(detail.graph.callees.map((callee) => callee.name));
    if (callerNames.length) {
      exercises.push({
        id: `caller:${detail.symbol.symbol_id}`,
        prompt: `Identify a real caller of ${detail.symbol.name}.`,
        instruction: "Type the exact caller symbol name shown in the indexed call relationships above.",
        acceptedAnswers: callerNames,
        hint: `Look for a relationship ending at ${detail.symbol.name}.`,
        explanation: `${callerNames[0]} is one of the indexed callers of ${detail.symbol.name}.`,
      });
    } else if (calleeNames.length) {
      exercises.push({
        id: `callee:${detail.symbol.symbol_id}`,
        prompt: `Identify a direct dependency used by ${detail.symbol.name}.`,
        instruction: "Type one direct callee symbol name.",
        acceptedAnswers: calleeNames,
        hint: `Look for a relationship starting at ${detail.symbol.name}.`,
        explanation: `${calleeNames[0]} is one of the indexed callees used by ${detail.symbol.name}.`,
      });
    }
  }

  return { evidence, flow, exercises };
}

function extractTestNames(source: string | undefined): string[] {
  if (!source) return [];
  const names: string[] = [];
  const quoted = /\b(?:it|test|describe)\s*\(\s*["'`]([^"'`]+)["'`]/g;
  const python = /\b(?:async\s+)?def\s+(test_[A-Za-z0-9_]+)/g;
  const named = /\b(test[A-Z][A-Za-z0-9_]*)\s*\(/g;
  for (const regex of [quoted, python, named]) {
    for (const match of source.matchAll(regex)) {
      if (match[1]) names.push(match[1]);
      if (names.length >= 5) break;
    }
    if (names.length >= 5) break;
  }
  return unique(names).slice(0, 5);
}

function testTeaching(
  relatedTests: TutorRelatedTest[],
  architecture: ArchitectureView | null,
  fileDetails: Record<string, FileDetailResponse>,
  sourceContents: Record<string, string>,
): { evidence: TutorEvidence[]; flow: TutorFlowStep[]; items: TutorItem[]; exercises: TutorExercise[] } {
  const nodes = architecture?.nodes ?? [];
  const evidence: TutorEvidence[] = [];
  const flow: TutorFlowStep[] = [];
  const items: TutorItem[] = [];
  const exercises: TutorExercise[] = [];

  for (const relation of relatedTests.slice(0, 4)) {
    const testNode = nodes
      .filter((node) => node.is_test && node.file_path === relation.testPath)
      .sort((a, b) => b.pagerank - a.pagerank)[0];
    const targetNode = nodes
      .filter((node) => !node.is_test && node.file_path === relation.targetPath)
      .sort((a, b) => b.pagerank - a.pagerank)[0];
    const testNames = extractTestNames(sourceContents[relation.testPath]);
    const targetDetail = fileDetails[relation.targetPath];
    const coverage = targetDetail?.coverage?.line_coverage_pct;
    const summary = testNode?.summary?.trim();

    evidence.push({
      title: testNode?.name || relation.testPath.split("/").at(-1) || relation.testPath,
      path: relation.testPath,
      explanation: `${summary ? `${summary} ` : ""}Tutor links this test to ${relation.targetPath} through ${relation.source === "graph" ? `the indexed ${relation.relation} relationship` : "a deterministic file-name/path match"}.${testNames.length ? ` Named test cases include: ${testNames.join(", ")}.` : ""}`,
      language: testNode?.language ?? undefined,
      signals: unique([
        "test file",
        `targets ${relation.targetPath}`,
        relation.source === "graph" ? relation.relation : "convention match",
        coverage == null ? null : `${Math.round(coverage)}% line coverage on target`,
      ]),
      ...lineExcerpt(
        sourceContents,
        relation.testPath,
        testNode?.line_range?.[0] ?? 1,
        testNode?.line_range?.[1] ?? 24,
      ),
    });

    flow.push({
      from: testNode?.name || relation.testPath,
      to: targetNode?.name || relation.targetPath,
      relation: relation.source === "graph" ? relation.relation : "test convention",
      explanation:
        relation.source === "graph"
          ? `The test reaches ${relation.targetPath} through a concrete indexed ${relation.relation} edge.`
          : `No direct test edge was available, so Tutor paired these files by deterministic test/source naming convention.`,
    });

    if (targetDetail?.health.metric) {
      items.push({
        title: relation.targetPath,
        detail: targetDetail.health.metric.has_test_file
          ? "RepoWise health metadata confirms a test file is associated with this production file."
          : "A related test was found from graph/path evidence even though the health metadata does not flag a dedicated test file.",
        meta: unique([
          coverage == null ? null : `${Math.round(coverage)}% line coverage`,
          targetDetail.coverage?.branch_coverage_pct == null
            ? null
            : `${Math.round(targetDetail.coverage.branch_coverage_pct)}% branch coverage`,
        ]).join(" · "),
      });
    }

    exercises.push({
      id: `test:${relation.testPath}:${relation.targetPath}`,
      prompt: `Which production file is exercised by ${relation.testPath}?`,
      instruction: "Type the repo-relative production file path.",
      acceptedAnswers: [relation.targetPath, relation.targetPath.split("/").at(-1) ?? relation.targetPath],
      hint: "Use the test-to-production relationship immediately above.",
      explanation: `${relation.testPath} is paired with ${relation.targetPath} by ${relation.source === "graph" ? "indexed graph evidence" : "deterministic naming convention"}.`,
    });
  }

  return { evidence, flow, items, exercises: exercises.slice(0, 2) };
}

interface ResolvedFlowStop {
  id: string;
  label: string;
  file?: string;
  signature?: string;
  role: "Input boundary" | "Processing" | "Storage" | "Output / terminal";
}

function terminalRole(label: string, file?: string): ResolvedFlowStop["role"] {
  const haystack = `${label} ${file ?? ""}`.toLowerCase();
  return /\b(save|write|insert|update|delete|persist|store|repository|database|db|cache|queue|publish)\b/.test(
    haystack,
  )
    ? "Storage"
    : "Output / terminal";
}

function resolveExecutionFlow(
  executionFlows: ExecutionFlows | null,
  symbolDetails: Record<string, SymbolDetailResponse>,
): { stops: ResolvedFlowStop[]; via: Array<string | null> } | null {
  const flow = executionFlows?.flows.find((candidate) => candidate.trace.length >= 2);
  if (!flow) return null;
  const stops = flow.trace.map((symbolId, index) => {
    const detail = symbolDetails[symbolId];
    const last = index === flow.trace.length - 1;
    return {
      id: symbolId,
      label: detail?.symbol.qualified_name || detail?.symbol.name || symbolId,
      ...(detail?.symbol.file_path ? { file: detail.symbol.file_path } : {}),
      ...(detail?.symbol.signature ? { signature: detail.symbol.signature } : {}),
      role: index === 0 ? "Input boundary" : last ? terminalRole(detail?.symbol.name || symbolId, detail?.symbol.file_path) : "Processing",
    } satisfies ResolvedFlowStop;
  });
  return { stops, via: flow.trace_via ?? [] };
}

function resolveArchitectureFlow(
  architecture: ArchitectureView | null,
): { stops: ResolvedFlowStop[]; relations: ArchEdge[] } | null {
  if (!architecture) return null;
  const nodes = architecture.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const start =
    nodes.find((node) => node.is_entry_point && !node.is_test) ||
    nodes.filter((node) => !node.is_test).sort((a, b) => b.pagerank - a.pagerank)[0];
  if (!start) return null;

  const trace: ArchNode[] = [start];
  const relations: ArchEdge[] = [];
  const visited = new Set([start.id]);
  let current = start;
  for (let depth = 0; depth < 5; depth += 1) {
    const edge = architecture.edges
      .filter((candidate) => candidate.source === current.id && !visited.has(candidate.target))
      .filter((candidate) => !nodeById.get(candidate.target)?.is_test)
      .sort(
        (a, b) =>
          b.weight * Math.max(0.1, b.confidence) -
          a.weight * Math.max(0.1, a.confidence),
      )[0];
    if (!edge) break;
    const next = nodeById.get(edge.target);
    if (!next) break;
    relations.push(edge);
    trace.push(next);
    visited.add(next.id);
    current = next;
  }
  if (trace.length < 2) return null;
  const stops = trace.map((node, index) => ({
    id: node.id,
    label: node.name || node.file_path || node.id,
    ...(node.file_path ? { file: node.file_path } : {}),
    role:
      index === 0
        ? "Input boundary"
        : index === trace.length - 1
          ? terminalRole(node.name, node.file_path ?? undefined)
          : "Processing",
  })) satisfies ResolvedFlowStop[];
  return { stops, relations };
}

function dataFlowTeaching(
  executionFlows: ExecutionFlows | null,
  symbolDetails: Record<string, SymbolDetailResponse>,
  architecture: ArchitectureView | null,
): { items: TutorItem[]; flow: TutorFlowStep[]; exercises: TutorExercise[] } {
  const symbolFlow = resolveExecutionFlow(executionFlows, symbolDetails);
  if (symbolFlow) {
    const items = symbolFlow.stops.map((stop, index) => ({
      title: `${stop.role} · ${stop.label}`,
      detail: stop.file || stop.id,
      meta: stop.signature || (index === 0 ? "entry symbol" : "indexed execution-flow symbol"),
    }));
    const flow = symbolFlow.stops.slice(0, -1).map((stop, index) => {
      const next = symbolFlow.stops[index + 1]!;
      const origin = symbolFlow.via[index];
      return {
        from: stop.label,
        to: next.label,
        relation: "calls",
        explanation: `Execution proceeds from ${stop.role.toLowerCase()} to ${next.role.toLowerCase()}${origin ? `; RepoWise resolved this hop via ${origin}` : ""}.`,
      };
    });
    const terminal = symbolFlow.stops.at(-1)!;
    return {
      items,
      flow,
      exercises: [
        {
          id: `data-flow:${terminal.id}`,
          prompt: "Trace the data-flow lesson to its terminal step.",
          instruction: `Type the final ${terminal.role === "Storage" ? "storage" : "output/terminal"} symbol name.`,
          acceptedAnswers: unique([terminal.label, terminal.label.split(".").at(-1), terminal.id]),
          hint: "Follow the call arrows from the input boundary through each processing step.",
          explanation: `${terminal.label} is the terminal step in the indexed execution flow shown above.`,
        },
      ],
    };
  }

  const architectureFlow = resolveArchitectureFlow(architecture);
  if (!architectureFlow) return { items: [], flow: [], exercises: [] };
  const items = architectureFlow.stops.map((stop) => ({
    title: `${stop.role} · ${stop.label}`,
    detail: stop.file || stop.id,
    meta: "fallback from the indexed architecture dependency graph",
  }));
  const flow = architectureFlow.stops.slice(0, -1).map((stop, index) => {
    const next = architectureFlow.stops[index + 1]!;
    const relation = architectureFlow.relations[index];
    return {
      from: stop.label,
      to: next.label,
      relation: relation?.edge_type || "dependency",
      explanation: `Tutor follows the strongest indexed production dependency from ${stop.role.toLowerCase()} to ${next.role.toLowerCase()}.`,
    };
  });
  const terminal = architectureFlow.stops.at(-1)!;
  return {
    items,
    flow,
    exercises: [
      {
        id: `data-flow-fallback:${terminal.id}`,
        prompt: "Trace the dependency-backed data flow to its terminal step.",
        instruction: "Type the final node or file name.",
        acceptedAnswers: unique([terminal.label, terminal.file, terminal.file?.split("/").at(-1)]),
        hint: "Follow the arrows from Input boundary through Processing.",
        explanation: `${terminal.label} is the terminal node in the deterministic fallback flow.`,
      },
    ],
  };
}

export function collectTutorRelatedTests(
  architecture: ArchitectureView | null,
  productionPaths: string[],
  limit = 4,
): TutorRelatedTest[] {
  if (!architecture || productionPaths.length === 0) return [];
  const production = new Set(productionPaths.map(normalizePath));
  const nodeById = new Map(architecture.nodes.map((node) => [node.id, node]));
  const result: TutorRelatedTest[] = [];
  const seen = new Set<string>();

  const add = (item: TutorRelatedTest) => {
    const key = `${normalizePath(item.testPath)}\u0000${normalizePath(item.targetPath)}`;
    if (seen.has(key) || result.length >= limit) return;
    seen.add(key);
    result.push(item);
  };

  for (const edge of architecture.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source?.file_path || !target?.file_path) continue;
    if (source.is_test && !target.is_test && production.has(normalizePath(target.file_path))) {
      add({ testPath: source.file_path, targetPath: target.file_path, relation: edge.edge_type, source: "graph" });
    } else if (target.is_test && !source.is_test && production.has(normalizePath(source.file_path))) {
      add({ testPath: target.file_path, targetPath: source.file_path, relation: edge.edge_type, source: "graph" });
    }
  }

  if (result.length >= limit) return result;
  const tests = unique(
    architecture.nodes.filter((node) => node.is_test).map((node) => node.file_path),
  );
  for (const testPath of tests) {
    const testStem = pathStem(testPath);
    if (!testStem) continue;
    const targetPath = productionPaths.find((path) => {
      const targetStem = pathStem(path);
      return Boolean(targetStem) && (testStem === targetStem || testStem.includes(targetStem) || targetStem.includes(testStem));
    });
    if (targetPath) {
      add({ testPath, targetPath, relation: "naming convention", source: "convention" });
    }
    if (result.length >= limit) break;
  }
  return result;
}

export function tutorExercisesForSection(section: TutorSection): TutorExercise[] {
  return (section as TutorSectionWithExercises).exercises ?? [];
}

export function normalizeTutorExerciseAnswer(value: string): string {
  return normalizePath(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function isTutorExerciseCorrect(exercise: TutorExercise, answer: string): boolean {
  const normalized = normalizeTutorExerciseAnswer(answer);
  return exercise.acceptedAnswers.some(
    (accepted) => normalizeTutorExerciseAnswer(accepted) === normalized,
  );
}

export function enrichTutorCurriculum({
  curriculum,
  architecture,
  fileDetails,
  symbolDetails,
  executionFlows,
  sourceContents,
  relatedTests,
}: EnrichTutorCurriculumInput): TutorCurriculum {
  const symbolTeaching = buildSymbolTeaching(symbolDetails, sourceContents);
  if (symbolTeaching.evidence.length) {
    addSection(curriculum, "important-code", {
      title: "Function and class deep dive",
      body: "Tutor now goes below file level. Each card teaches one important function/class, shows its exact source, signature-derived inputs and output, and its indexed callers/callees. This is deterministic graph and source analysis; no AI explanation is required.",
      evidence: symbolTeaching.evidence,
      ...(symbolTeaching.flow.length ? { flow: symbolTeaching.flow } : {}),
      ...(symbolTeaching.exercises.length ? { exercises: symbolTeaching.exercises } : {}),
    });
  }

  const tests = testTeaching(relatedTests, architecture, fileDetails, sourceContents);
  if (tests.evidence.length) {
    addSection(curriculum, "change-safely", {
      title: "Tests that protect the code you are learning",
      body: "Instead of merely telling you to check tests, Tutor identifies related test files, shows their source, names test cases when they can be extracted, and explains the production file each test is connected to.",
      ...(tests.items.length ? { items: tests.items } : {}),
      evidence: tests.evidence,
      ...(tests.flow.length ? { flow: tests.flow } : {}),
      ...(tests.exercises.length ? { exercises: tests.exercises } : {}),
    });
  }

  const dataFlow = dataFlowTeaching(executionFlows, symbolDetails, architecture);
  if (dataFlow.items.length) {
    addSection(curriculum, "code-tour", {
      title: "Input → processing → storage/output data flow",
      body: "This is a concrete flow, not a generic architecture description. Tutor prefers RepoWise's symbol-level execution-flow index; when that is unavailable it deterministically follows the strongest production dependency path. Storage is labelled only when the terminal symbol/file name contains an indexed persistence signal; otherwise the terminal is labelled output/terminal.",
      items: dataFlow.items,
      ...(dataFlow.flow.length ? { flow: dataFlow.flow } : {}),
      ...(dataFlow.exercises.length ? { exercises: dataFlow.exercises } : {}),
    });
  }

  const added = [
    symbolTeaching.evidence.length ? "symbol-level teaching" : null,
    tests.evidence.length ? "related-test teaching" : null,
    dataFlow.items.length ? "data-flow teaching" : null,
  ].filter((value): value is string => Boolean(value));
  if (added.length) curriculum.status = [...curriculum.status, ...added];

  return curriculum;
}
