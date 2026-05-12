#!/usr/bin/env bun
/**
 * Generates the 6 post-onboarding Agentic OS images: the four Dream
 * card backgrounds (memory / cost / skills / workflow), the cosmos
 * backdrop used in two places, and the Skills page hero.
 *
 * Design rationale: rather than color-coding each card (which would
 * break the two-accent palette), each card carries its own SCENE
 * metaphor — archive, ember, tool wall, clockwork — while staying in
 * the same charcoal + amber + blue language as the rest of the system.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate, type Aspect } from "./gen-image";

const root = join(import.meta.dir, "..");
const envPath = join(root, ".env.local");
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
    out: "src/assets/dream/memory-pink.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: an empty modern archive room at 4am — a wall of matte-black slim drawers stretching deep into shadow, single thin amber LED strip running along the floor edge, faint electric-blue light spilling from a single half-open drawer in the middle distance. Dust motes drift in the amber glow. Cold polished concrete floor. Metaphor: dormant knowledge, what you've stored is waiting to be retrieved.`,
  },
  {
    out: "src/assets/dream/cost-orange.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: extreme macro of a single hot amber ember on a bed of cold dark coals, shallow depth of field. The ember glows brightest at its core, fading to deep charcoal at its edges. A whisper of electric-blue smoke curls upward at the far right of frame. Background is pure black. Metaphor: small flames consume more than you think — cost that compounds invisibly.`,
  },
  {
    out: "src/assets/dream/skills-blue.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: a long wall of matte-black hand tools and calipers hanging in dark shadow-boxes, each with a tiny amber serial-number LED underneath. One specific tool — a precision wrench — is illuminated by a soft electric-blue overhead spot, slightly forward of its slot as if just lifted. The rest of the wall recedes into dark falloff. Metaphor: the right tool for the next job — your skill inventory.`,
  },
  {
    out: "src/assets/dream/workflow-yellow.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: extreme macro of brass clockwork half-buried in dark velvet — three exposed gears caught mid-rotation, the largest illuminated by warm amber side light, the smallest catching an electric-blue rim light from the opposite side. Polished but worn brass surfaces, fine dust visible between teeth. Background is pure black. Metaphor: motion locked in pattern — repetition you can name.`,
  },
  {
    out: "src/assets/dream-cosmos.jpg",
    aspect: "16:9",
    format: "jpg",
    prompt: `${STYLE_ANCHOR} Subject: a wide ultra-dark night sky shot, almost no terrestrial reference. Single elongated amber meteor trail crossing left-to-right in the upper third, faint dust-lane structure of a distant nebula glowing in deep electric blue along the lower edge of frame. Sparse warm-amber stars. ISO grain visible. Mood: the operating system's quiet vastness — autonomous, indifferent, methodical.`,
  },
  {
    out: "src/assets/skills/skills-hero.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: top-down overhead of a craftsman's workbench at night. Hand tools laid out in a precise grid — calipers, files, wrenches, an open leather tool roll — all matte black or worn brass. A single amber bench lamp casts a warm pool of light from the upper right, electric blue rim light spills from an off-frame workshop window on the left. Polished wood surface with tool oil patina. Metaphor: your toolset, organized, ready for the next session.`,
  },
];

async function main() {
  console.log(`[dashboard] generating ${jobs.length} Agentic OS images via nano-banana-2 @ 2K`);
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const out = join(root, j.out);
      try {
        return await generate({
          prompt: j.prompt,
          aspect: j.aspect,
          outPath: out,
          format: j.format,
          resolution: "2K",
        });
      } catch (e) {
        console.error(`[dashboard] FAILED ${j.out}: ${(e as Error).message}`);
        throw e;
      }
    }),
  );
  console.log("\n[dashboard] summary:");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`  ✓ ${jobs[i].out}`);
    else console.log(`  ✗ ${jobs[i].out} — ${(r.reason as Error).message}`);
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) process.exit(1);
}

main();
