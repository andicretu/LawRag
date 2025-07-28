// **src/app/api/chats/route.ts**
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/backend/lib/auth'
import { Client } from 'pg'

const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

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
  const { rows } = await client.query(
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
  
  await client.query(
    `INSERT INTO chats (user_id, question, answer, links)
     VALUES ($1, $2, $3, $4)`,
    [userId, question, answer, JSON.stringify(links)]
  )

  return NextResponse.json({ success: true }, { status: 201 })
}
