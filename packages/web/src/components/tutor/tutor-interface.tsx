"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  FileCode2,
  GitBranch,
  GraduationCap,
  Layers3,
  ListChecks,
  Map,
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
  TutorSection,
} from "./tutor-curriculum";
import { tutorExercisesForSection } from "./tutor-enrichment";
import { TutorSectionExercises } from "./tutor-exercises";

interface TutorInterfaceProps {
  repoId: string;
  curriculum: TutorCurriculum;
}

const MICRO_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";

function progressKey(repoId: string) {
  return `repowise:tutor:${repoId}:completed-v3`;
}

function selectedKey(repoId: string) {
  return `repowise:tutor:${repoId}:selected-v3`;
}

function SectionIcon({ section }: { section: TutorSection }) {
  if (section.flow?.length) return <Route className="h-4 w-4" />;
  if (section.evidence?.length) return <Code2 className="h-4 w-4" />;
  if (section.facts?.length) return <Layers3 className="h-4 w-4" />;
  if (section.items?.length) return <ListChecks className="h-4 w-4" />;
  return <BookOpen className="h-4 w-4" />;
}

function EvidenceCard({ evidence, index }: { evidence: TutorEvidence; index: number }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] text-[var(--color-accent-primary)]">
          <FileCode2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={MICRO_LABEL}>Source {String(index + 1).padStart(2, "0")}</p>
              <h4 className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {evidence.title}
              </h4>
            </div>
            {evidence.lineStart && evidence.lineEnd && (
              <span className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                L{evidence.lineStart}–{evidence.lineEnd}
              </span>
            )}
          </div>

          {evidence.path && (
            <p className="mt-1.5 break-all font-mono text-[11px] text-[var(--color-accent-primary)]">
              {evidence.path}
            </p>
          )}
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {evidence.explanation}
          </p>

          {evidence.signals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {evidence.signals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-tertiary)]"
                >
                  {signal}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {evidence.code && (
        <div className="border-t border-[var(--color-border-default)] bg-[var(--color-bg-inset)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-[var(--color-accent-primary)]" />
              <span className={MICRO_LABEL}>Read this code</span>
            </div>
            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
              {evidence.language || "indexed source"}
            </span>
          </div>
          <pre className="max-h-96 overflow-auto p-4 text-[12px] leading-5 text-[var(--color-text-secondary)] sm:p-5">
            <code>{evidence.code}</code>
          </pre>
        </div>
      )}
    </article>
  );
}

export function TutorInterface({ repoId, curriculum }: TutorInterfaceProps) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(curriculum.lessons[0]?.id ?? "");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

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
    } catch {
      // Progress persistence is optional; deterministic teaching still works.
    }
  }, [curriculum.lessons, repoId]);

  const selectedIndex = Math.max(
    0,
    curriculum.lessons.findIndex((lesson) => lesson.id === selectedId),
  );
  const selectedLesson = curriculum.lessons[selectedIndex] ?? curriculum.lessons[0];
  const progressPct = curriculum.lessons.length
    ? Math.round((completed.length / curriculum.lessons.length) * 100)
    : 0;

  const totalMinutes = useMemo(
    () => curriculum.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0),
    [curriculum.lessons],
  );

  const lessonMetrics = useMemo(() => {
    if (!selectedLesson) return { sources: 0, flows: 0, exercises: 0 };
    return selectedLesson.sections.reduce(
      (totals, section) => ({
        sources: totals.sources + (section.evidence?.length ?? 0),
        flows: totals.flows + (section.flow?.length ?? 0),
        exercises: totals.exercises + tutorExercisesForSection(section).length,
      }),
      { sources: 0, flows: 0, exercises: 0 },
    );
  }, [selectedLesson]);

  const selectLesson = useCallback(
    (lessonId: string) => {
      setSelectedId(lessonId);
      setSelectedOption(null);
      try {
        window.localStorage.setItem(selectedKey(repoId), lessonId);
      } catch {}
    },
    [repoId],
  );

  const persistCompleted = useCallback(
    (next: string[]) => {
      setCompleted(next);
      try {
        window.localStorage.setItem(progressKey(repoId), JSON.stringify(next));
      } catch {}
    },
    [repoId],
  );

  const checkpointPassed = selectedLesson
    ? completed.includes(selectedLesson.id) || selectedOption === selectedLesson.checkpoint.correctIndex
    : false;

  const markComplete = useCallback(() => {
    if (!selectedLesson || !checkpointPassed) return;
    const next = completed.includes(selectedLesson.id)
      ? completed
      : [...completed, selectedLesson.id];
    persistCompleted(next);
  }, [checkpointPassed, completed, persistCompleted, selectedLesson]);

  const completeAndContinue = useCallback(() => {
    if (!selectedLesson || !checkpointPassed) return;
    const next = completed.includes(selectedLesson.id)
      ? completed
      : [...completed, selectedLesson.id];
    persistCompleted(next);
    const nextLesson = curriculum.lessons[selectedIndex + 1];
    if (nextLesson) selectLesson(nextLesson.id);
  }, [
    checkpointPassed,
    completed,
    curriculum.lessons,
    persistCompleted,
    selectLesson,
    selectedIndex,
    selectedLesson,
  ]);

  const resetProgress = useCallback(() => {
    persistCompleted([]);
    setSelectedOption(null);
    const first = curriculum.lessons[0];
    if (first) selectLesson(first.id);
  }, [curriculum.lessons, persistCompleted, selectLesson]);

  if (!selectedLesson) {
    return (
      <div className="p-[var(--page-pad)] text-sm text-[var(--color-text-secondary)]">
        Tutor could not build a learning path from the current index. Re-index the repository and try again.
      </div>
    );
  }

  const answerWasWrong =
    selectedOption !== null && selectedOption !== selectedLesson.checkpoint.correctIndex;
  const answerWasCorrect =
    selectedOption !== null && selectedOption === selectedLesson.checkpoint.correctIndex;

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-bg-root)]">
      <aside className="hidden w-80 shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-border-default)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={MICRO_LABEL}>RepoWise Tutor</p>
              <p className="mt-1 truncate text-base font-semibold text-[var(--color-text-primary)]">
                {curriculum.repoName}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={MICRO_LABEL}>Course progress</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {progressPct}%
                </p>
              </div>
              <p className="pb-1 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                {completed.length}/{curriculum.lessons.length} lessons
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-inset)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent-primary)] transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <Clock3 className="h-3.5 w-3.5" />
              {totalMinutes} min guided course
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label="Tutor learning path">
          <div className="mb-3 flex items-center justify-between px-2">
            <p className={MICRO_LABEL}>Learning path</p>
            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
              {curriculum.lessons.length} modules
            </span>
          </div>
          <div className="relative space-y-1.5 before:absolute before:bottom-5 before:left-[22px] before:top-5 before:w-px before:bg-[var(--color-border-default)]">
            {curriculum.lessons.map((lesson, index) => {
              const active = lesson.id === selectedLesson.id;
              const done = completed.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => selectLesson(lesson.id)}
                  className={cn(
                    "group relative flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-[var(--color-border-active)] bg-[var(--color-accent-muted)]"
                      : "border-transparent hover:border-[var(--color-border-default)] hover:bg-[var(--color-bg-elevated)]",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-[var(--color-bg-surface)] text-[10px] font-semibold",
                      done
                        ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-bg-root)]"
                        : active
                          ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn(MICRO_LABEL, active && "text-[var(--color-accent-primary)]") }>
                      {lesson.eyebrow}
                    </span>
                    <span className="mt-1 block text-sm font-medium leading-5 text-[var(--color-text-primary)]">
                      {lesson.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                      <Clock3 className="h-3 w-3" /> ~{lesson.estimatedMinutes} min
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--color-border-default)] p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={resetProgress}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset course progress
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[var(--page-pad)] py-3">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  Lesson {selectedIndex + 1} of {curriculum.lessons.length}
                </p>
                <span className="text-[var(--color-text-tertiary)]">/</span>
                <p className="truncate text-sm text-[var(--color-text-secondary)]">
                  {selectedLesson.title}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-primary)]" />
              Indexed facts + source · deterministic
            </div>
          </div>

          <div className="mx-auto mt-3 w-full max-w-7xl lg:hidden">
            <label className="sr-only" htmlFor="tutor-mobile-lesson">Tutor lesson</label>
            <select
              id="tutor-mobile-lesson"
              value={selectedLesson.id}
              onChange={(event) => selectLesson(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {curriculum.lessons.map((lesson, index) => (
                <option key={lesson.id} value={lesson.id}>
                  {index + 1}. {lesson.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-[var(--page-pad)] py-6 sm:py-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 space-y-6">
                <section className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
                  <div className="h-1 w-full bg-[var(--color-accent-primary)]" />
                  <div className="p-5 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent-primary)]">
                        {selectedLesson.eyebrow}
                      </span>
                      <span className={MICRO_LABEL}>Lesson {selectedIndex + 1}</span>
                    </div>
                    <h1 className="mt-4 max-w-4xl text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
                      {selectedLesson.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
                      {selectedLesson.summary}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3">
                        <Clock3 className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                          {selectedLesson.estimatedMinutes}
                        </p>
                        <p className={MICRO_LABEL}>Minutes</p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3">
                        <FileCode2 className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                          {lessonMetrics.sources}
                        </p>
                        <p className={MICRO_LABEL}>Source views</p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3">
                        <GitBranch className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                          {lessonMetrics.flows}
                        </p>
                        <p className={MICRO_LABEL}>Flow hops</p>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3">
                        <ListChecks className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        <p className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">
                          {lessonMetrics.exercises}
                        </p>
                        <p className={MICRO_LABEL}>Exercises</p>
                      </div>
                    </div>

                    {selectedIndex === 0 && (
                      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-border-default)] pt-4">
                        <Map className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {curriculum.lessons.length} lessons · approximately {totalMinutes} minutes total
                        </span>
                        <span className="hidden text-[var(--color-text-tertiary)] sm:inline">·</span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {curriculum.subtitle}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)]">
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={MICRO_LABEL}>Learning objective</p>
                      <h2 className="mt-2 max-w-3xl text-lg font-semibold leading-7 text-[var(--color-text-primary)]">
                        {selectedLesson.objective}
                      </h2>
                    </div>
                  </div>
                </section>

                {selectedLesson.sections.map((section, sectionIndex) => (
                  <section
                    key={section.title}
                    className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
                  >
                    <div className="flex items-start gap-4 border-b border-[var(--color-border-default)] px-5 py-5 sm:px-6">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-accent-primary)]">
                        <SectionIcon section={section} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={MICRO_LABEL}>Step {String(sectionIndex + 1).padStart(2, "0")}</span>
                          {tutorExercisesForSection(section).length > 0 && (
                            <span className="rounded-md border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-accent-primary)]">
                              Practice included
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-lg font-semibold text-[var(--color-text-primary)]">
                          {section.title}
                        </h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                          {section.body}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5 p-5 sm:p-6">
                      {section.facts && section.facts.length > 0 && (
                        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {section.facts.map((fact) => (
                            <div
                              key={`${fact.label}:${fact.value}`}
                              className="min-w-0 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4"
                            >
                              <dt className={MICRO_LABEL}>{fact.label}</dt>
                              <dd
                                className="mt-2 truncate text-sm font-semibold text-[var(--color-text-primary)]"
                                title={fact.value}
                              >
                                {fact.value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {section.items && section.items.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {section.items.map((item, index) => (
                            <div
                              key={`${item.title}:${index}`}
                              className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-[var(--color-accent-primary)]">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                  {item.title}
                                </p>
                              </div>
                              {item.detail && (
                                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                                  {item.detail}
                                </p>
                              )}
                              {item.meta && (
                                <p className="mt-2 border-t border-[var(--color-border-default)] pt-2 font-mono text-[10px] leading-5 text-[var(--color-text-tertiary)]">
                                  {item.meta}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {section.flow && section.flow.length > 0 && (
                        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4 sm:p-5">
                          <div className="mb-4 flex items-center gap-2">
                            <Route className="h-4 w-4 text-[var(--color-accent-primary)]" />
                            <p className={MICRO_LABEL}>Execution / dependency trace</p>
                          </div>
                          <ol className="space-y-3">
                            {section.flow.map((step, index) => (
                              <li key={`${step.from}:${step.to}:${index}`} className="relative pl-9">
                                {index < section.flow!.length - 1 && (
                                  <span className="absolute bottom-[-14px] left-[13px] top-7 w-px bg-[var(--color-border-default)]" />
                                )}
                                <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-active)] bg-[var(--color-bg-surface)] font-mono text-[10px] font-semibold text-[var(--color-accent-primary)]">
                                  {index + 1}
                                </span>
                                <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3.5">
                                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                                    <span className="break-words">{step.from}</span>
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                                    <span className="break-words">{step.to}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-start gap-2">
                                    <span className="rounded-md border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent-primary)]">
                                      {step.relation}
                                    </span>
                                    <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                                      {step.explanation}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {section.evidence && section.evidence.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FileCode2 className="h-4 w-4 text-[var(--color-accent-primary)]" />
                              <p className={MICRO_LABEL}>Code walkthrough</p>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                              {section.evidence.length} source view{section.evidence.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {section.evidence.map((evidence, index) => (
                            <EvidenceCard
                              key={`${evidence.path ?? evidence.title}:${index}`}
                              evidence={evidence}
                              index={index}
                            />
                          ))}
                        </div>
                      )}

                      <TutorSectionExercises section={section} />
                    </div>
                  </section>
                ))}

                <section className="overflow-hidden rounded-2xl border border-[var(--color-border-active)] bg-[var(--color-bg-surface)]">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-accent-muted)] px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-active)] bg-[var(--color-bg-surface)] text-[var(--color-accent-primary)]">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={MICRO_LABEL}>Lesson checkpoint</p>
                        <p className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
                          Prove that the core idea is clear
                        </p>
                      </div>
                    </div>
                    {completed.includes(selectedLesson.id) && (
                      <span className="flex items-center gap-1.5 rounded-md border border-[var(--color-border-active)] bg-[var(--color-bg-surface)] px-2 py-1 text-xs font-medium text-[var(--color-accent-primary)]">
                        <Check className="h-3.5 w-3.5" /> Completed
                      </span>
                    )}
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="max-w-3xl text-base font-semibold leading-7 text-[var(--color-text-primary)]">
                      {selectedLesson.checkpoint.question}
                    </p>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      {selectedLesson.checkpoint.options.map((option, index) => {
                        const chosen = selectedOption === index;
                        const correct = index === selectedLesson.checkpoint.correctIndex;
                        const showCorrect = answerWasCorrect && correct;
                        const showWrong = answerWasWrong && chosen;
                        return (
                          <button
                            key={`${option}:${index}`}
                            type="button"
                            disabled={completed.includes(selectedLesson.id)}
                            onClick={() => setSelectedOption(index)}
                            className={cn(
                              "group flex min-h-14 items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                              showCorrect
                                ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                                : showWrong
                                  ? "border-[var(--color-border-strong)] bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)]"
                                  : chosen
                                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                                    : "border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-semibold",
                                chosen
                                  ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                                  : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
                              )}
                            >
                              {String.fromCharCode(65 + index)}
                            </span>
                            <span className="pt-0.5 leading-5">{option}</span>
                          </button>
                        );
                      })}
                    </div>

                    {answerWasCorrect && (
                      <div className="mt-5 rounded-xl border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] p-4">
                        <div className="flex items-start gap-3">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-primary)]" />
                          <div>
                            <p className={MICRO_LABEL}>Correct — why</p>
                            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                              {selectedLesson.checkpoint.explanation}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {answerWasWrong && (
                      <div className="mt-5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
                        Review the lesson evidence and try again. The lesson remains incomplete until the indexed answer is selected.
                      </div>
                    )}
                  </div>
                </section>

                <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={selectedIndex === 0}
                    onClick={() => {
                      const previous = curriculum.lessons[selectedIndex - 1];
                      if (previous) selectLesson(previous.id);
                    }}
                    className="gap-1.5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous lesson
                  </Button>

                  {selectedIndex < curriculum.lessons.length - 1 ? (
                    <Button
                      size="sm"
                      disabled={!checkpointPassed}
                      onClick={completeAndContinue}
                      className="gap-1.5"
                    >
                      Complete & continue
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" disabled={!checkpointPassed} onClick={markComplete} className="gap-1.5">
                      <Check className="h-4 w-4" />
                      Finish course
                    </Button>
                  )}
                </div>
              </div>

              <aside className="hidden xl:block">
                <div className="sticky top-0 space-y-4">
                  <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
                    <div className="flex items-center gap-2">
                      <Map className="h-4 w-4 text-[var(--color-accent-primary)]" />
                      <p className={MICRO_LABEL}>In this lesson</p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Learning objective</p>
                      </div>
                      {selectedLesson.sections.map((section, index) => (
                        <div key={section.title} className="flex items-start gap-2.5">
                          <Circle className="mt-1 h-2.5 w-2.5 shrink-0 fill-[var(--color-border-default)] text-[var(--color-border-default)]" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-5 text-[var(--color-text-primary)]">
                              {index + 1}. {section.title}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                              {(section.evidence?.length ?? 0) > 0 ? `${section.evidence!.length} source` : "guided concept"}
                              {tutorExercisesForSection(section).length > 0
                                ? ` · ${tutorExercisesForSection(section).length} practice`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-start gap-2.5">
                        <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                        <p className="text-xs leading-5 text-[var(--color-text-secondary)]">Knowledge checkpoint</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-[var(--color-accent-primary)]" />
                      <p className={MICRO_LABEL}>Teaching method</p>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--color-text-secondary)]">
                      Tutor teaches from RepoWise index data, source excerpts, symbol relationships, tests and execution flows. The lesson does not rely on AI-generated repository facts.
                    </p>
                    {curriculum.status.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {curriculum.status.slice(0, 5).map((status) => (
                          <span
                            key={status}
                            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 py-1 font-mono text-[9px] text-[var(--color-text-tertiary)]"
                          >
                            {status}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
