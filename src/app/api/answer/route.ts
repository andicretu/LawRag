import { NextResponse } from 'next/server';
import { answerFromContext } from '@/backend/generate/answer-question';
import { EmbeddedChunk } from '@/types/EmbeddedChunk';

export async function POST(req: Request) {
  try {
    const { clarifiedQuestion, chunks } = await req.json();

    if (!clarifiedQuestion || typeof clarifiedQuestion !== 'string' || !Array.isArray(chunks)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const answer = await answerFromContext(clarifiedQuestion, chunks);

    return NextResponse.json({
      answer,
      sources: (chunks as EmbeddedChunk[]).map((c: EmbeddedChunk) => ({
        title: c.title,
        url: `https://legislatie.just.ro/Public/DetaliiDocument/${c.sourceId}`,
        text: c.text,
      })),
    });

  } catch (err) {
    console.error('❌ API error in /api/answer:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
