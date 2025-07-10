// src/types/EmbeddedChunk.ts

export interface EmbeddedChunk {
  chunkId: number;
  chunkIndex: number;
  sourceId: string;
  text: string;
  title: string;

  // Optional metadata fields — used by some parts like rerank
  code?: string;
  url?: string;
  fetchedAt?: string;
  type?: "text" | "table";
}
