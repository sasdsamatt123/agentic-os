#!/usr/bin/env bun
/**
 * Generates the 5 Agentic OS onboarding images, replacing the upstream
 * Ghibli/watercolor variants with refined dark editorial photography.
 *
 * Palette anchors:
 *   charcoal       #0A0A0B
 *   amber primary  #C19A6B
 *   electric blue  #4A9EFF
 *   warm off-white #FAF7F2
 *
 * Aesthetic anchors: cinematic photograph, anamorphic widescreen,
 * Linear/Vercel premium dark, anti-watercolor, anti-anime.
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
    out: "src/assets/setup-welcome-hero.jpg",
    aspect: "16:9",
    format: "jpg",
    prompt: `${STYLE_ANCHOR} Subject: a wide overhead view of an empty modern operator's command room at night. One long curved desk with multiple matte-black monitors, all asleep. A single thin amber light glows from underneath the desk along the floor. One translucent electric-blue line of fiber-optic cable softly pulsing across the desk surface. Volumetric haze in the air. Polished dark concrete floor reflecting a faint amber band. Empty chair pulled out, ready. Mood: anticipation, quiet, premium — the operator has not arrived yet.`,
  },
  {
    out: "src/assets/install-overlay.jpg",
    aspect: "16:9",
    format: "jpg",
    prompt: `${STYLE_ANCHOR} Subject: extreme macro of a translucent dark-glass surface, photographed top-down. Thin amber data-lines flow diagonally across the glass like slow fiber-optic light. Soft electric-blue concentric pulse rings expand from a single off-center point. Deep volumetric haze, polished black backdrop. The amber lines are crisp at the focal plane, falling off into bokeh at the edges. Mood: scanning, detecting, system reading itself — alive but quiet.`,
  },
  {
    out: "src/assets/install-complete.jpg",
    aspect: "16:9",
    format: "jpg",
    prompt: `${STYLE_ANCHOR} Subject: a wide low-angle horizon at the very end of dusk. The lower half is deep charcoal land, the upper half deep charcoal sky. A single razor-thin amber sliver splits the two, like the last ember of sunset along the horizon line. In the upper third, a sparse constellation of warm amber pinpoint lights, like distant ridge-line city lights or far-off observatories. A faint electric-blue haze in the deepest part of the sky. Mood: settled, complete, quiet pride — the work is done.`,
  },
  {
    out: "src/assets/dream/cadence-morning.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: pre-dawn vantage from a high modern balcony. Deep charcoal sky transitions through a thin amber band along the horizon — the very first warmth of dawn. A single sharp electric-blue contrail crosses high above, fading. Distant mountain ridge silhouettes catching the first amber light along their top edge. Cold, still air implied. The dawn feels disciplined, not romantic. Mood: morning ritual, first-thing-in-the-day operator readiness, premium calm.`,
  },
  {
    out: "src/assets/dream/cadence-evening.png",
    aspect: "16:9",
    format: "png",
    prompt: `${STYLE_ANCHOR} Subject: twilight from a wooden modern balcony. Deep indigo-charcoal sky with the last embers of sun gone. Distant city lights pulse softly in warm amber along a far ridge. A single small warm-amber lantern sits on the balcony rail in the bottom-left corner, its glow catching a brass railing detail. Faint electric-blue glow seeps from a sleeping laptop screen on a low desk inside, just out of focus. Mountains barely visible in silhouette. Mood: end of day, reflection, the agent works while you sleep.`,
  },
];

async function main() {
  console.log(`[onboarding] generating ${jobs.length} Agentic OS images via nano-banana-2 @ 2K`);
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
        console.error(`[onboarding] FAILED ${j.out}: ${(e as Error).message}`);
        throw e;
      }
    }),
  );
  console.log("\n[onboarding] summary:");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`  ✓ ${jobs[i].out}`);
    else console.log(`  ✗ ${jobs[i].out} — ${(r.reason as Error).message}`);
  });
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) process.exit(1);
}

main();
