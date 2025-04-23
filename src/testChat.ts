// src/testChat.ts
import dotenv from 'dotenv';
dotenv.config();                        // ← this loads ZENDESK_*/OPENAI_* from your .env

import { chatWithZendesk } from './chatHandler';

(async () => {
  try {
    const answer = await chatWithZendesk('와이어 게이지에 관한 설명');
    console.log('💬 GPTs answer:\n', answer);
  } catch (e) {
    console.error('❌ Test failed:', e);
  }
})();
