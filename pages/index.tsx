// pages/index.tsx
import { useState, FormEvent } from 'react';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<
    { from: 'user' | 'bot'; text: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const sendQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    // 사용자 메시지 추가
    setHistory((h) => [...h, { from: 'user', text: question }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const { answer } = await res.json();
      setHistory((h) => [...h, { from: 'bot', text: answer }]);
    } catch (err: any) {
      console.error(err);
      setHistory((h) => [
        ...h,
        { from: 'bot', text: '에러가 발생했습니다. 콘솔을 확인하세요.' },
      ]);
    } finally {
      setLoading(false);
      setQuestion('');
    }
  };

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Zendesk 헬프센터 챗봇</h1>

      <div className="space-y-4 mb-4">
        {history.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded ${
              m.from === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-100'
            }`}
          >
            {m.text.split('\n').map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        ))}
        {loading && <p>로딩 중...</p>}
      </div>

      <form onSubmit={sendQuestion} className="flex">
        <input
          className="flex-1 border p-2 rounded-l"
          placeholder="질문을 입력하세요"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 rounded-r disabled:opacity-50"
          disabled={loading}
        >
          보내기
        </button>
      </form>
    </main>
  );
}
