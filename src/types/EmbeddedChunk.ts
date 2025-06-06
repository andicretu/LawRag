// src/types/EmbeddedChunk.ts

export interface EmbeddedChunk {
  chunkId: number;
  chunkIndex: number;
  sourceId: string;
  text: string;
  embedding: number[];

  // Optional metadata fields — used by some parts like rerank
  code?: string;
  url?: string;
  fetchedAt?: string;
  type?: "text" | "table";
}
