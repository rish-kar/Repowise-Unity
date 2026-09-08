import { describe, expect, it } from "vitest";
import type { FileDetailResponse } from "@repowise-dev/types/files";
import type { ExecutionFlows } from "@repowise-dev/types/graph";
import type { SymbolDetailResponse } from "@repowise-dev/types/symbols";
import type { ArchitectureView } from "@repowise-dev/ui/c4";
import type { TutorCurriculum, TutorLesson } from "./tutor-curriculum";
import {
  collectTutorRelatedTests,
  enrichTutorCurriculum,
  isTutorExerciseCorrect,
  tutorExercisesForSection,
} from "./tutor-enrichment";

function lesson(id: string): TutorLesson {
  return {
    id,
    eyebrow: id,
    title: id,
    summary: id,
    objective: id,
    estimatedMinutes: 1,
    sections: [],
    checkpoint: {
      question: "q",
      options: ["a"],
      correctIndex: 0,
      explanation: "a",
    },
  };
}

function baseCurriculum(): TutorCurriculum {
  return {
    repoName: "Example",
    subtitle: "Example",
    status: [],
    lessons: [
      lesson("entry-points"),
      lesson("layers"),
      lesson("code-tour"),
      lesson("important-code"),
      lesson("change-safely"),
    ],
  };
}

const architecture = {
  project_name: "Example",
  project_description: "Example",
  layers: [],
  nodes: [
    {
      id: "prod",
      node_type: "file",
      name: "service.py",
      file_path: "src/service.py",
      line_range: [1, 20],
      summary: "Core production service",
      complexity: "moderate",
      tags: [],
      language: "Python",
      pagerank: 0.8,
      pagerank_percentile: 98,
      betweenness: 0.2,
      in_degree: 3,
      out_degree: 2,
      community_id: 1,
      is_entry_point: true,
      is_test: false,
      is_hotspot: false,
      is_dead: false,
      has_doc: true,
      primary_owner: null,
      primary_owner_pct: null,
      bus_factor: null,
    },
    {
      id: "test",
      node_type: "file",
      name: "test_service.py",
      file_path: "tests/test_service.py",
      line_range: [1, 20],
      summary: "Validates service behaviour",
      complexity: "simple",
      tags: [],
      language: "Python",
      pagerank: 0.1,
      pagerank_percentile: 20,
      betweenness: 0,
      in_degree: 0,
      out_degree: 1,
      community_id: 1,
      is_entry_point: false,
      is_test: true,
      is_hotspot: false,
      is_dead: false,
      has_doc: false,
      primary_owner: null,
      primary_owner_pct: null,
      bus_factor: null,
    },
  ],
  edges: [
    {
      source: "test",
      target: "prod",
      edge_type: "imports",
      direction: "forward",
      weight: 1,
      confidence: 1,
    },
  ],
  tour: [],
  total_files: 2,
  total_symbols: 2,
  total_edges: 1,
  languages: ["Python"],
  frameworks: [],
  external_systems: [],
  entry_points: ["src/service.py"],
  entry_candidates: [],
} as ArchitectureView;

const fileDetails = {
  "src/service.py": {
    file_path: "src/service.py",
    wiki_page: null,
    health: {
      metric: {
        file_path: "src/service.py",
        score: 8,
        max_ccn: 4,
        max_nesting: 2,
        nloc: 30,
        has_test_file: true,
        line_coverage_pct: 90,
        module: "src",
        duplication_pct: 0,
      },
      breakdown: null,
      findings: [],
      trend: null,
      signals: null,
    },
    git: null,
    coverage: {
      line_coverage_pct: 90,
      branch_coverage_pct: 80,
      total_coverable_lines: 20,
      covered_lines: [],
      source_format: "coverage.py",
      ingested_at: null,
      ingested_commit_sha: null,
    },
    graph: null,
    symbols: [
      {
        symbol_id: "src/service.py::handle",
        name: "handle",
        kind: "function",
        signature: "def handle(value: str) -> str",
        start_line: 1,
        end_line: 3,
        visibility: "public",
        complexity_estimate: 4,
        is_async: false,
      },
    ],
    function_blame: [],
    governing_decisions: [],
    dead_code: [],
  } as FileDetailResponse,
};

const symbolDetails = {
  "src/service.py::handle": {
    symbol: {
      id: "1",
      repository_id: "repo-1",
      file_path: "src/service.py",
      symbol_id: "src/service.py::handle",
      name: "handle",
      qualified_name: "handle",
      kind: "function",
      signature: "def handle(value: str) -> str",
      start_line: 1,
      end_line: 3,
      docstring: "Transforms the incoming value.",
      visibility: "public",
      is_async: false,
      complexity_estimate: 4,
      language: "Python",
      parent_name: null,
      importance_score: 0.9,
    },
    graph: {
      pagerank: 0.8,
      in_degree: 1,
      out_degree: 1,
      caller_total: 1,
      callee_total: 1,
      callers: [
        {
          symbol_id: "src/main.py::main",
          name: "main",
          kind: "function",
          file: "src/main.py",
          start_line: 1,
          edge_type: "calls",
          confidence: 1,
        },
      ],
      callees: [
        {
          symbol_id: "src/store.py::save",
          name: "save",
          kind: "function",
          file: "src/store.py",
          start_line: 1,
          edge_type: "calls",
          confidence: 1,
        },
      ],
    },
    governing_decisions: [],
    file_context: {
      file_path: "src/service.py",
      health_score: 8,
      is_hotspot: false,
      primary_owner: null,
      language: "Python",
    },
  } as SymbolDetailResponse,
  "src/store.py::save": {
    symbol: {
      id: "2",
      repository_id: "repo-1",
      file_path: "src/store.py",
      symbol_id: "src/store.py::save",
      name: "save",
      qualified_name: "save",
      kind: "function",
      signature: "def save(value: str) -> None",
      start_line: 1,
      end_line: 3,
      docstring: "Persists the value.",
      visibility: "public",
      is_async: false,
      complexity_estimate: 2,
      language: "Python",
      parent_name: null,
      importance_score: 0.7,
    },
    graph: {
      pagerank: 0.5,
      in_degree: 1,
      out_degree: 0,
      caller_total: 1,
      callee_total: 0,
      callers: [],
      callees: [],
    },
    governing_decisions: [],
    file_context: {
      file_path: "src/store.py",
      health_score: 9,
      is_hotspot: false,
      primary_owner: null,
      language: "Python",
    },
  } as SymbolDetailResponse,
};

const executionFlows: ExecutionFlows = {
  total_entry_points: 1,
  flows: [
    {
      entry_point: "src/service.py::handle",
      entry_point_name: "handle",
      entry_point_score: 1,
      trace: ["src/service.py::handle", "src/store.py::save"],
      depth: 2,
      crosses_community: false,
      communities_visited: [1],
      trace_via: ["same_file"],
    },
  ],
};

const sourceContents = {
  "src/service.py": "def handle(value: str) -> str:\n    return value.strip()\n",
  "src/store.py": "def save(value: str) -> None:\n    db.write(value)\n",
  "tests/test_service.py": "def test_handle_trims_input():\n    assert handle(' x ') == 'x'\n",
};

describe("Tutor deterministic enrichment", () => {
  it("finds tests from the indexed graph", () => {
    expect(collectTutorRelatedTests(architecture, ["src/service.py"])).toEqual([
      {
        testPath: "tests/test_service.py",
        targetPath: "src/service.py",
        relation: "imports",
        source: "graph",
      },
    ]);
  });

  it("adds symbol teaching, related tests, real exercises, and data flow", () => {
    const curriculum = baseCurriculum();
    const relatedTests = collectTutorRelatedTests(architecture, ["src/service.py"]);
    enrichTutorCurriculum({
      curriculum,
      architecture,
      fileDetails,
      symbolDetails,
      executionFlows,
      sourceContents,
      relatedTests,
    });

    const symbolSection = curriculum.lessons
      .find((item) => item.id === "important-code")
      ?.sections.find((section) => section.title === "Function and class deep dive");
    expect(symbolSection?.evidence?.[0]?.explanation).toContain("inputs: value: str");
    expect(symbolSection?.evidence?.[0]?.signals).toContain("1 callers");
    expect(symbolSection?.flow?.some((step) => step.from === "main" && step.to === "handle")).toBe(true);

    const testSection = curriculum.lessons
      .find((item) => item.id === "change-safely")
      ?.sections.find((section) => section.title === "Tests that protect the code you are learning");
    expect(testSection?.evidence?.[0]?.path).toBe("tests/test_service.py");
    expect(testSection?.evidence?.[0]?.explanation).toContain("test_handle_trims_input");

    const dataSection = curriculum.lessons
      .find((item) => item.id === "code-tour")
      ?.sections.find((section) => section.title === "Input → processing → storage/output data flow");
    expect(dataSection?.items?.[0]?.title).toContain("Input boundary");
    expect(dataSection?.items?.[1]?.title).toContain("Storage");

    const exercises = [
      ...tutorExercisesForSection(symbolSection!),
      ...tutorExercisesForSection(testSection!),
      ...tutorExercisesForSection(dataSection!),
    ];
    expect(exercises.length).toBeGreaterThanOrEqual(3);
    expect(isTutorExerciseCorrect(exercises[0]!, "main")).toBe(true);
  });
});
