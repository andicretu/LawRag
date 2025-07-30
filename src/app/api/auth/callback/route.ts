// src/app/api/auth/callback/route.ts
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  console.log("Auth0 callback hit");
  console.log("code:", code);
  console.log("state:", state);

  return new Response("✅ Callback received. Now handle the token exchange here.", {
    status: 200,
  });
}
// Note: This is a placeholder response. You would typically exchange the code for a token here.
