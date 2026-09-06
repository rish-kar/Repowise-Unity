import { describe, expect, it } from "vitest";
import {
  TUTOR_LESSONS,
  buildTutorMessage,
  extractTutorQuestion,
} from "./tutor-prompt";

describe("Tutor prompt", () => {
  it("keeps the learner question recoverable for the UI", () => {
    const lesson = TUTOR_LESSONS[0]!;
    const prompt = buildTutorMessage({
      question: "Where does the app start?",
      level: "beginner",
      lesson,
      repoName: "Example",
    });

    expect(prompt).toContain("RepoWise Tutor mode");
    expect(prompt).toContain("Audience level: beginner");
    expect(prompt).toContain(`Current lesson: ${lesson.title}`);
    expect(extractTutorQuestion(prompt)).toBe("Where does the app start?");
  });

  it("leaves normal chat text untouched", () => {
    expect(extractTutorQuestion("plain question")).toBe("plain question");
  });

  it("ships a complete new-joiner learning path", () => {
    expect(TUTOR_LESSONS.map((lesson) => lesson.id)).toEqual([
      "orientation",
      "architecture",
      "flow",
      "state",
      "tests",
      "change",
    ]);
  });
});
