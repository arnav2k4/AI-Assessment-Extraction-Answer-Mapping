"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(
  () => import("../components/PDFViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="p-10 text-center">
        Loading PDF viewer...
      </div>
    ),
  }
);

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

export default function PdfAnswerViewer({
  fileUrl,
  answer,
}: {
  fileUrl: string;
  answer: Answer;
}) {
  const [page, setPage] = useState(
    answer.regions[0]?.page ?? 1
  );

  useEffect(() => {
    setPage(answer.regions[0]?.page ?? 1);
  }, [answer]);

  return (
    <PDFViewer
      fileUrl={fileUrl}
      answer={answer}
      page={page}
      setPage={setPage}
    />
  );
}