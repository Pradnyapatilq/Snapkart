import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { requireAdmin, requireAuth } from "./auth.js";
import { paymentProvider } from "./payments.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");

await app.register(helmet);
await app.register(cors, { origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(",") });
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(jwt, { secret: jwtSecret, sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "1h" } });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  if (error instanceof z.ZodError) return reply.code(400).send({ error: "VALIDATION_ERROR", details: error.issues });
  const appError = error as Error & { statusCode?: number; code?: string };
  if (appError.statusCode && appError.code) return reply.code(appError.statusCode).send({ error: appError.code, message: appError.message });
  return reply.code(500).send({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
});

const emailSchema = z.string().trim().email().max(254);
const passwordSchema = z.string().min(10).max(128);
const idParam = z.object({ id: z.string().min(1) });
const safeUser = (user: { id: string; email: string; name: string; role: string }) => ({ id: user.id, email: user.email, name: user.name, role: user.role });
const cartView = (cart: any) => ({
  id: cart.id,
  items: cart.items.map((item: any) => ({
    productId: item.productId, barcode: item.product.barcode, name: item.product.name,
    unitPriceMinor: item.product.priceMinor, currency: item.product.currency,
    quantity: item.quantity, lineTotalMinor: item.product.priceMinor * item.quantity,
  })),
  subtotalMinor: cart.items.reduce((sum: number, item: any) => sum + item.product.priceMinor * item.quantity, 0),
});

app.get("/health", async () => ({ status: "ok" }));
app.post("/auth/register", async (request, reply) => {
  const body = z.object({ email: emailSchema, password: passwordSchema, name: z.string().trim().min(1).max(120) }).parse(request.body);
  const exists = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (exists) return reply.code(409).send({ error: "EMAIL_IN_USE" });
  // Use Node's built-in scrypt so password handling does not require a native addon.
  const { scrypt, randomBytes } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const salt = randomBytes(16).toString("hex");
  const hash = (await promisify(scrypt)(body.password, salt, 64)) as Buffer;
  const user = await db.user.create({ data: { email: body.email.toLowerCase(), name: body.name, passwordHash: `scrypt$${salt}$${hash.toString("hex")}` } });
  const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role });
  await db.cart.create({ data: { userId: user.id } });
  return reply.code(201).send({ user: safeUser(user), token });
});
app.post("/auth/login", async (request, reply) => {
  const body = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).parse(request.body);
  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  const [algorithm, salt, expected] = user.passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  const { scrypt, timingSafeEqual } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const actual = (await promisify(scrypt)(body.password, salt, 64)) as Buffer;
  if (!timingSafeEqual(actual, Buffer.from(expected, "hex"))) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
  return { user: safeUser(user), token: app.jwt.sign({ id: user.id, email: user.email, role: user.role }) };
});
app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
  const user = await db.user.findUnique({ where: { id: request.user.id } });
  if (!user) return reply.code(404).send({ error: "USER_NOT_FOUND" });
  return { user: safeUser(user) };
});

app.get("/products", async (request) => {
  const query = z.object({ q: z.string().trim().max(120).optional(), barcode: z.string().trim().max(80).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query);
  const where = { active: true, ...(query.barcode ? { barcode: query.barcode } : {}), ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}) };
  const [items, total] = await Promise.all([db.product.findMany({ where, orderBy: { name: "asc" }, skip: (query.page - 1) * query.limit, take: query.limit }), db.product.count({ where })]);
  return { items, page: query.page, limit: query.limit, total };
});
app.get("/products/barcode/:barcode", async (request, reply) => {
  const { barcode } = z.object({ barcode: z.string().min(1).max(80) }).parse(request.params);
  const product = await db.product.findFirst({ where: { barcode, active: true } });
  if (!product) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
  return { product };
});

app.get("/cart", { preHandler: requireAuth }, async (request, reply) => {
  const cart = await db.cart.findUnique({ where: { userId: request.user.id }, include: { items: { include: { product: true }, orderBy: { id: "asc" } } } });
  if (!cart) return reply.code(404).send({ error: "CART_NOT_FOUND" });
  return cartView(cart);
});
app.post("/cart/items", { preHandler: requireAuth }, async (request, reply) => {
  const body = z.object({ barcode: z.string().min(1).max(80), quantity: z.number().int().min(1).max(99).default(1) }).parse(request.body);
  const product = await db.product.findFirst({ where: { barcode: body.barcode, active: true } });
  if (!product) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
  const cart = await db.cart.upsert({ where: { userId: request.user.id }, create: { userId: request.user.id }, update: {} });
  const current = await db.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId: product.id } } });
  if (product.stock < body.quantity + (current?.quantity ?? 0)) return reply.code(409).send({ error: "INSUFFICIENT_STOCK" });
  await db.cartItem.upsert({ where: { cartId_productId: { cartId: cart.id, productId: product.id } }, create: { cartId: cart.id, productId: product.id, quantity: body.quantity }, update: { quantity: { increment: body.quantity } } });
  const fresh = await db.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: { include: { product: true } } } });
  return reply.code(200).send(cartView(fresh));
});
app.patch("/cart/items/:id", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = idParam.parse(request.params);
  const { quantity } = z.object({ quantity: z.number().int().min(1).max(99) }).parse(request.body);
  const item = await db.cartItem.findFirst({ where: { id, cart: { userId: request.user.id } }, include: { product: true } });
  if (!item) return reply.code(404).send({ error: "CART_ITEM_NOT_FOUND" });
  if (quantity > item.product.stock) return reply.code(409).send({ error: "INSUFFICIENT_STOCK" });
  await db.cartItem.update({ where: { id }, data: { quantity } });
  return { ok: true };
});
app.delete("/cart/items/:id", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = idParam.parse(request.params);
  const result = await db.cartItem.deleteMany({ where: { id, cart: { userId: request.user.id } } });
  if (!result.count) return reply.code(404).send({ error: "CART_ITEM_NOT_FOUND" });
  return reply.code(204).send();
});

app.post("/checkout", { preHandler: requireAuth }, async (request, reply) => {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || key.length < 8 || key.length > 128) return reply.code(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED" });
  const existing = await db.order.findUnique({ where: { userId_idempotencyKey: { userId: request.user.id, idempotencyKey: key } }, include: { items: true, payment: true } });
  if (existing) return { order: existing };
  const order = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { userId: request.user.id }, include: { items: { include: { product: true } } } });
    if (!cart?.items.length) throw Object.assign(new Error("Cart is empty"), { statusCode: 400, code: "EMPTY_CART" });
    if (cart.items.some((item) => item.product.currency !== cart.items[0]!.product.currency)) throw Object.assign(new Error("Cart products must use the same currency"), { statusCode: 409, code: "MIXED_CURRENCIES" });
    for (const item of cart.items) {
      const changed = await tx.product.updateMany({ where: { id: item.productId, active: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
      if (changed.count !== 1) throw Object.assign(new Error(`Insufficient stock for ${item.product.name}`), { statusCode: 409, code: "INSUFFICIENT_STOCK" });
    }
    const subtotalMinor = cart.items.reduce((sum, item) => sum + item.product.priceMinor * item.quantity, 0);
    const created = await tx.order.create({ data: { userId: request.user.id, idempotencyKey: key, subtotalMinor, currency: cart.items[0]!.product.currency, items: { create: cart.items.map(({ product, quantity }) => ({ productId: product.id, barcode: product.barcode, productName: product.name, unitPriceMinor: product.priceMinor, quantity })) }, payment: { create: { provider: paymentProvider.name, amountMinor: subtotalMinor, currency: cart.items[0]!.product.currency } } }, include: { items: true, payment: true } });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  }, { isolationLevel: "Serializable" });
  try {
    const result = await paymentProvider.charge({ orderId: order.id, amountMinor: order.subtotalMinor, currency: order.currency });
    const updated = await db.$transaction(async (tx) => {
      await tx.payment.update({ where: { orderId: order.id }, data: { status: result.succeeded ? "SUCCEEDED" : "FAILED", providerReference: result.reference } });
      if (!result.succeeded) {
        for (const item of order.items) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      return tx.order.update({ where: { id: order.id }, data: { status: result.succeeded ? "PAID" : "PAYMENT_FAILED" }, include: { items: true, payment: true } });
    });
    return reply.code(result.succeeded ? 201 : 402).send({ order: updated });
  } catch (error) {
    app.log.error(error, "Payment provider call failed");
    return reply.code(202).send({ order, paymentStatus: "PENDING", message: "Payment result is pending reconciliation" });
  }
});
app.get("/orders", { preHandler: requireAuth }, async (request) => {
  const orders = await db.order.findMany({ where: { userId: request.user.id }, include: { items: true, payment: true }, orderBy: { createdAt: "desc" } });
  return { items: orders };
});
app.get("/orders/:id", { preHandler: requireAuth }, async (request, reply) => {
  const { id } = idParam.parse(request.params);
  const order = await db.order.findFirst({ where: { id, userId: request.user.id }, include: { items: true, payment: true } });
  if (!order) return reply.code(404).send({ error: "ORDER_NOT_FOUND" });
  return { order };
});

app.get("/admin/summary", { preHandler: requireAdmin }, async () => {
  const [products, customers, orders, revenue] = await Promise.all([
    db.product.count({ where: { active: true } }), db.user.count({ where: { role: "CUSTOMER" } }),
    db.order.count(), db.order.aggregate({ where: { status: "PAID" }, _sum: { subtotalMinor: true } }),
  ]);
  return { products, customers, orders, revenueMinor: revenue._sum.subtotalMinor ?? 0 };
});
app.get("/admin/inventory", { preHandler: requireAdmin }, async (request) => {
  const query = z.object({ q: z.string().trim().max(120).optional(), lowStockAt: z.coerce.number().int().min(0).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
  const where = { ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" as const } }, { barcode: { contains: query.q } }] } : {}), ...(query.lowStockAt === undefined ? {} : { stock: { lte: query.lowStockAt } }) };
  const [items, total] = await Promise.all([db.product.findMany({ where, orderBy: [{ stock: "asc" }, { name: "asc" }], skip: (query.page - 1) * query.limit, take: query.limit }), db.product.count({ where })]);
  return { items, total, page: query.page, limit: query.limit };
});
app.post("/admin/products", { preHandler: requireAdmin }, async (request, reply) => {
  const body = z.object({ barcode: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), priceMinor: z.number().int().positive(), currency: z.string().length(3).default("INR"), stock: z.number().int().min(0).default(0) }).parse(request.body);
  const product = await db.product.create({ data: body });
  return reply.code(201).send({ product });
});
app.patch("/admin/products/:id", { preHandler: requireAdmin }, async (request, reply) => {
  const { id } = idParam.parse(request.params);
  const body = z.object({ barcode: z.string().trim().min(1).max(80).optional(), name: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).nullable().optional(), priceMinor: z.number().int().positive().optional(), currency: z.string().length(3).optional(), active: z.boolean().optional() }).parse(request.body);
  const product = await db.product.update({ where: { id }, data: body });
  return { product };
});
app.post("/admin/products/:id/inventory-adjustments", { preHandler: requireAdmin }, async (request, reply) => {
  const { id } = idParam.parse(request.params);
  const body = z.object({ delta: z.number().int().refine((value) => value !== 0), reason: z.string().trim().min(3).max(300) }).parse(request.body);
  const adjustment = await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id } });
    if (!product) return null;
    const resultingStock = product.stock + body.delta;
    if (resultingStock < 0) throw Object.assign(new Error("Inventory cannot be negative"), { statusCode: 409, code: "NEGATIVE_STOCK" });
    await tx.product.update({ where: { id }, data: { stock: resultingStock } });
    return tx.inventoryAdjustment.create({ data: { productId: id, adminUserId: request.user.id, delta: body.delta, resultingStock, reason: body.reason } });
  });
  if (!adjustment) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
  return reply.code(201).send({ adjustment });
});
app.get("/admin/orders", { preHandler: requireAdmin }, async (request) => {
  const query = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(["PENDING_PAYMENT", "PAID", "PAYMENT_FAILED", "CANCELLED"]).optional() }).parse(request.query);
  const where = query.status ? { status: query.status } : {};
  const [items, total] = await Promise.all([db.order.findMany({ where, include: { user: { select: { id: true, email: true, name: true } }, items: true, payment: true }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit }), db.order.count({ where })]);
  return { items, total, page: query.page, limit: query.limit };
});

app.addHook("onClose", async () => db.$disconnect());
try {
  await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
