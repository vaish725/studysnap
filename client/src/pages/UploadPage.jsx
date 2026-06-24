import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, BookOpen, Zap, ChevronRight, Loader2, X } from 'lucide-react';

const MODES = [
  { id: 'mcq',       label: 'Multiple choice', icon: '⓪', desc: '4 options per question' },
  { id: 'fillblank', label: 'Fill in the blank', icon: '✏️', desc: 'Complete the sentence' },
  { id: 'truefalse', label: 'True / False',      icon: '⚖️', desc: 'Quick fact check' },
];

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'medium', label: 'Medium', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'hard',   label: 'Hard',   color: 'text-red-600 bg-red-50 border-red-200' },
];

export default function UploadPage({ onQuizReady }) {
  const [image, setImage]           = useState(null);
  const [preview, setPreview]       = useState(null);
  const [mode, setMode]             = useState('mcq');
  const [difficulty, setDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WEBP, etc.)');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  async function handleGenerate() {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', image);
      form.append('mode', mode);
      form.append('difficulty', difficulty);
      form.append('questionCount', questionCount);

      const res = await fetch('/api/generate-quiz', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      onQuizReady(data.quiz, { mode, difficulty, questionCount });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
          <Zap size={14} />
          Powered by Gemini Vision
        </div>
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-2">StudySnap</h1>
        <p className="text-slate-500 text-lg">Snap your notes. Get a quiz. Study smarter.</p>
      </div>

      {/* Upload zone */}
      <div className="card p-6 mb-4">
        {!preview ? (
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileRef.current.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'}`}
          >
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
                <Camera size={28} className="text-brand-500" />
              </div>
            </div>
            <p className="font-medium text-slate-700 mb-1">Drop your notes photo here</p>
            <p className="text-sm text-slate-400">or click to browse — JPG, PNG, WEBP up to 10 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden">
            <img src={preview} alt="Uploaded notes" className="w-full max-h-72 object-contain bg-slate-100 rounded-xl" />
            <button
              onClick={() => { setImage(null); setPreview(null); }}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
            >
              <X size={16} />
            </button>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <BookOpen size={14} />
              <span>{image?.name}</span>
              <button
                onClick={() => fileRef.current.click()}
                className="ml-auto text-brand-600 hover:underline text-xs"
              >
                Change photo
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}
      </div>

      {/* Config */}
      <div className="card p-6 mb-4 space-y-6">
        {/* Mode */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-3 block">Quiz type</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-3 rounded-xl border text-left transition-all
                  ${mode === m.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="text-lg mb-1">{m.icon}</div>
                <div className={`text-xs font-medium ${mode === m.id ? 'text-brand-700' : 'text-slate-700'}`}>{m.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-3 block">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all
                  ${difficulty === d.id ? d.color : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Question count */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-3 flex items-center justify-between">
            Number of questions
            <span className="text-brand-600 font-semibold">{questionCount}</span>
          </label>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>3 quick</span>
            <span>10 thorough</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={!image || loading}
        className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3.5"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Gemini is reading your notes…
          </>
        ) : (
          <>
            Generate quiz
            <ChevronRight size={18} />
          </>
        )}
      </button>

      {loading && (
        <p className="text-center text-sm text-slate-400 mt-3 animate-pulse-soft">
          Extracting concepts and crafting questions…
        </p>
      )}
    </div>
  );
}
