import { NextResponse } from 'next/server';
import { searchChunks } from '@/backend/augment/search-chunks';
import { answerFromContext } from '@/backend/generate/answer-question';
import { clarifyQuestion } from '@/backend/augment/clarify-question';

export async function POST(req: Request) {
  try {
    const { question: originalQuestion } = await req.json();

    if (!originalQuestion || typeof originalQuestion !== 'string') {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    const clarifiedQuestion = await clarifyQuestion(originalQuestion);
    const chunks = await searchChunks(clarifiedQuestion);
    const answer = await answerFromContext(clarifiedQuestion, chunks);

    return NextResponse.json({
      answer,
      sources: chunks.map((c) => ({
        title: c.title,
        url: `https://legislatie.just.ro/Public/DetaliiDocument/${c.sourceId}`,
        text: c.text,
    }))
  });
  } catch (err) {
    console.error('❌ API error in /api/answer:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
