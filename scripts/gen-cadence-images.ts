#!/usr/bin/env bun
/**
 * Two premium Ghibli-style images for the Dream cadence step:
 * one morning, one evening. Same setting, different time of day.
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

const SHARED =
  "Hand-painted anime watercolor in the studio Ghibli style. A peaceful Japanese hilltop study with a wooden balcony, an antique brass telescope on a tripod, papers and journals on a small writing desk, ferns in clay pots. Slow, cinematic, contemplative atmosphere. Painterly textures, visible brushwork, generous negative sky, no characters, no text, no UI, no watermark, no logos. 4K detail.";

interface Job {
  out: string;
  aspect: Aspect;
  prompt: string;
}

const jobs: Job[] = [
  {
    out: "src/assets/dream/cadence-morning.png",
    aspect: "16:9",
    prompt: `${SHARED} Time: just after sunrise. Color palette: soft peach and rose gold sky, warm amber light through cherry blossoms, gentle dawn mist drifting through the valley below, dewy grass, the first beam of sun catching the brass telescope. Hopeful, fresh, full of promise.`,
  },
  {
    out: "src/assets/dream/cadence-evening.png",
    aspect: "16:9",
    prompt: `${SHARED} Time: just after sunset. Color palette: deep indigo and violet sky beginning to reveal early stars, warm orange lanterns lit on the balcony, the last embers of sun on the distant horizon, fireflies starting to drift. Quiet, dreamy, contemplative.`,
  },
];

async function main() {
  console.log(`[cadence] generating ${jobs.length} Ghibli images via nano-banana-2`);
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const out = join(root, j.out);
      try {
        return await generate({ prompt: j.prompt, aspect: j.aspect, outPath: out });
      } catch (e) {
        console.error(`[cadence] FAILED ${j.out}: ${(e as Error).message}`);
        throw e;
      }
    }),
  );
  console.log("\n[cadence] summary:");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`  ✅ ${jobs[i].out}`);
    else console.log(`  ❌ ${jobs[i].out} — ${(r.reason as Error).message}`);
  });
}

main();
