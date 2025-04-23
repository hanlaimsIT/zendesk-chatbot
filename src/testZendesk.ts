// test.js
import fetch from 'node-fetch';

(async () => {
  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      question: 'FL 게이지 와이어 교체 절차 설명해줘'
    }),
  });
  const json = await res.json();
  console.log(json);
})();
