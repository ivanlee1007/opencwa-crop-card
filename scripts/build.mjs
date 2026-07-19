import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await build({
  entryPoints: [fileURLToPath(new URL("../src/index.js", import.meta.url))],
  outfile: fileURLToPath(new URL("../opencwa-crop-card.js", import.meta.url)),
  bundle: true,
  format: "iife",
  target: ["es2020"],
  minify: false,
  sourcemap: false,
  legalComments: "none",
  banner: { js: `/* OpenCWA Crop Card v${pkg.version} | MIT */` },
});
const artifact = new URL("../opencwa-crop-card.js", import.meta.url);
const source = await readFile(artifact, "utf8");
await writeFile(artifact, source.replace("__OPENCWA_CROP_CARD_VERSION__", pkg.version), "utf8");
console.log(`Built opencwa-crop-card.js v${pkg.version}`);
