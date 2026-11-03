// Renders the app's icon and splash PNGs from the SVG sources in
// assets/source/. Run from mobile/ with `bun run icons` after editing a source.
import { readFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const outputs = [
  { source: "icon.svg", target: "assets/images/icon.png" },
  { source: "android-icon-foreground.svg", target: "assets/images/android-icon-foreground.png" },
  { source: "android-icon-monochrome.svg", target: "assets/images/android-icon-monochrome.png" },
  { source: "splash-icon.svg", target: "assets/images/splash-icon.png" },
  // Uploaded to the Play Console listing by hand; the app doesn't bundle it.
  { source: "play-store-icon.svg", target: "store/play-store-icon.png" },
];

for (const { source, target } of outputs) {
  const svg = await readFile(path.join("assets/source", source));
  await sharp(svg).png().toFile(target);
  console.log(`${source} -> ${target}`);
}
