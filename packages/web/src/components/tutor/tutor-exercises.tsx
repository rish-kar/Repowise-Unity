"use client";

import { useState } from "react";
import { Check, Keyboard, Lightbulb, RotateCcw, X } from "lucide-react";
import { Button } from "@repowise-dev/ui/ui";
import { cn } from "@repowise-dev/ui/lib/cn";
import type { TutorSection } from "./tutor-curriculum";
import {
  isTutorExerciseCorrect,
  tutorExercisesForSection,
  type TutorExercise,
} from "./tutor-enrichment";

const MICRO_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";

function ExerciseCard({ exercise, index }: { exercise: TutorExercise; index: number }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = checked && isTutorExerciseCorrect(exercise, answer);
  const wrong = checked && !correct;

  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] font-mono text-[10px] font-semibold text-[var(--color-accent-primary)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6 text-[var(--color-text-primary)]">
            {exercise.prompt}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {exercise.instruction}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (checked) setChecked(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && answer.trim()) setChecked(true);
                }}
                placeholder="Type the indexed answer"
                className={cn(
                  "w-full rounded-lg border bg-[var(--color-bg-elevated)] py-2.5 pl-10 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)]",
                  correct
                    ? "border-[var(--color-accent-primary)]"
                    : wrong
                      ? "border-[var(--color-border-strong)]"
                      : "border-[var(--color-border-default)] focus:border-[var(--color-accent-primary)]",
                )}
                aria-label={exercise.prompt}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!answer.trim()}
              onClick={() => setChecked(true)}
              className="h-10 px-4"
            >
              Check answer
            </Button>
          </div>

          {correct && (
            <div className="mt-4 rounded-lg border border-[var(--color-border-active)] bg-[var(--color-accent-muted)] p-3.5">
              <div className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-primary)]" />
                <div>
                  <p className={MICRO_LABEL}>Matched indexed evidence</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {exercise.explanation}
                  </p>
                </div>
              </div>
            </div>
          )}

          {wrong && (
            <div className="mt-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-inset)] p-3.5">
              <div className="flex items-start gap-2.5">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    No match yet
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm leading-6 text-[var(--color-text-tertiary)]">
                    <Lightbulb className="mt-1 h-3.5 w-3.5 shrink-0" />
                    {exercise.hint}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAnswer("");
                      setChecked(false);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent-primary)] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TutorSectionExercises({ section }: { section: TutorSection }) {
  const exercises = tutorExercisesForSection(section);
  if (!exercises.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border-active)] bg-[var(--color-bg-elevated)]">
      <div className="flex items-start gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-accent-muted)] px-4 py-4 sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-active)] bg-[var(--color-bg-surface)] text-[var(--color-accent-primary)]">
          <Keyboard className="h-4 w-4" />
        </div>
        <div>
          <p className={MICRO_LABEL}>Hands-on practice</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
            Work with real repository facts, not multiple-choice guesses
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
            Answers are checked against RepoWise&apos;s indexed symbols, files, tests and flows.
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:p-4">
        {exercises.map((exercise, index) => (
          <ExerciseCard key={exercise.id} exercise={exercise} index={index} />
        ))}
      </div>
    </div>
  );
}
