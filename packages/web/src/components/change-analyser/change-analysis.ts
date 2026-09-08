import type { BlastRadiusResponse, TestRecommendation } from "@repowise-dev/types/blast-radius";
import type { FileDetailResponse, FileGraphNeighbor } from "@repowise-dev/types/files";
import type { SymbolCallEntry, SymbolDetailResponse } from "@repowise-dev/types/symbols";

export interface LoadedChangeFile {
  path: string;
  detail: FileDetailResponse | null;
  source: string | null;
  symbols: SymbolDetailResponse[];
}

export interface SourceSignal {
  kind: "http-endpoint";
  label: string;
  evidence: string;
}

export interface FileSurface {
  path: string;
  language: string | null;
  isEntryPoint: boolean;
  publicSymbols: Array<{ name: string; signature: string; kind: string }>;
  dependencies: FileGraphNeighbor[];
  dependents: FileGraphNeighbor[];
  endpoints: SourceSignal[];
  observedCalls: string[];
  healthScore: number | null;
  isHotspot: boolean | null;
  churnPercentile: number | null;
  priorDefectCount: number | null;
}

export interface RankedSymbolImpact {
  symbolId: string;
  name: string;
  kind: string;
  signature: string;
  filePath: string;
  line: number;
  visibility: string;
  callers: SymbolCallEntry[];
  callees: SymbolCallEntry[];
  callerTotal: number;
  calleeTotal: number;
  matchedTerms: string[];
  score: number;
  reasons: string[];
}

export interface ChangeAnalysisReport {
  intent: string;
  mode: "existing" | "planned";
  selectedFiles: string[];
  evidenceCoverage: "strong" | "partial" | "limited";
  fileSurfaces: FileSurface[];
  likelySymbols: RankedSymbolImpact[];
  directDependents: Array<{ path: string; edgeType: string; importedNames: string[] }>;
  upstreamDependencies: Array<{ path: string; edgeType: string; importedNames: string[] }>;
  transitiveAffected: Array<{ path: string; depth: number }>;
  tests: TestRecommendation[];
  testStatus: string;
  structuralBreadth: { score: number; band: string } | null;
  riskFactors: string[];
  limitations: string[];
}

const STOP_WORDS = new Set([
  "add",
  "after",
  "all",
  "and",
  "before",
  "change",
  "changed",
  "changing",
  "code",
  "does",
  "existing",
  "file",
  "files",
  "for",
  "from",
  "into",
  "new",
  "plan",
  "planned",
  "should",
  "that",
  "the",
  "then",
  "this",
  "to",
  "update",
  "use",
  "with",
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function extractChangeTerms(intent: string): string[] {
  const raw = intent.toLowerCase().match(/[a-z0-9_$./-]{3,}/g) ?? [];
  const tokens = raw.flatMap((value) => value.split(/[.$/\-_]+/g));
  return unique(tokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token)));
}

function normaliseRoute(value: string): string {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
}

function joinRoutes(base: string, child: string): string {
  const joined = `${normaliseRoute(base).replace(/\/$/, "")}${normaliseRoute(child)}`;
  return joined || "/";
}

/**
 * Extract only high-confidence public HTTP route signals. These are evidence,
 * not a parser replacement: unsupported frameworks simply return no signal.
 */
export function extractSourceSignals(source: string | null): SourceSignal[] {
  if (!source) return [];
  const signals: SourceSignal[] = [];

  const javaClassPrefix = source.slice(0, Math.max(0, source.indexOf("class ") + 1));
  const javaBase =
    javaClassPrefix.match(
      /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/,
    )?.[1] ?? "";
  const javaMapping = /@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(\s*(?:value\s*=\s*)?["']([^"']*)["'][^)]*\))?/g;
  for (const match of source.matchAll(javaMapping)) {
    const method = match[1]?.toUpperCase();
    if (!method) continue;
    const path = joinRoutes(javaBase, match[2] ?? "");
    signals.push({
      kind: "http-endpoint",
      label: `${method} ${path}`,
      evidence: match[0],
    });
  }

  const jsOrPythonRoute = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const match of source.matchAll(jsOrPythonRoute)) {
    const method = match[1]?.toUpperCase();
    const path = match[2];
    if (!method || !path) continue;
    signals.push({
      kind: "http-endpoint",
      label: `${method} ${normaliseRoute(path)}`,
      evidence: match[0],
    });
  }

  const csharpBase = source.match(/\[Route\(\s*["']([^"']+)["']\s*\)\]/)?.[1] ?? "";
  const csharpRoute = /\[Http(Get|Post|Put|Delete|Patch)(?:\(\s*["']([^"']*)["']\s*\))?\]/g;
  for (const match of source.matchAll(csharpRoute)) {
    const method = match[1]?.toUpperCase();
    if (!method) continue;
    signals.push({
      kind: "http-endpoint",
      label: `${method} ${joinRoutes(csharpBase, match[2] ?? "")}`,
      evidence: match[0],
    });
  }

  return unique(signals.map((signal) => `${signal.label}\u0000${signal.evidence}`)).map((value) => {
    const [label = "", evidence = ""] = value.split("\u0000");
    return { kind: "http-endpoint" as const, label, evidence };
  });
}

export function extractObservedCalls(source: string | null): string[] {
  if (!source) return [];
  const calls: string[] = [];
  const dottedCall = /\b([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of source.matchAll(dottedCall)) {
    const receiver = match[1];
    const method = match[2];
    if (!receiver || !method) continue;
    calls.push(`${receiver}.${method}`);
  }
  return unique(calls).slice(0, 24);
}

function relationText(rows: SymbolCallEntry[]): string {
  return rows.map((row) => `${row.name} ${row.file} ${row.edge_type}`).join(" ").toLowerCase();
}

export function rankSymbolAgainstIntent(
  symbol: SymbolDetailResponse,
  terms: string[],
  isEntryPoint: boolean,
): RankedSymbolImpact {
  const identity = `${symbol.symbol.name} ${symbol.symbol.qualified_name} ${symbol.symbol.signature} ${symbol.symbol.docstring ?? ""}`.toLowerCase();
  const calls = relationText([...symbol.graph.callers, ...symbol.graph.callees]);
  const matchedTerms = terms.filter((term) => identity.includes(term) || calls.includes(term));
  const nameMatches = terms.filter((term) => symbol.symbol.name.toLowerCase().includes(term)).length;
  const identityMatches = terms.filter((term) => identity.includes(term)).length;
  const relationMatches = terms.filter((term) => calls.includes(term)).length;
  const callerTotal = symbol.graph.caller_total ?? symbol.graph.callers.length;
  const calleeTotal = symbol.graph.callee_total ?? symbol.graph.callees.length;

  let score = nameMatches * 5 + identityMatches * 3 + relationMatches * 2;
  if (symbol.symbol.visibility === "public") score += 2;
  if (callerTotal > 0) score += Math.min(3, callerTotal);
  if (isEntryPoint) score += 2;

  const reasons: string[] = [];
  if (matchedTerms.length > 0) reasons.push(`matches: ${matchedTerms.join(", ")}`);
  if (symbol.symbol.visibility === "public") reasons.push("public symbol");
  if (isEntryPoint) reasons.push("entry-point file");
  if (callerTotal > 0) reasons.push(`${callerTotal} caller${callerTotal === 1 ? "" : "s"}`);
  if (calleeTotal > 0) reasons.push(`${calleeTotal} downstream call${calleeTotal === 1 ? "" : "s"}`);
  if ((symbol.fix_count ?? 0) > 0) reasons.push(`${symbol.fix_count} prior counted fix${symbol.fix_count === 1 ? "" : "es"}`);

  return {
    symbolId: symbol.symbol.symbol_id,
    name: symbol.symbol.name,
    kind: symbol.symbol.kind,
    signature: symbol.symbol.signature,
    filePath: symbol.symbol.file_path,
    line: symbol.symbol.start_line,
    visibility: symbol.symbol.visibility,
    callers: symbol.graph.callers,
    callees: symbol.graph.callees,
    callerTotal,
    calleeTotal,
    matchedTerms,
    score,
    reasons,
  };
}

function neighbourKey(row: FileGraphNeighbor): string {
  return `${row.node_id}\u0000${row.edge_type}\u0000${row.imported_names.join(",")}`;
}

function serialiseNeighbours(rows: FileGraphNeighbor[]) {
  return unique(rows.map(neighbourKey)).map((value) => {
    const [path = "", edgeType = "", imported = ""] = value.split("\u0000");
    return {
      path,
      edgeType,
      importedNames: imported ? imported.split(",").filter(Boolean) : [],
    };
  });
}

export function buildChangeAnalysisReport(input: {
  intent: string;
  mode: "existing" | "planned";
  files: LoadedChangeFile[];
  blast: BlastRadiusResponse | null;
}): ChangeAnalysisReport {
  const terms = extractChangeTerms(input.intent);
  const fileSurfaces: FileSurface[] = input.files.map((file) => {
    const detail = file.detail;
    return {
      path: file.path,
      language: detail?.graph?.language ?? null,
      isEntryPoint: detail?.graph?.is_entry_point ?? false,
      publicSymbols:
        detail?.symbols
          .filter((symbol) => symbol.visibility === "public")
          .map((symbol) => ({ name: symbol.name, signature: symbol.signature, kind: symbol.kind })) ?? [],
      dependencies: detail?.graph?.dependencies ?? [],
      dependents: detail?.graph?.dependents ?? [],
      endpoints: extractSourceSignals(file.source),
      observedCalls: extractObservedCalls(file.source),
      healthScore: detail?.health.metric?.score ?? null,
      isHotspot: detail?.git?.is_hotspot ?? null,
      churnPercentile: detail?.git?.churn_percentile ?? null,
      priorDefectCount: detail?.git?.prior_defect_count ?? null,
    };
  });

  const entryPointByPath = new Map(fileSurfaces.map((file) => [file.path, file.isEntryPoint]));
  const ranked = input.files.flatMap((file) =>
    file.symbols.map((symbol) =>
      rankSymbolAgainstIntent(symbol, terms, entryPointByPath.get(symbol.symbol.file_path) ?? false),
    ),
  );
  ranked.sort((a, b) => b.score - a.score || b.callerTotal - a.callerTotal || a.name.localeCompare(b.name));
  const matched = ranked.filter((symbol) => symbol.matchedTerms.length > 0);
  const likelySymbols = (matched.length > 0 ? matched : ranked).slice(0, 12);

  const directDependents = serialiseNeighbours(fileSurfaces.flatMap((file) => file.dependents));
  const upstreamDependencies = serialiseNeighbours(fileSurfaces.flatMap((file) => file.dependencies));
  const selectedSet = new Set(input.files.map((file) => file.path));
  const directSet = new Set(directDependents.map((row) => row.path));
  const transitiveAffected =
    input.blast?.transitive_affected.filter(
      (row) => !selectedSet.has(row.path) && !directSet.has(row.path),
    ) ?? [];

  const tests = input.blast?.test_impact?.recommendations ?? [];
  const testStatus = input.blast?.test_impact?.coverage.status ?? "unknown";
  const riskFactors: string[] = [];
  const endpointCount = fileSurfaces.reduce((count, file) => count + file.endpoints.length, 0);
  const publicCount = fileSurfaces.reduce((count, file) => count + file.publicSymbols.length, 0);
  const hotspots = fileSurfaces.filter((file) => file.isHotspot === true);
  const priorFixes = fileSurfaces.reduce((count, file) => count + (file.priorDefectCount ?? 0), 0);

  if (endpointCount > 0) riskFactors.push(`${endpointCount} HTTP endpoint${endpointCount === 1 ? "" : "s"} sit on the selected change surface.`);
  if (publicCount > 0) riskFactors.push(`${publicCount} public symbol${publicCount === 1 ? "" : "s"} may represent compatibility contracts.`);
  if (directDependents.length > 0) riskFactors.push(`${directDependents.length} file${directDependents.length === 1 ? "" : "s"} depend directly on the selected files.`);
  if (transitiveAffected.length > 0) riskFactors.push(`${transitiveAffected.length} additional file${transitiveAffected.length === 1 ? "" : "s"} are reachable transitively.`);
  if (hotspots.length > 0) riskFactors.push(`${hotspots.length} selected file${hotspots.length === 1 ? " is" : "s are"} a Git hotspot.`);
  if (priorFixes > 0) riskFactors.push(`${priorFixes} counted prior bug-fix touch${priorFixes === 1 ? "" : "es"} were recorded on the selected files.`);
  if ((input.blast?.cochange_warnings.length ?? 0) > 0) riskFactors.push(`${input.blast?.cochange_warnings.length ?? 0} historical co-change partner${input.blast?.cochange_warnings.length === 1 ? " is" : "s are"} missing from the selected change.`);
  if (testStatus === "unavailable" || testStatus === "degraded" || testStatus === "unknown") {
    riskFactors.push("Test evidence is incomplete; an empty recommendation list must not be treated as proof that no tests are needed.");
  }

  const limitations: string[] = [];
  const detailsMissing = input.files.filter((file) => file.detail == null).length;
  const sourceMissing = input.files.filter((file) => file.source == null).length;
  const symbolsAvailable = input.files.reduce((count, file) => count + file.symbols.length, 0);
  if (detailsMissing > 0) limitations.push(`Indexed file-detail evidence was unavailable for ${detailsMissing} selected file${detailsMissing === 1 ? "" : "s"}.`);
  if (sourceMissing > 0) limitations.push(`Current source text could not be read for ${sourceMissing} selected file${sourceMissing === 1 ? "" : "s"}.`);
  if (symbolsAvailable === 0) limitations.push("Symbol-level callers and callees were unavailable, so the report falls back to file-level graph evidence.");
  if (!input.blast) limitations.push("Blast-radius data was unavailable, so transitive and test-impact evidence is omitted.");
  if (terms.length > 0 && matched.length === 0) limitations.push("The change description did not match a specific indexed symbol; likely-symbol ranking therefore falls back to public/connected symbols in the selected files.");

  let evidencePoints = 0;
  if (detailsMissing === 0 && input.files.length > 0) evidencePoints += 2;
  if (sourceMissing === 0 && input.files.length > 0) evidencePoints += 1;
  if (symbolsAvailable > 0) evidencePoints += 2;
  if (input.blast) evidencePoints += 1;
  if (matched.length > 0) evidencePoints += 1;
  const evidenceCoverage = evidencePoints >= 6 ? "strong" : evidencePoints >= 3 ? "partial" : "limited";

  return {
    intent: input.intent,
    mode: input.mode,
    selectedFiles: input.files.map((file) => file.path),
    evidenceCoverage,
    fileSurfaces,
    likelySymbols,
    directDependents,
    upstreamDependencies,
    transitiveAffected,
    tests,
    testStatus,
    structuralBreadth: input.blast
      ? { score: input.blast.structural_impact_score, band: input.blast.structural_impact_band }
      : null,
    riskFactors,
    limitations,
  };
}
