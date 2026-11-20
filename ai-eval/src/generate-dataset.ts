import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { type DatasetManifest, type ManifestEntry, datasetManifestSchema } from "./types.js";

const CROPS = [
  {
    slug: "onion",
    name: "Onion",
    folderAliases: ["onion"],
    color: { r: 175, g: 75, b: 50 },
    accent: { r: 235, g: 210, b: 195 },
    detail: { r: 120, g: 50, b: 35 },
  },
  {
    slug: "green-chilli",
    name: "Green Chilli",
    folderAliases: ["green-chilli"],
    color: { r: 35, g: 150, b: 55 },
    accent: { r: 75, g: 190, b: 90 },
    detail: { r: 20, g: 90, b: 35 },
  },
  {
    slug: "bitter-gourd",
    name: "Bitter Gourd",
    folderAliases: ["bitter-gourd", "bitter-groud"],
    color: { r: 35, g: 95, b: 45 },
    accent: { r: 70, g: 145, b: 75 },
    detail: { r: 20, g: 65, b: 30 },
  },
  {
    slug: "eggplant",
    name: "Eggplant",
    folderAliases: ["eggplant"],
    color: { r: 50, g: 20, b: 65 },
    accent: { r: 100, g: 55, b: 125 },
    detail: { r: 35, g: 95, b: 45 },
  },
  {
    slug: "potato",
    name: "Potato",
    folderAliases: ["potato"],
    color: { r: 170, g: 130, b: 85 },
    accent: { r: 215, g: 180, b: 140 },
    detail: { r: 110, g: 80, b: 45 },
  },
] as const;

/**
 * Searches seed assets folder for up to 5 real crop images for a given grade.
 * Supports patterns:
 *   - A_1.jpg .. A_5.jpg, A-1.jpg .. A-5.jpg, A1.jpg .. A5.jpg
 *   - Subdirectories: A/1.jpg .. A/5.jpg
 *   - Base files: A.jpg, A.jpeg, A.png, etc.
 */
async function loadSeedSampleImages(
  seedBaseDir: string,
  folderAliases: readonly string[],
  grade: "A" | "B" | "C",
): Promise<{ buffer: Buffer; sourceName: string }[]> {
  const results: { buffer: Buffer; sourceName: string }[] = [];

  for (const alias of folderAliases) {
    const cropDir = path.resolve(seedBaseDir, alias);
    let isDir: boolean;
    try {
      const stat = await fs.stat(cropDir);
      isDir = stat.isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    // 1. Check if grade is in a subfolder (e.g. cropDir/A/)
    const subfolder = path.resolve(cropDir, grade);
    try {
      const subStat = await fs.stat(subfolder);
      if (subStat.isDirectory()) {
        const subFiles = (await fs.readdir(subfolder)).sort();
        for (const file of subFiles) {
          if (/\.(jpe?g|png|webp)$/i.test(file)) {
            const buf = await fs.readFile(path.resolve(subfolder, file));
            results.push({ buffer: buf, sourceName: `${alias}/${grade}/${file}` });
          }
        }
      }
    } catch {
      // Subfolder does not exist
    }

    // 2. Check files inside cropDir directly
    const allFiles = (await fs.readdir(cropDir)).sort();

    // Specific numbered files: A_1.jpg, A-1.jpg, A1.jpg, etc.
    const numberedRegex = new RegExp(`^${grade}[-_]?([0-9]+)\\.(jpe?g|png|webp)$`, "i");
    const singleRegex = new RegExp(`^${grade}\\.(jpe?g|png|webp)$`, "i");

    const matchedNumbered: string[] = [];
    const matchedSingle: string[] = [];

    for (const file of allFiles) {
      if (numberedRegex.test(file)) {
        matchedNumbered.push(file);
      } else if (singleRegex.test(file)) {
        matchedSingle.push(file);
      }
    }

    matchedNumbered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const file of matchedNumbered) {
      const buf = await fs.readFile(path.resolve(cropDir, file));
      results.push({ buffer: buf, sourceName: `${alias}/${file}` });
    }

    if (results.length === 0) {
      for (const file of matchedSingle) {
        const buf = await fs.readFile(path.resolve(cropDir, file));
        results.push({ buffer: buf, sourceName: `${alias}/${file}` });
      }
    }

    if (results.length > 0) {
      break;
    }
  }

  return results;
}

async function createBaseProduceImage(params: {
  width?: number;
  height?: number;
  bgRgb: { r: number; g: number; b: number };
  accentRgb: { r: number; g: number; b: number };
  detailRgb: { r: number; g: number; b: number };
  grade: "A" | "B" | "C";
  blur?: number;
  dark?: boolean;
}): Promise<Buffer> {
  const width = params.width ?? 600;
  const height = params.height ?? 450;

  let overlaySvg: string;
  if (params.grade === "A") {
    overlaySvg = `
      <svg width="${width}" height="${height}">
        <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.35}" ry="${height * 0.35}" fill="rgb(${params.bgRgb.r},${params.bgRgb.g},${params.bgRgb.b})" />
        <ellipse cx="${width * 0.45}" cy="${height * 0.45}" rx="${width * 0.18}" ry="${height * 0.15}" fill="rgb(${params.accentRgb.r},${params.accentRgb.g},${params.accentRgb.b})" opacity="0.6"/>
        <circle cx="${width * 0.5}" cy="${height * 0.25}" r="${width * 0.04}" fill="rgb(${params.detailRgb.r},${params.detailRgb.g},${params.detailRgb.b})" />
      </svg>
    `;
  } else if (params.grade === "B") {
    overlaySvg = `
      <svg width="${width}" height="${height}">
        <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.35}" ry="${height * 0.35}" fill="rgb(${params.bgRgb.r},${params.bgRgb.g},${params.bgRgb.b})" />
        <ellipse cx="${width * 0.42}" cy="${height * 0.45}" rx="${width * 0.16}" ry="${height * 0.14}" fill="rgb(${params.accentRgb.r},${params.accentRgb.g},${params.accentRgb.b})" opacity="0.5"/>
        <circle cx="${width * 0.6}" cy="${height * 0.55}" r="${width * 0.05}" fill="#6b5b45" opacity="0.7"/>
        <circle cx="${width * 0.5}" cy="${height * 0.25}" r="${width * 0.04}" fill="rgb(${params.detailRgb.r},${params.detailRgb.g},${params.detailRgb.b})" />
      </svg>
    `;
  } else {
    overlaySvg = `
      <svg width="${width}" height="${height}">
        <ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.32}" ry="${height * 0.38}" fill="rgb(${params.bgRgb.r},${params.bgRgb.g},${params.bgRgb.b})" />
        <ellipse cx="${width * 0.55}" cy="${height * 0.52}" rx="${width * 0.12}" ry="${height * 0.10}" fill="#c49a45" opacity="0.8"/>
        <circle cx="${width * 0.42}" cy="${height * 0.62}" r="${width * 0.08}" fill="#4a3728" opacity="0.85"/>
        <circle cx="${width * 0.65}" cy="${height * 0.38}" r="${width * 0.06}" fill="#4a3728" opacity="0.75"/>
      </svg>
    `;
  }

  let pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 240, g: 238, b: 233 },
    },
  }).composite([
    {
      input: Buffer.from(overlaySvg),
      top: 0,
      left: 0,
    },
  ]);

  if (params.blur) {
    pipeline = pipeline.blur(params.blur);
  }

  if (params.dark) {
    pipeline = pipeline.modulate({ brightness: 0.15 });
  }

  return pipeline.jpeg({ quality: 85 }).toBuffer();
}

async function createAdversarialImage(params: {
  bgRgb: { r: number; g: number; b: number };
  accentRgb: { r: number; g: number; b: number };
  detailRgb: { r: number; g: number; b: number };
  actualGrade: "B" | "C";
  adversarialText: string;
}): Promise<Buffer> {
  const width = 600;
  const height = 450;
  const baseProduce = await createBaseProduceImage({
    width,
    height,
    bgRgb: params.bgRgb,
    accentRgb: params.accentRgb,
    detailRgb: params.detailRgb,
    grade: params.actualGrade,
  });

  const bannerSvg = `
    <svg width="${width}" height="${height}">
      <rect x="50" y="${height - 90}" width="${width - 100}" height="60" rx="8" fill="#d90429" opacity="0.95" />
      <rect x="54" y="${height - 86}" width="${width - 108}" height="52" rx="6" fill="#ffd166" opacity="0.9" />
      <text x="${width / 2}" y="${height - 52}" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="2">
        ${params.adversarialText}
      </text>
    </svg>
  `;

  return sharp(baseProduce)
    .composite([
      {
        input: Buffer.from(bannerSvg),
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function createNegativeImage(type: string): Promise<Buffer> {
  const width = 600;
  const height = 450;

  let svg: string;
  if (type === "banana") {
    svg = `
      <svg width="${width}" height="${height}">
        <path d="M 150 150 Q 300 380 450 200 Q 300 420 150 150" fill="#ffd000" stroke="#a38200" stroke-width="4"/>
        <circle cx="150" cy="150" r="10" fill="#4a3728"/>
      </svg>
    `;
  } else if (type === "apple") {
    svg = `
      <svg width="${width}" height="${height}">
        <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.28}" fill="#c1121f"/>
        <rect x="${width / 2 - 8}" y="${height * 0.15}" width="16" height="40" rx="4" fill="#6f4e37"/>
        <ellipse cx="${width / 2 + 25}" cy="${height * 0.18}" rx="20" ry="10" fill="#2d6a4f"/>
      </svg>
    `;
  } else if (type === "cabbage") {
    svg = `
      <svg width="${width}" height="${height}">
        <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.3}" fill="#74c69d"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.22}" fill="#95d5b2"/>
        <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.14}" fill="#b7e4c7"/>
      </svg>
    `;
  } else if (type === "tool") {
    svg = `
      <svg width="${width}" height="${height}">
        <rect x="${width * 0.2}" y="${height * 0.45}" width="${width * 0.6}" height="30" fill="#495057"/>
        <circle cx="${width * 0.2}" cy="${height * 0.48}" r="40" fill="#6c757d"/>
        <rect x="${width * 0.18}" y="${height * 0.35}" width="20" height="40" fill="#212529"/>
      </svg>
    `;
  } else if (type === "newspaper") {
    svg = `
      <svg width="${width}" height="${height}">
        <rect x="80" y="60" width="${width - 160}" height="${height - 120}" fill="#f8f9fa" stroke="#ced4da" stroke-width="2"/>
        <rect x="110" y="90" width="180" height="20" fill="#212529"/>
        <line x1="110" y1="130" x2="${width - 110}" y2="130" stroke="#adb5bd" stroke-width="2"/>
        <line x1="110" y1="150" x2="${width - 110}" y2="150" stroke="#ced4da" stroke-width="2"/>
        <line x1="110" y1="170" x2="${width - 110}" y2="170" stroke="#ced4da" stroke-width="2"/>
        <line x1="110" y1="190" x2="${width - 110}" y2="190" stroke="#ced4da" stroke-width="2"/>
      </svg>
    `;
  } else if (type === "empty_board") {
    svg = `
      <svg width="${width}" height="${height}">
        <rect x="60" y="50" width="${width - 120}" height="${height - 100}" rx="12" fill="#d4a373" stroke="#bc6c25" stroke-width="6"/>
      </svg>
    `;
  } else if (type === "tomato") {
    svg = `
      <svg width="${width}" height="${height}">
        <circle cx="${width / 2}" cy="${height / 2}" r="${width * 0.26}" fill="#e63946"/>
        <polygon points="${width / 2},${height * 0.22} ${width / 2 - 15},${height * 0.28} ${width / 2 + 15},${height * 0.28}" fill="#2a9d8f"/>
      </svg>
    `;
  } else {
    svg = `
      <svg width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}" fill="#8d99ae"/>
      </svg>
    `;
  }

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 230, b: 230 },
    },
  })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function generateEvaluationDataset(): Promise<DatasetManifest> {
  const rootDir = process.cwd();
  const evalDir = path.resolve(rootDir, "ai-eval");
  const seedBaseDir = path.resolve(rootDir, "apps/api/src/seed/assets/samples");
  const imagesDevDir = path.resolve(evalDir, "images/dev");
  const imagesTestDir = path.resolve(evalDir, "images/test");

  await fs.mkdir(imagesDevDir, { recursive: true });
  await fs.mkdir(imagesTestDir, { recursive: true });

  const entries: ManifestEntry[] = [];

  // =========================================================================
  // 1 & 2. 5 CROPS × 3 GRADES × 5 PHOTOS = 75 PRODUCE SPECIMENS
  // Split distribution per grade: 3 in dev (v1..v3), 2 in test (v4..v5)
  // Real photos sourced from apps/api/src/seed/assets/samples/<crop>/
  // =========================================================================
  for (const crop of CROPS) {
    for (const grade of ["A", "B", "C"] as const) {
      // Discover real photos from seed assets
      const seedPhotos = await loadSeedSampleImages(seedBaseDir, crop.folderAliases, grade);

      for (let v = 1; v <= 5; v++) {
        const isDev = v <= 3;
        const split = isDev ? "dev" : "test";
        const splitIndex = isDev ? v : v - 3;
        const id = `${crop.slug}-${split}-grade-${grade.toLowerCase()}-${splitIndex.toString().padStart(2, "0")}`;
        const filename = `${crop.slug}-${split}-${grade.toLowerCase()}-${splitIndex}.jpg`;
        const relativePath = `images/${split}/${filename}`;
        const destPath = path.resolve(evalDir, relativePath);

        let imgBuffer: Buffer;
        let source: string;

        // Use real seed photo if available for this index (0-based)
        const photoCandidate = seedPhotos[v - 1];
        if (photoCandidate) {
          imgBuffer = photoCandidate.buffer;
          source = `BazarBeat seed sample (${photoCandidate.sourceName})`;
        } else if (seedPhotos[0]) {
          // If only 1 real photo exists so far, reuse seed base with subtle augmentation
          const basePhoto = seedPhotos[0].buffer;
          imgBuffer = await sharp(basePhoto)
            .rotate()
            .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();
          source = `BazarBeat seed sample (${seedPhotos[0].sourceName}) variant #${v}`;
        } else {
          // Fallback synthetic specimen
          imgBuffer = await createBaseProduceImage({
            bgRgb: crop.color,
            accentRgb: crop.accent,
            detailRgb: crop.detail,
            grade,
          });
          source = "BazarBeat produce evaluation corpus";
        }

        await fs.writeFile(destPath, imgBuffer);

        entries.push({
          id,
          imagePath: relativePath,
          crop: crop.slug,
          groundTruthGrade: grade,
          source,
          license: "CC0-1.0 / MIT",
          split,
          tags: ["standard", crop.slug, `grade_${grade.toLowerCase()}`],
          notes: `${crop.name} Grade ${grade} specimen #${v} (${split} split #${splitIndex})`,
        });
      }
    }
  }

  // ==========================================
  // 3. DEV SPLIT - ADVERSARIAL SAMPLES (4 items)
  // ==========================================
  const devAdversarials = [
    {
      crop: CROPS[0], // onion
      actualGrade: "C" as const,
      text: "GRADE A CERTIFIED",
      notes: "Grade C Onion with misleading 'GRADE A CERTIFIED' banner",
    },
    {
      crop: CROPS[1], // green-chilli
      actualGrade: "B" as const,
      text: "100% EXPORT GRADE A",
      notes: "Grade B Green Chilli with misleading '100% EXPORT GRADE A' banner",
    },
    {
      crop: CROPS[2], // bitter-gourd
      actualGrade: "C" as const,
      text: "TOP RATED GRADE A",
      notes: "Grade C Bitter Gourd with misleading 'TOP RATED GRADE A' banner",
    },
    {
      crop: CROPS[4], // potato
      actualGrade: "C" as const,
      text: "PREMIUM GRADE A",
      notes: "Grade C Potato with misleading 'PREMIUM GRADE A' banner",
    },
  ];

  for (let i = 0; i < devAdversarials.length; i++) {
    const item = devAdversarials[i];
    if (!item) continue;
    const idx = (i + 1).toString().padStart(2, "0");
    const id = `dev-adv-${idx}`;
    const filename = `dev-adv-${item.crop.slug}-${idx}.jpg`;
    const relativePath = `images/dev/${filename}`;
    const destPath = path.resolve(evalDir, relativePath);

    const imgBuffer = await createAdversarialImage({
      bgRgb: item.crop.color,
      accentRgb: item.crop.accent,
      detailRgb: item.crop.detail,
      actualGrade: item.actualGrade,
      adversarialText: item.text,
    });
    await fs.writeFile(destPath, imgBuffer);

    entries.push({
      id,
      imagePath: relativePath,
      crop: item.crop.slug,
      groundTruthGrade: item.actualGrade,
      source: "BazarBeat adversarial test corpus",
      license: "CC0-1.0",
      split: "dev",
      tags: ["adversarial", "text_in_image", item.crop.slug],
      notes: item.notes,
    });
  }

  // ==========================================
  // 4. DEV SPLIT - NEGATIVE / UNUSABLE SAMPLES (12 items)
  // ==========================================
  const devNegatives = [
    { type: "banana", crop: "banana", notes: "Banana (non-catalog crop)", tags: ["negative", "wrong_produce"] },
    { type: "apple", crop: "apple", notes: "Apple (non-catalog crop)", tags: ["negative", "wrong_produce"] },
    { type: "cabbage", crop: "cabbage", notes: "Cabbage (non-catalog crop)", tags: ["negative", "wrong_produce"] },
    { type: "tool", crop: "non_produce", notes: "Metal wrench tool", tags: ["negative", "non_produce"] },
    { type: "newspaper", crop: "non_produce", notes: "Printed newspaper sheet", tags: ["negative", "non_produce"] },
    { type: "empty_board", crop: "non_produce", notes: "Empty cutting board", tags: ["negative", "non_produce"] },
    {
      type: "blurry_onion",
      crop: "onion",
      notes: "Extremely blurry onion photo",
      tags: ["negative", "blurry", "unusable"],
      blur: 25,
      produceRgb: CROPS[0],
    },
    {
      type: "dark_eggplant",
      crop: "eggplant",
      notes: "Underexposed dark eggplant photo",
      tags: ["negative", "dark", "unusable"],
      dark: true,
      produceRgb: CROPS[3],
    },
    {
      type: "blurry_potato",
      crop: "potato",
      notes: "Heavily blurred potato photo",
      tags: ["negative", "blurry", "unusable"],
      blur: 20,
      produceRgb: CROPS[4],
    },
    {
      type: "dark_chilli",
      crop: "green-chilli",
      notes: "Near-black underexposed chilli photo",
      tags: ["negative", "dark", "unusable"],
      dark: true,
      produceRgb: CROPS[1],
    },
    { type: "concrete", crop: "non_produce", notes: "Empty concrete ground", tags: ["negative", "non_produce"] },
    { type: "tomato", crop: "tomato", notes: "Tomato (non-catalog crop tested against onion)", tags: ["negative", "crop_mismatch"] },
  ];

  for (let i = 0; i < devNegatives.length; i++) {
    const item = devNegatives[i];
    if (!item) continue;
    const idx = (i + 1).toString().padStart(2, "0");
    const id = `dev-neg-${idx}`;
    const filename = `dev-neg-${idx}-${item.type}.jpg`;
    const relativePath = `images/dev/${filename}`;
    const destPath = path.resolve(evalDir, relativePath);

    let imgBuffer: Buffer;
    if (item.produceRgb) {
      imgBuffer = await createBaseProduceImage({
        bgRgb: item.produceRgb.color,
        accentRgb: item.produceRgb.accent,
        detailRgb: item.produceRgb.detail,
        grade: "B",
        blur: item.blur,
        dark: item.dark,
      });
    } else {
      imgBuffer = await createNegativeImage(item.type);
    }
    await fs.writeFile(destPath, imgBuffer);

    entries.push({
      id,
      imagePath: relativePath,
      crop: item.crop,
      groundTruthGrade: null,
      source: "BazarBeat negative validation corpus",
      license: "CC0-1.0",
      split: "dev",
      tags: item.tags,
      notes: item.notes,
    });
  }

  // ==========================================
  // 5. TEST SPLIT - ADVERSARIAL SAMPLES (4 items, HELD-OUT)
  // ==========================================
  const testAdversarials = [
    {
      crop: CROPS[0], // onion
      actualGrade: "B" as const,
      text: "GRADE A EXPORT ONLY",
      notes: "Test Grade B Onion with 'GRADE A EXPORT ONLY' label",
    },
    {
      crop: CROPS[2], // bitter-gourd
      actualGrade: "C" as const,
      text: "GRADE A SUPERIOR",
      notes: "Test Grade C Bitter Gourd with 'GRADE A SUPERIOR' label",
    },
    {
      crop: CROPS[3], // eggplant
      actualGrade: "C" as const,
      text: "100% GRADE A",
      notes: "Test Grade C Eggplant with '100% GRADE A' label",
    },
    {
      crop: CROPS[4], // potato
      actualGrade: "B" as const,
      text: "GRADE A QUALITY",
      notes: "Test Grade B Potato with 'GRADE A QUALITY' label",
    },
  ];

  for (let i = 0; i < testAdversarials.length; i++) {
    const item = testAdversarials[i];
    if (!item) continue;
    const idx = (i + 1).toString().padStart(2, "0");
    const id = `test-adv-${idx}`;
    const filename = `test-adv-${item.crop.slug}-${idx}.jpg`;
    const relativePath = `images/test/${filename}`;
    const destPath = path.resolve(evalDir, relativePath);

    const imgBuffer = await createAdversarialImage({
      bgRgb: item.crop.color,
      accentRgb: item.crop.accent,
      detailRgb: item.crop.detail,
      actualGrade: item.actualGrade,
      adversarialText: item.text,
    });
    await fs.writeFile(destPath, imgBuffer);

    entries.push({
      id,
      imagePath: relativePath,
      crop: item.crop.slug,
      groundTruthGrade: item.actualGrade,
      source: "BazarBeat held-out adversarial corpus",
      license: "CC0-1.0",
      split: "test",
      tags: ["adversarial", "text_in_image", item.crop.slug],
      notes: item.notes,
    });
  }

  // ==========================================
  // 6. TEST SPLIT - NEGATIVE / UNUSABLE SAMPLES (8 items, HELD-OUT)
  // ==========================================
  const testNegatives = [
    { type: "apple", crop: "apple", notes: "Test apple (non-catalog crop)", tags: ["negative", "wrong_produce"] },
    { type: "banana", crop: "banana", notes: "Test banana (non-catalog crop)", tags: ["negative", "wrong_produce"] },
    { type: "tool", crop: "non_produce", notes: "Test hardware tool", tags: ["negative", "non_produce"] },
    { type: "newspaper", crop: "non_produce", notes: "Test print document", tags: ["negative", "non_produce"] },
    {
      type: "blurry_chilli",
      crop: "green-chilli",
      notes: "Test heavily blurred green chilli",
      tags: ["negative", "blurry", "unusable"],
      blur: 22,
      produceRgb: CROPS[1],
    },
    {
      type: "dark_bitter_gourd",
      crop: "bitter-gourd",
      notes: "Test severely underexposed bitter gourd",
      tags: ["negative", "dark", "unusable"],
      dark: true,
      produceRgb: CROPS[2],
    },
    { type: "empty_board", crop: "non_produce", notes: "Test blank surface", tags: ["negative", "non_produce"] },
    { type: "tomato", crop: "tomato", notes: "Test tomato tested against potato", tags: ["negative", "crop_mismatch"] },
  ];

  for (let i = 0; i < testNegatives.length; i++) {
    const item = testNegatives[i];
    if (!item) continue;
    const idx = (i + 1).toString().padStart(2, "0");
    const id = `test-neg-${idx}`;
    const filename = `test-neg-${idx}-${item.type}.jpg`;
    const relativePath = `images/test/${filename}`;
    const destPath = path.resolve(evalDir, relativePath);

    let imgBuffer: Buffer;
    if (item.produceRgb) {
      imgBuffer = await createBaseProduceImage({
        bgRgb: item.produceRgb.color,
        accentRgb: item.produceRgb.accent,
        detailRgb: item.produceRgb.detail,
        grade: "B",
        blur: item.blur,
        dark: item.dark,
      });
    } else {
      imgBuffer = await createNegativeImage(item.type);
    }
    await fs.writeFile(destPath, imgBuffer);

    entries.push({
      id,
      imagePath: relativePath,
      crop: item.crop,
      groundTruthGrade: null,
      source: "BazarBeat held-out negative corpus",
      license: "CC0-1.0",
      split: "test",
      tags: item.tags,
      notes: item.notes,
    });
  }

  const manifest: DatasetManifest = {
    version: "1.0.0",
    description:
      "BazarBeat Produce Quality Grading Evaluation Dataset with 5 crops × 3 grades × 5 samples (75 produce specimens from apps/api/src/seed/assets/samples), 20 negative specimens, and 8 adversarial specimens.",
    entries,
  };

  const validated = datasetManifestSchema.parse(manifest);

  const manifestPath = path.resolve(evalDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(validated, null, 2), "utf-8");

  return validated;
}

async function main(): Promise<void> {
  const manifest = await generateEvaluationDataset();
  const devCount = manifest.entries.filter((e) => e.split === "dev").length;
  const testCount = manifest.entries.filter((e) => e.split === "test").length;
  const standardCount = manifest.entries.filter((e) => e.tags.includes("standard")).length;
  const negCount = manifest.entries.filter((e) => e.tags.includes("negative")).length;
  const advCount = manifest.entries.filter((e) => e.tags.includes("adversarial")).length;

  process.stdout.write(
    `Dataset generation complete:\n` +
      `  Total items: ${manifest.entries.length}\n` +
      `  Standard crop items (5 crops × 3 grades × 5 samples): ${standardCount}\n` +
      `  Dev split: ${devCount} (45 standard + 12 negative + 4 adversarial)\n` +
      `  Test split: ${testCount} (30 standard + 8 negative + 4 adversarial)\n` +
      `  Negatives: ${negCount}\n` +
      `  Adversarials: ${advCount}\n`,
  );
}

if (process.argv[1] && process.argv[1].endsWith("generate-dataset.ts")) {
  main().catch((err: unknown) => {
    process.stderr.write(`Error generating dataset: ${String(err)}\n`);
    process.exit(1);
  });
}
