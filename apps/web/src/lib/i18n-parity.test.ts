import { describe, expect, it } from "vitest";

import { i18n } from "./i18n.js";

interface LeafEntry {
  key: string;
  value: string;
}

function getLeafEntries(
  obj: Record<string, unknown>,
  prefix = "",
): LeafEntry[] {
  const result: LeafEntry[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      result.push(...getLeafEntries(v as Record<string, unknown>, fullKey));
    } else if (typeof v === "string") {
      result.push({ key: fullKey, value: v });
    }
  }
  return result;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/[{}]/g, "").trim()).sort();
}

describe("i18n Parity & Completeness (Task 8.9)", () => {
  const enResources = i18n.getResourceBundle("en", "translation") as Record<string, unknown>;
  const bnResources = i18n.getResourceBundle("bn", "translation") as Record<string, unknown>;

  const enLeaves = getLeafEntries(enResources);
  const bnLeaves = getLeafEntries(bnResources);

  const enMap = new Map<string, string>(enLeaves.map((e) => [e.key, e.value]));
  const bnMap = new Map<string, string>(bnLeaves.map((e) => [e.key, e.value]));

  it("has non-empty translation resource bundles for both en and bn", () => {
    expect(enLeaves.length).toBeGreaterThan(100);
    expect(bnLeaves.length).toBeGreaterThan(100);
  });

  it("verifies every 'en' key exists in 'bn' (100% coverage)", () => {
    const missingInBn: string[] = [];
    for (const { key } of enLeaves) {
      if (!bnMap.has(key)) {
        missingInBn.push(key);
      }
    }
    expect(
      missingInBn,
      `Found ${missingInBn.length} keys present in English but missing in Bangla:\n${missingInBn.join("\n")}`,
    ).toEqual([]);
  });

  it("verifies every 'bn' key exists in 'en' (no orphaned keys)", () => {
    const missingInEn: string[] = [];
    for (const { key } of bnLeaves) {
      if (!enMap.has(key)) {
        missingInEn.push(key);
      }
    }
    expect(
      missingInEn,
      `Found ${missingInEn.length} keys present in Bangla but missing in English:\n${missingInEn.join("\n")}`,
    ).toEqual([]);
  });

  it("verifies no translation in either language is an empty string", () => {
    const emptyEn = enLeaves.filter((e) => e.value.trim().length === 0).map((e) => e.key);
    const emptyBn = bnLeaves.filter((e) => e.value.trim().length === 0).map((e) => e.key);

    expect(emptyEn, `Empty English keys: ${emptyEn.join(", ")}`).toEqual([]);
    expect(emptyBn, `Empty Bangla keys: ${emptyBn.join(", ")}`).toEqual([]);
  });

  it("verifies identical interpolation variables in en and bn for all keys", () => {
    const variableMismatches: Array<{ key: string; enVars: string[]; bnVars: string[] }> = [];

    for (const { key, value: enVal } of enLeaves) {
      const bnVal = bnMap.get(key);
      if (!bnVal) continue;

      const enVars = extractVariables(enVal);
      const bnVars = extractVariables(bnVal);

      if (JSON.stringify(enVars) !== JSON.stringify(bnVars)) {
        variableMismatches.push({ key, enVars, bnVars });
      }
    }

    expect(
      variableMismatches,
      `Variable mismatches:\n${variableMismatches.map((m) => `${m.key}: en=[${m.enVars.join(",")}] bn=[${m.bnVars.join(",")}]`).join("\n")}`,
    ).toEqual([]);
  });

  it("missing-key handler produces visible ⚠️[<key>] marker for unregistered keys", () => {
    const missingKey = "unregistered.fake.translation.key";
    const rendered = i18n.t(missingKey);
    expect(rendered).toBe(`⚠️[${missingKey}]`);
  });

  it("sets document.documentElement.lang to match active language", async () => {
    await i18n.changeLanguage("bn");
    expect(document.documentElement.lang).toBe("bn");

    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
  });
});
