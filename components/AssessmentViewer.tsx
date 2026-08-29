"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCw, Sparkles } from "lucide-react";
import PdfAnswerViewer from "./PdfAnswerViewer";
import type {
  Question,
  AssessmentResult,
} from "@/app/api/process-assessment/route";

type Answer = {
  id: string;
  questionNumber: string;
  text: string;
  regions: Question["answerRegions"];
};

export default function AssessmentViewer({
  result,
  answerSheet,
  processing = false,
  error = "",
  onReevaluate,
}: {
  result: AssessmentResult;
  answerSheet: File | null;
  processing?: boolean;
  error?: string;
  onReevaluate?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    result.questions[0]?.id ?? null
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(result.questions[0] ? [result.questions[0].id] : [])
  );

  const selectedQuestion =
    result.questions.find((q) => q.id === selectedId) ??
    result.questions[0] ??
    null;

  const allExpanded =
    result.questions.length > 0 &&
    result.questions.every((q) => expandedIds.has(q.id));

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(result.questions.map((q) => q.id)));
    }
  }

  function selectAndToggle(question: Question) {
    setSelectedId(question.id);

    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(question.id)) {
        next.delete(question.id);
      } else {
        next.add(question.id);
      }

      return next;
    });
  }

  const answer: Answer | undefined = useMemo(() => {
    if (
      !selectedQuestion?.answerId ||
      selectedQuestion.answerRegions.length === 0
    ) {
      return undefined;
    }

    return {
      id: selectedQuestion.answerId,
      questionNumber: selectedQuestion.number,
      text: selectedQuestion.answerText ?? "",
      regions: selectedQuestion.answerRegions,
    };
  }, [selectedQuestion]);

  const answerSheetUrl = useMemo(
    () => (answerSheet ? URL.createObjectURL(answerSheet) : null),
    [answerSheet]
  );

  const totalQuestions = result.questions.length;

  const answeredCount = result.questions.filter(
    (q) => q.status === "answered"
  ).length;

  const unansweredCount = result.questions.filter(
    (q) => q.status === "unanswered"
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            Question - Answer Mapping
          </h1>

          <p className="text-sm text-gray-500">
            {totalQuestions} Questions &bull; {answeredCount} Answered &bull;{" "}
            {unansweredCount} Unanswered
          </p>
        </div>

        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}

          {onReevaluate && (
            <button
              type="button"
              onClick={onReevaluate}
              disabled={processing}
              className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCw size={14} />
              {processing ? "Reevaluating..." : "Reevaluate Assignment"}
            </button>
          )}
        </div>
      </div>

      {/* Body */}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Questions */}

        <section className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Extracted Questions
              </h2>

              <p className="text-xs text-gray-500">from question paper</p>
            </div>

            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-sm font-medium text-orange-600 hover:underline"
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {result.questions.map((question) => {
              const selected = selectedQuestion?.id === question.id;
              const expanded = expandedIds.has(question.id);

              return (
                <div
                  key={question.id}
                  className={`rounded-xl border p-3 transition ${
                    selected
                      ? "border-orange-300 bg-orange-50/60"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectAndToggle(question)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 px-1.5 text-xs font-semibold text-gray-700">
                        {question.number}
                      </span>

                      <p className="text-sm leading-5 text-gray-800">
                        {question.text}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <ScoreBadge question={question} />

                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-3 rounded-lg bg-orange-50 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                        <Sparkles size={13} />
                        AI Feedback
                      </div>

                      <p className="text-xs leading-5 text-gray-700">
                        {question.feedback ||
                          (question.status === "unanswered"
                            ? "No corresponding answer was detected in the answer sheet."
                            : "No additional feedback available.")}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Answer sheet */}

        <section className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Answer Sheet</h2>

            {selectedQuestion && (
              <p className="text-sm text-gray-500">
                Question {selectedQuestion.number}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!selectedQuestion || selectedQuestion.status === "unanswered" ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <div className="text-3xl">⚠️</div>

                <h3 className="mt-2 font-semibold text-red-800">
                  Unanswered
                </h3>

                <p className="mt-1 text-sm text-red-700">
                  No corresponding answer was detected in the answer sheet.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 rounded-xl bg-gray-50 p-4">
                  <div className="mb-2 text-sm font-semibold text-gray-900">
                    Extracted Answer
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {selectedQuestion.answerText ||
                      "Answer text unavailable."}
                  </p>
                </div>

                {answerSheetUrl && answer && (
                  <PdfAnswerViewer
                    fileUrl={answerSheetUrl}
                    answer={answer}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* Unmatched answers */}

      {result.unmatchedAnswers.length > 0 && (
        <div className="px-4 pb-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-semibold text-amber-900">
              Unmatched Answers
            </h2>

            <p className="mt-1 text-sm text-amber-800">
              These answers were found in the answer sheet but could not be
              confidently associated with a question.
            </p>

            <div className="mt-4 space-y-3">
              {result.unmatchedAnswers.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg bg-white p-3 text-sm"
                >
                  {item.regions[0] && (
                    <span className="font-medium">
                      Page {item.regions[0].page}
                    </span>
                  )}

                  <p className="mt-1">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ question }: { question: Question }) {
  if (question.status === "unanswered") {
    return (
      <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        Unanswered
      </span>
    );
  }

  const ratio =
    question.maxMarks > 0 ? question.marksAwarded / question.maxMarks : 0;

  const colorClass =
    ratio >= 0.8
      ? "bg-green-100 text-green-700"
      : ratio > 0
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {question.marksAwarded}/{question.maxMarks}
    </span>
  );
}
