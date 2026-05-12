#!/usr/bin/env bun
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const envPath = join(root, "..", ".env.local");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const KEY = process.env.KIE_API_KEY!;
const POLL = "https://api.kie.ai/api/v1/jobs/recordInfo";

const tasks = [
  { taskId: "4c4bff4f9dbc90c5609a4e755f81a45e", out: "src/assets/skills/deep-research.png" },
  { taskId: "ca02ff9509e52aefee4480428552584b", out: "src/assets/skills/title-generator.png" },
  { taskId: "080adc90835ce4be5cacc44776802036", out: "src/assets/skills/signal-report.png" },
  { taskId: "42e48ca5036036335415e3c094d1dd38", out: "src/assets/skills/comment-miner.png" },
  { taskId: "eb37ab95fa4249fb0fbaa1b2066923cd", out: "src/assets/logos/codex.png" },
  { taskId: "7e6eebf8fe54a69588f8a46dd2f49e08", out: "src/assets/logos/openai-gpt5.png" },
];

async function pollOne(taskId: string, out: string): Promise<string> {
  const outAbs = join(root, out);
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${POLL}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) {
      console.warn(`[poll ${taskId.slice(0, 8)}] HTTP ${r.status}`);
      await new Promise((res) => setTimeout(res, 4000));
      continue;
    }
    const j: any = await r.json();
    const d = j.data;
    if (!d) {
      await new Promise((res) => setTimeout(res, 4000));
      continue;
    }
    const state = (d.state || "").toLowerCase();
    if (state === "success") {
      let url: string | undefined;
      try {
        const result = typeof d.resultJson === "string" ? JSON.parse(d.resultJson) : d.resultJson;
        url = result?.resultUrls?.[0] || result?.urls?.[0] || result?.[0];
      } catch {}
      if (!url) throw new Error(`No result URL in: ${JSON.stringify(d).slice(0, 400)}`);
      console.log(`[poll ${taskId.slice(0, 8)}] success → ${url}`);
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      mkdirSync(dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, buf);
      console.log(`[poll ${taskId.slice(0, 8)}] saved → ${outAbs}`);
      return outAbs;
    }
    if (state === "failed" || state === "fail" || state === "error") {
      throw new Error(`failed: ${d.failCode} ${d.failMsg}`);
    }
    if (i % 4 === 0) console.log(`[poll ${taskId.slice(0, 8)}] ${i * 4}s · ${state}`);
    await new Promise((res) => setTimeout(res, 4000));
  }
  throw new Error("timeout");
}

const results = await Promise.allSettled(tasks.map((t) => pollOne(t.taskId, t.out)));
console.log("\nSummary:");
results.forEach((r, i) => {
  if (r.status === "fulfilled") console.log(`  ✅ ${tasks[i].out}`);
  else console.log(`  ❌ ${tasks[i].out} — ${(r.reason as Error).message}`);
});
