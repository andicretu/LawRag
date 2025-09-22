import { NextResponse } from 'next/server';
import { searchChunks } from '@/backend/augment/search-chunks';
import type { EmbeddedChunk } from "@/types/EmbeddedChunk";


export async function POST(req: Request) {
  try {
    const { clarifiedQuestion } = await req.json();

    if (!clarifiedQuestion || typeof clarifiedQuestion !== 'string') {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    const chunks = await searchChunks(clarifiedQuestion)

    console.log("🔎 /api/search sample keys:", chunks[0] && Object.keys(chunks[0] as EmbeddedChunk));
    const missing = (chunks as EmbeddedChunk[]).filter(c => c.sourceId == null);
    console.log("⚠️ missing sourceId count:", missing.length, missing.slice(0,3));

    return NextResponse.json({
      sources: chunks.map((c) => ({
        title: c.title,
        url: `https://legislatie.just.ro/Public/DetaliiDocument/${c.sourceId}`,
        text: c.text,
      })),
    });

  } catch (err) {
    console.error("❌ Error in /api/search:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
