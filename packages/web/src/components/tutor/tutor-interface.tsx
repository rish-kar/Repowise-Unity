"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  FileCode2,
  GitBranch,
  GraduationCap,
  ListChecks,
  RotateCcw,
  Route,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@repowise-dev/ui/ui";
import { cn } from "@repowise-dev/ui/lib/cn";
import type {
  TutorCurriculum,
  TutorEvidence,
  TutorLesson,
  TutorSection,
} from "./tutor-curriculum";
import { tutorExercisesForSection } from "./tutor-enrichment";
import { TutorSectionExercises } from "./tutor-exercises";

interface TutorInterfaceProps {
  repoId: string;
  curriculum: TutorCurriculum;
}

type WorkspaceMode = "learn" | "code" | "flow" | "practice";

const MICRO_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";

function progressKey(repoId: string) {
  return `repowise:tutor:${repoId}:completed-v3`;
}

function selectedKey(repoId: string) {
  return `repowise:tutor:${repoId}:selected-v3`;
}

function EvidenceCard({ evidence }: { evidence: TutorEvidence }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
      <div className="flex items-start gap-3 border-b border-[var(--color-border-default)] px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]">
          <FileCode2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {evidence.title}
              </h3>
              {evidence.path && (
                <p className="mt-1 break-all font-mono text-[11px] text-[var(--color-accent-primary)]">
                  {evidence.path}
                </p>
              )}
            </div>
            {evidence.lineStart && evidence.lineEnd && (
              <span className="rounded-md bg-[var(--color-bg-elevated)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                L{evidence.lineStart}–{evidence.lineEnd}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            {evidence.explanation}
          </p>
          {evidence.signals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {evidence.signals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-tertiary)]"
                >
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {evidence.code && (
        <div className="bg-[var(--color-bg-inset)]">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className={MICRO_LABEL}>Source</span>
            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
              {evidence.language || "indexed source"}
            </span>
          </div>
          <pre className="max-h-[34rem] overflow-auto border-t border-[var(--color-border-default)] p-4 text-[12px] leading-5 text-[var(--color-text-secondary)]">
            <code>{evidence.code}</code>
          </pre>
        </div>
      )}
    </article>
  );
}

function LearnView({ lesson }: { lesson: TutorLesson }) {
  return (
    <div className="space-y-4">
      {lesson.sections.map((section, index) => (
        <section
          key={section.title}
          className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] font-mono text-[11px] font-semibold text-[var(--color-accent-primary)]">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {section.title}
              </h3>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                {section.body}
              </p>
            </div>
          </div>

          {section.facts && section.facts.length > 0 && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.facts.map((fact) => (
                <div
                  key={`${fact.label}:${fact.value}`}
                  className="rounded-lg bg-[var(--color-bg-elevated)] px-3 py-3"
                >
                  <dt className={MICRO_LABEL}>{fact.label}</dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]" title={fact.value}>
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {section.items && section.items.length > 0 && (
            <div className="mt-4 divide-y divide-[var(--color-border-default)] rounded-lg border border-[var(--color-border-default)]">
              {section.items.map((item, itemIndex) => (
                <div key={`${item.title}:${itemIndex}`} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-[10px] text-[var(--color-accent-primary)]">
                      {String(itemIndex + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                      {item.detail && (
                        <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
                      )}
                      {item.meta && (
                        <p className="mt-1 font-mono text-[10px] leading-5 text-[var(--color-text-tertiary)]">{item.meta}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CodeView({ lesson }: { lesson: TutorLesson }) {
  const evidence = lesson.sections.flatMap((section) => section.evidence ?? []);
  if (!evidence.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
        No source-backed code excerpts are available for this lesson.
      </div>
    );
  }
  return <div className="space-y-4">{evidence.map((item, index) => <EvidenceCard key={`${item.path ?? item.title}:${index}`} evidence={item} />)}</div>;
}

function FlowView({ lesson }: { lesson: TutorLesson }) {
  const sections = lesson.sections.filter((section) => section.flow?.length);
  if (!sections.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border-default)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
        No indexed execution or dependency flow is available for this lesson.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <section key={section.title} className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[var(--color-accent-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{section.body}</p>
          <ol className="mt-5 space-y-2">
            {section.flow!.map((step, index) => (
              <li key={`${step.from}:${step.to}:${index}`} className="grid gap-2 rounded-lg bg-[var(--color-bg-elevated)] p-3 sm:grid-cols-[32px_minmax(0,1fr)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-muted)] font-mono text-[10px] font-semibold text-[var(--color-accent-primary)]">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    <span className="break-all">{step.from}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                    <span className="break-all">{step.to}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-start gap-2">
                    <span className="rounded-md border border-[var(--color-border-default)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent-primary)]">
                      {step.relation}
                    </span>
                    <p className="text-sm leading-5 text-[var(--color-text-secondary)]">{step.explanation}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function PracticeView({
  lesson,
  completed,
  selectedOption,
  setSelectedOption,
}: {
  lesson: TutorLesson;
  completed: boolean;
  selectedOption: number | null;
  setSelectedOption: (value: number) => void;
}) {
  const answerWasWrong = selectedOption !== null && selectedOption !== lesson.checkpoint.correctIndex;
  const answerWasCorrect = selectedOption !== null && selectedOption === lesson.checkpoint.correctIndex;

  return (
    <div className="space-y-4">
      {lesson.sections.map((section) => (
        <TutorSectionExercises key={section.title} section={section} />
      ))}

      <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-[var(--color-accent-primary)]" />
            <p className={MICRO_LABEL}>Knowledge checkpoint</p>
          </div>
          {completed && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-primary)]">
              <Check className="h-3.5 w-3.5" /> Complete
            </span>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-base font-medium leading-6 text-[var(--color-text-primary)]">
          {lesson.checkpoint.question}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {lesson.checkpoint.options.map((option, index) => {
            const chosen = selectedOption === index;
            const correct = index === lesson.checkpoint.correctIndex;
            return (
              <button
                key={`${option}:${index}`}
                type="button"
                disabled={completed}
                onClick={() => setSelectedOption(index)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                  answerWasCorrect && correct
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                    : answerWasWrong && chosen
                      ? "border-[var(--color-border-strong)] bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)]"
                      : chosen
                        ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                        : "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]",
                )}
              >
                <span className="mr-2 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                  {String.fromCharCode(65 + index)}.
                </span>
                {option}
              </button>
            );
          })}
        </div>
        {answerWasCorrect && (
          <div className="mt-4 rounded-lg bg-[var(--color-accent-muted)] p-4">
            <p className={MICRO_LABEL}>Correct</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              {lesson.checkpoint.explanation}
            </p>
          </div>
        )}
        {answerWasWrong && (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Review the lesson evidence and try again.
          </p>
        )}
      </section>
    </div>
  );
}

export function TutorInterface({ repoId, curriculum }: TutorInterfaceProps) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(curriculum.lessons[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>("learn");

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(progressKey(repoId)) ?? "[]") as unknown;
      const valid = Array.isArray(stored)
        ? stored.filter(
            (value): value is string =>
              typeof value === "string" && curriculum.lessons.some((lesson) => lesson.id === value),
          )
        : [];
      setCompleted(valid);
      const savedSelected = window.localStorage.getItem(selectedKey(repoId));
      if (savedSelected && curriculum.lessons.some((lesson) => lesson.id === savedSelected)) {
        setSelectedId(savedSelected);
      } else {
        const firstIncomplete = curriculum.lessons.find((lesson) => !valid.includes(lesson.id));
        if (firstIncomplete) setSelectedId(firstIncomplete.id);
      }
    } catch {}
  }, [curriculum.lessons, repoId]);

  const selectedIndex = Math.max(0, curriculum.lessons.findIndex((lesson) => lesson.id === selectedId));
  const selectedLesson = curriculum.lessons[selectedIndex] ?? curriculum.lessons[0];
  const totalMinutes = useMemo(() => curriculum.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0), [curriculum.lessons]);
  const progressPct = curriculum.lessons.length ? Math.round((completed.length / curriculum.lessons.length) * 100) : 0;

  const selectLesson = useCallback((lessonId: string) => {
    setSelectedId(lessonId);
    setSelectedOption(null);
    setMode("learn");
    try {
      window.localStorage.setItem(selectedKey(repoId), lessonId);
    } catch {}
  }, [repoId]);

  const persistCompleted = useCallback((next: string[]) => {
    setCompleted(next);
    try {
      window.localStorage.setItem(progressKey(repoId), JSON.stringify(next));
    } catch {}
  }, [repoId]);

  if (!selectedLesson) {
    return <div className="p-[var(--page-pad)] text-sm text-[var(--color-text-secondary)]">Tutor could not build a learning path from the current index.</div>;
  }

  const checkpointPassed = completed.includes(selectedLesson.id) || selectedOption === selectedLesson.checkpoint.correctIndex;
  const codeCount = selectedLesson.sections.reduce((sum, section) => sum + (section.evidence?.length ?? 0), 0);
  const flowCount = selectedLesson.sections.reduce((sum, section) => sum + (section.flow?.length ?? 0), 0);
  const exerciseCount = selectedLesson.sections.reduce((sum, section) => sum + tutorExercisesForSection(section).length, 0);

  const completeAndContinue = () => {
    if (!checkpointPassed) return;
    const nextCompleted = completed.includes(selectedLesson.id) ? completed : [...completed, selectedLesson.id];
    persistCompleted(nextCompleted);
    const nextLesson = curriculum.lessons[selectedIndex + 1];
    if (nextLesson) selectLesson(nextLesson.id);
  };

  const markComplete = () => {
    if (!checkpointPassed || completed.includes(selectedLesson.id)) return;
    persistCompleted([...completed, selectedLesson.id]);
  };

  const resetProgress = () => {
    persistCompleted([]);
    setSelectedOption(null);
    setMode("learn");
    const first = curriculum.lessons[0];
    if (first) selectLesson(first.id);
  };

  const modes: Array<{ id: WorkspaceMode; label: string; icon: typeof BookOpen; count?: number; disabled?: boolean }> = [
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "code", label: "Code", icon: Code2, count: codeCount, disabled: codeCount === 0 },
    { id: "flow", label: "Flow", icon: GitBranch, count: flowCount, disabled: flowCount === 0 },
    { id: "practice", label: "Practice", icon: ListChecks, count: exerciseCount + 1 },
  ];

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-bg-root)]">
      <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-border-default)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Tutor</p>
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">{curriculum.repoName}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className={MICRO_LABEL}>Progress</p>
              <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{progressPct}%</p>
            </div>
            <div className="text-right text-xs text-[var(--color-text-tertiary)]">
              <p>{completed.length}/{curriculum.lessons.length} complete</p>
              <p className="mt-1">{totalMinutes} min total</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-inset)]">
            <div className="h-full rounded-full bg-[var(--color-accent-primary)]" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Tutor learning path">
          {curriculum.lessons.map((lesson, index) => {
            const active = lesson.id === selectedLesson.id;
            const done = completed.includes(lesson.id);
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => selectLesson(lesson.id)}
                className={cn(
                  "mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                  active ? "bg-[var(--color-accent-muted)]" : "hover:bg-[var(--color-bg-elevated)]",
                )}
              >
                <span className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-bg-root)]"
                    : active
                      ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                      : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
                )}>
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-5 text-[var(--color-text-primary)]">{lesson.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
                    <Clock3 className="h-3 w-3" /> {lesson.estimatedMinutes} min
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border-default)] p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={resetProgress}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset progress
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
          <div className="flex items-center justify-between gap-4 px-[var(--page-pad)] py-3">
            <div className="min-w-0">
              <p className={MICRO_LABEL}>Lesson {selectedIndex + 1} of {curriculum.lessons.length}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">{selectedLesson.title}</p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-[var(--color-text-tertiary)] sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-primary)]" />
              Source-backed · deterministic
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto border-t border-[var(--color-border-default)] px-[var(--page-pad)] py-2">
            {modes.map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => setMode(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.count != null && (
                    <span className="rounded-full bg-[var(--color-bg-elevated)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--color-text-tertiary)]">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-[var(--page-pad)] py-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {mode === "learn" && <LearnView lesson={selectedLesson} />}
              {mode === "code" && <CodeView lesson={selectedLesson} />}
              {mode === "flow" && <FlowView lesson={selectedLesson} />}
              {mode === "practice" && (
                <PracticeView
                  lesson={selectedLesson}
                  completed={completed.includes(selectedLesson.id)}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                />
              )}
            </div>

            <aside className="hidden xl:block">
              <div className="sticky top-0 space-y-3">
                <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                  <div className="flex items-center gap-2 text-[var(--color-accent-primary)]">
                    <Target className="h-4 w-4" />
                    <p className={MICRO_LABEL}>Objective</p>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-[var(--color-text-primary)]">{selectedLesson.objective}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{selectedLesson.summary}</p>
                </section>

                <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                  <p className={MICRO_LABEL}>Lesson material</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 text-center">
                      <Code2 className="mx-auto h-4 w-4 text-[var(--color-accent-primary)]" />
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{codeCount}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">code</p>
                    </div>
                    <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 text-center">
                      <GitBranch className="mx-auto h-4 w-4 text-[var(--color-accent-primary)]" />
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{flowCount}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">flows</p>
                    </div>
                    <div className="rounded-lg bg-[var(--color-bg-elevated)] p-3 text-center">
                      <ListChecks className="mx-auto h-4 w-4 text-[var(--color-accent-primary)]" />
                      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{exerciseCount + 1}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">tasks</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                  <p className={MICRO_LABEL}>Navigation</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIndex === 0}
                      onClick={() => {
                        const previous = curriculum.lessons[selectedIndex - 1];
                        if (previous) selectLesson(previous.id);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    {selectedIndex < curriculum.lessons.length - 1 ? (
                      <Button size="sm" disabled={!checkpointPassed} onClick={completeAndContinue}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" disabled={!checkpointPassed} onClick={markComplete}>
                        <Check className="h-4 w-4" /> Finish
                      </Button>
                    )}
                  </div>
                  {!checkpointPassed && (
                    <button
                      type="button"
                      onClick={() => setMode("practice")}
                      className="mt-3 w-full rounded-lg bg-[var(--color-bg-elevated)] px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    >
                      Complete the checkpoint in Practice to unlock the next lesson.
                    </button>
                  )}
                </section>
              </div>
            </aside>
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[var(--page-pad)] py-2 xl:hidden">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedIndex === 0}
              onClick={() => {
                const previous = curriculum.lessons[selectedIndex - 1];
                if (previous) selectLesson(previous.id);
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            {selectedIndex < curriculum.lessons.length - 1 ? (
              <Button size="sm" disabled={!checkpointPassed} onClick={completeAndContinue}>
                Complete & next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" disabled={!checkpointPassed} onClick={markComplete}>
                <Check className="h-4 w-4" /> Finish
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
