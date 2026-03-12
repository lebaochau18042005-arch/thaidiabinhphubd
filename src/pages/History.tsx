import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History as HistoryIcon, Clock, Target, Calendar, Trash2 } from 'lucide-react';
import { QuizAttempt } from '../types';
import { cn } from '../utils/cn';

export default function History() {
  const [history, setHistory] = useState<QuizAttempt[]>([]);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('examGeoHistory') || '[]');
    setHistory(data);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}p ${s}s`;
  };

  // FEAT 3: Delete all history
  const handleDeleteAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử làm bài không?')) {
      localStorage.removeItem('examGeoHistory');
      setHistory([]);
    }
  };

  // BUG 3 fix: score is the actual points (e.g. 3.5), compute % relative to 10 scale
  // maxScore used when saving = mode === 'exam' => ~10, else varies.
  // We stored score in points format (e.g. 3.5/10).
  // Best approach: display score directly and compute percentage as score/10
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-emerald-600';
    if (score >= 6.5) return 'text-blue-600';
    if (score >= 5) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto pb-20 md:pb-0"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
            <HistoryIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Lịch sử làm bài</h1>
            <p className="text-slate-500">Xem lại kết quả các bài đã luyện tập</p>
          </div>
        </div>
        {/* FEAT 3: Delete all button */}
        {history.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-100"
          >
            <Trash2 className="w-4 h-4" />
            Xóa tất cả
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <HistoryIcon className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-2">Chưa có dữ liệu</h3>
          <p className="text-slate-500">Bạn chưa hoàn thành bài luyện tập nào. Hãy bắt đầu ngay nhé!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((attempt) => {
            // BUG 3 fix: score is stored in points, maxScore for exam = ~10, for practice varies
            // We compute percentage as (score / 10) * 100 capped at 100%
            const percentage = Math.min(100, Math.round((attempt.score / 10) * 100));
            const scoreColor = getScoreColor(attempt.score);
            return (
              <div key={attempt.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                      attempt.mode === 'exam' ? "bg-rose-100 text-rose-700" :
                      attempt.mode === 'topic' ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    )}>
                      {attempt.mode === 'exam' ? 'Thi thử' : attempt.mode === 'topic' ? 'Chủ đề' : 'Bài học'}
                    </span>
                    <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{attempt.title}</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(attempt.date).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatTime(attempt.timeSpent)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {attempt.totalQuestions} câu
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:border-l sm:border-slate-100 sm:pl-6">
                  {/* FEAT 4: Show score as X.XX / 10 */}
                  <div className="text-right">
                    <div className={cn("text-2xl font-bold", scoreColor)}>{attempt.score.toFixed(2)}</div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">/ 10 điểm</div>
                  </div>
                  {/* BUG 3 fix: percentage is now score/10, correct and meaningful */}
                  <div className="w-12 h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={cn(
                          percentage >= 80 ? "text-emerald-500" :
                          percentage >= 65 ? "text-blue-500" :
                          percentage >= 50 ? "text-amber-500" : "text-rose-500"
                        )}
                        strokeDasharray={`${percentage}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                    </svg>
                    <span className="text-xs font-bold text-slate-700">{percentage}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
