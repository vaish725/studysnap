import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'public')));
}

app.post('/api/generate-quiz', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const { mode = 'mcq', difficulty = 'medium', questionCount = 5 } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const modeInstructions = {
      mcq:       `Generate ${questionCount} multiple-choice questions. Each must have exactly 4 options (A,B,C,D) and one correct answer (correctAnswer is the 0-based index 0-3).`,
      fillblank: `Generate ${questionCount} fill-in-the-blank questions. Each should have a sentence with one blank (use "____") and the correct word/phrase as correctAnswer.`,
      truefalse: `Generate ${questionCount} true/false questions. correctAnswer must be boolean true or false.`,
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
      : `{"id":1,"question":"Statement.","correctAnswer":true,"explanation":"..."}`;

    const prompt = `You are a professional educator creating a study quiz from notes in an image.
Analyze the image carefully and extract the key concepts, facts, and information.
${modeInstructions[mode] || modeInstructions.mcq}
Difficulty: ${difficultyInstructions[difficulty] || difficultyInstructions.medium}
Return ONLY a valid JSON object (no markdown, no backticks):
{"topic":"Topic from notes","questions":[${templateQ}]}`;

    const imageData = { inlineData: { data: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } };
    const result = await model.generateContent([prompt, imageData]);
    const text = result.response.text().trim().replace(/```json|```/g, '').trim();
    const quiz = JSON.parse(text);
    res.json({ success: true, quiz, mode, difficulty });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate quiz' });
  }
});

app.post('/api/explain', async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer, mode } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `A student answered a quiz question incorrectly. Give a friendly, encouraging 2-3 sentence explanation.
Question: ${question}
Student answered: ${userAnswer}
Correct answer: ${correctAnswer}
Be concise, educational, and supportive. Return only plain text.`;
    const result = await model.generateContent(prompt);
    res.json({ explanation: result.response.text() });
  } catch (err) {
    console.error('Explanation error:', err);
    res.status(500).json({ error: 'Failed to get explanation' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV === 'production') {
  app.get('*', (_, res) => res.sendFile(join(__dirname, 'public', 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StudySnap server running on :${PORT}`));
