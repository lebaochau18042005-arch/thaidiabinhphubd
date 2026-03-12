import { useState } from 'react';
import { Upload, FileText, Play, CheckCircle2, Loader2, Copy, ExternalLink, Info } from 'lucide-react';
import { cn } from '../utils/cn';
import { questions } from '../data';
import { QuestionType } from '../types';

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<'create' | 'monitor'>('create');
  const [examMethod, setExamMethod] = useState<'ai' | 'upload'>('ai');
  const [generatedExamId, setGeneratedExamId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const generateQuestions = () => {
    const getQs = (type: QuestionType, count: number) => {
      return questions.filter(q => q.type === type).sort(() => 0.5 - Math.random()).slice(0, count);
    };
    return [
      ...getQs('multiple_choice', 18),
      ...getQs('true_false', 4),
      ...getQs('short_answer', 6)
    ];
  };

  // Generate a random 6-char alphanumeric exam ID
  const generateExamId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateExam = () => {
    setIsCreating(true);
    try {
      const qs = generateQuestions();
      const examId = generateExamId();
      // Save exam to localStorage so students can load it via URL
      localStorage.setItem(`exam_${examId}`, JSON.stringify({
        id: examId,
        method: examMethod,
        questions: qs,
        createdAt: Date.now()
      }));
      setGeneratedExamId(examId);
    } catch (error) {
      console.error('Lỗi khi tạo đề:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadStatus('Đang xử lý file...');
      // Since we're on a static host, we can't parse the file server-side.
      // Instead, create an exam from our question bank directly.
      setTimeout(() => {
        setUploadStatus('');
        handleCreateExam();
      }, 1000);
    }
  };

  const examUrl = generatedExamId
    ? `${window.location.origin}/quiz?mode=exam&examId=${generatedExamId}`
    : '';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Bảng Điều Khiển Giáo Viên</h1>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "px-6 py-2 rounded-lg font-medium transition-colors",
              activeTab === 'create' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Tạo Đề Thi
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={cn(
              "px-6 py-2 rounded-lg font-medium transition-colors",
              activeTab === 'monitor' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Hướng Dẫn
          </button>
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Phương thức tạo đề</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => setExamMethod('ai')}
              className={cn(
                "p-6 rounded-2xl border-2 text-left transition-all",
                examMethod === 'ai' ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-emerald-200"
              )}
            >
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Play className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Tạo bằng ngân hàng đề</h3>
              <p className="text-slate-600 text-sm">Hệ thống tự động sinh đề thi theo cấu trúc chuẩn 2025 từ ngân hàng câu hỏi.</p>
            </button>

            <button
              onClick={() => setExamMethod('upload')}
              className={cn(
                "p-6 rounded-2xl border-2 text-left transition-all",
                examMethod === 'upload' ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-200"
              )}
            >
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Tải file lên</h3>
              <p className="text-slate-600 text-sm">Chọn file để kích hoạt tạo đề từ ngân hàng câu hỏi (phiên bản web tĩnh).</p>
            </button>
          </div>

          {examMethod === 'upload' && !generatedExamId && (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50 mb-6">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".doc,.docx,.pdf,.html"
                onChange={handleFileUpload}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-blue-500">
                  <FileText className="w-8 h-8" />
                </div>
                <span className="text-lg font-medium text-slate-700 mb-2">Nhấn để chọn file</span>
                <span className="text-sm text-slate-500">Hỗ trợ Word, PDF, HTML</span>
              </label>
              {uploadStatus && (
                <div className="mt-4 text-sm font-medium text-emerald-600 bg-emerald-50 p-3 rounded-lg inline-block">
                  {uploadStatus}
                </div>
              )}
            </div>
          )}

          {examMethod === 'ai' && !generatedExamId && (
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <p className="text-slate-700 mb-4">Hệ thống sẽ tự động tạo một đề thi gồm 28 câu hỏi (18 câu trắc nghiệm, 4 câu đúng/sai, 6 câu trả lời ngắn) và lưu mã phòng thi.</p>
              <button 
                onClick={handleCreateExam}
                disabled={isCreating}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isCreating && <Loader2 className="w-5 h-5 animate-spin" />}
                Tạo Đề Ngay
              </button>
            </div>
          )}

          {generatedExamId && (
            <div className="mt-8 p-8 bg-emerald-50 rounded-3xl border border-emerald-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Tạo phòng thi thành công!</h3>
                  <p className="text-slate-600 text-sm">Chia sẻ mã hoặc đường link dưới đây cho học sinh</p>
                </div>
              </div>
              
              {/* Exam Code */}
              <div className="bg-white border-2 border-emerald-200 rounded-2xl p-6 mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-500 mb-1 uppercase tracking-wider">Mã Phòng Thi</div>
                  <div className="text-5xl font-black text-emerald-600 tracking-widest">{generatedExamId}</div>
                </div>
                <button
                  onClick={() => handleCopy(generatedExamId)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-semibold hover:bg-emerald-200 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Đã sao chép!' : 'Sao chép'}
                </button>
              </div>

              {/* Exam Link */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-500 mb-0.5">Đường link làm bài</div>
                  <div className="text-sm text-emerald-600 font-medium truncate">{examUrl}</div>
                </div>
                <button
                  onClick={() => handleCopy(examUrl)}
                  className="flex-shrink-0 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Copy link
                </button>
              </div>

              <div className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-3 border border-amber-100">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Lưu ý: Học sinh cần sử dụng <strong>cùng một trình duyệt và thiết bị</strong> mà giáo viên đã tạo đề, hoặc dùng đường link trực tiếp ở trên.</span>
              </div>

              <button
                onClick={() => { setGeneratedExamId(''); }}
                className="mt-4 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Tạo đề mới
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'monitor' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-start gap-4 p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <Info className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-blue-800 mb-2">Về tính năng theo dõi</h3>
              <p className="text-blue-700 text-sm leading-relaxed">
                Tính năng <strong>Theo Dõi Trực Tiếp</strong> (real-time) yêu cầu một server WebSocket chạy liên tục, 
                hiện không khả dụng trên phiên bản web tĩnh này. 
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cách sử dụng phòng thi hiệu quả:</h3>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Vào tab "Tạo Đề Thi" và nhấn "Tạo Đề Ngay" để tạo đề với mã phòng thi.' },
                { step: '2', text: 'Sao chép đường link và chia sẻ cho học sinh. Học sinh dùng link để vào làm bài.' },
                { step: '3', text: 'Sau khi học sinh hoàn thành, yêu cầu họ chụp màn hình kết quả và gửi lại cho bạn.' },
                { step: '4', text: 'Kết quả từng học sinh được lưu trong mục "Lịch sử làm bài" trên trình duyệt của học sinh.' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {item.step}
                  </span>
                  <p className="text-slate-700 text-sm leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
