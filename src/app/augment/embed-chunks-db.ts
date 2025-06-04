// embed-chunks-db.ts

import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import fetch from "node-fetch";

// Load environment variables (particularly DATABASE_URL and OPENAI_API_KEY)
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const MODEL = "text-embedding-3-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!OPENAI_API_KEY) {
  console.error("❌ Embed chunks - Missing OpenAI API key in environment. Check your .env file.");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("❌ Embed chunks - Missing DATABASE_URL in environment. Check your .env file.");
  process.exit(1);
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface DbChunk {
  chunk_id: number;
  chunk_text: string;
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ input: text, model: MODEL }),
  });

  const json = (await response.json()) as OpenAIEmbeddingResponse;

  if (!response.ok || !json.data || !json.data[0]) {
    console.error("❌ OpenAI API error:", JSON.stringify(json, null, 2));
    throw new Error("Failed to fetch embedding.");
  }
  return json.data[0].embedding;
}

export async function embedChunksDb(batchSize = 50): Promise<number> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let totalUpdated = 0;

  while (true) {
    // 1) Fetch up to `batchSize` chunks that still have NULL embedding
    const { rows } = await client.query<DbChunk>(
      `
      SELECT chunk_id, chunk_text
        FROM law_chunks
       WHERE embedding IS NULL
       ORDER BY chunk_id
       LIMIT $1
      `,
      [batchSize]
    );

    if (rows.length === 0) {
      // No more un-embedded chunks
      break;
    }

    // 2) For each chunk in this batch, call the embedding endpoint, then UPDATE
    for (const { chunk_id, chunk_text } of rows) {
      let vector: number[];
      try {
        vector = await fetchEmbedding(chunk_text);
      } catch (err) {
        console.error(`❌ Failed to embed chunk ${chunk_id}:`, err);
        // Skip this chunk for now; move on to the next.
        continue;
      }

      // 3) Write the vector back to Postgres
      await client.query(
        `
        UPDATE law_chunks
           SET embedding = $1
         WHERE chunk_id = $2
        `,
        [vector, chunk_id]
      );

      totalUpdated++;
      console.log(`✅ Embedded chunk_id=${chunk_id} (${totalUpdated} total)`);
    }
  }

  await client.end();
  console.log(`\n🎉 Done. Total chunks embedded: ${totalUpdated}`);
  return totalUpdated;
}

if (require.main === module) {
  (async () => {
    try {
      const count = await embedChunksDb();
      process.exit(count > 0 ? 0 : 0);
    } catch (err) {
      console.error("Fatal error in embedding loop:", err);
      process.exit(1);
    }
  })();
}
