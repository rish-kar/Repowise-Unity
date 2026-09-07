"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@repowise-dev/ui/ui";
import { cn } from "@repowise-dev/ui/lib/cn";
import type { TutorCurriculum } from "./tutor-curriculum";

interface TutorInterfaceProps {
  repoId: string;
  curriculum: TutorCurriculum;
}

const MICRO_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";

function progressKey(repoId: string) {
  return `repowise:tutor:${repoId}:completed-v2`;
}

function selectedKey(repoId: string) {
  return `repowise:tutor:${repoId}:selected-v2`;
}

export function TutorInterface({ repoId, curriculum }: TutorInterfaceProps) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(curriculum.lessons[0]?.id ?? "");
  const [answerVisible, setAnswerVisible] = useState(false);

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
      // Progress persistence is optional; the deterministic lessons still work.
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
      setAnswerVisible(false);
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

  const markComplete = useCallback(() => {
    if (!selectedLesson) return;
    const next = completed.includes(selectedLesson.id)
      ? completed
      : [...completed, selectedLesson.id];
    persistCompleted(next);
  }, [completed, persistCompleted, selectedLesson]);

  const completeAndContinue = useCallback(() => {
    if (!selectedLesson) return;
    markComplete();
    const nextLesson = curriculum.lessons[selectedIndex + 1];
    if (nextLesson) selectLesson(nextLesson.id);
  }, [curriculum.lessons, markComplete, selectLesson, selectedIndex, selectedLesson]);

  const resetProgress = useCallback(() => {
    persistCompleted([]);
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
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                {curriculum.repoName}
              </p>
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
          <p className={cn(MICRO_LABEL, "mb-2 px-2")}>System-led path</p>
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
              No AI required
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
                  <span className={MICRO_LABEL}>Generated from current RepoWise index</span>
                  <span className="text-[var(--color-text-tertiary)]">·</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent-primary)]">
                    {curriculum.lessons.length} lessons · ~{totalMinutes} min
                  </span>
                </div>
                <h1 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
                  Learn {curriculum.repoName} in the order the codebase suggests
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
                  <ul className="mt-5 border-t border-[var(--color-border-default)]">
                    {section.items.map((item, index) => {
                      const content = (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="min-w-0 break-words text-sm font-medium text-[var(--color-text-primary)]">
                                {item.title}
                              </span>
                            </div>
                            {item.detail && (
                              <p className="mt-1 pl-7 text-sm leading-6 text-[var(--color-text-secondary)]">
                                {item.detail}
                              </p>
                            )}
                            {item.meta && (
                              <p className="mt-1 pl-7 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                                {item.meta}
                              </p>
                            )}
                          </div>
                          {item.href && <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />}
                        </>
                      );

                      return (
                        <li key={`${item.title}:${index}`} className="border-b border-[var(--color-border-default)]">
                          {item.href ? (
                            <Link
                              href={item.href}
                              className="flex items-start gap-3 py-4 transition-colors hover:bg-[var(--color-bg-overlay)]"
                            >
                              {content}
                            </Link>
                          ) : (
                            <div className="flex items-start gap-3 py-4">{content}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}

            <section className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5">
              <p className={MICRO_LABEL}>Checkpoint</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[var(--color-text-primary)]">
                {selectedLesson.checkpoint.question}
              </p>
              {answerVisible ? (
                <div className="mt-4 border-l-2 border-[var(--color-accent-primary)] pl-4">
                  <p className={MICRO_LABEL}>Answer from the index</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {selectedLesson.checkpoint.answer}
                  </p>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setAnswerVisible(true)}>
                  Reveal answer
                </Button>
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

              <div className="flex items-center gap-2 sm:justify-end">
                {!completed.includes(selectedLesson.id) && (
                  <Button variant="ghost" size="sm" onClick={markComplete} className="gap-1.5">
                    <Check className="h-4 w-4" />
                    Mark complete
                  </Button>
                )}
                {selectedIndex < curriculum.lessons.length - 1 ? (
                  <Button size="sm" onClick={completeAndContinue} className="gap-1.5">
                    Complete & continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={markComplete} className="gap-1.5">
                    <Check className="h-4 w-4" />
                    Finish path
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
