import { NextResponse } from "next/server";
import { clarifyQuestion } from "@/backend/augment/clarify-question";

export async function POST(req: Request) {
  try {
    const { question: originalQuestion } = await req.json();

    if (!originalQuestion || typeof originalQuestion !== "string") {
      return NextResponse.json(
        { error: "Invalid question" },
        { status: 400 }
      );
    }

    console.log("🔍 Clarifying question...");
    const clarifiedQuestion = await clarifyQuestion(originalQuestion);
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
