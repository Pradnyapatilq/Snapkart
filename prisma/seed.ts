import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

type MockProduct = {
  barcode: string;
  name: string;
  priceMinor: number;
  currency: string;
  stock: number;
  category: string | null;
  brand: string | null;
  supplier: string | null;
  expiresAt: string | null;
  active: boolean;
};

const db = new PrismaClient();
const dataPath = fileURLToPath(new URL("./mock-products.json", import.meta.url));

try {
  const products = JSON.parse(await readFile(dataPath, "utf8")) as MockProduct[];
  for (const product of products) {
    const { expiresAt, ...fields } = product;
    await db.product.upsert({
      where: { barcode: product.barcode },
      create: { ...fields, expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`) : null },
      update: { ...fields, expiresAt: expiresAt ? new Date(`${expiresAt}T00:00:00.000Z`) : null },
    });
  }
  console.log(`Seeded ${products.length} SnapKart mock products.`);
} finally {
  await db.$disconnect();
}
