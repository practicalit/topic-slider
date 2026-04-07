"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { TeachingContextGuard } from "@/components/teaching-context-guard";
import { ContentSlideView } from "@/components/content-slide-view";
import { isImageBodyPreviewable } from "@/components/content-media-upload";
import {
  JeopardyPlayMode,
  type JeopardyCategoryDTO,
  type JeopardySettingsDTO,
} from "@/components/jeopardy-play-mode";
import type { ContentKind } from "@/types/content";
import { isElementFullscreen, toggleElementFullscreen } from "@/lib/fullscreen";
import { contentKindShort, slideSnippetText } from "@/lib/slide-outline";
import { GameWinnerSplash } from "@/components/game-winner-splash";
import { parseSlideThemeFromDb } from "@/lib/slide-theme";

interface Content {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;
  sortOrder: number;
  slideTheme?: unknown | null;
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
  answer: number;
}

interface Topic {
  id: string;
  title: string;
  description: string | null;
  taught: boolean;
  contents: Content[];
  quizzes: Quiz[];
}

type Mode = "slides" | "quiz" | "jeopardy";

function hasJeopardyCells(categories: JeopardyCategoryDTO[]) {
  return categories.some((c) => c.cells.length > 0);
}

const DEFAULT_JEOPARDY_SETTINGS: JeopardySettingsDTO = {
  columns: 5,
  rows: 5,
  teamCount: 2,
};

export default function PresentTopicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [jeopardyCategories, setJeopardyCategories] = useState<JeopardyCategoryDTO[]>([]);
  const [jeopardySettings, setJeopardySettings] =
    useState<JeopardySettingsDTO>(DEFAULT_JEOPARDY_SETTINGS);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [mode, setMode] = useState<Mode>("slides");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetch(`/api/topics/${id}`), fetch(`/api/topics/${id}/jeopardy`)])
      .then(async ([topicRes, jeopardyRes]) => {
        const topicData = topicRes.ok ? await topicRes.json() : null;
        const jeopardyData = jeopardyRes.ok ? await jeopardyRes.json() : { categories: [] };
        if (cancelled) return;
        if (topicData) {
          setTopic(topicData);
          setCurrentSlide(0);
        } else {
          setTopic(null);
        }
        setJeopardyCategories(
          Array.isArray(jeopardyData.categories) ? jeopardyData.categories : []
        );
        if (jeopardyData.settings && typeof jeopardyData.settings === "object") {
          const s = jeopardyData.settings as Record<string, unknown>;
          const n = (v: unknown, d: number) =>
            typeof v === "number" && Number.isFinite(v) ? v : d;
          setJeopardySettings({
            columns: n(s.columns, DEFAULT_JEOPARDY_SETTINGS.columns),
            rows: n(s.rows, DEFAULT_JEOPARDY_SETTINGS.rows),
            teamCount: n(s.teamCount, DEFAULT_JEOPARDY_SETTINGS.teamCount),
          });
        } else {
          setJeopardySettings(DEFAULT_JEOPARDY_SETTINGS);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function markAsTaught() {
    await fetch(`/api/topics/${id}/taught`, { method: "POST" });
    setTopic((prev) => (prev ? { ...prev, taught: true } : prev));
  }

  const slides = topic?.contents ?? [];
  const totalSlides = slides.length;
  const showJeopardy = hasJeopardyCells(jeopardyCategories);

  let main: React.ReactNode;
  if (loading || !topic) {
    main = (
      <div className="flex justify-center py-20 text-gray-500 font-medium">
        {loading ? "Loading..." : "Topic not found or access denied."}
      </div>
    );
  } else if (mode === "quiz") {
    main = (
      <QuizMode
        topic={topic}
        onBack={() => setMode("slides")}
        onFinish={() => router.push("/present")}
      />
    );
  } else if (mode === "jeopardy") {
    main = (
      <JeopardyPlayMode
        topicId={topic.id}
        topicTitle={topic.title}
        categories={jeopardyCategories}
        settings={jeopardySettings}
        onBack={() => setMode("slides")}
        onFinish={() => router.push("/present")}
      />
    );
  } else if (totalSlides === 0) {
    main = (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{topic.title}</h1>
              <p className="text-sm text-gray-600">No slides yet</p>
            </div>
            <div className="flex gap-2">
              {!topic.taught && (
                <button
                  onClick={markAsTaught}
                  className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  ✓ Mark as Taught
                </button>
              )}
              {showJeopardy && (
                <button
                  onClick={() => setMode("jeopardy")}
                  className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-amber-300/60"
                >
                  Jeopardy →
                </button>
              )}
              {topic.quizzes.length > 0 && (
                <button
                  onClick={() => setMode("quiz")}
                  className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-200"
                >
                  Start Quiz →
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="text-center max-w-md text-gray-600">
            <p className="text-lg font-medium text-gray-900 mb-2">No content blocks</p>
            <p className="text-sm">
              Add text, slide, image, or video blocks in the admin panel for this topic.
            </p>
          </div>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-4">
          <div className="max-w-5xl mx-auto flex justify-end">
            <button
              onClick={() => {
                if (showJeopardy) {
                  setMode("jeopardy");
                } else if (topic.quizzes.length > 0) {
                  setMode("quiz");
                } else {
                  markAsTaught();
                  router.push("/present");
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors border border-indigo-200"
            >
              {showJeopardy ? "Jeopardy →" : topic.quizzes.length > 0 ? "Start Quiz →" : "Finish ✓"}
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    main = (
      <PresentSlidesLayout
        topic={topic}
        slides={slides}
        currentSlide={currentSlide}
        setCurrentSlide={setCurrentSlide}
        totalSlides={totalSlides}
        markAsTaught={markAsTaught}
        hasJeopardy={showJeopardy}
        onStartJeopardy={() => setMode("jeopardy")}
        onStartQuiz={() => setMode("quiz")}
        onFinish={() => {
          markAsTaught();
          router.push("/present");
        }}
      />
    );
  }

  return <TeachingContextGuard>{main}</TeachingContextGuard>;
}

type PresentSlidesLayoutProps = {
  topic: Topic;
  slides: Content[];
  currentSlide: number;
  setCurrentSlide: Dispatch<SetStateAction<number>>;
  totalSlides: number;
  markAsTaught: () => void;
  hasJeopardy: boolean;
  onStartJeopardy: () => void;
  onStartQuiz: () => void;
  onFinish: () => void;
};

function PresentSlidesLayout({
  topic,
  slides,
  currentSlide,
  setCurrentSlide,
  totalSlides,
  markAsTaught,
  hasJeopardy,
  onStartJeopardy,
  onStartQuiz,
  onFinish,
}: PresentSlidesLayoutProps) {
  const slide = slides[currentSlide];
  const slideThemeParsed =
    slide.kind === "SLIDE" ? parseSlideThemeFromDb(slide.slideTheme) : null;
  const tightenSlideChrome = Boolean(slideThemeParsed);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncFullscreen = useCallback(() => {
    const el = containerRef.current;
    setIsFullscreen(el ? isElementFullscreen(el) : false);
  }, []);

  useEffect(() => {
    const onChange = () => syncFullscreen();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, [syncFullscreen]);

  const togglePresentationFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      await toggleElementFullscreen(el);
    } catch {
      /* user gesture or browser policy */
    }
    syncFullscreen();
  }, [syncFullscreen]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((i) => Math.max(0, i - 1));
  }, [setCurrentSlide]);

  const handleNext = useCallback(() => {
    if (currentSlide === totalSlides - 1) {
      if (hasJeopardy) onStartJeopardy();
      else if (topic.quizzes.length > 0) onStartQuiz();
      else onFinish();
      return;
    }
    setCurrentSlide((i) => i + 1);
  }, [
    currentSlide,
    totalSlides,
    hasJeopardy,
    topic.quizzes.length,
    onStartJeopardy,
    onStartQuiz,
    onFinish,
    setCurrentSlide,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void togglePresentationFullscreen();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === " " && isFullscreen) {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePresentationFullscreen, handleNext, handlePrev, isFullscreen]);

  useEffect(() => {
    if (isFullscreen) return;
    document
      .getElementById(`slide-outline-${currentSlide}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    document.getElementById(`slide-outline-mobile-${currentSlide}`)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [currentSlide, isFullscreen]);

  const showChrome = !isFullscreen;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col ${
        isFullscreen
          ? "h-full min-h-0 w-full bg-zinc-950"
          : "min-h-[calc(100vh-4rem)] bg-gray-50"
      }`}
    >
      {showChrome && (
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="max-w-[100rem] mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{topic.title}</h1>
            <p className="text-sm text-gray-600">
              Slide {currentSlide + 1} of {totalSlides}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void togglePresentationFullscreen()}
              title="Fullscreen presentation — slide only (F)"
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border bg-indigo-50 text-indigo-600 border-indigo-300 hover:bg-gray-100"
            >
              Presentation mode
            </button>
            {!topic.taught && (
              <button
                type="button"
                onClick={markAsTaught}
                className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                ✓ Mark as Taught
              </button>
            )}
            {hasJeopardy && (
              <button
                type="button"
                onClick={onStartJeopardy}
                className="bg-amber-100 text-amber-900 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-amber-300/60"
              >
                Jeopardy →
              </button>
            )}
            {topic.quizzes.length > 0 && (
              <button
                type="button"
                onClick={onStartQuiz}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >
                Start Quiz →
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Mobile / tablet: horizontal outline with snippets */}
      {showChrome && (
      <div
        className="lg:hidden border-b border-gray-200 bg-gray-50 shrink-0"
        aria-label="Slide outline"
      >
        <div className="flex gap-2 overflow-x-auto px-3 py-2.5 snap-x snap-mandatory">
          {slides.map((s, i) => {
            const active = i === currentSlide;
            const snippet = slideSnippetText(s.body, s.kind);
            return (
              <button
                key={s.id}
                type="button"
                id={`slide-outline-mobile-${i}`}
                onClick={() => setCurrentSlide(i)}
                className={`snap-start shrink-0 w-[9.5rem] text-left rounded-xl border px-2.5 py-2 transition-all ${
                  active
                    ? "border-indigo-600 bg-white shadow-md ring-2 ring-indigo-500/30"
                    : "border-gray-200 bg-white/70 hover:bg-white hover:border-indigo-300"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                    {i + 1}/{totalSlides}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide font-semibold text-indigo-600 px-1 py-0.5 rounded bg-indigo-50">
                    {contentKindShort(s.kind)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">{s.title}</p>
                <p className="text-[10px] text-gray-500 line-clamp-2 mt-1 leading-snug">{snippet}</p>
              </button>
            );
          })}
        </div>
      </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {showChrome && (
        <aside
          className="hidden lg:flex w-72 xl:w-80 flex-col shrink-0 border-r border-gray-200 bg-gradient-to-b from-gray-100/80 to-gray-50"
          aria-label="Slide outline"
        >
          <div className="px-3 py-3 border-b border-gray-200 shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
              Slides
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{totalSlides} blocks · click to jump</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {slides.map((s, i) => {
              const active = i === currentSlide;
              const snippet = slideSnippetText(s.body, s.kind);
              return (
                <button
                  key={s.id}
                  type="button"
                  id={`slide-outline-${i}`}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-full text-left rounded-xl px-2.5 py-2.5 transition-all border ${
                    active
                      ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/25"
                      : "bg-white/50 border-transparent hover:bg-white hover:border-indigo-200"
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="text-xs font-mono font-semibold text-gray-500 w-6 shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="inline-block text-[9px] uppercase tracking-wide font-bold text-indigo-600 px-1.5 py-0.5 rounded-md bg-indigo-50 mb-1">
                        {contentKindShort(s.kind)}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                        {s.title}
                      </p>
                      <p className="text-[11px] text-gray-600 leading-snug line-clamp-2 mt-1">
                        {snippet}
                      </p>
                      {s.kind === "IMAGE" && isImageBodyPreviewable(s.body) && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.body}
                            alt=""
                            className="h-14 w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          {isFullscreen && (
            <button
              type="button"
              onClick={() => void togglePresentationFullscreen()}
              title="Exit presentation (Esc or F)"
              className="absolute top-3 right-3 z-20 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm hover:bg-black/70 hover:text-white"
            >
              ✕ Exit
            </button>
          )}

          <div
            className={
              showChrome
                ? "flex-1 overflow-y-auto px-4 py-6"
                : "flex flex-1 min-h-0 items-center justify-center overflow-y-auto px-6 py-10 pb-28"
            }
          >
            <div
              className={`w-full mx-auto ${
                slide.kind === "IMAGE" || slide.kind === "VIDEO"
                  ? isFullscreen
                    ? "max-w-6xl"
                    : "max-w-5xl"
                  : isFullscreen
                    ? "max-w-5xl"
                    : "max-w-3xl"
              }`}
            >
              <div
                className={
                  showChrome
                    ? `bg-white rounded-2xl shadow-lg border border-gray-200 min-h-[min(400px,50vh)] lg:min-h-[400px] ring-1 ring-gray-200 ${
                        tightenSlideChrome ? "p-2 sm:p-4" : "p-6 md:p-12"
                      }`
                    : `bg-white rounded-2xl shadow-2xl ring-1 ring-white/10 max-h-[min(88vh,920px)] overflow-y-auto ${
                        tightenSlideChrome ? "p-3 sm:p-5" : "p-6 md:p-12"
                      }`
                }
              >
                <ContentSlideView
                  content={{
                    kind: slide.kind ?? "TEXT",
                    title: slide.title,
                    body: slide.body,
                    slideTheme: slideThemeParsed,
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className={
              showChrome
                ? "bg-gray-50 border-t border-gray-200 px-4 py-4 shrink-0"
                : "absolute bottom-0 left-0 right-0 z-10 border-t border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md"
            }
          >
            <div
              className={
                showChrome
                  ? "max-w-5xl mx-auto flex items-center justify-between gap-2"
                  : "mx-auto flex max-w-2xl items-center justify-between gap-4"
              }
            >
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentSlide === 0}
                className={
                  showChrome
                    ? "bg-gray-100 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-colors text-gray-900 border border-gray-200 text-sm"
                    : "rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                }
              >
                ← Previous
              </button>

              {showChrome ? (
                <div className="hidden sm:flex gap-1.5 flex-wrap justify-center max-w-[40%]">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentSlide(i)}
                      title={`Slide ${i + 1}`}
                      className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors shrink-0 ${
                        i === currentSlide ? "bg-indigo-600" : "bg-gray-100 hover:bg-gray-100"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span className="tabular-nums text-sm font-medium text-white/70">
                  {currentSlide + 1} / {totalSlides}
                </span>
              )}

              <button
                type="button"
                onClick={handleNext}
                className={
                  showChrome
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-6 py-2.5 rounded-lg font-medium transition-colors border border-indigo-200 text-sm"
                    : "rounded-lg border border-indigo-300 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                }
              >
                {currentSlide === totalSlides - 1
                  ? hasJeopardy
                    ? "Jeopardy →"
                    : topic.quizzes.length > 0
                      ? "Start Quiz →"
                      : "Finish ✓"
                  : "Next →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------ Quiz Mode ------ */

interface QuizModeProps {
  topic: Topic;
  onBack: () => void;
  onFinish: () => void;
}

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
}

function quizWinnerSummary(
  scores: Record<string, number>,
  students: StudentOption[]
): { title: string; highlight?: string; lines: string[] } {
  const sorted = Object.entries(scores)
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return {
      title: "Rejoice in the Lord — quiz complete!",
      highlight: "Faith grows whenever we seek the truth together.",
      lines: [],
    };
  }
  const [topId, top] = sorted[0];
  const topSt = students.find((s) => s.id === topId);
  const lines = sorted.slice(0, 8).map(([id, pts]) => {
    const s = students.find((x) => x.id === id);
    return `${s ? `${s.firstName} ${s.lastName}` : "Student"} — ${pts} star${pts === 1 ? "" : "s"}`;
  });
  return {
    title: "Rejoice in the Lord — quiz complete!",
    highlight: `${topSt?.firstName ?? "A student"} leads with ${top} star${top === 1 ? "" : "s"}.`,
    lines,
  };
}

function QuizMode({ topic, onBack, onFinish }: QuizModeProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [quizWinnerSplashOpen, setQuizWinnerSplashOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/students")
      .then(async (r) => (await r.json()) as unknown)
      .then((data) => {
        if (cancelled) return;
        setStudents(Array.isArray(data) ? (data as StudentOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quiz = topic.quizzes[currentQ];
  const isCorrect = selectedAnswer === quiz?.answer;
  const totalQuestions = topic.quizzes.length;

  function handleSubmitAnswer() {
    if (selectedAnswer === null || !selectedStudent) return;
    setShowResult(true);

    if (isCorrect) {
      setScores((prev) => ({
        ...prev,
        [selectedStudent]: (prev[selectedStudent] || 0) + 1,
      }));
    }
  }

  async function commitQuizFinishAfterSplash() {
    setQuizWinnerSplashOpen(false);
    for (const [studentId, points] of Object.entries(scores)) {
      await fetch("/api/stars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          topicId: topic.id,
          points,
        }),
      });
    }
    await fetch(`/api/topics/${topic.id}/taught`, { method: "POST" });
    onFinish();
  }

  function handleNext() {
    if (currentQ === totalQuestions - 1) {
      setQuizWinnerSplashOpen(true);
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setSelectedStudent("");
    }
  }

  if (!quiz) return null;

  const quizSplash = quizWinnerSummary(scores, students);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Quiz: {topic.title}
            </h1>
            <p className="text-sm text-gray-600">
              Question {currentQ + 1} of {totalQuestions}
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            ← Back to Slides
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 ring-1 ring-gray-200">
            {/* Student Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Which student is answering?
              </label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                disabled={showResult}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900"
              >
                <option value="">Select a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Question */}
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {quiz.question}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {quiz.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => !showResult && setSelectedAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left px-5 py-3 rounded-lg border-2 font-medium transition-all ${
                    showResult
                      ? i === quiz.answer
                        ? "border-green-500 bg-green-50 text-green-700"
                        : i === selectedAnswer
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-500"
                      : selectedAnswer === i
                      ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                      : "border-gray-200 hover:border-indigo-300 text-gray-900"
                  }`}
                >
                  <span className="mr-3">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                </button>
              ))}
            </div>

            {/* Result */}
            {showResult && (
              <div
                className={`p-4 rounded-lg mb-4 ${
                  isCorrect
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isCorrect
                  ? "⭐ Correct! +1 star!"
                  : `✗ Incorrect. The correct answer was: ${quiz.options[quiz.answer]}`}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {!showResult ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedAnswer === null || !selectedStudent}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors border border-indigo-200"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors border border-indigo-200"
                >
                  {currentQ === totalQuestions - 1 ? "Finish Quiz ✓" : "Next Question →"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <GameWinnerSplash
        open={quizWinnerSplashOpen}
        variant="quiz"
        title={quizSplash.title}
        highlight={quizSplash.highlight}
        lines={quizSplash.lines}
        onContinue={() => void commitQuizFinishAfterSplash()}
        continueLabel="Save stars & return"
      />
    </div>
  );
}
