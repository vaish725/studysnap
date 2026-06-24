import { useState } from 'react';
import UploadPage from './pages/UploadPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';

// App-level state machine: upload → quiz → results
export default function App() {
  const [screen, setScreen] = useState('upload'); // 'upload' | 'quiz' | 'results'
  const [quizData, setQuizData] = useState(null);
  const [quizConfig, setQuizConfig] = useState(null);
  const [results, setResults] = useState(null);

  function handleQuizReady(data, config) {
    setQuizData(data);
    setQuizConfig(config);
    setScreen('quiz');
  }

  function handleQuizComplete(resultData) {
    setResults(resultData);
    setScreen('results');
  }

  function handleRestart() {
    setScreen('upload');
    setQuizData(null);
    setQuizConfig(null);
    setResults(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {screen === 'upload' && (
        <UploadPage onQuizReady={handleQuizReady} />
      )}
      {screen === 'quiz' && (
        <QuizPage
          quiz={quizData}
          config={quizConfig}
          onComplete={handleQuizComplete}
          onBack={() => setScreen('upload')}
        />
      )}
      {screen === 'results' && (
        <ResultsPage
          results={results}
          quiz={quizData}
          config={quizConfig}
          onRetry={() => setScreen('quiz')}
          onNewQuiz={handleRestart}
        />
      )}
    </div>
  );
}
