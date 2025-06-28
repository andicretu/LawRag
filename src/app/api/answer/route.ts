import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { question } = await req.json();

  console.log('Received question:', question);

  // Simulate a short delay and return dummy data
  return NextResponse.json({
    answer: `✅ Dummy answer for: ${question}`,
    sources: [
      'https://legislatie.just.ro/Public/DetaliiDocument/111111',
      'https://legislatie.just.ro/Public/DetaliiDocument/222222',
    ],
  });
}
