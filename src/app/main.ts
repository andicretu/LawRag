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

  let relevantChunks;
  try {
    relevantChunks = await searchChunks(question);
    console.log("✅ Retrieved relevant chunks:", relevantChunks.length);
  } catch (err) {
    console.error("❌ Failed during searchChunks:", err);
    process.exit(1);
  }

  try {
    const finalAnswer = await answerFromContext(question, relevantChunks);
    console.log("\n✅ Final Answer:\n", finalAnswer);
  } catch (err) {
    console.error("❌ Failed during answerFromContext:", err);
    process.exit(1);
  }
}

main();
