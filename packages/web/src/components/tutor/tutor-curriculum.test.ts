import { describe, expect, it } from "vitest";
import type { ArchitectureView } from "@repowise-dev/ui/c4";
import { buildTutorCurriculum } from "./tutor-curriculum";

const architecture: ArchitectureView = {
  project_name: "Example",
  project_description: "Example indexed project",
  layers: [
    {
      id: "api",
      name: "API",
      description: "Request boundary",
      node_ids: ["entry"],
      file_count: 2,
      complexity_distribution: { simple: 2 },
      health_score: 8,
      sub_groups: [],
      display_order: 0,
    },
  ],
  nodes: [
    {
      id: "entry",
      node_type: "file",
      name: "main.py",
      file_path: "src/main.py",
      line_range: null,
      summary: "Starts the application",
      complexity: "simple",
      tags: [],
      language: "Python",
      pagerank: 0.5,
      pagerank_percentile: 99,
      betweenness: 0,
      in_degree: 0,
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
  ],
  edges: [],
  tour: [
    {
      order: 1,
      title: "Start the app",
      description: "Read the entry point",
      node_ids: ["entry"],
      target_path: "src/main.py",
      layer_id: "api",
      reason: "Entry point",
      depth: 0,
      kind: "code",
      page_type: "file_page",
    },
  ],
  total_files: 2,
  total_symbols: 10,
  total_edges: 0,
  languages: ["Python"],
  frameworks: [],
  external_systems: [],
  entry_points: ["src/main.py"],
  entry_candidates: [],
};

describe("buildTutorCurriculum", () => {
  it("builds a deterministic system-led path from the RepoWise index", () => {
    const result = buildTutorCurriculum({
      repoId: "repo-1",
      repoName: "Example",
      defaultBranch: "main",
      overview: null,
      architecture,
    });

    expect(result.lessons).toHaveLength(6);
    expect(result.subtitle).toContain("No AI provider is required");
    expect(result.lessons[1]?.sections[0]?.items?.[0]?.title).toBe("src/main.py");
    expect(result.lessons[3]?.sections[0]?.items?.[0]?.title).toContain("Start the app");
  });

  it("still produces a usable path when optional index views are unavailable", () => {
    const result = buildTutorCurriculum({
      repoId: "repo-1",
      repoName: "Example",
      defaultBranch: "main",
      overview: null,
      architecture: null,
    });

    expect(result.lessons).toHaveLength(6);
    expect(result.lessons[0]?.checkpoint.answer).toBe("Not identified");
  });
});
