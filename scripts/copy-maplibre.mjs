import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const packageFile = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(await readFile(packageFile, "utf8"));
const source = join(dirname(packageFile), "dist");
const target = resolve("public", "vendor", "maplibre", version);
await mkdir(target, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(join(source, name), join(target, name));
}
await copyFile(join(dirname(packageFile), "LICENSE.txt"), join(target, "LICENSE.txt"));
console.log(`MapLibre ${version}: worker and shared module copied`);
