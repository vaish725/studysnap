import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Clock, Check, X, Loader2 } from 'lucide-react';

export default function QuizPage({ quiz, config, onComplete, onBack }) {
  const [current, setCurrent]         = useState(0);
  const [answers, setAnswers]         = useState({});
  const [submitted, setSubmitted]     = useState({});
  const [explanations, setExplanations] = useState({});
  const [loadingExp, setLoadingExp]   = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [fillValue, setFillValue]     = useState('');
  const startTime = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const question      = quiz.questions[current];
  const totalQ        = quiz.questions.length;
  const isLast        = current === totalQ - 1;
  const isAnswered    = submitted[question.id] !== undefined;
  const effectiveMode = config.mode === 'mixed' ? (question.type || 'mcq') : config.mode;

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function checkAnswer(userAnswer) {
    if (isAnswered) return;
    const correct = question.correctAnswer;
    let isCorrect;

    if (effectiveMode === 'mcq' || effectiveMode === 'truefalse') {
      isCorrect = userAnswer === correct;
    } else {
      isCorrect = userAnswer.trim().toLowerCase() === String(correct).toLowerCase();
    }

    setAnswers((prev) => ({ ...prev, [question.id]: userAnswer }));
    setSubmitted((prev) => ({ ...prev, [question.id]: isCorrect }));

    if (!isCorrect) fetchExplanation(question, userAnswer, correct);
  }

  async function fetchExplanation(q, userAnswer, correctAnswer) {
    setLoadingExp(true);
    try {
      const qMode = config.mode === 'mixed' ? (q.type || 'mcq') : config.mode;
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          userAnswer: qMode === 'mcq' ? q.options[userAnswer] : String(userAnswer),
          correctAnswer: qMode === 'mcq' ? q.options[correctAnswer] : String(correctAnswer),
          mode: qMode,
        }),
      });
      const data = await res.json();
      setExplanations((prev) => ({ ...prev, [q.id]: data.explanation }));
    } catch {
      setExplanations((prev) => ({ ...prev, [q.id]: q.explanation }));
    } finally {
      setLoadingExp(false);
    }
  }

  function handleNext() {
    if (current < totalQ - 1) {
      setCurrent((c) => c + 1);
      setFillValue('');
    }
  }

  function handleFinish() {
    onComplete({
      answers,
      submitted,
      explanations,
      totalQuestions: totalQ,
      correctCount: Object.values(submitted).filter(Boolean).length,
      timeSeconds: elapsed,
    });
  }

  // MCQ option styling
  function mcqOptionClass(idx) {
    const base = 'w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ';
    if (!isAnswered) return base + 'border-slate-200 hover:border-brand-300 hover:bg-brand-50 cursor-pointer';
    if (idx === question.correctAnswer) return base + 'border-emerald-400 bg-emerald-50 text-emerald-800';
    if (idx === answers[question.id] && !submitted[question.id]) return base + 'border-red-400 bg-red-50 text-red-800';
    return base + 'border-slate-100 bg-slate-50 text-slate-400';
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{quiz.topic}</span>
          <div className="flex items-center gap-1" aria-label={`Elapsed time: ${formatTime(elapsed)}`}>
            <Clock size={14} />
            <span className="font-mono">{formatTime(elapsed)}</span>
          </div>
        </div>
        <span className="text-sm text-slate-400">{current + 1} / {totalQ}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-500"
          style={{ width: `${((current + 1) / totalQ) * 100}%` }}
        />
      </div>

      {/* Question card */}
      <div className="card p-6 mb-4 animate-slide-up" key={question.id}>
        <div className="flex items-start gap-3 mb-6">
          <span className="text-xs font-medium text-brand-600 bg-brand-50 rounded-lg px-2.5 py-1 mt-0.5 shrink-0">
            Q{current + 1}
          </span>
          <p className="text-lg font-medium text-slate-800 leading-relaxed">{question.question}</p>
        </div>

        {/* MCQ */}
        {effectiveMode === 'mcq' && (
          <div className="space-y-2.5">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => checkAnswer(idx)}
                className={mcqOptionClass(idx)}
                disabled={isAnswered}
              >
                <span className="w-6 h-6 rounded-lg border border-current flex items-center justify-center text-xs font-medium shrink-0">
                  {['A', 'B', 'C', 'D'][idx]}
                </span>
                <span className="text-sm">{opt}</span>
                {isAnswered && idx === question.correctAnswer && (
                  <Check size={16} className="ml-auto text-emerald-600 shrink-0" />
                )}
                {isAnswered && idx === answers[question.id] && !submitted[question.id] && (
                  <X size={16} className="ml-auto text-red-500 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* True / False */}
        {effectiveMode === 'truefalse' && (
          <div className="grid grid-cols-2 gap-3">
            {[true, false].map((val) => {
              const selected = answers[question.id] === val;
              const isCorrect = val === question.correctAnswer;
              let cls = 'p-4 rounded-xl border font-medium transition-all ';
              if (!isAnswered) cls += 'border-slate-200 hover:border-brand-300 hover:bg-brand-50 cursor-pointer text-slate-700';
              else if (isCorrect)  cls += 'border-emerald-400 bg-emerald-50 text-emerald-800';
              else if (selected)   cls += 'border-red-400 bg-red-50 text-red-700';
              else                 cls += 'border-slate-100 text-slate-400';
              return (
                <button key={String(val)} onClick={() => checkAnswer(val)} disabled={isAnswered} className={cls}>
                  {val ? <Check size={20} className="mb-1" /> : <X size={20} className="mb-1" />}
                  {val ? 'True' : 'False'}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill in the blank */}
        {effectiveMode === 'fillblank' && (
          <div className="space-y-3">
            <input
              type="text"
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isAnswered && fillValue.trim() && checkAnswer(fillValue.trim())}
              disabled={isAnswered}
              placeholder="Type your answer…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent disabled:bg-slate-50"
              autoFocus
            />
            {!isAnswered && (
              <button
                onClick={() => checkAnswer(fillValue.trim())}
                disabled={!fillValue.trim()}
                className="btn-primary w-full"
              >
                Submit answer
              </button>
            )}
            {isAnswered && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium
                ${submitted[question.id] ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {submitted[question.id] ? <Check size={16} /> : <X size={16} />}
                {submitted[question.id] ? 'Correct!' : `Correct answer: "${question.correctAnswer}"`}
              </div>
            )}
          </div>
        )}

        {/* Result feedback */}
        {isAnswered && (
          <div className="mt-4 animate-fade-in">
            {submitted[question.id] ? (
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                <Check size={16} className="shrink-0" />
                Correct!
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2">
                <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                  {loadingExp
                    ? <><Loader2 size={12} className="animate-spin" /> Getting explanation…</>
                    : 'Explanation'}
                </p>
                {!loadingExp && (
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {explanations[question.id] || question.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {isAnswered && (
        <div className="flex gap-3 animate-fade-in">
          {!isLast ? (
            <button onClick={handleNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
              Next question
              <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleFinish} className="btn-primary flex-1 flex items-center justify-center gap-2">
              See results
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}

      {/* Dots navigation */}
      <div className="flex justify-center gap-1.5 mt-6">
        {quiz.questions.map((q, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === current ? 'bg-brand-500 w-4' :
              submitted[q.id] === true ? 'bg-emerald-400' :
              submitted[q.id] === false ? 'bg-red-400' :
              'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
