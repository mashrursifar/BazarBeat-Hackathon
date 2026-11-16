import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.resolve(dirname, "../../.tmp");

process.env.TEMP = tmpDir;
process.env.TMP = tmpDir;
process.env.MONGOMS_TMPDIR = tmpDir;

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
  },
});
