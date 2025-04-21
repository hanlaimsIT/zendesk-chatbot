console.log("☁️  Chatbot starting...");
import readline from "readline";
import { chatWithZendesk } from "./chatHandler";

const rl = readline.createInterface(process.stdin, process.stdout);
rl.question("질문을 입력하세요: ", async q => {
  console.log(await chatWithZendesk(q));
  rl.close();
});
