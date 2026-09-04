import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsDirectory = path.join(projectRoot, "src", "tests");
const testFiles = readdirSync(testsDirectory)
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join(testsDirectory, file));

if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...testFiles],
  { cwd: projectRoot, stdio: "inherit" }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
