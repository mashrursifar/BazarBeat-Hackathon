import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

async function main(): Promise<void> {
  const rootDir = process.cwd().endsWith("api") ? path.resolve(process.cwd(), "../..") : process.cwd();
  const fixturesDir = path.resolve(rootDir, "e2e/fixtures");
  await fs.mkdir(fixturesDir, { recursive: true });

  const fixtures = [
    {
      name: "bitter-gourd-grade-a.jpg",
      grade: "A" as const,
      color: { r: 27, g: 67, b: 50 }, // Deep rich green
      stripe: { r: 64, g: 145, b: 108 },
    },
    {
      name: "bitter-gourd-grade-b.jpg",
      grade: "B" as const,
      color: { r: 82, g: 183, b: 136 }, // Lighter green with minor blemishes
      stripe: { r: 212, g: 163, b: 115 },
    },
    {
      name: "bitter-gourd-grade-c.jpg",
      grade: "C" as const,
      color: { r: 183, g: 228, b: 199 }, // Yellow-green
      stripe: { r: 233, g: 216, b: 166 },
    },
    {
      name: "potato-grade-a.jpg",
      grade: "A" as const,
      color: { r: 140, g: 98, b: 57 }, // Clean potato brown
      stripe: { r: 201, g: 176, b: 151 },
    },
  ];

  const registry: Record<string, "A" | "B" | "C"> = {};

  for (const item of fixtures) {
    const rawBuffer = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: item.color,
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 100,
              height: 100,
              channels: 3,
              background: item.stripe,
            },
          })
            .jpeg()
            .toBuffer(),
          top: 100,
          left: 150,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    const filePath = path.join(fixturesDir, item.name);
    await fs.writeFile(filePath, rawBuffer);

    // Compute sharp-processed hash (matching processImage logic)
    const processedBuffer = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const processedHash = crypto.createHash("sha256").update(processedBuffer).digest("hex");
    const rawHash = crypto.createHash("sha256").update(rawBuffer).digest("hex");

    registry[processedHash] = item.grade;
    registry[rawHash] = item.grade;
  }

  const demoFixturesContent = `// Auto-generated demo fixtures registry
import type { CropGrade } from "@bazarbeat/shared";

/** SHA-256 hash to grade mapping for deterministic demo and E2E testing */
export const DEMO_SAMPLE_HASHES: Record<string, CropGrade> = ${JSON.stringify(registry, null, 2)};
`;

  const outputPath = path.resolve(rootDir, "apps/api/src/modules/ai/demo-fixtures.ts");
  await fs.writeFile(outputPath, demoFixturesContent, "utf-8");
  console.log("Fixtures generated successfully.");
}

void main();
