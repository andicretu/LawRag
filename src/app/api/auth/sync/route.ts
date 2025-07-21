// src/app/api/auth/sync/route.ts

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { Client } from "pg"; // or use your DB client
import { createRemoteJWKSet } from "jose";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/.well-known/jwks.json`)
);

    const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/`,
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
    });

    const auth0_id = payload.sub;
    const email = payload.email;

    if (!auth0_id || !email) {
      return NextResponse.json({ error: "Invalid token payload" }, { status: 400 });
    }

    // Check if user exists
    const result = await client.query("SELECT * FROM users WHERE auth0_id = $1", [auth0_id]);

    if (result.rows.length === 0) {
      // Create new user
      await client.query("INSERT INTO users (auth0_id, email) VALUES ($1, $2)", [auth0_id, email]);

      return NextResponse.json({ message: "Thank you for registering", registered: true });
    }

    return NextResponse.json({ message: "Welcome back", registered: false });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Unauthorized or invalid token" }, { status: 401 });
  }
}
