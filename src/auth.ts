import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "./db.js";

export type AuthUser = { id: string; email: string; role: "CUSTOMER" | "ADMIN" };
declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: AuthUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "UNAUTHORIZED", message: "Sign in to continue" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const authResult = await requireAuth(request, reply);
  if (authResult) return authResult;
  const user = await db.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") {
    return reply.code(403).send({ error: "FORBIDDEN", message: "Administrator access required" });
  }
}
