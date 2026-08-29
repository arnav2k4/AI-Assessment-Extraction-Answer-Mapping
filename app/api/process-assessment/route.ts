import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export type AnswerRegion = {
  page: number;
  box_2d: [number, number, number, number];
};

export type Question = {
  id: string;
  number: string;
  text: string;
  answered: boolean;
  answerId: string | null;
  answerText: string | null;
  answerRegions: AnswerRegion[];
  status: "answered" | "unanswered" | "ambiguous";
  confidence: number;
  feedback?: string;
  maxMarks: number;
  marksAwarded: number;
};

export type UnmatchedAnswer = {
  id: string;
  text: string;
  regions: AnswerRegion[];
};

export type AssessmentResult = {
  success: boolean;

  questions: Question[];

  unmatchedAnswers: UnmatchedAnswer[];

  summary: {
    totalQuestions: number;
    answeredQuestions: number;
    unansweredQuestions: number;
    unmatchedAnswers: number;
    answeredPercentage: number;
  };

  processing: {
    model: string;
    questionPaperFile: string;
    answerSheetFile: string;
  };
};

/**
 * Convert an uploaded File into base64.
 *
 * IMPORTANT:
 * This runs inside a Node.js API route.
 * FileReader is a browser API and cannot be used here.
 */
async function fileToBase64(
  file: File
): Promise<string> {
  const arrayBuffer =
    await file.arrayBuffer();

  const buffer = Buffer.from(
    arrayBuffer
  );

  return buffer.toString("base64");
}

/**
 * Remove markdown code fences if Gemini
 * happens to return:
 *
 * ```json
 * {...}
 * ```
 */
function cleanJsonResponse(
  text: string
): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      );
  }

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned = cleaned.slice(
      firstBrace,
      lastBrace + 1
    );
  }

  return cleaned;
}

/**
 * Validate and normalize Gemini's
 * bounding-box coordinates.
 */
function normalizeRegion(
  region: any
): AnswerRegion | null {
  if (!region) {
    return null;
  }

  const page = Number(
    region.page
  );

  if (
    !Number.isFinite(page) ||
    page < 1
  ) {
    return null;
  }

  let box =
    region.box_2d;

  if (
    !Array.isArray(box) ||
    box.length !== 4
  ) {
    return null;
  }

  box = box.map(
    (value: any) =>
      Number(value)
  );

  if (
    box.some(
      (value: number) =>
        !Number.isFinite(value)
    )
  ) {
    return null;
  }

  let [
    ymin,
    xmin,
    ymax,
    xmax,
  ] = box;

  ymin = Math.max(
    0,
    Math.min(1000, ymin)
  );

  xmin = Math.max(
    0,
    Math.min(1000, xmin)
  );

  ymax = Math.max(
    0,
    Math.min(1000, ymax)
  );

  xmax = Math.max(
    0,
    Math.min(1000, xmax)
  );

  return {
    page,
    box_2d: [
      ymin,
      xmin,
      ymax,
      xmax,
    ],
  };
}

/**
 * Convert Gemini's raw response into
 * the structure expected by the frontend.
 */
function normalizeResult(
  raw: any
): AssessmentResult {
  const rawQuestions =
    Array.isArray(
      raw?.questions
    )
      ? raw.questions
      : [];

  const rawUnmatchedAnswers =
    Array.isArray(
      raw?.unmatchedAnswers
    )
      ? raw.unmatchedAnswers
      : [];

  const questions: Question[] =
    rawQuestions.map(
      (
        question: any,
        index: number
      ) => {
        const rawRegions =
          Array.isArray(
            question?.answerRegions
          )
            ? question.answerRegions
            : [];

        const answerRegions =
          rawRegions
            .map(
              normalizeRegion
            )
            .filter(
              (
                region:
                  | AnswerRegion
                  | null
              ): region is AnswerRegion =>
                region !== null
            );

        const status =
          question?.status ===
            "answered" ||
          question?.status ===
            "unanswered" ||
          question?.status ===
            "ambiguous"
            ? question.status
            : question?.answered
              ? "answered"
              : "unanswered";

        const maxMarks =
          Number.isFinite(
            Number(question?.maxMarks)
          ) &&
          Number(question?.maxMarks) > 0
            ? Number(question.maxMarks)
            : 5;

        const marksAwarded =
          status === "unanswered"
            ? 0
            : Math.max(
                0,
                Math.min(
                  maxMarks,
                  Number(
                    question?.marksAwarded
                  ) || 0
                )
              );

        return {
          id:
            String(
              question?.id ||
                ""
            ).trim() ||
            `question-${
              index + 1
            }`,

          number:
            String(
              question?.number ||
                ""
            ).trim() ||
            `${index + 1}`,

          text:
            String(
              question?.text ||
                ""
            ).trim(),

          answered:
            status ===
            "answered",

          answerId:
            question?.answerId
              ? String(
                  question.answerId
                )
              : null,

          answerText:
            question?.answerText
              ? String(
                  question.answerText
                )
              : null,

          answerRegions,

          status,

          confidence:
            Math.max(
              0,
              Math.min(
                1,
                Number(
                  question?.confidence
                ) || 0
              )
            ),

          feedback:
            question?.feedback
              ? String(
                  question.feedback
                )
              : undefined,

          maxMarks,

          marksAwarded,
        };
      }
    );

  const unmatchedAnswers: UnmatchedAnswer[] =
    rawUnmatchedAnswers.map(
      (
        answer: any,
        index: number
      ) => ({
        id:
          String(
            answer?.id || ""
          ).trim() ||
          `unmatched-${
            index + 1
          }`,

        text:
          String(
            answer?.text || ""
          ).trim(),

        regions:
          Array.isArray(
            answer?.regions
          )
            ? answer.regions
                .map(
                  normalizeRegion
                )
                .filter(
                  (
                    region:
                      | AnswerRegion
                      | null
                  ): region is AnswerRegion =>
                    region !== null
                )
            : [],
      })
    );

  const totalQuestions =
    questions.length;

  const answeredQuestions =
    questions.filter(
      (q) =>
        q.status ===
        "answered"
    ).length;

  const unansweredQuestions =
    questions.filter(
      (q) =>
        q.status ===
        "unanswered"
    ).length;

  return {
    success: true,

    questions,

    unmatchedAnswers,

    summary: {
      totalQuestions,

      answeredQuestions,

      unansweredQuestions,

      unmatchedAnswers:
        unmatchedAnswers.length,

      answeredPercentage:
        totalQuestions > 0
          ? Math.round(
              (answeredQuestions /
                totalQuestions) *
                100
            )
          : 0,
    },

    processing: {
      model:
        "gemini-3.6-flash",

      questionPaperFile:
        "",

      answerSheetFile:
        "",
    },
  };
}

/**
 * Main Gemini prompt.
 */
const prompt = `
You are an AI assessment analysis engine for a teacher-facing application.

You will receive EXACTLY TWO documents:

DOCUMENT 1 = QUESTION PAPER
DOCUMENT 2 = ONE STUDENT HANDWRITTEN ANSWER SHEET

Your job is to analyze both documents and produce structured JSON that allows a teacher to understand:

1. Every question in the question paper
2. Every answer written by the student
3. Which student answer belongs to which question
4. Whether each question was answered or left unanswered
5. The EXACT visual location of each answer on the student's answer sheet
6. Answers that cannot be confidently mapped to a question

The most important requirement is ACCURATE ANSWER MAPPING and ACCURATE ANSWER REGIONS.

============================================================
CORE PIPELINE
============================================================

Perform these steps internally, in this exact order:

STEP 1 — QUESTION EXTRACTION
STEP 2 — ANSWER EXTRACTION
STEP 3 — ANSWER-TO-QUESTION MAPPING
STEP 4 — ANSWER REGION IDENTIFICATION
STEP 5 — VALIDATION OF THE MAPPING
STEP 6 — RETURN STRUCTURED JSON

Do NOT skip any of these stages.

============================================================
DOCUMENT ROLES
============================================================

The FIRST uploaded document is ALWAYS the QUESTION PAPER.

The SECOND uploaded document is ALWAYS the STUDENT HANDWRITTEN ANSWER SHEET.

Do not confuse the two documents.

The answer sheet may contain:

- handwritten answers
- printed question numbers
- handwritten question numbers
- crossed-out answers
- corrections
- diagrams
- equations
- tables
- multiple pages
- answers written out of order
- answers spanning multiple pages
- unanswered questions
- stray/unrelated writing

Treat the second document as the student's actual submitted answer sheet.

============================================================
STEP 1 — QUESTION EXTRACTION
============================================================

Extract EVERY question from the question paper.

Preserve the EXACT printed order.

Preserve the ORIGINAL question numbering.

Do NOT renumber questions.

Do NOT skip questions.

Do NOT merge questions.

Do NOT invent questions.

------------------------------------------------------------
SUB-PARTS MUST BE SEPARATE QUESTIONS
------------------------------------------------------------

Every labelled sub-part must be represented as a separate question.

For example:

11 (a) Explain...
11 (b) Explain...

must become:

11(a)
11(b)

as two separate question objects.

Similarly:

3(a)
3(b)

5(i)
5(ii)

7(A)
7(B)

must all become separate entries.

If a question contains multiple explicitly labelled parts, each labelled part is its own question.

------------------------------------------------------------
QUESTION ORDER
------------------------------------------------------------

The final questions array MUST follow the exact printed order in the question paper.

Example:

1
2
3(a)
3(b)
4
5(a)
5(b)
6

Do not reorder based on answer-sheet order.

============================================================
STEP 2 — ANSWER EXTRACTION
============================================================

Now analyze ONLY the student answer sheet.

Identify every distinct student answer.

For each answer determine:

- question number written by the student, if present
- answer text
- pages containing the answer
- exact visual region containing the answer
- whether the answer is complete or continues elsewhere

Do NOT assume that answers appear in question order.

For example, the student may write:

Question 1
Question 5
Question 2
Question 8
Question 3(a)

This is valid.

The mapping must use the question identifier and content rather than page/order position.

============================================================
STEP 3 — ANSWER-TO-QUESTION MAPPING
============================================================

For EACH extracted question from the question paper, search the ENTIRE student answer sheet for its corresponding answer.

Never assume:

question 1 → first answer
question 2 → second answer
question 3 → third answer

Instead use all available evidence.

------------------------------------------------------------
MAPPING SIGNALS
------------------------------------------------------------

Use the following signals, in order of importance:

1. Explicit question number written on the answer sheet
2. Explicit sub-question label
3. Semantic relationship between question and answer
4. Context and wording
5. Continuity from previous/next page
6. Physical layout
7. Handwritten numbering
8. Other contextual evidence

If a handwritten label clearly says:

11(a)

then map that region to question 11(a).

If the student answers questions out of order, preserve the question paper order in the final output.

============================================================
AMBIGUOUS MAPPINGS
============================================================

Do NOT force a mapping when there is insufficient evidence.

If an answer could belong to multiple questions and cannot be confidently resolved:

- mark the relevant question as "ambiguous"
- provide the best candidate answer if appropriate
- use a lower confidence score
- explain the ambiguity briefly in feedback

Do NOT fabricate certainty.

============================================================
UNANSWERED QUESTIONS
============================================================

A question is "unanswered" ONLY when there is no corresponding student answer anywhere in the entire answer sheet.

Before marking a question unanswered:

1. Search all answer-sheet pages.
2. Check handwritten question numbers.
3. Check sub-question labels.
4. Check for answers written out of order.
5. Check whether the answer continues on another page.
6. Check whether the student omitted the question number but the content clearly answers it.

Only after these checks should the question be marked unanswered.

For an unanswered question:

"answered": false

"status": "unanswered"

"answerId": null

"answerText": null

"answerRegions": []

============================================================
ANSWERS WITHOUT QUESTION NUMBERS
============================================================

Sometimes a student may write an answer without explicitly writing the question number.

Do NOT automatically classify it as unmatched.

Use semantic/contextual analysis to determine whether it clearly answers one of the questions.

If the answer clearly corresponds to a question, map it.

If it cannot be confidently mapped, classify it as unmatched.

============================================================
ANSWERS THAT DO NOT MATCH ANY QUESTION
============================================================

If the student has written an answer that cannot be associated with any question in the question paper:

place it in:

"unmatchedAnswers"

Examples include:

- stray writing
- accidentally answered question
- unrelated text
- unclear answer with no identifiable question
- answer for a question not present in the paper

Do NOT discard these answers.

============================================================
STEP 4 — EXACT ANSWER REGION
============================================================

This is CRITICAL.

For every matched answer, identify the EXACT physical region of the answer on the student's answer sheet.

The application will use these coordinates to draw a highlight box over the answer.

Return:

"answerRegions": [
  {
    "page": 2,
    "box_2d": [ymin, xmin, ymax, xmax]
  }
]

Coordinates MUST use the normalized 0–1000 coordinate system.

Coordinate system:

0 = top edge / left edge
1000 = bottom edge / right edge

The array MUST be:

[ymin, xmin, ymax, xmax]

where:

ymin = top of answer
xmin = left of answer
ymax = bottom of answer
xmax = right of answer

Example:

[250, 100, 500, 900]

means:

top = 25% of page height
left = 10% of page width
bottom = 50% of page height
right = 90% of page width

------------------------------------------------------------
BOUNDING BOX ACCURACY
------------------------------------------------------------

The bounding box MUST tightly contain the student's answer.

Include:

- handwritten text
- equations
- diagrams that form part of the answer
- tables that form part of the answer
- continuation text

Do NOT include:

- unrelated answers
- neighboring questions
- large empty margins
- unrelated page content
- the entire page unless the answer genuinely occupies the entire page

The goal is for the teacher to click a question and immediately see the exact answer highlighted.

============================================================
MULTI-PAGE ANSWERS
============================================================

Answers may span multiple pages.

If one answer continues across multiple pages, return MULTIPLE regions.

Example:

"answerRegions": [
  {
    "page": 2,
    "box_2d": [200, 100, 900, 900]
  },
  {
    "page": 3,
    "box_2d": [100, 100, 450, 900]
  }
]

Do NOT create one huge bounding box spanning pages.

Each page must have its own region.

============================================================
QUESTION NUMBER REGION VS ANSWER REGION
============================================================

The answer region should primarily contain the student's answer.

If the handwritten question number is immediately adjacent to the answer, it may be included in the bounding box.

However, do not expand the region unnecessarily.

============================================================
CROSSED-OUT ANSWERS
============================================================

If an answer is clearly crossed out and replaced by another answer:

Treat the replacement/current answer as the answer.

Do not map the crossed-out answer unless it is clearly the student's final response.

============================================================
CONTINUATION ANSWERS
============================================================

If the student writes:

"Q5"

and begins the answer on page 2, then continues:

"Q5 continued"

on page 4,

both regions belong to question 5.

Return both regions.

============================================================
DIAGRAMS AND NON-TEXT ANSWERS
============================================================

Answers may contain diagrams, graphs, tables, equations, or code.

These still count as answers.

If a diagram clearly belongs to a question, include its region in answerRegions.

If an answer consists of multiple separate regions on the same page, return multiple bounding boxes.

============================================================
CONFIDENCE
============================================================

Return a confidence value between 0 and 1.

Use:

0.95–1.00 = extremely confident
0.85–0.94 = highly confident
0.70–0.84 = reasonably confident
0.50–0.69 = ambiguous
below 0.50 = very uncertain

Confidence should reflect the confidence of the QUESTION → ANSWER mapping, not merely OCR quality.

============================================================
MARKS AND GRADING
============================================================

Every question has a maximum mark value ("maxMarks").

If the question paper prints marks for a question (e.g. "[2 marks]", "(5)", "2M"), use that exact value as maxMarks.

If no marks are printed for a question, use maxMarks = 5.

For every question, also return "marksAwarded": your best assessment of how many of the maxMarks the student's answer earns, based on correctness and completeness of the answer against the question.

Grading rules:

- An unanswered question always has marksAwarded = 0.
- A fully correct and complete answer earns marksAwarded = maxMarks.
- A partially correct, incomplete, or partially relevant answer earns a proportional value between 0 and maxMarks.
- A completely incorrect or irrelevant answer earns marksAwarded = 0.
- marksAwarded must never exceed maxMarks and must never be negative.
- Briefly justify the awarded marks inside "feedback".

============================================================
VALIDATION
============================================================

Before returning the result, perform a final consistency check.

Verify:

1. Every question from the question paper appears exactly once.
2. Question order matches the printed question paper.
3. Sub-parts are separate entries.
4. Every answered question has an answerId.
5. Every answered question has at least one answer region.
6. Every unanswered question has no answerId.
7. Every unanswered question has an empty answerRegions array.
8. Multi-page answers have multiple regions.
9. Out-of-order answers have been mapped correctly.
10. Unmatched answers are included separately.
11. No question has been invented.
12. No answer has been silently discarded.
13. Every question has maxMarks and marksAwarded, with 0 ≤ marksAwarded ≤ maxMarks.

============================================================
OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

Do NOT return markdown.

Do NOT return json.

Do NOT include explanations outside the JSON.

Use EXACTLY this structure:

{
  "questions": [
    {
      "id": "q1",
      "number": "1",
      "text": "Exact question text",
      "answered": true,
      "answerId": "a1",
      "answerText": "Student's answer",
      "answerRegions": [
        {
          "page": 1,
          "box_2d": [200, 100, 500, 900]
        }
      ],
      "status": "answered",
      "confidence": 0.96,
      "feedback": "Answer identified on page 1.",
      "maxMarks": 2,
      "marksAwarded": 2
    }
  ],

  "unmatchedAnswers": [
    {
      "id": "a99",
      "text": "Unmatched student answer",
      "regions": [
        {
          "page": 4,
          "box_2d": [400, 100, 700, 900]
        }
      ]
    }
  ]
}

============================================================
IMPORTANT FINAL RULES
============================================================

The question paper defines the list and order of questions.

The answer sheet defines the student's responses.

Do not use answer-sheet order as question order.

Do not mark a question unanswered merely because the answer is on a different page.

Do not mark a question unanswered merely because the student answered questions out of order.

Do not mark a question unanswered merely because the answer has no explicit question number if its content clearly identifies the question.

Do not force ambiguous mappings.

Do not invent answers.

Do not invent question numbers.

Do not merge labelled sub-parts.

Exact answer regions are mandatory for every mapped answer.

Return ONLY JSON.
`;

/**
 * POST /api/process-assessment
 */
export async function POST(
  request: Request
) {
  try {
    // ==========================================
    // Check API key
    // ==========================================

    if (
      !process.env.GEMINI_API_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // Read multipart form
    // ==========================================

    const formData =
      await request.formData();

    const questionPaper =
      formData.get(
        "questionPaper"
      );

    const answerSheet =
      formData.get(
        "answerSheet"
      );

    // ==========================================
    // Validate question paper
    // ==========================================

    if (
      !questionPaper ||
      !(questionPaper instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Question paper is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Validate answer sheet
    // ==========================================

    if (
      !answerSheet ||
      !(answerSheet instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Answer sheet is required.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Validate question paper type
    // ==========================================

    if (
      !ALLOWED_TYPES.includes(
        questionPaper.type
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Question paper must be a PDF or image.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Validate answer sheet type
    // ==========================================

    if (
      !ALLOWED_TYPES.includes(
        answerSheet.type
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Answer sheet must be a PDF or image.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Validate question paper size
    // ==========================================

    if (
      questionPaper.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Question paper is too large. Maximum size is 20 MB.",
        },
        {
          status: 400,
        }
      );
    }

    // ==========================================
    // Validate answer sheet size
    // ==========================================

    if (
      answerSheet.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          error:
            "Answer sheet is too large. Maximum size is 20 MB.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "Starting assessment processing..."
    );

    console.log(
      "Question paper:",
      questionPaper.name,
      questionPaper.type,
      `${(
        questionPaper.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    console.log(
      "Answer sheet:",
      answerSheet.name,
      answerSheet.type,
      `${(
        answerSheet.size /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // ==========================================
    // Convert PDFs/images to base64
    // ==========================================

    const [
      questionPaperBase64,
      answerSheetBase64,
    ] = await Promise.all([
      fileToBase64(
        questionPaper
      ),
      fileToBase64(
        answerSheet
      ),
    ]);

    console.log(
      "Files converted to base64."
    );

    // ==========================================
    // Gemini request
    // ==========================================

    let response: any = null;

    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {
      try {
        console.log(
          `Gemini request attempt ${attempt}/3`
        );

        console.log("QUESTION PAPER MIME:", questionPaper.type);
        console.log(
          "QUESTION PAPER BASE64 LENGTH:",
          questionPaperBase64.length
        );

        console.log("ANSWER SHEET MIME:", answerSheet.type);
        console.log(
          "ANSWER SHEET BASE64 LENGTH:",
          answerSheetBase64.length
        );


        response =
          await ai.models.generateContent(
            {
              model:
                "gemini-3.6-flash",

              contents: [
                {
                  text: `
              DOCUMENT 1 — QUESTION PAPER

              The following PDF is the question paper.
              Extract the questions from this document.
                  `,
                },
                {
                  inlineData: {
                    mimeType: questionPaper.type,
                    data: questionPaperBase64,
                  },
                },
                {
                  text: `
              DOCUMENT 2 — STUDENT HANDWRITTEN ANSWER SHEET

              The following PDF is the student's handwritten answer sheet.
              Extract and map the student's answers from this document.
                  `,
                },
                {
                  inlineData: {
                    mimeType: answerSheet.type,
                    data: answerSheetBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],

              config: {
                responseMimeType:
                  "application/json",

                temperature: 0,
              },
            }
          );

        console.log(
          "Gemini request successful."
        );

        break;
      } catch (error: any) {
        console.error(
          `Gemini attempt ${attempt} failed:`,
          error
        );

        const status =
          error?.status ||
          error?.code;

        // Retry temporary errors only.
        if (
          (
            status === 503 ||
            status === 429 ||
            status === 500
          ) &&
          attempt < 3
        ) {
          const delay =
            attempt * 3000;

          console.log(
            `Retrying in ${delay}ms...`
          );

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                delay
              )
          );

          continue;
        }

        throw error;
      }
    }

    if (!response) {
      throw new Error(
        "Gemini did not return a response."
      );
    }

    // ==========================================
    // Get response text
    // ==========================================

    const responseText =
      response.text;

    if (!responseText) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    console.log(
      "Gemini response received."
    );

    // ==========================================
    // Parse JSON
    // ==========================================

    const cleanedResponse =
      cleanJsonResponse(
        responseText
      );

    let rawResult: any;

    try {
      rawResult =
        JSON.parse(
          cleanedResponse
        );
    } catch {
      console.error(
        "Failed to parse Gemini JSON."
      );

      console.error(
        "Gemini response:",
        responseText
      );

      return NextResponse.json(
        {
          error:
            "Gemini returned invalid JSON.",

          rawResponse:
            responseText.substring(
              0,
              2000
            ),
        },
        {
          status: 500,
        }
      );
    }

    // ==========================================
    // Normalize result
    // ==========================================

    const result =
      normalizeResult(
        rawResult
      );

    result.processing = {
      model:
        "gemini-3.6-flash",

      questionPaperFile:
        questionPaper.name,

      answerSheetFile:
        answerSheet.name,
    };

    console.log(
      "Assessment processing completed."
    );

    console.log(
      "Total questions:",
      result.summary
        .totalQuestions
    );

    console.log(
      "Answered:",
      result.summary
        .answeredQuestions
    );

    console.log(
      "Unanswered:",
      result.summary
        .unansweredQuestions
    );

    console.log(
      "Unmatched:",
      result.summary
        .unmatchedAnswers
    );

    // ==========================================
    // Return result
    // ==========================================

    return NextResponse.json(
      result,
      {
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(
      "Assessment processing failed:",
      error
    );

    const status =
      error?.status ||
      error?.code;

    let message =
      "Failed to process assessment.";

    if (status === 401) {
      message =
        "Invalid Gemini API key.";
    } else if (status === 403) {
      message =
        "Gemini API access is not enabled for this API key/project.";
    } else if (status === 404) {
      message =
        "The configured Gemini model is not available for this API key.";
    } else if (status === 429) {
      message =
        "Gemini rate limit or quota exceeded. Please try again shortly.";
    } else if (status === 503) {
      message =
        "Gemini is temporarily unavailable. Please try again shortly.";
    } else if (
      error?.message
    ) {
      message =
        error.message;
    }

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}