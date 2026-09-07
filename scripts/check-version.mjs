import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const versionSource = await readFile(new URL("../src/version.ts", import.meta.url), "utf8");
const sourceVersion = versionSource.match(/APP_VERSION = "([^"]+)"/)?.[1];

if (!sourceVersion || sourceVersion !== packageJson.version) {
  console.error(`Version mismatch: package.json=${packageJson.version}, src/version.ts=${sourceVersion ?? "missing"}`);
  process.exit(1);
}

console.log(`Version check passed (${sourceVersion})`);
