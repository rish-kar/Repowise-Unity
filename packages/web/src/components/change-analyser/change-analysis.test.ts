import { describe, expect, it } from "vitest";
import type { SymbolDetailResponse } from "@repowise-dev/types/symbols";
import {
  extractChangeTerms,
  extractObservedCalls,
  extractSourceSignals,
  rankSymbolAgainstIntent,
} from "./change-analysis";

const javaController = `
@RestController
@RequestMapping("/api")
public class AddMutationController {
  @PostMapping("/addMutations")
  public ResponseEntity<?> addMutations(MultipartFile file) throws Exception {
    FileSections sections = fileSplitterService.splitFile(new String(file.getBytes()));
    mutationGeneratorService.generateMutation(rules, Collections.singleton(Mutations.ADD), bundle);
    return zipService.createZipResponse(baseFileName);
  }
}
`;

function symbolDetail(): SymbolDetailResponse {
  return {
    symbol: {
      id: "db-1",
      repository_id: "r1",
      file_path: "src/main/java/com/xmen/controller/AddMutationController.java",
      symbol_id: "src/main/java/com/xmen/controller/AddMutationController.java::addMutations",
      name: "addMutations",
      qualified_name: "com.xmen.controller.AddMutationController.addMutations",
      kind: "method",
      signature: "ResponseEntity<?> addMutations(MultipartFile file)",
      start_line: 10,
      end_line: 20,
      docstring: "Generate add mutations and return a ZIP response.",
      visibility: "public",
      is_async: false,
      complexity_estimate: 2,
      language: "java",
      parent_name: "AddMutationController",
    },
    graph: {
      pagerank: 0.1,
      in_degree: 1,
      out_degree: 2,
      callers: [],
      callees: [
        {
          symbol_id: "ZipService::createZipResponse",
          name: "createZipResponse",
          kind: "method",
          file: "src/main/java/com/xmen/service/ZipService.java",
          start_line: 30,
          edge_type: "calls",
          confidence: 1,
        },
        {
          symbol_id: "MutationGeneratorService::generateMutation",
          name: "generateMutation",
          kind: "method",
          file: "src/main/java/com/xmen/service/MutationGeneratorService.java",
          start_line: 20,
          edge_type: "calls",
          confidence: 1,
        },
      ],
      caller_total: 0,
      callee_total: 2,
      relations: [],
    },
    governing_decisions: [],
    file_context: {
      file_path: "src/main/java/com/xmen/controller/AddMutationController.java",
      health_score: 8,
      is_hotspot: false,
      primary_owner: "dev@example.com",
      language: "java",
    },
  };
}

describe("change analysis evidence", () => {
  it("extracts a Spring endpoint with its class-level prefix", () => {
    expect(extractSourceSignals(javaController)).toEqual([
      {
        kind: "http-endpoint",
        label: "POST /api/addMutations",
        evidence: '@PostMapping("/addMutations")',
      },
    ]);
  });

  it("extracts concrete calls from the current source", () => {
    expect(extractObservedCalls(javaController)).toEqual(
      expect.arrayContaining([
        "fileSplitterService.splitFile",
        "file.getBytes",
        "mutationGeneratorService.generateMutation",
        "zipService.createZipResponse",
      ]),
    );
  });

  it("ranks symbols against what the developer says will change", () => {
    const terms = extractChangeTerms("Change the ZIP response returned by addMutations");
    const ranked = rankSymbolAgainstIntent(symbolDetail(), terms, true);

    expect(ranked.matchedTerms).toEqual(expect.arrayContaining(["zip", "response", "addmutations"]));
    expect(ranked.score).toBeGreaterThan(0);
    expect(ranked.reasons).toEqual(expect.arrayContaining(["public symbol", "entry-point file"]));
    expect(ranked.callees.map((callee) => callee.name)).toContain("createZipResponse");
  });
});
