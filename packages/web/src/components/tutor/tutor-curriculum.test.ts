import { describe, expect, it } from "vitest";
import type { ArchitectureView } from "@repowise-dev/ui/c4";
import { buildTutorCurriculum } from "./tutor-curriculum";

const architecture: ArchitectureView = {
  project_name: "Example",
  project_description: "A small request-processing service.",
  total_files: 3,
  total_symbols: 6,
  total_edges: 2,
  languages: ["TypeScript"],
  frameworks: ["Next.js"],
  external_systems: [],
  entry_points: ["src/entry.ts"],
  entry_candidates: [],
  tour: [],
  layers: [
    {
      id: "web",
      name: "Web",
      description: "Accepts incoming requests.",
      node_ids: ["entry"],
      file_count: 1,
      complexity_distribution: { simple: 1 },
      health_score: 9,
      sub_groups: [],
      display_order: 0,
    },
    {
      id: "core",
      name: "Core",
      description: "Runs application behaviour.",
      node_ids: ["service", "store"],
      file_count: 2,
      complexity_distribution: { simple: 2 },
      health_score: 8,
      sub_groups: [],
      display_order: 1,
    },
  ],
  nodes: [
    {
      id: "entry",
      node_type: "function",
      name: "handleRequest",
      file_path: "src/entry.ts",
      line_range: [1, 3],
      summary: "Receives a request and forwards it to the service.",
      complexity: "simple",
      tags: ["request"],
      language: "TypeScript",
      pagerank: 0.9,
      pagerank_percentile: 99,
      betweenness: 0.5,
      in_degree: 0,
      out_degree: 1,
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
      id: "service",
      node_type: "function",
      name: "runService",
      file_path: "src/service.ts",
      line_range: [1, 3],
      summary: "Applies the core behaviour and calls the store.",
      complexity: "simple",
      tags: ["service"],
      language: "TypeScript",
      pagerank: 0.8,
      pagerank_percentile: 95,
      betweenness: 0.4,
      in_degree: 1,
      out_degree: 1,
      community_id: 1,
      is_entry_point: false,
      is_test: false,
      is_hotspot: false,
      is_dead: false,
      has_doc: true,
      primary_owner: null,
      primary_owner_pct: null,
      bus_factor: null,
    },
    {
      id: "store",
      node_type: "function",
      name: "writeRecord",
      file_path: "src/store.ts",
      line_range: [1, 2],
      summary: "Persists the result.",
      complexity: "simple",
      tags: ["storage"],
      language: "TypeScript",
      pagerank: 0.7,
      pagerank_percentile: 90,
      betweenness: 0.2,
      in_degree: 1,
      out_degree: 0,
      community_id: 1,
      is_entry_point: false,
      is_test: false,
      is_hotspot: false,
      is_dead: false,
      has_doc: true,
      primary_owner: null,
      primary_owner_pct: null,
      bus_factor: null,
    },
  ],
  edges: [
    { source: "entry", target: "service", edge_type: "calls", direction: "forward", weight: 5, confidence: 1 },
    { source: "service", target: "store", edge_type: "calls", direction: "forward", weight: 4, confidence: 1 },
  ],
};

describe("buildTutorCurriculum", () => {
  it("teaches source and graph evidence inside Tutor without AI", () => {
    const curriculum = buildTutorCurriculum({
      repoName: "Example",
      defaultBranch: "main",
      overview: null,
      architecture,
      sourceContents: {
        "src/entry.ts": "export function handleRequest() {\n  return runService();\n}",
        "src/service.ts": "export function runService() {\n  return writeRecord();\n}",
        "src/store.ts": "export function writeRecord() {\n}\n",
      },
    });

    const entryLesson = curriculum.lessons.find((lesson) => lesson.id === "entry-points");
    const traceLesson = curriculum.lessons.find((lesson) => lesson.id === "code-tour");

    expect(curriculum.lessons).toHaveLength(6);
    expect(curriculum.subtitle).toContain("no AI provider is required");
    expect(
      entryLesson?.sections
        .flatMap((section) => section.evidence ?? [])
        .some((item) => item.code?.includes("runService")),
    ).toBe(true);
    expect(
      traceLesson?.sections
        .flatMap((section) => section.flow ?? [])
        .map((step) => `${step.from}->${step.to}`),
    ).toEqual(["handleRequest->runService", "runService->writeRecord"]);
    expect(traceLesson?.checkpoint.options[traceLesson.checkpoint.correctIndex]).toBe("writeRecord");
  });

  it("still builds the course when optional index views are unavailable", () => {
    const curriculum = buildTutorCurriculum({
      repoName: "Example",
      defaultBranch: "main",
      overview: null,
      architecture: null,
      sourceContents: {},
    });

    expect(curriculum.lessons).toHaveLength(6);
    expect(curriculum.lessons[0]?.checkpoint.options).toContain("Not identified");
    expect(curriculum.status).toContain("0 source files loaded");
  });
});
