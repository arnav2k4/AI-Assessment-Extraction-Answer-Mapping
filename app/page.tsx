"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, UserRound, Upload, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import AssessmentViewer from "@/components/AssessmentViewer";
import type {
  AssessmentResult as ApiAssessmentResult,
  Question,
  UnmatchedAnswer,
} from "@/app/api/process-assessment/route";

type AssessmentResult = ApiAssessmentResult & {
  // Supports APIs that return { assessment: {...} }
  assessment?: {
    questions: Question[];
    unmatchedAnswers?: UnmatchedAnswer[];
    summary?: ApiAssessmentResult["summary"];
  };
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 0 : 1)}MB`;
}

/**
 * PDF page counts are only known client-side; loaded lazily so
 * pdfjs never has to run during SSR.
 */
function usePageCount(file: File | null) {
  const [result, setResult] = useState<{
    file: File | null;
    pages: number | null;
  }>({ file: null, pages: null });

  const isPdf = !!file && file.type === "application/pdf";

  useEffect(() => {
    if (!file || !isPdf) return;

    let cancelled = false;

    (async () => {
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const buffer = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buffer }).promise;

      if (!cancelled) setResult({ file, pages: doc.numPages });
    })().catch(() => {
      if (!cancelled) setResult({ file, pages: null });
    });

    return () => {
      cancelled = true;
    };
  }, [file, isPdf]);

  if (!isPdf) return null;

  return result.file === file ? result.pages : null;
}

export default function Home() {
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const questionInput = useRef<HTMLInputElement>(null);
  const answerInput = useRef<HTMLInputElement>(null);

  const questionPaperPages = usePageCount(questionPaper);
  const answerSheetPages = usePageCount(answerSheet);

  // =========================================================
  // Process / Reevaluate Assignment
  // =========================================================

  async function processAssessment() {
    if (!questionPaper || !answerSheet) {
      setError("Please upload both the question paper and answer sheet.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const formData = new FormData();

      formData.append("questionPaper", questionPaper);
      formData.append("answerSheet", answerSheet);

      const response = await fetch("/api/process-assessment", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("Gemini/API response:", data);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to process assessment.");
      }

      const normalizedResult: AssessmentResult = {
        ...data,

        questions: data.questions ?? data.assessment?.questions ?? [],

        unmatchedAnswers:
          data.unmatchedAnswers ?? data.assessment?.unmatchedAnswers ?? [],

        summary: data.summary ??
          data.assessment?.summary ?? {
            totalQuestions:
              data.questions?.length ??
              data.assessment?.questions?.length ??
              0,

            answeredQuestions: 0,

            unansweredQuestions: 0,

            unmatchedAnswers:
              data.unmatchedAnswers?.length ??
              data.assessment?.unmatchedAnswers?.length ??
              0,

            answeredPercentage: 0,
          },
      };

      setResult(normalizedResult);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message || "Something went wrong while processing the assessment."
      );
    } finally {
      setProcessing(false);
    }
  }

  // =========================================================
  // Back to Upload
  // =========================================================

  function handleBackToUpload() {
    setQuestionPaper(null);
    setAnswerSheet(null);
    setResult(null);
    setError("");
    setProcessing(false);

    if (questionInput.current) questionInput.current.value = "";
    if (answerInput.current) answerInput.current.value = "";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // =========================================================
  // File validation
  // =========================================================

  function validateFile(file: File) {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return "Only PDF, JPG, PNG, and WebP files are allowed.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File size must be less than 10 MB.";
    }

    return null;
  }

  function handleQuestionPaper(file: File | undefined) {
    if (!file) return;

    const validation = validateFile(file);

    if (validation) {
      setError(validation);
      if (questionInput.current) questionInput.current.value = "";
      return;
    }

    setError("");
    setQuestionPaper(file);
  }

  function handleAnswerSheet(file: File | undefined) {
    if (!file) return;

    const validation = validateFile(file);

    if (validation) {
      setError(validation);
      if (answerInput.current) answerInput.current.value = "";
      return;
    }

    setError("");
    setAnswerSheet(file);
  }

  function removeQuestionPaper() {
    setQuestionPaper(null);
    if (questionInput.current) questionInput.current.value = "";
  }

  function removeAnswerSheet() {
    setAnswerSheet(null);
    if (answerInput.current) answerInput.current.value = "";
  }

  const canStartMapping = !!questionPaper && !!answerSheet && !processing;

  // =========================================================
  // Assessment Results
  // =========================================================

  if (result) {
    return (
      <AppShell breadcrumb="Exams" onBack={handleBackToUpload}>
        <AssessmentViewer
          result={result}
          answerSheet={answerSheet}
          processing={processing}
          error={error}
          onReevaluate={processAssessment}
        />
      </AppShell>
    );
  }

  // =========================================================
  // Loading state
  // =========================================================

  if (processing) {
    return (
      <AppShell breadcrumb="Exams">
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <Sparkles size={40} className="text-orange-500" />

          <p className="text-lg font-semibold text-gray-900">Extracting...</p>

          <p className="text-sm text-gray-500">This may take a while</p>
        </div>
      </AppShell>
    );
  }

  // =========================================================
  // Upload Screen
  // =========================================================

  return (
    <AppShell breadcrumb="Exams">
      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-14 text-center">
        <h1 className="text-3xl font-semibold text-gray-900">
          Upload{" "}
          <span className="rounded-md bg-orange-100 px-2 py-0.5 text-orange-600">
            Question Paper &amp; Answer Sheets
          </span>
        </h1>

        <p className="mt-3 text-gray-500">Upload both files to get started</p>

        <div className="relative my-8 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-orange-300 bg-orange-50">
          <UserRound size={40} className="text-orange-400" />
        </div>

        {error && (
          <div className="mb-6 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-4">
          <UploadCard
            label="Question Paper"
            file={questionPaper}
            pages={questionPaperPages}
            inputRef={questionInput}
            onSelect={handleQuestionPaper}
            onRemove={removeQuestionPaper}
          />

          <UploadCard
            label="Answer Sheet"
            file={answerSheet}
            pages={answerSheetPages}
            inputRef={answerInput}
            onSelect={handleAnswerSheet}
            onRemove={removeAnswerSheet}
          />
        </div>

        <button
          type="button"
          disabled={!canStartMapping}
          onClick={processAssessment}
          className="mt-8 flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          Start Mapping
          <ArrowRight size={16} />
        </button>

        <p className="mt-3 text-xs text-gray-400">
          Once both files are uploaded, you&rsquo;ll be able to map answers
          with questions
        </p>
      </div>
    </AppShell>
  );
}

function UploadCard({
  label,
  file,
  pages,
  inputRef,
  onSelect,
  onRemove,
}: {
  label: string;
  file: File | null;
  pages: number | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => onSelect(event.target.files?.[0])}
      />

      {file ? (
        <>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
          >
            <X size={13} />
          </button>

          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600">
            <span className="text-xs font-bold">PDF</span>
          </div>

          <p className="max-w-[160px] truncate text-sm font-medium text-gray-900">
            {file.name}
          </p>

          <p className="mt-0.5 text-xs text-gray-500">
            {formatFileSize(file.size)}
            {pages ? ` • ${pages} Page${pages === 1 ? "" : "s"}` : ""}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center"
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <Upload size={16} />
          </div>

          <p className="text-sm font-medium text-gray-900">
            Upload <span className="font-semibold">{label}</span>
          </p>

          <p className="mt-0.5 text-xs text-gray-400">Max 10MB</p>
        </button>
      )}
    </div>
  );
}
