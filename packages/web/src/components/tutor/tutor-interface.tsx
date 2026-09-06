"use client";

import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  RotateCcw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import type { ChatUIMessage } from "@repowise-dev/types/chat";
import { ChatComposer } from "@repowise-dev/ui/chat/chat-composer";
import { ChatMessage } from "@repowise-dev/ui/chat/chat-message";
import { Button } from "@repowise-dev/ui/ui";
import { cn } from "@repowise-dev/ui/lib/cn";
import { getProviders } from "@/lib/api/providers";
import { getRepoStats } from "@/lib/api/repos";
import { pageHref } from "@/lib/utils/page-href";
import { ModelSelector } from "@/components/chat/model-selector";
import { useRepositoryChat } from "@/components/chat/repository-chat-provider";
import {
  TUTOR_LESSONS,
  TUTOR_LEVELS,
  buildTutorMessage,
  extractTutorQuestion,
  type TutorLevel,
} from "./tutor-prompt";

interface TutorInterfaceProps {
  repoId: string;
  repoName: string;
  defaultBranch?: string;
  headCommit?: string;
}

const MICRO_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]";

function storageKey(repoId: string, suffix: string) {
  return `repowise:tutor:${repoId}:${suffix}`;
}

export function TutorInterface({
  repoId,
  repoName,
  defaultBranch,
  headCommit,
}: TutorInterfaceProps) {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancel,
    reset,
    selectedProvider,
    selectedModel,
    selectModel,
  } = useRepositoryChat();

  const [level, setLevel] = useState<TutorLevel>("beginner");
  const [selectedLessonId, setSelectedLessonId] = useState(TUTOR_LESSONS[0]!.id);
  const [completed, setCompleted] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const didReset = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { data: providers } = useSWR(
    `providers:${repoId}`,
    () => getProviders(repoId),
    { revalidateOnFocus: false },
  );
  const { data: stats } = useSWR(
    `repo-stats:${repoId}`,
    () => getRepoStats(repoId),
    { revalidateOnFocus: false },
  );

  const anyConfigured =
    providers === undefined || providers.providers.some((provider) => provider.configured);

  useEffect(() => {
    if (didReset.current) return;
    didReset.current = true;
    reset();

    try {
      const storedLevel = window.localStorage.getItem(storageKey(repoId, "level"));
      if (
        storedLevel === "beginner" ||
        storedLevel === "intermediate" ||
        storedLevel === "advanced"
      ) {
        setLevel(storedLevel);
      }

      const storedCompleted = JSON.parse(
        window.localStorage.getItem(storageKey(repoId, "completed")) ?? "[]",
      ) as unknown;
      if (Array.isArray(storedCompleted)) {
        setCompleted(
          storedCompleted.filter(
            (value): value is string =>
              typeof value === "string" &&
              TUTOR_LESSONS.some((lesson) => lesson.id === value),
          ),
        );
      }
    } catch {
      // Local progress is a convenience only; Tutor works without storage.
    }
  }, [repoId, reset]);

  useEffect(() => {
    if (messages.length === 0) return;
    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isStreaming]);

  const selectedLesson =
    TUTOR_LESSONS.find((lesson) => lesson.id === selectedLessonId) ?? TUTOR_LESSONS[0]!;

  const displayMessages = useMemo<ChatUIMessage[]>(
    () =>
      messages.map((message) =>
        message.role === "user"
          ? { ...message, text: extractTutorQuestion(message.text) }
          : message,
      ),
    [messages],
  );

  const setTutorLevel = useCallback(
    (next: TutorLevel) => {
      setLevel(next);
      try {
        window.localStorage.setItem(storageKey(repoId, "level"), next);
      } catch {}
    },
    [repoId],
  );

  const toggleLessonComplete = useCallback(
    (lessonId: string) => {
      setCompleted((current) => {
        const next = current.includes(lessonId)
          ? current.filter((id) => id !== lessonId)
          : [...current, lessonId];
        try {
          window.localStorage.setItem(
            storageKey(repoId, "completed"),
            JSON.stringify(next),
          );
        } catch {}
        return next;
      });
    },
    [repoId],
  );

  const sendTutorMessage = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || isStreaming || !anyConfigured) return;

      const wrapped = buildTutorMessage({
        question: text,
        level,
        lesson: selectedLesson,
        repoName,
      });

      await sendMessage(wrapped, {
        context: { kind: "chat", label: "Tutor" },
        ...(selectedProvider ? { provider: selectedProvider } : {}),
        ...(selectedModel ? { model: selectedModel } : {}),
      });
    },
    [
      anyConfigured,
      isStreaming,
      level,
      repoName,
      selectedLesson,
      selectedModel,
      selectedProvider,
      sendMessage,
    ],
  );

  const startLesson = useCallback(() => {
    void sendTutorMessage(selectedLesson.starter);
  }, [selectedLesson, sendTutorMessage]);

  const startNewSession = useCallback(() => {
    cancel();
    reset();
    setDraft("");
  }, [cancel, reset]);

  const progressPct = Math.round((completed.length / TUTOR_LESSONS.length) * 100);
  const status = [
    stats ? `${stats.file_count.toLocaleString()} files` : null,
    stats && stats.symbol_count > 0
      ? `${stats.symbol_count.toLocaleString()} symbols`
      : null,
    stats ? `${Math.round(stats.doc_coverage_pct)}% documented` : null,
    defaultBranch,
    headCommit ? headCommit.slice(0, 7) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full min-h-0 bg-[var(--color-bg-root)]">
      <aside className="hidden w-72 shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-bg-surface)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--color-border-default)] p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-accent-primary)]">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Tutor
              </p>
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">
                {repoName}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <span className={MICRO_LABEL}>Progress</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--color-text-tertiary)]">
                {completed.length}/{TUTOR_LESSONS.length}
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

        <div className="border-b border-[var(--color-border-default)] p-4">
          <p className={cn(MICRO_LABEL, "mb-2")}>Depth</p>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-[var(--color-bg-inset)] p-1">
            {TUTOR_LEVELS.map((item) => {
              const active = item.id === level;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTutorLevel(item.id)}
                  className={cn(
                    "rounded px-2 py-1.5 text-[11px] transition-colors",
                    active
                      ? "bg-[var(--color-bg-elevated)] font-medium text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Tutor lessons">
          <p className={cn(MICRO_LABEL, "mb-2 px-2")}>Learning path</p>
          <div className="space-y-1">
            {TUTOR_LESSONS.map((lesson) => {
              const active = lesson.id === selectedLesson.id;
              const done = completed.includes(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={cn(
                    "group flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors",
                    active
                      ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] hover:text-[var(--color-text-primary)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      done
                        ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-bg-root)]"
                        : active
                          ? "border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{lesson.title}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--color-text-tertiary)]">
                      {lesson.eyebrow}
                    </span>
                  </span>
                  {active && (
                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                  )}
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
            onClick={startNewSession}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New tutor session
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-[var(--page-pad)] py-3">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent-primary)]" />
                <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                  {selectedLesson.title}
                </p>
              </div>
              <p className="mt-0.5 truncate text-xs text-[var(--color-text-tertiary)]">
                {selectedLesson.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleLessonComplete(selectedLesson.id)}
              className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors sm:flex",
                completed.includes(selectedLesson.id)
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)] text-[var(--color-accent-primary)]"
                  : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)]",
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {completed.includes(selectedLesson.id) ? "Completed" : "Mark complete"}
            </button>
          </div>

          <div className="mx-auto mt-3 grid w-full max-w-4xl grid-cols-2 gap-2 lg:hidden">
            <label className="sr-only" htmlFor="tutor-mobile-lesson">
              Tutor lesson
            </label>
            <select
              id="tutor-mobile-lesson"
              value={selectedLesson.id}
              onChange={(event) => setSelectedLessonId(event.target.value)}
              className="min-w-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {TUTOR_LESSONS.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="tutor-mobile-level">
              Tutor depth
            </label>
            <select
              id="tutor-mobile-level"
              value={level}
              onChange={(event) => setTutorLevel(event.target.value as TutorLevel)}
              className="min-w-0 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {TUTOR_LEVELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {displayMessages.length === 0 ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-9 px-[var(--page-pad)] py-10 sm:py-14">
              <div className="max-w-2xl">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-accent-primary)]">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <p className={cn(MICRO_LABEL, "mb-2")}>RepoWise Tutor</p>
                <h1 className="text-[24px] font-semibold leading-tight text-[var(--color-text-primary)] sm:text-[28px]">
                  Learn {repoName} one layer at a time
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-7 text-[var(--color-text-secondary)]">
                  Tutor uses the same RepoWise index, knowledge graph, documentation,
                  Git history, and code-search tools as Chat, but explains the evidence
                  as a guided lesson for your experience level.
                </p>
                {status && (
                  <p className="mt-4 font-mono text-xs tabular-nums text-[var(--color-text-tertiary)]">
                    {status}
                  </p>
                )}
              </div>

              <section className="max-w-2xl">
                <p className={cn(MICRO_LABEL, "mb-2")}>{selectedLesson.eyebrow}</p>
                <div className="border-y border-[var(--color-border-default)] py-5">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {selectedLesson.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    {selectedLesson.description}
                  </p>
                  <button
                    type="button"
                    onClick={startLesson}
                    disabled={!anyConfigured}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-accent-primary)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Teach me this lesson
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <section className="max-w-2xl">
                <p className={cn(MICRO_LABEL, "mb-1")}>Or ask directly</p>
                <ul className="border-t border-[var(--color-border-default)]">
                  {[
                    "Explain this repository to me like it is my first day on the team.",
                    "Which five files should I understand first, and in what order?",
                    "Show me one important code path and explain every hand-off.",
                  ].map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        onClick={() => setDraft(question)}
                        className="group flex w-full items-center gap-3 border-b border-[var(--color-border-default)] py-3 text-left text-[15px] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                      >
                        <span className="min-w-0 flex-1">{question}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-[var(--page-pad)] py-8">
              {displayMessages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  repoId={repoId}
                  buildCitationHref={(source) => pageHref(repoId, source.pageId)}
                />
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--color-border-default)] bg-[var(--color-bg-root)] px-[var(--page-pad)] pb-4 pt-3">
          <div className="mx-auto w-full max-w-4xl">
            {!anyConfigured && (
              <div className="mb-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                Tutor uses RepoWise Chat to reason over the index. Configure a chat
                provider in{" "}
                <Link
                  href="/settings"
                  className="text-[var(--color-accent-primary)] hover:underline"
                >
                  Settings
                </Link>
                {" "}to begin.
              </div>
            )}

            {error && (
              <div className="mb-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                {error}
              </div>
            )}

            <ChatComposer
              value={draft}
              onValueChange={setDraft}
              onSend={sendTutorMessage}
              onCancel={cancel}
              isStreaming={isStreaming}
              placeholder={`Ask your ${level} tutor about ${selectedLesson.title.toLowerCase()}…`}
              disabled={!anyConfigured}
              autoFocus
              footer={
                <div className="flex items-center gap-2">
                  <ModelSelector
                    repoId={repoId}
                    activeProvider={selectedProvider}
                    activeModel={selectedModel}
                    onSelect={selectModel}
                  />
                  <span className="hidden text-[11px] text-[var(--color-text-tertiary)] sm:inline">
                    {TUTOR_LEVELS.find((item) => item.id === level)?.label} ·{" "}
                    {selectedLesson.title}
                  </span>
                </div>
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
