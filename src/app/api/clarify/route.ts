import { NextResponse, NextRequest } from "next/server";
import { clarifyQuestion } from "@/backend/augment/clarify-question";
import { verifyToken } from "@/backend/lib/auth";
import { pool }                      from '@/backend/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { question: originalQuestion } = await req.json();

    if (!originalQuestion || typeof originalQuestion !== "string") {
      return NextResponse.json(
        { error: "Invalid question" },
        { status: 400 }
      );
    }

    //Identify user from token
    const tokenUserId = await verifyToken(req);

    // Get latest sumary for this user
    const { rows } = await pool.query(
      `SELECT summary FROM chats WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tokenUserId]
    );

    const summary = rows[0]?.summary || "";

    // Log the original question and summary
    console.log("🔍 Clarifying question...");
    const clarifiedQuestion = await clarifyQuestion(originalQuestion, summary);
    console.log("✅ Clarified question:", clarifiedQuestion);

    return NextResponse.json({ clarifiedQuestion });
  } catch (err) {
    console.error("❌ API error in /api/clarify:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
