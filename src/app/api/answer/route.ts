import { NextResponse } from 'next/server';
import { searchChunks } from '@/backend/augment/search-chunks';
import { answerFromContext } from '@/backend/generate/answer-question';

export async function POST(req: Request) {
  try {
    const { question } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    const chunks = await searchChunks(question);
    const answer = await answerFromContext(question, chunks);

    return NextResponse.json({
      answer,
      sources: chunks.map((c) => ({
        title: c.title,
        url: `https://legislatie.just.ro/Public/DetaliiDocument/${c.sourceId}`,
    }))
  });
  } catch (err) {
    console.error('❌ API error in /api/answer:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
