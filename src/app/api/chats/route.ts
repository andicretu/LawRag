// src/app/api/chats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken }               from '@/backend/lib/auth';
import { pool }                      from '@/backend/lib/db';

// GET /api/chats
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await verifyToken(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT question, answer, links, created_at
       FROM chats
      WHERE user_id = $1
   ORDER BY created_at`,
    [userId]
  );
  return NextResponse.json(rows);
}

// POST /api/chats
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await verifyToken(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { question, answer, links } = await req.json();
  await pool.query(
    `INSERT INTO chats (user_id, question, answer, links)
     VALUES ($1, $2, $3, $4)`,
    [userId, question, answer, JSON.stringify(links)]
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
