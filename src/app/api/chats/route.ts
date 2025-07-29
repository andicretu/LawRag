// **src/app/api/chats/route.ts**
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/backend/lib/auth'
import { pool } from "@/backend/lib/db";
import { generateSummary } from '@/backend/generate/summarize-thread' // Import the summary generation function


// GET /api/chats - fetch user chat history
export async function GET(req: NextRequest) {
  //create token userId
  let tokenUserId: string
  try {
    tokenUserId = await verifyToken(req)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')

  if (!userId || userId !== tokenUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Fetch chat history for the user
  const { rows } = await pool.query(
    `SELECT question, answer, links, created_at
       FROM chats
      WHERE user_id = $1
   ORDER BY created_at`,
    [userId]
  )
  return NextResponse.json(rows)
}

// POST /api/chats - save a new chat entry
export async function POST(req: NextRequest) {
  let tokenUserId: string
  try {
    tokenUserId = await verifyToken(req)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')

  if (!userId || userId !== tokenUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { question, answer, links } = await req.json()

  if (!answer || typeof answer !== 'string') {
    console.error("❌ Invalid answer format:", answer);
    return NextResponse.json({ error: 'Invalid answer format' }, { status: 400 })
  }

  //Get previous summary (latest for this user)
  const { rows } = await pool.query(
    `SELECT summary FROM chats WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const previousSummary = rows[0]?.summary ?? '';

  let updatedSummary = "";

  try {
    updatedSummary = await generateSummary({
      previousSummary,
      question,
      answer
    })
  } catch (err) {
    console.error("⚠️ Failed to generate summary:", err)
    // Optionally fallback to previous summary
    updatedSummary = previousSummary
  }
  
  await pool.query(
    `INSERT INTO chats (user_id, question, answer, links, summary)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, question, answer, JSON.stringify(links), updatedSummary]
  )

  return NextResponse.json({ success: true }, { status: 201 })
}
