#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generate, type Aspect } from "./gen-image";

const repoRoot = resolve(import.meta.dir, "..");
const envPath = resolve(repoRoot, ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const STYLE_ANCHOR =
  "Cinematic photograph, refined dark editorial aesthetic. Anamorphic widescreen framing, slight ISO film grain, shallow depth of field. Premium operator-console mood — Linear / Vercel / Heretic visual language, anti-illustration, anti-watercolor, anti-anime. Color palette: deep charcoal black (#0A0A0B) base, warm amber primary (#C19A6B) accent, electric blue (#4A9EFF) rim light, warm off-white (#FAF7F2) highlights. No characters, no text, no UI, no logos, no watermark.";

interface Job {
  out: string;
  aspect: Aspect;
  format: "png" | "jpg";
  prompt: string;
}

const jobs: Job[] = [
  {
    out: resolve(repoRoot, "src/assets/dream/skills-blue.png"),
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: a long wall of matte-black hand tools and brass calipers hanging in dark shadow-boxes, each with a tiny amber serial-number LED underneath. One specific tool — a precision wrench — is illuminated by a soft electric-blue overhead spot, slightly forward of its slot as if just lifted. The rest of the wall recedes into dark falloff. Photographic realism. Metaphor: the right tool for the next job — your skill inventory.`,
  },
  {
    out: resolve(repoRoot, "src/assets/dream/workflow-yellow.png"),
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: extreme macro of brass clockwork half-buried in dark velvet — three exposed gears caught mid-rotation, the largest illuminated by warm amber side light, the smallest catching an electric-blue rim light from the opposite side. Polished but worn brass surfaces, fine dust visible between teeth. Background is pure black. Photographic realism. Metaphor: motion locked in pattern — repetition you can name.`,
  },
];

console.log(`[retry-2] regenerating ${jobs.length} images`);
const results = await Promise.allSettled(
  jobs.map((j) =>
    generate({ prompt: j.prompt, aspect: j.aspect, outPath: j.out, format: j.format, resolution: "2K" })
      .catch((e) => { console.error(`[retry-2] FAILED ${j.out}: ${(e as Error).message}`); throw e; })
  )
);
results.forEach((r, i) => {
  if (r.status === "fulfilled") console.log(`  ✓ ${jobs[i].out}`);
  else console.log(`  ✗ ${jobs[i].out}`);
});
const failed = results.filter((r) => r.status === "rejected").length;
if (failed > 0) process.exit(1);
