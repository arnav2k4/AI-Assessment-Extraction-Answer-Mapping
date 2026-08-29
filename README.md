# VedaAI Assessment

An AI-assisted grading tool. Upload a question paper and a student's handwritten answer sheet, and Gemini extracts the questions, matches each one to the student's answer, grades it, and highlights exactly where the answer appears on the sheet.

## Live Demo

🔗 **[your-vercel-link-here.vercel.app](#)** — no setup required, just open the link.

## Features

- Extracts every question from the question paper, preserving original numbering (including sub-parts like `1(a)`, `1(b)`)
- Matches each question to the student's answer, even if answered out of order or across multiple pages
- Grades each answer with a score (`marksAwarded` / `maxMarks`) and AI feedback
- Highlights the exact answer region on the answer sheet PDF, with zoom and page navigation
- Flags answers that couldn't be confidently matched to any question

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org) 18 or later
- A [Gemini API key](https://aistudio.google.com/apikey) (free to create)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/vedaai-assessment.git
cd vedaai-assessment
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your environment variable

Copy the example file:

```bash
cp .env.example .env
```

Then open `.env` and add your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

> `.env` is gitignored and never committed. Each person running this project needs their own key.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Google Gemini API](https://ai.google.dev) for question extraction, answer matching, and grading
- [react-pdf](https://github.com/wojtekmaj/react-pdf) / `pdfjs-dist` for in-browser PDF rendering

## Deployment

This project is deployed on [Vercel](https://vercel.com). To deploy your own copy:

1. Push this repository to GitHub.
2. Import it into Vercel ([vercel.com/new](https://vercel.com/new)).
3. Leave **Root Directory** as the default — the Next.js app is at the repo root.
4. Add an environment variable `GEMINI_API_KEY` with your key under Project Settings → Environment Variables.
5. Deploy.
