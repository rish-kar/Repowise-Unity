"use client";

import { useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { Button } from "@repowise-dev/ui/ui";
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
    <div className="border-b border-[var(--color-border-default)] py-5 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--color-text-tertiary)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-6 text-[var(--color-text-primary)]">
            {exercise.prompt}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {exercise.instruction}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={answer}
              onChange={(event) => {
                setAnswer(event.target.value);
                if (checked) setChecked(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && answer.trim()) setChecked(true);
              }}
              placeholder="Type your answer"
              className="min-w-0 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent-primary)]"
              aria-label={exercise.prompt}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!answer.trim()}
              onClick={() => setChecked(true)}
            >
              Check answer
            </Button>
          </div>

          {correct && (
            <div className="mt-3 flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-primary)]" />
              <p>{exercise.explanation}</p>
            </div>
          )}
          {wrong && (
            <div className="mt-3 flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p>That does not match the indexed answer yet.</p>
                <p className="mt-1 flex items-start gap-1.5 text-[var(--color-text-tertiary)]">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {exercise.hint}
                </p>
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
    <div className="mt-6 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4">
      <div className="border-b border-[var(--color-border-default)] py-4">
        <p className={MICRO_LABEL}>Hands-on practice</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          These are deterministic exercises checked against RepoWise&apos;s indexed facts — not another multiple-choice quiz.
        </p>
      </div>
      {exercises.map((exercise, index) => (
        <ExerciseCard key={exercise.id} exercise={exercise} index={index} />
      ))}
    </div>
  );
}
