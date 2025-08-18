// src/app/api/auth/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { pool }                      from '@/backend/lib/db';

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/.well-known/jwks.json`)
);

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

try {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/`,
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  });

  const auth0_id = payload.sub;
  if (!auth0_id) {
    return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
  }

  const email = (payload as { email?: string }).email ?? null;

  await pool.query(
    `
    INSERT INTO users (auth0_id, email)
    VALUES ($1, $2)
    ON CONFLICT (auth0_id)
    DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email)
    `,
    [auth0_id, email]
  );

  return NextResponse.json({ message: "User synced" });
} catch (err) {
  console.error("❌ Sync error:", err);
  return NextResponse.json({ error: "Sync failed" }, { status: 500 });
}
}
