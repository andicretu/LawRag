
import { NextResponse, NextRequest } from "next/server";
import { clarifyQuestion } from "@/backend/augment/clarify-question";
import { verifyToken } from "@/backend/lib/auth";
import { pool } from "@/backend/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("📦 Clarify Request Body!!!!!!!!:", body);
    const originalQuestion = body.question;
    const rawToken = body.token;

    if (!originalQuestion || typeof originalQuestion !== "string") {
      return NextResponse.json({ error: "Invalid question" }, { status: 400 });
    }

    // Optional: try to identify user
    let tokenUserId: string | null = null;
    try {
      tokenUserId = await verifyToken(rawToken || req);
    } catch {
      tokenUserId = null; // not authenticated
    }

    // Optional: fetch summary if user is known
    let summary = "";
    if (tokenUserId) {
      try {
        const { rows } = await pool.query(
          `SELECT summary FROM chats WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [tokenUserId]
        );
        summary = rows[0]?.summary || "";
      } catch (err) {
        console.warn("⚠️ Failed to fetch summary for user:", err);
      }
    }

    // Clarify question using context if available
    const clarifiedQuestion = await clarifyQuestion(originalQuestion, summary);
    console.log("✅ Clarified question:", clarifiedQuestion);

    return NextResponse.json({ clarifiedQuestion });
  } catch (err) {
    console.error("❌ API error in /api/clarify:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
