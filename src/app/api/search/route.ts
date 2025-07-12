import { NextResponse } from 'next/server';
import { searchChunks } from '@/backend/augment/search-chunks';

export async function POST(req: Request) {
  try {
    const { clarifiedQuestion } = await req.json();

    if (!clarifiedQuestion || typeof clarifiedQuestion !== 'string') {
      return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
    }

    const chunks = await searchChunks(clarifiedQuestion);

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
