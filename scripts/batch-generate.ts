#!/usr/bin/env bun
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
  model?: string;
}

const jobs: Job[] = [
  {
    out: "src/assets/skills/deep-research.png",
    aspect: "16:9",
    prompt:
      "A serene anime watercolor scene of a warm lamp-lit ancient library at dusk. Towering wooden bookshelves stretch into shadow, scrolls and books glow softly, dust motes drift in golden beams of light. A cozy reading nook with floating papers and an unrolled map. No characters, no text, no watermark. Hand-drawn painterly aesthetic, deep amber and forest green palette, dreamy atmosphere, miyazaki-inspired film quality, cinematic depth.",
  },
  {
    out: "src/assets/skills/title-generator.png",
    aspect: "16:9",
    prompt:
      "A serene anime watercolor of a floating workshop in the clouds at golden hour. An antique typewriter on a wooden desk with paper sheets drifting in soft wind. Ink bottles, candles glowing, distant mountains with cumulus clouds. No characters, no text, no watermark. Hand-drawn painterly aesthetic, magical and serene mood, miyazaki-inspired film quality, warm cream and sky blue palette, cinematic light rays.",
  },
  {
    out: "src/assets/skills/comment-miner.png",
    aspect: "16:9",
    prompt:
      "A serene anime watercolor of a magical forest post office at twilight. Hundreds of letters and envelopes flying through the air like white birds. Cozy lantern-lit shelves of mossy mailboxes, stone path, fireflies dancing. No characters, no text, no watermark. Hand-drawn painterly aesthetic, gentle and magical mood, miyazaki-inspired film quality, soft forest greens and warm yellow lighting, cinematic depth.",
  },
  {
    out: "src/assets/skills/signal-report.png",
    aspect: "16:9",
    prompt:
      "A serene anime watercolor of a mountain watchtower at sunrise with a brass radio antenna at its peak. Glowing concentric pastel ripples emanating from the antenna. Billowing clouds below, wooden balcony with telescopes and weather instruments. No characters, no text, no watermark. Hand-drawn painterly aesthetic, hopeful and cinematic mood, miyazaki-inspired film quality, dawn pinks fading into ocean blues, sun behind antenna.",
  },
  {
    out: "src/assets/logos/openai-gpt5.png",
    aspect: "1:1",
    prompt:
      "A premium minimalist app icon for an AI product on a dark charcoal background. A clean white spiral knot mark of six interwoven loops, subtle iridescent metallic shimmer, soft inner glow, centered composition, app icon style. No text, no watermark, sharp crisp edges, modern, sophisticated, neutral.",
    model: "nano-banana-2",
  },
  {
    out: "src/assets/logos/codex.png",
    aspect: "1:1",
    prompt:
      "A premium minimalist app icon on a dark charcoal background. A clean monochrome white geometric mark suggesting code: stacked angular brackets and a stylized terminal cursor, soft inner glow, centered composition. No text, no watermark, sharp crisp edges, modern, technical, sophisticated.",
    model: "nano-banana-2",
  },
];

async function main() {
  console.log(`[batch] starting ${jobs.length} generations via nano-banana-2`);
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const out = join(root, j.out);
      try {
        return await generate({ prompt: j.prompt, aspect: j.aspect, outPath: out, model: j.model });
      } catch (e) {
        console.error(`[batch] FAILED ${j.out}: ${(e as Error).message}`);
        throw e;
      }
    }),
  );
  console.log("\n[batch] summary:");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`  ✅ ${jobs[i].out}`);
    else console.log(`  ❌ ${jobs[i].out} — ${(r.reason as Error).message}`);
  });
}

main();
