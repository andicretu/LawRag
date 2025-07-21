// src/backend/lib/auth.ts
import { NextRequest } from "next/server"
import { jwtVerify, createRemoteJWKSet } from "jose"

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/.well-known/jwks.json`)
)

export async function verifyToken(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) throw new Error("Missing token")

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/`,
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  })

  if (!payload.sub) throw new Error("Invalid token payload")
  return payload.sub
}
