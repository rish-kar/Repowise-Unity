export type TutorLevel = "beginner" | "intermediate" | "advanced";

export interface TutorLesson {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  starter: string;
}

export const TUTOR_LEVELS: ReadonlyArray<{
  id: TutorLevel;
  label: string;
  guidance: string;
}> = [
  {
    id: "beginner",
    label: "Beginner",
    guidance:
      "Assume the learner is new to professional codebases. Define jargon, explain why each piece exists, and prefer mental models before implementation detail.",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    guidance:
      "Assume the learner can read code syntax but is new to this repository. Focus on boundaries, data flow, conventions, and practical navigation.",
  },
  {
    id: "advanced",
    label: "Advanced",
    guidance:
      "Assume the learner is an experienced engineer. Emphasize architecture, trade-offs, coupling, failure modes, and safe change strategy.",
  },
];

export const TUTOR_LESSONS: readonly TutorLesson[] = [
  {
    id: "orientation",
    title: "Orientation",
    eyebrow: "01 · Start here",
    description:
      "Build a plain-language mental model of what the repository does, how it is organised, and where execution begins.",
    starter:
      "Give me a beginner-friendly orientation to this repository. Start with what the system is for, then show me the major folders or modules, the main entry points, and the smallest set of files I should read first.",
  },
  {
    id: "architecture",
    title: "Architecture & layers",
    eyebrow: "02 · Structure",
    description:
      "Understand the major components, their responsibilities, dependency direction, and the boundaries that keep them separate.",
    starter:
      "Teach me the architecture of this repository layer by layer. Explain the responsibility of each major component, what it depends on, and how the layers connect using concrete files and symbols from the index.",
  },
  {
    id: "flow",
    title: "End-to-end flow",
    eyebrow: "03 · Trace",
    description:
      "Follow one representative path through the code from an external input to the final output or side effect.",
    starter:
      "Choose one representative end-to-end flow in this repository and trace it for me from entry point to outcome. Explain every hand-off in beginner-friendly language and cite the files or symbols involved.",
  },
  {
    id: "state",
    title: "Data, state & dependencies",
    eyebrow: "04 · Connect",
    description:
      "See where data comes from, how it changes, where state lives, and which external systems or packages matter.",
    starter:
      "Teach me how data and state move through this repository. Cover important models, persistence or storage, configuration, external services, and third-party dependencies, and show how they connect to the main flow.",
  },
  {
    id: "tests",
    title: "Tests & safety net",
    eyebrow: "05 · Verify",
    description:
      "Learn how the project proves behaviour is correct, where tests live, and which areas have the weakest safety net.",
    starter:
      "Explain the testing strategy in this repository as if I am a new joiner. Show me the main test layers, how they map to production code, what is well covered, and what I should be careful changing.",
  },
  {
    id: "change",
    title: "Make a safe change",
    eyebrow: "06 · Apply",
    description:
      "Turn understanding into action by planning a small change, identifying impact, and deciding what to verify before editing.",
    starter:
      "Walk me through how a new joiner should make one small, realistic change in this repository safely. Do not edit code. Identify the likely files, dependencies, tests, and blast radius, then give me a step-by-step implementation plan.",
  },
];

const QUESTION_MARKER = "### Learner question";

export function buildTutorMessage({
  question,
  level,
  lesson,
  repoName,
}: {
  question: string;
  level: TutorLevel;
  lesson: TutorLesson;
  repoName: string;
}): string {
  const levelGuidance =
    TUTOR_LEVELS.find((item) => item.id === level)?.guidance ?? TUTOR_LEVELS[0]!.guidance;

  return `# RepoWise Tutor mode

You are teaching a learner how the indexed repository "${repoName}" works.
Use RepoWise's existing repository intelligence — indexed code, knowledge graph, generated documentation, Git history, tests, and available tools — as the factual basis for the lesson.

Audience level: ${level}
Current lesson: ${lesson.title}
Level guidance: ${levelGuidance}

Teaching contract:
- Inspect relevant repository evidence before making claims. Do not invent behaviour that is not supported by the index or tool results.
- Teach from the outside in: system purpose -> component/layer -> file -> symbol or function when useful.
- Define unfamiliar terms the first time you use them.
- Explain both WHAT a piece does and WHY it exists, then show what calls it and what it calls next.
- Prefer concrete repository paths, symbols, dependency relationships, tests, and citations over generic programming advice.
- Separate confirmed facts from reasonable inference. If evidence is missing, say what is unknown.
- Keep code excerpts small and purposeful; do not dump whole files.
- When the learner asks about a change, teach impact and verification before implementation.
- End substantial explanations with a short "Checkpoint" and one "Next thing to inspect".
- Stay focused on the learner's question and current lesson; do not turn the answer into a generic textbook chapter.

${QUESTION_MARKER}
${question.trim()}`;
}

export function extractTutorQuestion(message: string): string {
  const index = message.lastIndexOf(QUESTION_MARKER);
  if (index === -1) return message;
  const question = message.slice(index + QUESTION_MARKER.length).trim();
  return question || message;
}
