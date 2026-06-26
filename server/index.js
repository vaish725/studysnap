import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// attempts:1 disables the SDK's built-in p-retry loop (default is 5 attempts with exponential backoff).
// Without this, a single 429 triggers 4 internal retries (~15s of backoff) before the error surfaces,
// which compounds with any outer retry logic and blows past the request timeout.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { retryOptions: { attempts: 1 } },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'public')));
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MODEL = 'gemini-2.5-flash';
const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } };

function withTimeout(promise, ms, msg = `Request timed out after ${ms / 1000}s`) {
  const timer = new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
  return Promise.race([promise, timer]);
}

function geminiError(err, fallback) {
  if (err.message?.includes('429') || err.status === 429) {
    return { status: 429, message: 'Gemini API quota exceeded. Please wait a moment and try again.' };
  }
  if (err.message?.includes('timed out')) {
    return { status: 504, message: err.message };
  }
  return { status: 500, message: err.message || fallback };
}

app.post('/api/generate-quiz', upload.single('image'), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    if (!ALLOWED_MIMES.includes(req.file.mimetype)) return res.status(400).json({ error: 'Invalid file type. Please upload an image.' });
    const { mode = 'mcq', difficulty = 'medium', questionCount = 5 } = req.body;

    const modeInstructions = {
      mcq:       `Generate ${questionCount} multiple-choice questions. Each must have exactly 4 options (A,B,C,D) and one correct answer (correctAnswer is the 0-based index 0-3).`,
      fillblank: `Generate ${questionCount} fill-in-the-blank questions. Each should have a sentence with one blank (use "____") and the correct word/phrase as correctAnswer.`,
      truefalse: `Generate ${questionCount} true/false questions. correctAnswer must be boolean true or false.`,
      mixed:     `Generate ${questionCount} questions mixing all three types roughly evenly. Each question MUST include a "type" field set to "mcq", "fillblank", or "truefalse". MCQ questions must have an "options" array of 4 strings and correctAnswer as a 0-based index. Fill-in-the-blank questions must have "____" in the question and a string correctAnswer. True/false questions must have a boolean correctAnswer.`,
    };
    const difficultyInstructions = {
      easy:   'Keep questions straightforward, testing basic recall and comprehension.',
      medium: 'Include a mix of recall and application. MCQ distractors should be plausible.',
      hard:   'Focus on deeper understanding and edge cases. Make distractors very similar to the correct answer.',
    };

    const templateQ = mode === 'mcq'
      ? `{"id":1,"question":"...?","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}`
      : mode === 'fillblank'
      ? `{"id":1,"question":"Sentence with ____.","correctAnswer":"word","explanation":"..."}`
      : mode === 'truefalse'
      ? `{"id":1,"question":"Statement.","correctAnswer":true,"explanation":"..."}`
      : `{"id":1,"type":"mcq","question":"...?","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."},{"id":2,"type":"fillblank","question":"Sentence with ____.","correctAnswer":"word","explanation":"..."},{"id":3,"type":"truefalse","question":"Statement.","correctAnswer":true,"explanation":"..."}`;

    const prompt = `You are a professional educator creating a study quiz from notes in an image.
Analyze the image carefully and extract the key concepts, facts, and information.
${modeInstructions[mode] || modeInstructions.mcq}
Difficulty: ${difficultyInstructions[difficulty] || difficultyInstructions.medium}
Return ONLY a valid JSON object (no markdown, no backticks):
{"topic":"Topic from notes","questions":[${templateQ}]}`;

    const imageData = { inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } };

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: [{ parts: [{ text: prompt }, imageData] }],
        config: NO_THINKING,
      }),
      30000,
      'Quiz generation timed out. Please try again.'
    );

    const text = result.text.trim().replace(/```json|```/g, '').trim();
    let quiz;
    try {
      quiz = JSON.parse(text);
    } catch {
      return res.status(500).json({ error: 'Failed to parse quiz response. Please try again.' });
    }
    if (typeof quiz.topic !== 'string' || !Array.isArray(quiz.questions)) {
      return res.status(500).json({ error: 'Quiz format unexpected. Please try again.' });
    }
    if (!quiz.topic) quiz.topic = 'Study Notes';
    res.json({ success: true, quiz, mode, difficulty });
  } catch (err) {
    console.error('Quiz generation error:', err.message);
    const { status, message } = geminiError(err, 'Failed to generate quiz');
    res.status(status).json({ error: message });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer } = req.body;
    const prompt = `A student answered a quiz question incorrectly. Give a friendly, encouraging 2-3 sentence explanation.
Question: ${question}
Student answered: ${userAnswer}
Correct answer: ${correctAnswer}
Be concise, educational, and supportive. Return only plain text.`;

    const result = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: NO_THINKING,
      }),
      15000,
      'Explanation timed out.'
    );
    res.json({ explanation: result.text });
  } catch (err) {
    console.error('Explanation error:', err.message);
    const { status, message } = geminiError(err, 'Failed to get explanation');
    res.status(status).json({ error: message });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (_, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StudySnap server running on :${PORT}`));
