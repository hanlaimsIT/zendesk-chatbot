// test.cjs
const fetch = require('node-fetch');

;(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        question: 'FL 게이지 와이어 교체 절차 설명해줘'
      }),
    });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
})();
