"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Region = {
  page: number;
  box_2d: [number, number, number, number];
};

type Answer = {
  id: string;
  questionNumber: string;
  text: string;
  regions: Region[];
};

const BASE_WIDTH = 560;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;

export default function PDFViewer({
  fileUrl,
  answer,
  page,
  setPage,
}: {
  fileUrl: string;
  answer: Answer;
  page: number;
  setPage: (page: number) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(100);

  const currentRegions = answer.regions.filter(
    (region) => region.page === page
  );

  return (
    <div>
      {/* Toolbar */}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-1">
          <button
            type="button"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 10))}
            aria-label="Zoom out"
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
          >
            <Minus size={13} />
          </button>

          <span className="w-11 text-center text-xs font-medium text-gray-600">
            {zoom}%
          </span>

          <button
            type="button"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 10))}
            aria-label="Zoom in"
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Previous page"
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="px-1 text-xs font-medium text-gray-600">
            Page {page}
            {numPages ? ` of ${numPages}` : ""}
          </span>

          <button
            type="button"
            disabled={!numPages || page >= numPages}
            onClick={() => setPage(page + 1)}
            aria-label="Next page"
            className="flex h-6 w-6 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* PDF */}

      <div className="relative flex justify-center overflow-auto rounded-xl border bg-slate-100">
        <div className="relative">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <div className="p-10 text-center">
                Loading answer sheet...
              </div>
            }
            error={
              <div className="p-10 text-center text-red-600">
                Failed to load answer sheet.
              </div>
            }
          >
            <Page
              pageNumber={page}
              width={(BASE_WIDTH * zoom) / 100}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Highlight regions */}

          {currentRegions.map((region, index) => {
            const [ymin, xmin, ymax, xmax] = region.box_2d;

            return (
              <div
                key={index}
                className="pointer-events-none absolute border-2 border-green-500 bg-green-400/15"
                style={{
                  top: `${ymin / 10}%`,
                  left: `${xmin / 10}%`,
                  width: `${(xmax - xmin) / 10}%`,
                  height: `${(ymax - ymin) / 10}%`,
                }}
              >
                <span className="absolute -top-2.5 left-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                  Q{answer.questionNumber}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {answer.regions.length > 1 && (
        <p className="mt-3 text-center text-xs text-slate-500">
          This answer spans {answer.regions.length} page regions.
        </p>
      )}
    </div>
  );
}
