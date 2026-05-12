#!/usr/bin/env bun
/**
 * Generate 4 unique Ghibli-style stargazing images for the Dream cards.
 * Each is color-themed to match a Dream category tone.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate, type Aspect } from "./gen-image";

const root = join(import.meta.dir, "..");
const envPath = join(root, "..", ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

interface Job {
  out: string;
  aspect: Aspect;
  prompt: string;
}

const BASE =
  "A serene anime watercolor stargazing scene at night. A solitary observatory or astronomer's nook on a quiet hilltop, brass telescope angled to the sky, soft constellations forming over distant misty mountains. Floating papers and lanterns glow gently, fireflies drift. Hand-drawn painterly aesthetic, miyazaki-inspired film quality, dreamy and contemplative mood, generous starry sky with nebula clouds, cinematic depth. No characters. No text. No watermark. No UI. No logos.";

const jobs: Job[] = [
  {
    out: "src/assets/dream/memory-pink.png",
    aspect: "16:9",
    prompt: `${BASE} Color palette: rose pink and magenta nebula, blush horizon, soft cherry-blossom mist, warm pink starlight reflecting off the telescope brass.`,
  },
  {
    out: "src/assets/dream/cost-orange.png",
    aspect: "16:9",
    prompt: `${BASE} Color palette: warm sunset orange and amber, glowing tangerine nebula, copper-gold telescope reflections, ember firefly motes, deep dusk indigo at the corners.`,
  },
  {
    out: "src/assets/dream/skills-blue.png",
    aspect: "16:9",
    prompt: `${BASE} Color palette: deep cobalt and cyan nebula, sapphire starlight, gentle aqua mist, midnight indigo sky with bright blue-white stars, soft moonlit silver highlights.`,
  },
  {
    out: "src/assets/dream/workflow-yellow.png",
    aspect: "16:9",
    prompt: `${BASE} Color palette: golden yellow and pale cream nebula, warm honey starlight, glowing amber lanterns, soft buttery moon haze, faint olive horizon. Stars feel sun-warmed even at night.`,
  },
];

async function main() {
  console.log(`[dream] starting ${jobs.length} generations via nano-banana-2`);
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const out = join(root, j.out);
      try {
        return await generate({ prompt: j.prompt, aspect: j.aspect, outPath: out });
      } catch (e) {
        console.error(`[dream] FAILED ${j.out}: ${(e as Error).message}`);
        throw e;
      }
    }),
  );
  console.log("\n[dream] summary:");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`  ✅ ${jobs[i].out}`);
    else console.log(`  ❌ ${jobs[i].out} — ${(r.reason as Error).message}`);
  });
}

main();
