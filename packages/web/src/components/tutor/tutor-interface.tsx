"use client";

import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@repowise-dev/ui/ui";
import { cn } from "@repowise-dev/ui/lib/cn";
import type { TutorCurriculum, TutorEvidence } from "./tutor-curriculum";

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

function EvidenceCard({ evidence, index }: { evidence: TutorEvidence; index: number }) {
  return (
    <article className="border-b border-[var(--color-border-default)] py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{evidence.title}</h4>
          {evidence.path && (
            <p className="mt-1 break-all font-mono text-[11px] text-[var(--color-accent-primary)]">
              {evidence.path}
            </p>
          )}
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {evidence.explanation}
          </p>

          {evidence.signals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {evidence.signals.map((signal) => (
                <span
                  key={signal}
                  className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-tertiary)]"
                >
                  {signal}
                </span>
              ))}
            </div>
          )}

          {evidence.code && (
            <div className="mt-4 overflow-hidden rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-inset)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-default)] px-3 py-2">
                <span className={MICRO_LABEL}>Source excerpt</span>
                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                  {evidence.lineStart && evidence.lineEnd
                    ? `lines ${evidence.lineStart}–${evidence.lineEnd}`
                    : evidence.language || "indexed source"}
                </span>
              </div>
              <pre className="max-h-80 overflow-auto p-4 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                <code>{evidence.code}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
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
  }, [checkpointPassed, completed, curriculum.lessons, persistCompleted, selectLesson, selectedIndex, selectedLesson]);

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
      <aside className="hidden w-72 shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-border-default)] p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-accent-primary)]">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Tutor</p>
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">{curriculum.repoName}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className={MICRO_LABEL}>Progress</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                {completed.length}/{curriculum.lessons.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-inset)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent-primary)] transition-[width] duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Tutor learning path">
          <p className={cn(MICRO_LABEL, "mb-2 px-2")}>System-led course</p>
          <div className="space-y-1">
            {curriculum.lessons.map((lesson, index) => {
              const active = lesson.id === selectedLesson.id;
              const done = completed.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => selectLesson(lesson.id)}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors",
                    active
                      ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
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
                    <span className="block text-sm font-medium">{lesson.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--color-text-tertiary)]">
                      ~{lesson.estimatedMinutes} min
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-[var(--color-border-default)] p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={resetProgress}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset learning progress
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[var(--page-pad)] py-3">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {selectedLesson.eyebrow} · {selectedLesson.title}
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
                {curriculum.status.join(" · ")}
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-primary)]" />
              Taught from index + source · no AI
            </div>
          </div>

          <div className="mx-auto mt-3 w-full max-w-5xl lg:hidden">
            <label className="sr-only" htmlFor="tutor-mobile-lesson">Tutor lesson</label>
            <select
              id="tutor-mobile-lesson"
              value={selectedLesson.id}
              onChange={(event) => selectLesson(event.target.value)}
              className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
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
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-[var(--page-pad)] py-8 sm:py-10">
            {selectedIndex === 0 && (
              <section className="border-b border-[var(--color-border-default)] pb-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={MICRO_LABEL}>Generated from current RepoWise index + local source</span>
                  <span className="text-[var(--color-text-tertiary)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent-primary)]">
                    {curriculum.lessons.length} lessons · ~{totalMinutes} min
                  </span>
                </div>
                <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
                  Learn {curriculum.repoName} without assembling the story yourself
                </h1>
                <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
                  {curriculum.subtitle}
                </p>
              </section>
            )}

            <section>
              <p className={MICRO_LABEL}>Objective</p>
              <h2 className="mt-2 max-w-3xl text-xl font-semibold text-[var(--color-text-primary)]">
                {selectedLesson.objective}
              </h2>
              <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
                {selectedLesson.summary}
              </p>
            </section>

            {selectedLesson.sections.map((section) => (
              <section key={section.title} className="border-t border-[var(--color-border-default)] pt-6">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{section.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                  {section.body}
                </p>

                {section.facts && section.facts.length > 0 && (
                  <dl className="mt-5 grid grid-cols-2 border-y border-[var(--color-border-default)] sm:grid-cols-3">
                    {section.facts.map((fact) => (
                      <div key={`${fact.label}:${fact.value}`} className="min-w-0 border-b border-[var(--color-border-subtle)] px-3 py-4 last:border-b-0 sm:border-b-0">
                        <dt className={MICRO_LABEL}>{fact.label}</dt>
                        <dd className="mt-1 truncate text-sm font-medium text-[var(--color-text-primary)]" title={fact.value}>
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {section.items && section.items.length > 0 && (
                  <div className="mt-5 border-t border-[var(--color-border-default)]">
                    {section.items.map((item, index) => (
                      <div key={`${item.title}:${index}`} className="flex items-start gap-3 border-b border-[var(--color-border-default)] py-4">
                        <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                          {item.detail && (
                            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{item.detail}</p>
                          )}
                          {item.meta && (
                            <p className="mt-1 font-mono text-[11px] leading-5 text-[var(--color-text-tertiary)]">{item.meta}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section.flow && section.flow.length > 0 && (
                  <ol className="mt-5 border-t border-[var(--color-border-default)]">
                    {section.flow.map((step, index) => (
                      <li key={`${step.from}:${step.to}:${index}`} className="border-b border-[var(--color-border-default)] py-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                          <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{String(index + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 break-words">{step.from}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                          <span className="min-w-0 break-words">{step.to}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-start gap-2 pl-7">
                          <span className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-accent-primary)]">
                            {step.relation}
                          </span>
                          <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">{step.explanation}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {section.evidence && section.evidence.length > 0 && (
                  <div className="mt-5 border-t border-[var(--color-border-default)]">
                    {section.evidence.map((evidence, index) => (
                      <EvidenceCard key={`${evidence.path ?? evidence.title}:${index}`} evidence={evidence} index={index} />
                    ))}
                  </div>
                )}
              </section>
            ))}

            <section className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className={MICRO_LABEL}>Knowledge checkpoint</p>
                {completed.includes(selectedLesson.id) && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-primary)]">
                    <Check className="h-3.5 w-3.5" /> Completed
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text-primary)]">
                {selectedLesson.checkpoint.question}
              </p>
              <div className="mt-4 grid gap-2">
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
                        "rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                        showCorrect
                          ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                          : showWrong
                            ? "border-[var(--color-border-strong)] bg-[var(--color-bg-inset)] text-[var(--color-text-secondary)]"
                            : chosen
                              ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                              : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-text-primary)]",
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
                <div className="mt-4 border-l-2 border-[var(--color-accent-primary)] pl-4">
                  <p className={MICRO_LABEL}>Correct — why</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {selectedLesson.checkpoint.explanation}
                  </p>
                </div>
              )}
              {answerWasWrong && (
                <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                  Not quite. Review the evidence above and choose again; Tutor will not mark the lesson complete until the checkpoint is correct.
                </p>
              )}
            </section>

            <div className="flex flex-col gap-3 border-t border-[var(--color-border-default)] pt-6 sm:flex-row sm:items-center sm:justify-between">
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
                Previous
              </Button>

              {selectedIndex < curriculum.lessons.length - 1 ? (
                <Button size="sm" disabled={!checkpointPassed} onClick={completeAndContinue} className="gap-1.5">
                  Complete lesson & continue
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
        </div>
      </main>
    </div>
  );
}
