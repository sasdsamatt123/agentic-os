#!/usr/bin/env bun
/**
 * Generate an image via kie.ai (default model: nano-banana-2) and download it.
 *
 * Usage:
 *   KIE_API_KEY=... bun run scripts/gen-image.ts <prompt> <aspect> <out-path> [model]
 *     aspect = 16:9 | 3:2 | 1:1 | 4:3 | 9:16 | etc.
 *     model  = nano-banana-2 (default) | nano-banana-pro | gpt-image-2 | flux-max
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

function getKey(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("KIE_API_KEY not set in env. Add to .env.local and source it.");
  return k;
}

export type Aspect =
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16"
  | "21:9"
  | "4:5"
  | "5:4"
  | "auto";

export interface GenOpts {
  prompt: string;
  aspect: Aspect;
  outPath: string;
  model?: string;
  resolution?: "1K" | "2K" | "4K";
  format?: "png" | "jpg";
}

export async function generate(opts: GenOpts): Promise<string> {
  const {
    prompt,
    aspect,
    outPath,
    model = "nano-banana-2",
    resolution = "2K",
    format = "png",
  } = opts;

  const submit = await fetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: {
        prompt,
        aspect_ratio: aspect,
        resolution,
        output_format: format,
      },
    }),
  });
  if (!submit.ok) {
    throw new Error(`kie.ai createTask failed: ${submit.status} ${await submit.text()}`);
  }
  const j: any = await submit.json();
  const taskId = j.data?.taskId || j.taskId;
  if (!taskId) throw new Error(`No taskId in response: ${JSON.stringify(j)}`);
  console.log(
    `[gen] taskId=${taskId} model=${model} aspect=${aspect} prompt="${prompt.slice(0, 60)}..."`,
  );

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const r = await fetch(`${KIE_BASE}/recordInfo?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${getKey()}` },
    });
    if (!r.ok) {
      console.warn(`[gen] poll ${i}: HTTP ${r.status}`);
      continue;
    }
    const pj: any = await r.json();
    const d = pj.data;
    if (!d) continue;
    const state = (d.state || d.status || "").toString().toUpperCase();
    if (state === "SUCCESS" || state === "COMPLETED" || state === "DONE") {
      let url: string | undefined;
      try {
        const result = typeof d.resultJson === "string" ? JSON.parse(d.resultJson) : d.resultJson;
        url =
          result?.resultUrls?.[0] ||
          result?.urls?.[0] ||
          result?.[0] ||
          d.resultUrls?.[0] ||
          d.response?.resultUrls?.[0] ||
          d.output?.[0] ||
          d.output?.image_url;
      } catch {}
      if (!url) throw new Error(`Success but no result URL: ${JSON.stringify(d).slice(0, 600)}`);
      // Whitelist the host the polling response points at — the upstream
      // service decides this URL, but we should still refuse to fetch from
      // arbitrary hosts in case the API ever returns user-supplied or
      // adversarial values. Allowed: kie.ai infra + common CDNs.
      const ALLOWED_HOSTS = [
        "kie.ai",
        "tempfile.aiquickdraw.com",
        "tempfile.redpandaai.co",
        "amazonaws.com",
        "cloudfront.net",
        "googleusercontent.com",
        "googleapis.com",
      ];
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Result URL is not a valid URL: ${url.slice(0, 200)}`);
      }
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Refusing non-http(s) result URL: ${parsed.protocol}`);
      }
      const hostOk = ALLOWED_HOSTS.some(
        (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
      );
      if (!hostOk) {
        throw new Error(`Refusing fetch from non-allowlisted host: ${parsed.hostname}`);
      }
      console.log(`[gen] success → ${url}`);
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, buf);
      console.log(`[gen] saved → ${outPath}`);
      return outPath;
    }
    if (state === "FAILED" || state === "FAIL" || state === "ERROR") {
      const code = d.errorCode || d.code;
      const msg = d.errorMessage || d.msg || d.error;
      throw new Error(`Generation failed: ${code} ${msg}`);
    }
    if (i % 4 === 0) console.log(`[gen] ${i * 4}s · ${state || "PENDING"}`);
  }
  throw new Error("Polling timed out after ~6 minutes");
}

if (import.meta.main) {
  const [prompt, aspect = "3:2", out = "out.png", model] = Bun.argv.slice(2);
  if (!prompt) {
    console.error('Usage: bun run scripts/gen-image.ts "<prompt>" [aspect] [out-path] [model]');
    process.exit(1);
  }
  generate({ prompt, aspect: aspect as Aspect, outPath: out, model })
    .then((p) => console.log(p))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
