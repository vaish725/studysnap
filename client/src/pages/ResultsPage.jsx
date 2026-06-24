import { useRef } from 'react';
import { RotateCcw, Plus, Download, Copy, Check, Trophy, Clock, Target } from 'lucide-react';
import { useState } from 'react';

function ScoreRing({ score }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1s ease-out' }}
      />
      <text x="70" y="66" textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily="Inter,sans-serif">
        {score}%
      </text>
      <text x="70" y="84" textAnchor="middle" fill="#94a3b8" fontSize="12" fontFamily="Inter,sans-serif">
        score
      </text>
    </svg>
  );
}

export default function ResultsPage({ results, quiz, config, onRetry, onNewQuiz }) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef();

  const score = Math.round((results.correctCount / results.totalQuestions) * 100);
  const grade = score >= 90 ? { label: 'Excellent!', emoji: '🏆' }
              : score >= 70 ? { label: 'Good job!', emoji: '👏' }
              : score >= 50 ? { label: 'Keep practicing', emoji: '💪' }
              :               { label: 'Keep going!', emoji: '📚' };

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async function handleCopy() {
    const lines = quiz.questions.map((q, i) =>
      `Q${i + 1}: ${q.question}\nAnswer: ${
        config.mode === 'mcq' ? q.options[q.correctAnswer] : q.correctAnswer
      }\n`
    );
    await navigator.clipboard.writeText(`${quiz.topic} — StudySnap Quiz\n\n${lines.join('\n')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      html2pdf()
        .set({ margin: 10, filename: `${quiz.topic}-quiz.pdf`, html2canvas: { scale: 2 } })
        .from(printRef.current)
        .save();
    } catch (e) {
      console.error('PDF error', e);
      window.print();
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Score card */}
      <div className="card p-8 text-center mb-4">
        <div className="text-3xl mb-2">{grade.emoji}</div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">{grade.label}</h2>
        <p className="text-slate-500 mb-6 text-sm">{quiz.topic}</p>

        <div className="flex justify-center mb-6">
          <ScoreRing score={score} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: <Check size={16} className="text-emerald-600" />, label: 'Correct', value: results.correctCount, color: 'text-emerald-600' },
            { icon: <Target size={16} className="text-brand-500" />, label: 'Total', value: results.totalQuestions, color: 'text-brand-600' },
            { icon: <Clock size={16} className="text-slate-500" />, label: 'Time', value: formatTime(results.timeSeconds), color: 'text-slate-700' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 rounded-xl p-3">
              <div className="flex justify-center mb-1">{stat.icon}</div>
              <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Answer breakdown */}
      <div className="card p-6 mb-4" ref={printRef}>
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Trophy size={16} className="text-brand-500" />
          Answer breakdown
        </h3>
        <div className="space-y-3">
          {quiz.questions.map((q, i) => {
            const correct = results.submitted[q.id];
            return (
              <div key={q.id} className={`rounded-xl p-4 border ${correct ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${correct ? 'bg-emerald-500' : 'bg-red-400'}`}>
                    {correct ? <Check size={11} className="text-white" /> : <span className="text-white text-xs font-bold">✗</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 mb-1">Q{i + 1}. {q.question}</p>
                    <p className="text-xs text-slate-500">
                      Correct: <span className="font-medium text-slate-700">
                        {config.mode === 'mcq'
                          ? `${['A','B','C','D'][q.correctAnswer]}. ${q.options[q.correctAnswer]}`
                          : String(q.correctAnswer)}
                      </span>
                    </p>
                    {!correct && q.explanation && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button onClick={handleCopy} className="btn-secondary flex items-center justify-center gap-2 text-sm">
          {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          {copied ? 'Copied!' : 'Copy quiz'}
        </button>
        <button onClick={handleDownload} className="btn-secondary flex items-center justify-center gap-2 text-sm">
          <Download size={15} />
          Download PDF
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onRetry} className="btn-secondary flex items-center justify-center gap-2">
          <RotateCcw size={16} />
          Retry quiz
        </button>
        <button onClick={onNewQuiz} className="btn-primary flex items-center justify-center gap-2">
          <Plus size={16} />
          New quiz
        </button>
      </div>
    </div>
  );
}
