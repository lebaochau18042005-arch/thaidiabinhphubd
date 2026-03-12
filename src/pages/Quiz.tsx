import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Loader2, RefreshCcw, Home, Clock, Trophy, Star, ThumbsUp, BookOpen, Frown } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { questions } from '../data';
import { Question, QuestionType, QuizAttempt, UserProfile } from '../types';
import { getExplanation } from '../services/ai';
import { cn } from '../utils/cn';

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') as 'lesson' | 'topic' | 'exam' || 'exam';
  const filter = searchParams.get('filter');
  const examId = searchParams.get('examId');
  const countParam = searchParams.get('count');

  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Answer states
  const [mcAnswer, setMcAnswer] = useState<number | null>(null);
  const [tfAnswer, setTfAnswer] = useState<Record<string, boolean>>({});
  const [saAnswer, setSaAnswer] = useState<string>('');
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [isFinished, setIsFinished] = useState(false);
  const [startTime] = useState(Date.now());
  
  // Timer states (50 minutes = 3000 seconds) — only for exam mode
  const [timeLeft, setTimeLeft] = useState(3000);
  const [timeRanOut, setTimeRanOut] = useState(false);
  
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const savedProfile = localStorage.getItem('examGeoProfile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
    }
  }, []);

  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      
      if (mode === 'exam' && examId) {
        // Load exam from localStorage (created by TeacherDashboard)
        try {
          const storedExam = localStorage.getItem(`exam_${examId}`);
          if (storedExam) {
            const examData = JSON.parse(storedExam);
            setQuizQuestions(examData.questions);
          } else {
            alert('Không tìm thấy mã đề thi! Vui lòng kiểm tra lại.');
            navigate('/exam');
            return;
          }
        } catch (err) {
          console.error('Lỗi khi tải đề thi:', err);
          alert('Lỗi khi đọc dữ liệu đề thi!');
          navigate('/exam');
          return;
        }
      } else {
        let preferredPool = questions;
        if (mode === 'lesson' && filter) {
          preferredPool = questions.filter(q => q.lesson === filter);
        } else if (mode === 'topic' && filter) {
          preferredPool = questions.filter(q => q.topic === filter);
        }

        const getQuestions = (type: QuestionType, count: number) => {
          let selected = preferredPool.filter(q => q.type === type);
          selected = selected.sort(() => 0.5 - Math.random());
          
          if (selected.length >= count) {
            return selected.slice(0, count);
          }
          
          const remaining = count - selected.length;
          let others = questions.filter(q => q.type === type && !selected.includes(q));
          others = others.sort(() => 0.5 - Math.random());
          return [...selected, ...others.slice(0, remaining)];
        };

        let finalQuestions: Question[] = [];
        if (mode === 'exam') {
          finalQuestions = [
            ...getQuestions('multiple_choice', 18),
            ...getQuestions('true_false', 4),
            ...getQuestions('short_answer', 6)
          ];
        } else if (countParam) {
          const count = countParam === 'all' ? preferredPool.length : parseInt(countParam, 10);
          let shuffled = [...preferredPool].sort(() => 0.5 - Math.random());
          finalQuestions = shuffled.slice(0, count);
        } else {
          finalQuestions = [
            ...getQuestions('multiple_choice', 12),
            ...getQuestions('true_false', 4),
            ...getQuestions('short_answer', 6)
          ];
        }
        setQuizQuestions(finalQuestions);
      }
      
      setTimeLeft(3000);
      setIsLoading(false);
    };

    loadQuestions();
  }, [mode, filter, examId, navigate]);

  // Timer only runs in exam mode
  useEffect(() => {
    if (mode !== 'exam') return;
    if (isFinished || quizQuestions.length === 0) return;
    
    if (timeLeft <= 0) {
      setTimeRanOut(true);
      finishQuiz(scoreRef.current);
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, isFinished, quizQuestions.length, mode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = quizQuestions[currentIndex];

  const isAnswerComplete = () => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === 'multiple_choice') return mcAnswer !== null;
    if (currentQuestion.type === 'true_false') return Object.keys(tfAnswer).length === currentQuestion.statements.length;
    if (currentQuestion.type === 'short_answer') return saAnswer.trim() !== '';
    return false;
  };

  const normalizeAnswer = (val: string) => val.trim().toLowerCase().replace(/\s+/g, ' ');

  const handleSubmit = async () => {
    if (!isAnswerComplete() || isSubmitted) return;
    
    setIsSubmitted(true);
    let isCorrect = false;
    let userAnswerForAi: any = null;
    let pointsEarned = 0;
    
    if (currentQuestion.type === 'multiple_choice') {
      isCorrect = mcAnswer === currentQuestion.correctAnswerIndex;
      userAnswerForAi = mcAnswer;
      if (isCorrect) pointsEarned = 0.25;
    } else if (currentQuestion.type === 'true_false') {
      let correctCount = 0;
      currentQuestion.statements.forEach(stmt => {
        if (tfAnswer[stmt.id] === stmt.isTrue) correctCount++;
      });
      isCorrect = correctCount === currentQuestion.statements.length;
      userAnswerForAi = tfAnswer;
      
      if (correctCount === 1) pointsEarned = 0.1;
      else if (correctCount === 2) pointsEarned = 0.25;
      else if (correctCount === 3) pointsEarned = 0.5;
      else if (correctCount === 4) pointsEarned = 1.0;
      
    } else if (currentQuestion.type === 'short_answer') {
      isCorrect = normalizeAnswer(saAnswer) === normalizeAnswer(currentQuestion.correctAnswer.toString());
      userAnswerForAi = saAnswer.trim();
      if (isCorrect) pointsEarned = 0.25;
    }
    
    const newScore = scoreRef.current + pointsEarned;
    scoreRef.current = newScore;
    setScore(newScore);
    setIsAnswerCorrect(isCorrect);
    
    setIsAiLoading(true);
    const explanation = await getExplanation(
      currentQuestion,
      userAnswerForAi,
      isCorrect,
      profile || undefined
    );
    setAiExplanation(explanation);
    setIsAiLoading(false);
  };

  const handleNext = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (currentIndex < quizQuestions.length - 1) {
      setCurrentIndex(i => i + 1);
      setMcAnswer(null);
      setTfAnswer({});
      setSaAnswer('');
      setIsSubmitted(false);
      setIsAnswerCorrect(null);
      setAiExplanation(null);
    } else {
      finishQuiz(scoreRef.current);
    }
  };

  const finishQuiz = (finalScore: number) => {
    setIsFinished(true);
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    const attempt: QuizAttempt = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      mode,
      title: mode === 'exam' ? 'Đề thi tham khảo 2025' : (filter || 'Luyện tập'),
      score: Number(finalScore.toFixed(2)),
      totalQuestions: quizQuestions.length,
      timeSpent
    };

    const history = JSON.parse(localStorage.getItem('examGeoHistory') || '[]');
    localStorage.setItem('examGeoHistory', JSON.stringify([attempt, ...history]));
  };

  const maxScore = quizQuestions.reduce((acc, q) => {
    if (q.type === 'multiple_choice') return acc + 0.25;
    if (q.type === 'true_false') return acc + 1.0;
    if (q.type === 'short_answer') return acc + 0.25;
    return acc;
  }, 0);

  const getGrade = (s: number, max: number) => {
    const normalized = max > 0 ? (s / max) * 10 : 0;
    if (normalized >= 9.0) return { label: 'Xuất sắc', icon: Trophy, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (normalized >= 8.0) return { label: 'Giỏi', icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (normalized >= 6.5) return { label: 'Khá', icon: ThumbsUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    if (normalized >= 5.0) return { label: 'Trung bình', icon: BookOpen, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
    return { label: 'Cần cố gắng thêm', icon: Frown, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-slate-500 font-medium">Đang tải câu hỏi...</p>
      </div>
    );
  }

  if (quizQuestions.length === 0) {
    return <div className="text-center p-10">Không tìm thấy câu hỏi nào.</div>;
  }

  if (isFinished) {
    const grade = getGrade(score, maxScore);
    const GradeIcon = grade.icon;
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center"
      >
        {timeRanOut && (
          <div className="mb-6 inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-full font-medium">
            <AlertCircle className="w-5 h-5" />
            Đã hết thời gian làm bài!
          </div>
        )}
        
        <div className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-lg border mb-6", grade.bg, grade.color, grade.border)}>
          <GradeIcon className="w-6 h-6" />
          {grade.label}
        </div>

        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Hoàn thành!</h2>
        <p className="text-slate-600 mb-8">Bạn đã hoàn thành bài thi {mode === 'exam' ? 'tổng hợp' : filter}</p>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-50 p-4 rounded-2xl">
            <div className="text-sm text-slate-500 mb-1">Điểm số</div>
            <div className="text-3xl font-bold text-emerald-600">{score.toFixed(2)} / {maxScore.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">({maxScore > 0 ? ((score / maxScore) * 10).toFixed(2) : '0.00'} / 10)</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl">
            <div className="text-sm text-slate-500 mb-1">Thời gian</div>
            <div className="text-3xl font-bold text-blue-600">{Math.floor(timeSpent / 60)}p {timeSpent % 60}s</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => navigate(0)}
            className="px-6 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-semibold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCcw className="w-5 h-5" />
            Làm lại
          </button>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Về trang chủ
          </button>
        </div>
      </motion.div>
    );
  }

  const progressPercent = Math.round(((currentIndex) / quizQuestions.length) * 100);

  return (
    <div className="max-w-3xl mx-auto pb-24 md:pb-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <div className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
            Câu {currentIndex + 1} / {quizQuestions.length}
          </div>
          {mode === 'exam' && (
            <div className={cn(
              "text-sm font-medium px-3 py-1 rounded-full shadow-sm border flex items-center gap-1.5 transition-colors",
              timeLeft < 300 ? "bg-rose-50 text-rose-600 border-rose-100 animate-pulse" : "bg-white text-slate-600 border-slate-100"
            )}>
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          )}
        </div>
        <div className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
          Điểm: {score.toFixed(2)}
        </div>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-6 overflow-hidden">
        <motion.div
          className="bg-emerald-500 h-1.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-3 mb-6">
            <span className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold">
              {currentIndex + 1}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">
                  {currentQuestion.type === 'multiple_choice' ? 'Phần 1: Trắc nghiệm khách quan' : 
                   currentQuestion.type === 'true_false' ? 'Phần 2: Trắc nghiệm Đúng/Sai' : 
                   'Phần 3: Trả lời ngắn'}
                </span>
                {currentQuestion.cognitiveLevel && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {currentQuestion.cognitiveLevel}
                  </span>
                )}
              </div>
              <div className="text-lg md:text-xl font-medium text-slate-800 leading-relaxed prose prose-slate max-w-none prose-table:w-auto prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 prose-table:border-collapse prose-table:border prose-th:border prose-td:border">
                <Markdown remarkPlugins={[remarkGfm]}>{currentQuestion.text}</Markdown>
              </div>
              {currentQuestion.context && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm text-slate-700 border border-slate-200">
                  {currentQuestion.context}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {currentQuestion.type === 'multiple_choice' && currentQuestion.options.map((option, idx) => {
              const isSelected = mcAnswer === idx;
              const isCorrect = idx === currentQuestion.correctAnswerIndex;
              
              let optionStateClass = "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50";
              if (isSubmitted) {
                if (isCorrect) {
                  optionStateClass = "border-emerald-500 bg-emerald-50 text-emerald-800";
                } else if (isSelected) {
                  optionStateClass = "border-rose-500 bg-rose-50 text-rose-800";
                } else {
                  optionStateClass = "border-slate-100 opacity-50";
                }
              } else if (isSelected) {
                optionStateClass = "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500";
              }

              return (
                <button
                  key={idx}
                  onClick={() => !isSubmitted && setMcAnswer(idx)}
                  disabled={isSubmitted}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4",
                    optionStateClass
                  )}
                >
                  <span className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm",
                    isSubmitted && isCorrect ? "border-emerald-500 bg-emerald-500 text-white" :
                    isSubmitted && isSelected && !isCorrect ? "border-rose-500 bg-rose-500 text-white" :
                    isSelected ? "border-emerald-500 text-emerald-600" : "border-slate-300 text-slate-500"
                  )}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {isSubmitted && isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                  {isSubmitted && isSelected && !isCorrect && <XCircle className="w-6 h-6 text-rose-500" />}
                </button>
              );
            })}

            {currentQuestion.type === 'true_false' && (
              <div className="space-y-4">
                {currentQuestion.statements.map((stmt, idx) => {
                  const isTrueSelected = tfAnswer[stmt.id] === true;
                  const isFalseSelected = tfAnswer[stmt.id] === false;
                  const isCorrectlyAnswered = tfAnswer[stmt.id] === stmt.isTrue;

                  return (
                    <div key={stmt.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                      <p className="font-medium text-slate-800 mb-3"><span className="font-bold text-emerald-600 mr-2">{String.fromCharCode(97 + idx)})</span>{stmt.text}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => !isSubmitted && setTfAnswer(prev => ({...prev, [stmt.id]: true}))}
                          disabled={isSubmitted}
                          className={cn(
                            "flex-1 py-2 rounded-xl border-2 font-medium transition-colors",
                            isSubmitted && stmt.isTrue ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                            isSubmitted && isTrueSelected && !stmt.isTrue ? "border-rose-500 bg-rose-50 text-rose-700" :
                            isTrueSelected ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                            "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                          )}
                        >
                          Đúng
                        </button>
                        <button
                          onClick={() => !isSubmitted && setTfAnswer(prev => ({...prev, [stmt.id]: false}))}
                          disabled={isSubmitted}
                          className={cn(
                            "flex-1 py-2 rounded-xl border-2 font-medium transition-colors",
                            isSubmitted && !stmt.isTrue ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                            isSubmitted && isFalseSelected && stmt.isTrue ? "border-rose-500 bg-rose-50 text-rose-700" :
                            isFalseSelected ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                            "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                          )}
                        >
                          Sai
                        </button>
                      </div>
                      {isSubmitted && (
                        <div className="mt-2 text-sm flex items-center gap-1">
                          {isCorrectlyAnswered ? (
                            <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Trả lời đúng</span>
                          ) : (
                            <span className="text-rose-600 flex items-center gap-1"><XCircle className="w-4 h-4"/> Trả lời sai — Đáp án: <strong>{stmt.isTrue ? 'Đúng' : 'Sai'}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentQuestion.type === 'short_answer' && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhập đáp án của bạn:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={saAnswer}
                    onChange={(e) => setSaAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && isAnswerComplete() && !isSubmitted) handleSubmit(); }}
                    disabled={isSubmitted}
                    placeholder="Nhập số..."
                    className={cn(
                      "flex-1 p-4 rounded-xl border-2 outline-none transition-shadow text-lg font-medium",
                      isSubmitted && normalizeAnswer(saAnswer) === normalizeAnswer(currentQuestion.correctAnswer.toString()) ? "border-emerald-500 bg-emerald-50 text-emerald-800" :
                      isSubmitted && normalizeAnswer(saAnswer) !== normalizeAnswer(currentQuestion.correctAnswer.toString()) ? "border-rose-500 bg-rose-50 text-rose-800" :
                      "border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-white"
                    )}
                  />
                  {currentQuestion.unit && <span className="text-slate-500 font-medium">{currentQuestion.unit}</span>}
                </div>
                {isSubmitted && (
                  <div className="mt-4">
                    {normalizeAnswer(saAnswer) === normalizeAnswer(currentQuestion.correctAnswer.toString()) ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-medium"><CheckCircle2 className="w-5 h-5"/> Chính xác!</span>
                    ) : (
                      <div className="text-rose-600 font-medium">
                        <span className="flex items-center gap-1 mb-1"><XCircle className="w-5 h-5"/> Sai rồi.</span>
                        <span className="text-slate-700">Đáp án đúng là: <strong className="text-emerald-600">{currentQuestion.correctAnswer}</strong></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isSubmitted && (aiExplanation || isAiLoading) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "border-t p-6",
                isAnswerCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className={cn(
                  "w-6 h-6 flex-shrink-0 mt-0.5",
                  isAnswerCorrect ? "text-emerald-600" : "text-rose-600"
                )} />
                <div className="flex-1">
                  <h4 className={cn(
                    "font-bold mb-3 text-lg",
                    isAnswerCorrect ? "text-emerald-800" : "text-rose-800"
                  )}>Phân tích từ AI</h4>
                  {isAiLoading ? (
                    <div className={cn(
                      "flex items-center gap-2",
                      isAnswerCorrect ? "text-emerald-600" : "text-rose-600"
                    )}>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-medium">Đang phân tích câu trả lời...</span>
                    </div>
                  ) : (
                    <div className={cn(
                      "markdown-body leading-relaxed",
                      isAnswerCorrect ? "text-emerald-900" : "text-rose-900"
                    )}>
                      <Markdown>{aiExplanation}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={!isAnswerComplete()}
            className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md w-full md:w-auto"
          >
            Kiểm tra
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2 w-full md:w-auto"
          >
            {currentIndex < quizQuestions.length - 1 ? 'Câu tiếp theo' : 'Hoàn thành'}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
