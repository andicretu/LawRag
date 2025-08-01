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

    // Use pool.query() directly for simple queries
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE auth0_id = $1",
      [auth0_id]
    );

    if (rows.length === 0) {
      await pool.query(
        "INSERT INTO users (auth0_id) VALUES ($1)",
        [auth0_id]
      );
      return NextResponse.json({ message: "Thank you for registering", registered: true });
    }

    return NextResponse.json({ message: "Welcome back", registered: false });
    
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Unauthorized or invalid token" }, { status: 401 });
  }
}
