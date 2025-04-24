// main.ts
import { searchChunks } from "./augment/search-chunks";
import { answerFromContext } from "./generate/answer-question";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env" ) });

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error("❓ Please provide a question as a command-line argument.");
    process.exit(1);
  }

  console.log("🚀 Starting legal assistant workflow...");

  const relevantChunks = await searchChunks(question);

  const finalAnswer = await answerFromContext(question, relevantChunks);

  console.log("\n✅ Final Answer:\n", finalAnswer);
}

main();
