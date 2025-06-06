// embed-chunks-db.ts

import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";
import fetch from "node-fetch";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const MODEL = "text-embedding-3-small";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


if (!OPENAI_API_KEY || !DATABASE_URL) {
  console.error("❌ Missing OPENAI_API_KEY or DATABASE_URL in .env");
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

async function fetchEmbeddingsBatch(inputs: string[]): Promise<number[][]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ input: inputs, model: MODEL }),
    });

    const json = await response.json() as OpenAIEmbeddingResponse;

    if (!response.ok || !json.data || json.data.length !== inputs.length) {
      console.error("❌ OpenAI batch API error:", JSON.stringify(json, null, 2));
      throw new Error("Failed to fetch batch embeddings.");
    }

    return json.data.map(d => d.embedding);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.warn("⏳ Waiting 2s due to error:", err.message);
    } else {
      console.warn("⏳ Waiting 2s due to unknown error:", JSON.stringify(err));
    }

    await new Promise((res) => setTimeout(res, 2000));
    return await fetchEmbeddingsBatch(inputs);
  }
}


export async function embedChunksDb(batchSize = 50): Promise<number> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  let totalUpdated = 0;

  while (true) {
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

    if (rows.length === 0) break;

    const chunkIds = rows.map(row => row.chunk_id);
    const texts = rows.map(row => row.chunk_text);

    let vectors: number[][];

    try {
      vectors = await fetchEmbeddingsBatch(texts);
    } catch (err) {
      console.error("❌ Failed to embed batch:", err);
      continue; // skip batch, try next
    }

    try {
      await client.query("BEGIN");
      for (let i = 0; i < chunkIds.length; i++) {
        const vectorString = `[${vectors[i].join(",")}]`;
        await client.query(
          `UPDATE law_chunks SET embedding = $1 WHERE chunk_id = $2`,
          [vectorString, chunkIds[i]]
        );
        totalUpdated++;
        console.log(`✅ Embedded chunk_id=${chunkIds[i]} (${totalUpdated} total)`);
      }
      await client.query("COMMIT");
      await sleep(1700);
    } catch (err) {
      console.error("❌ DB update failed. Rolling back:", err);
      await client.query("ROLLBACK");
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
      process.exit(count > 0 ? 0 : 1);
    } catch (err) {
      console.error("Fatal error in embedding loop:", err);
      process.exit(1);
    }
  })();
}
