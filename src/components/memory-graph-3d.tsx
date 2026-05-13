import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Sparkles, Zap } from "lucide-react";
import { workspaces, skills, runs, memorySignals, memorySources } from "@/lib/mock-data";
import { useLiveData } from "@/lib/use-live-data";
import { MemoryGraphLoader } from "@/components/memory-graph-loader";

type ForceGraphModule = typeof import("react-force-graph-3d").default;
type ThreeModule = typeof import("three");
type UnrealBloomPassCtor =
  typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass;

export interface MemNode {
  id: string;
  name: string;
  kind: "hub" | "workspace" | "file" | "decision" | "session" | "skill" | "vector_store";
  workspaceId?: string;
  size?: string;
  updated?: string;
  status?: "healthy" | "stale" | "missing";
  freshness?: number;
  meta?: string;
  source?: string;
  preview?: string;
  vectorCount?: number;
  namespaces?: number | Array<{ name: string; vectorCount: number }>;
  dimension?: number;
  val: number;
  color: string;
}

interface MemLink {
  source: string;
  target: string;
  kind: "core" | "file" | "decision" | "session" | "skill" | "cross";
}

const ACCENT = "#3ddc97";
const ACCENT2 = "#7be0c8";
const STALE = "#f5b14c";
const MISSING = "#ef5a5a";
const FILE_COL = "#8a93a3";
const WS_COL = "#e6ebf2";
const DEC_COL = "#4A9EFF";
const SES_COL = "#60a5fa";
const SKILL_COL = "#f472b6";

function buildData(liveData?: any) {
  // Prefer real data from the aggregator if it produced a memory graph.
  const liveMemory = liveData?.memory;
  if (liveMemory?.nodes?.length && liveMemory?.links?.length) {
    return {
      nodes: liveMemory.nodes as MemNode[],
      links: liveMemory.links as MemLink[],
    };
  }

  const nodes: MemNode[] = [];
  const links: MemLink[] = [];

  nodes.push({
    id: "hub",
    name: "Memory Core",
    kind: "hub",
    val: 60,
    color: ACCENT,
    source: "all",
  });

  // Decision satellites around hub
  const decisions = [
    "use-claude-md-everywhere",
    "skills-as-units",
    "outputs-immutable",
    "memory-wrap-nightly",
  ];
  decisions.forEach((d) => {
    nodes.push({
      id: `dec-${d}`,
      name: d,
      kind: "decision",
      val: 8,
      color: DEC_COL,
      meta: "decision",
      source: "obsidian",
    });
    links.push({ source: "hub", target: `dec-${d}`, kind: "decision" });
  });

  workspaces.forEach((w, wi) => {
    const status: MemNode["status"] =
      w.claudeMdStatus === "missing" ? "missing" : w.memoryFreshness < 60 ? "stale" : "healthy";
    const wsColor = status === "missing" ? MISSING : status === "stale" ? STALE : WS_COL;
    // Half of workspaces are "Obsidian" buckets, half "Claude" buckets — visual diversity
    const wsSource = wi % 2 === 0 ? "obsidian" : "claude";

    nodes.push({
      id: `ws-${w.id}`,
      name: w.name,
      kind: "workspace",
      workspaceId: w.id,
      status,
      freshness: w.memoryFreshness,
      val: 22,
      color: wsColor,
      source: wsSource,
      updated: w.lastRun,
    });
    links.push({ source: "hub", target: `ws-${w.id}`, kind: "core" });

    w.memoryFiles.slice(0, 5).forEach((f, j) => {
      const id = `f-${w.id}-${j}`;
      nodes.push({
        id,
        name: f.name,
        kind: "file",
        workspaceId: w.id,
        size: f.size,
        updated: f.updated,
        val: 5,
        color: FILE_COL,
        source: wsSource,
        preview: f.name.endsWith(".md") ? "Agency means happen-to-life energy…" : undefined,
      });
      links.push({ source: `ws-${w.id}`, target: id, kind: "file" });
    });
  });

  // Pinecone vector_store nodes — large, brightly coloured, link to hub
  memorySources
    .filter((s) => s.kind === "vector")
    .forEach((s) => {
      nodes.push({
        id: `vs-${s.id}`,
        name: s.label,
        kind: "vector_store",
        val: 28,
        color: s.color,
        source: s.id,
        vectorCount: s.vectorCount,
        namespaces: s.namespaces,
        dimension: s.dimension,
      });
      links.push({ source: "hub", target: `vs-${s.id}`, kind: "core" });
    });

  // Sessions cluster — recent runs as nodes linking workspace + skill
  runs.slice(0, 10).forEach((r, i) => {
    const sid = `ses-${i}`;
    nodes.push({
      id: sid,
      name: r.id,
      kind: "session",
      workspaceId: workspaces.find((w) => w.name === r.workspace)?.id,
      meta: `${r.skill} · ${r.duration}`,
      val: 6,
      color: SES_COL,
    });
    const ws = workspaces.find((w) => w.name === r.workspace);
    if (ws) links.push({ source: `ws-${ws.id}`, target: sid, kind: "session" });
  });

  // Top skills as orbiters cross-linking workspaces they touch
  const topSkills = [...skills].sort((a, b) => b.uses - a.uses).slice(0, 6);
  topSkills.forEach((s) => {
    const sid = `sk-${s.name.replace(/\s+/g, "-").toLowerCase()}`;
    nodes.push({
      id: sid,
      name: s.name,
      kind: "skill",
      val: 9,
      color: SKILL_COL,
      meta: `${s.uses} uses`,
    });
    if (s.scope === "global") {
      // link to 2-3 workspaces
      workspaces
        .slice(0, 3)
        .forEach((w) => links.push({ source: sid, target: `ws-${w.id}`, kind: "skill" }));
    } else if (s.workspace) {
      links.push({ source: sid, target: `ws-${s.workspace}`, kind: "skill" });
    }
  });

  // Dense cross-workspace memory links — every workspace connects to ~3 others
  for (let i = 0; i < workspaces.length; i++) {
    for (let k = 1; k <= 3; k++) {
      const j = (i + k) % workspaces.length;
      if (i !== j) {
        links.push({
          source: `ws-${workspaces[i].id}`,
          target: `ws-${workspaces[j].id}`,
          kind: "cross",
        });
      }
    }
  }

  // Decisions cross-link to workspaces (knowledge influence)
  decisions.forEach((d, di) => {
    workspaces.forEach((w, wi) => {
      if ((wi + di) % 3 === 0) {
        links.push({ source: `dec-${d}`, target: `ws-${w.id}`, kind: "decision" });
      }
    });
  });

  // Sessions also reference decisions
  runs.slice(0, 10).forEach((_, i) => {
    const sid = `ses-${i}`;
    const d = decisions[i % decisions.length];
    links.push({ source: sid, target: `dec-${d}`, kind: "session" });
  });

  // Skills cross-pollinate — every skill links to 2 workspaces minimum
  topSkills.forEach((s, si) => {
    const sid = `sk-${s.name.replace(/\s+/g, "-").toLowerCase()}`;
    workspaces.forEach((w, wi) => {
      if ((wi + si) % 4 === 0) links.push({ source: sid, target: `ws-${w.id}`, kind: "skill" });
    });
  });

  // Skill-to-skill resonance
  for (let i = 0; i < topSkills.length - 1; i++) {
    const a = `sk-${topSkills[i].name.replace(/\s+/g, "-").toLowerCase()}`;
    const b = `sk-${topSkills[i + 1].name.replace(/\s+/g, "-").toLowerCase()}`;
    links.push({ source: a, target: b, kind: "skill" });
  }

  // File-to-file shared knowledge across workspaces (pick a few)
  const fileNodes = nodes.filter((n) => n.kind === "file");
  for (let i = 0; i < fileNodes.length; i += 4) {
    const a = fileNodes[i];
    const b = fileNodes[(i + 7) % fileNodes.length];
    if (a && b && a.workspaceId !== b.workspaceId) {
      links.push({ source: a.id, target: b.id, kind: "cross" });
    }
  }

  return { nodes, links };
}

// Spheres view: same semantic graph + extra "memory mote" sphere nodes that
// inherit real file names from live data so tooltips are still meaningful.
function buildSpheresData(extra = 140) {
  const base = buildData();
  const nodes: MemNode[] = [...base.nodes];
  const links: MemLink[] = [...base.links];
  const palette = [ACCENT, ACCENT2, WS_COL, FILE_COL, DEC_COL, SES_COL, SKILL_COL];
  const realFiles = base.nodes.filter(
    (n) => n.kind === "file" && n.name && !n.id.startsWith("mote-"),
  );
  const wsIds = base.nodes.filter((n) => n.kind === "workspace").map((n) => n.id);
  const anchorPool = wsIds.length ? wsIds : workspaces.map((w) => `ws-${w.id}`);
  for (let i = 0; i < extra; i++) {
    const id = `mote-${i}`;
    const color = palette[i % palette.length];
    const inherit = realFiles[i % Math.max(1, realFiles.length)];
    nodes.push({
      id,
      name: inherit?.name ?? "Memory thread",
      kind: "file",
      workspaceId: inherit?.workspaceId,
      source: inherit?.source,
      meta: inherit ? "ambient connection" : "ambient memory thread",
      val: 1.5 + Math.random() * 2,
      color,
    });
    const anchor = i % 9 === 0 ? "hub" : anchorPool[i % anchorPool.length];
    links.push({ source: anchor, target: id, kind: "file" });
    if (i % 17 === 0 && i > 0) {
      links.push({ source: `mote-${i - 1}`, target: id, kind: "cross" });
    }
  }
  return { nodes, links };
}

// Blend view: full structured graph + a sprinkle of motes (between Default and Spheres)
function buildBlendData() {
  return buildSpheresData(70);
}

// Random view: pure scatter, no semantic structure. Names borrowed from real
// memory if available so tooltips still make sense.
function buildRandomData() {
  const nodes: MemNode[] = [];
  const links: MemLink[] = [];
  const palette = [ACCENT, ACCENT2, WS_COL, FILE_COL, DEC_COL, SES_COL, SKILL_COL, STALE, MISSING];
  const realFiles = buildData().nodes.filter((n) => n.kind === "file" && n.name);
  const N = 380;
  for (let i = 0; i < N; i++) {
    const inherit = realFiles[i % Math.max(1, realFiles.length)];
    nodes.push({
      id: `r-${i}`,
      name: inherit?.name ?? "Memory thread",
      kind: "file",
      meta: "ambient memory thread",
      val: 1 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
  for (let i = 0; i < N * 1.2; i++) {
    const a = Math.floor(Math.random() * N);
    let b = Math.floor(Math.random() * N);
    if (b === a) b = (b + 1) % N;
    links.push({ source: `r-${a}`, target: `r-${b}`, kind: "cross" });
  }
  return { nodes, links };
}

type ViewMode = "structured" | "blend" | "spheres" | "random";

// Pre-flight WebGL check — three.js' WebGLRenderer throws if the browser
// refuses a context (battery saver, GPU recovery, headless modes). We gate
// the dynamic 3D import on this so a refused context never reaches the root
// error boundary as "Error creating WebGL context".
function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function Memory3DFallback({
  embedded,
  stats,
  sourceCount,
}: {
  embedded: boolean;
  stats: any;
  sourceCount: number;
}) {
  return (
    <div
      className={`relative w-full ${embedded ? "h-full min-h-[420px]" : "min-h-[560px] h-full"} grid place-items-center px-6`}
    >
      <div className="text-center max-w-[420px]">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-2">
          Memory at a glance
        </div>
        <div
          className="font-mono text-[56px] font-semibold tabular-nums tracking-tight leading-none mb-1.5"
          style={{ color: "oklch(0.78 0.10 70)" }}
        >
          {(stats.totalFiles ?? 0).toLocaleString()}
        </div>
        <div className="text-[13px] text-muted-foreground mb-4">
          files across {sourceCount} sources
          {typeof stats.stale === "number" && stats.stale > 0 && (
            <>
              {" · "}
              <span className="text-foreground/75">{stats.stale} stale</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground/65 max-w-[360px] mx-auto leading-relaxed">
          The 3D graph couldn't initialise WebGL on this device.
          {!embedded && " The page still works — the visualisation is the only part affected."}
        </div>
      </div>
    </div>
  );
}

export function MemoryGraph3D({
  onSelect,
  embedded = false,
  sourceFilter = "all",
}: {
  onSelect: (node: MemNode) => void;
  embedded?: boolean;
  sourceFilter?: string;
}) {
  const [view, setView] = useState<ViewMode>("structured");

  const graphLd = useLiveData();

  const fullData = useMemo(() => {
    if (view === "spheres") return buildSpheresData();
    if (view === "blend") return buildBlendData();
    if (view === "random") return buildRandomData();
    return buildData(graphLd);
  }, [view, graphLd]);
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 640 });
  const [Graph, setGraph] = useState<ForceGraphModule | null>(null);
  const [THREE, setThree] = useState<ThreeModule | null>(null);
  const [BloomPass, setBloomPass] = useState<UnrealBloomPassCtor | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  hoverIdRef.current = hoverId;

  // Controls
  const [rotating, setRotating] = useState(true);
  const [particles, setParticles] = useState(true);
  const [linkOpacity, setLinkOpacity] = useState(0.7);
  const [density, setDensity] = useState<"lite" | "full">("full");

  const rotatingRef = useRef(rotating);
  rotatingRef.current = rotating;

  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => {
    setWebglOk(hasWebGL());
  }, []);

  useEffect(() => {
    if (webglOk !== true) return;
    let alive = true;
    Promise.all([
      import("react-force-graph-3d"),
      import("three"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    ])
      .then(([graphMod, threeMod, bloomMod]) => {
        if (!alive) return;
        setGraph(() => graphMod.default);
        setThree(threeMod);
        setBloomPass(() => bloomMod.UnrealBloomPass);
      })
      .catch((err) => {
        console.warn("[memory-graph-3d] dynamic import failed", err);
      });
    return () => {
      alive = false;
    };
  }, [webglOk]);

  // Filter links by density + by selected source category. Supports:
  //   "all"                        — no filter
  //   "obsidian" | "claude" | "pinecone"   — single category
  //   "multi:obsidian,pinecone"    — union of categories
  //   "" (empty)                   — show only the hub (zero categories selected)
  const data = useMemo(() => {
    let nodes = fullData.nodes;
    let links = fullData.links;
    if (sourceFilter && sourceFilter !== "all") {
      const allowedCats = sourceFilter.startsWith("multi:")
        ? new Set(sourceFilter.slice(6).split(",").filter(Boolean))
        : new Set([sourceFilter]);
      const matches = (n: MemNode): boolean => {
        if (allowedCats.has("pinecone") && (n.kind === "vector_store" || n.source === "pinecone"))
          return true;
        if (allowedCats.has("obsidian") && n.source === "obsidian") return true;
        if (allowedCats.has("claude") && n.source === "claude") return true;
        return false;
      };
      const allow = new Set<string>(["hub"]);
      nodes.forEach((n) => {
        if (n.id === "hub") return;
        if (matches(n)) allow.add(n.id);
      });
      nodes = nodes.filter((n) => allow.has(n.id));
      links = links.filter((l) => {
        const s = typeof l.source === "object" ? (l.source as any).id : l.source;
        const t = typeof l.target === "object" ? (l.target as any).id : l.target;
        return allow.has(s) && allow.has(t);
      });
    }
    if (density === "full") return { nodes, links };
    const keep = new Set(["core", "file", "decision"]);
    return { nodes, links: links.filter((l) => keep.has(l.kind)) };
  }, [fullData, density, sourceFilter]);

  // Build adjacency for hover highlighting
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    data.links.forEach((l) => {
      const s = typeof l.source === "object" ? (l.source as any).id : l.source;
      const t = typeof l.target === "object" ? (l.target as any).id : l.target;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(t)) m.set(t, new Set());
      m.get(s)!.add(t);
      m.get(t)!.add(s);
    });
    return m;
  }, [data]);

  const isLit = (id: string) => {
    if (!hoverId) return true;
    if (id === hoverId) return true;
    return adjacency.get(hoverId)?.has(id) ?? false;
  };

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Configure forces, lighting, and gentle camera orbit
  useEffect(() => {
    if (!fgRef.current || !THREE) return;
    const fg = fgRef.current;

    // Disable wheel-zoom in embedded mode so page scrolling isn't trapped
    if (embedded) {
      try {
        const controls = fg.controls?.();
        if (controls) {
          controls.enableZoom = false;
          controls.enablePan = false;
        }
      } catch {}
    }

    // Custom forces — keep hub centered, push files outward
    try {
      const charge = fg.d3Force("charge");
      if (charge) charge.strength(-90);
      const linkF = fg.d3Force("link");
      if (linkF)
        linkF.distance((l: any) => {
          if (l.kind === "core") return 90;
          if (l.kind === "file") return 28;
          if (l.kind === "session") return 40;
          if (l.kind === "skill") return 110;
          if (l.kind === "decision") return 60;
          if (l.kind === "cross") return 140;
          return 60;
        });
    } catch {}

    // Add lights + starfield for depth
    const scene = fg.scene();
    if (!scene.userData.__memEnhanced) {
      scene.userData.__memEnhanced = true;
      scene.fog = new THREE.FogExp2(0x000000, 0.0022);

      const amb = new THREE.AmbientLight(0xffffff, 0.35);
      scene.add(amb);
      const key = new THREE.PointLight(0x3ddc97, 1.4, 1200);
      key.position.set(120, 180, 200);
      scene.add(key);
      const rim = new THREE.PointLight(0x60a5fa, 0.9, 1000);
      rim.position.set(-220, -120, -160);
      scene.add(rim);

      // Starfield
      const starGeom = new THREE.BufferGeometry();
      const N = 1200;
      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 700 + Math.random() * 600;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      starGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xa9b4c2,
        size: 1.2,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const stars = new THREE.Points(starGeom, starMat);
      stars.userData.__stars = true;
      scene.add(stars);
    }

    // Real bloom glow via post-processing
    if (BloomPass && !scene.userData.__bloom && typeof fg.postProcessingComposer === "function") {
      try {
        const composer = fg.postProcessingComposer();
        const bloom = new BloomPass(
          new THREE.Vector2(size.w, size.h),
          0.7, // strength — softer
          0.6, // radius
          0.35, // threshold — only the brightest (hub) blooms hard
        );
        composer.addPass(bloom);
        scene.userData.__bloom = bloom;
      } catch {}
    }

    // Slow auto-orbit + animations
    let raf = 0;
    let angle = 0;
    const tick = () => {
      if (rotatingRef.current) {
        angle += 0.0011;
        const distance = 420;
        fg.cameraPosition({
          x: distance * Math.sin(angle),
          y: 80 + Math.sin(angle * 0.7) * 30,
          z: distance * Math.cos(angle),
        });
      }

      // Pulse hub & rotate stars
      const t = performance.now() * 0.001;
      scene.children.forEach((obj: any) => {
        if (obj.userData.__stars) obj.rotation.y = t * 0.01;
        if (obj.userData.__pulse) {
          const s = 1 + Math.sin(t * 2) * 0.06;
          obj.scale.set(s, s, s);
        }
        if (obj.userData.__ring) {
          obj.rotation.z = t * 0.4;
        }
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [BloomPass, THREE, size.h, size.w]);

  // No WebGL — render a clean fallback instead of letting the renderer throw.
  if (webglOk === false) {
    const stats = (graphLd as any)?.memory?.stats ?? {};
    const sourceCount = ((graphLd as any)?.memory?.sources ?? []).length;
    return <Memory3DFallback embedded={embedded} stats={stats} sourceCount={sourceCount} />;
  }

  return (
    <>
      <div
        ref={wrapRef}
        className="w-full h-full min-h-[460px] relative pr-7"
        style={{ height: "100%" }}
        onWheelCapture={(e) => {
          // Don't let the canvas trap page scroll — only zoom on Ctrl/Meta
          if (!e.ctrlKey && !e.metaKey) e.stopPropagation();
        }}
      >
        {/* right-edge scroll gutter — lets the page scroll past the canvas */}
        <div aria-hidden className="absolute top-0 right-0 h-full w-7 z-20 pointer-events-none">
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 h-12 w-0.5 rounded-full bg-foreground/15" />
        </div>
        {Graph && THREE ? (
          <Graph
            ref={fgRef}
            width={size.w}
            height={size.h}
            graphData={data as any}
            backgroundColor="rgba(0,0,0,0)"
            showNavInfo={false}
            warmupTicks={80}
            cooldownTicks={200}
            nodeRelSize={6}
            nodeLabel={(n: any) => {
              const escape = (s: string) =>
                String(s).replace(
                  /[&<>"']/g,
                  (c) =>
                    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
                );
              let cap = "MEMORY";
              let title = n.name;
              let line2 = "";
              let line3 = "";
              if (n.kind === "hub") {
                cap = "MEMORY CORE";
                line2 = "Shared index across every layer";
              } else if (n.kind === "workspace") {
                cap = "WORKSPACE";
                const files = data.nodes.filter(
                  (x: any) => x.kind === "file" && x.workspaceId === n.workspaceId,
                );
                const recent = files[0]?.updated ?? n.updated ?? "—";
                line2 = `${files.length} note${files.length === 1 ? "" : "s"} · last edited ${recent}`;
                if (n.path) line3 = n.path;
                else if (n.noIndex) line3 = "Suggested: add a MEMORY.md";
                else if (n.status === "missing") line3 = "No files on disk";
              } else if (n.kind === "file") {
                cap = "NOTE";
                line2 = `${n.size ?? "—"} · last edited ${n.updated ?? "—"}`;
                if (n.path) line3 = n.path;
                else if (n.preview) line3 = `“${n.preview}”`;
              } else if (n.kind === "vector_store") {
                cap = "PINECONE INDEX";
                const v = n.vectorCount ? n.vectorCount.toLocaleString() : "—";
                const nsCount = Array.isArray(n.namespaces) ? n.namespaces.length : (n.namespaces ?? "—");
                line2 = `${v} vectors · ${nsCount} namespaces`;
                line3 = `Pinecone · ${n.dimension ?? 1024}-dim cosine`;
              } else {
                cap = n.kind.toUpperCase();
                line2 = n.meta ?? "";
              }
              return `<div style="font:500 11px ui-sans-serif,system-ui;padding:9px 11px;background:rgba(11,14,19,0.94);border:1px solid #2a2f3a;border-radius:10px;color:#fff;box-shadow:0 10px 28px rgba(0,0,0,.5);max-width:280px">
            <div style="font-size:9px;letter-spacing:.18em;color:#8a93a3;margin-bottom:3px">${cap}</div>
            <div style="font-weight:600">${escape(title)}</div>
            ${line2 ? `<div style="color:#9aa3b0;margin-top:3px;font-size:10px">${escape(line2)}</div>` : ""}
            ${line3 ? `<div style="color:#c7cdd6;margin-top:3px;font-size:10px;font-style:italic">${escape(line3)}</div>` : ""}
          </div>`;
            }}
            nodeThreeObject={(n: any) => {
              const group = new THREE.Group();
              const lit = isLit(n.id);
              const opacity = lit ? 1 : 0.18;

              let r = 6;
              if (view === "random") {
                r = 2 + (n.val ?? 2) * 0.6;
              } else if (n.kind === "hub") r = 26;
              else if (n.kind === "vector_store") r = 17;
              else if (n.kind === "workspace") r = 14;
              else if (n.kind === "skill") r = 10;
              else if (n.kind === "session") r = 7;
              else if (n.kind === "decision") r = 9;
              else r = view === "spheres" ? 2 + (n.val ?? 2) * 0.7 : 5;

              const isMissing = n.status === "missing";
              const isStale = n.status === "stale";
              const baseEmissive =
                n.kind === "hub"
                  ? 2.4
                  : n.kind === "vector_store"
                    ? 2.1
                    : isMissing
                      ? 2.2
                      : isStale
                        ? 1.2
                        : n.kind === "workspace"
                          ? 0.7
                          : 0.5;
              const mat = new THREE.MeshStandardMaterial({
                color: n.color,
                emissive: n.color,
                emissiveIntensity: baseEmissive,
                roughness: 0.35,
                metalness: 0.1,
                transparent: true,
                opacity,
              });

              let geom: any;
              if (view === "spheres" || view === "random")
                geom = new THREE.SphereGeometry(r, 20, 20);
              else if (n.kind === "decision") geom = new THREE.OctahedronGeometry(r, 0);
              else if (n.kind === "skill") geom = new THREE.IcosahedronGeometry(r, 0);
              else if (n.kind === "session") geom = new THREE.TetrahedronGeometry(r, 0);
              else geom = new THREE.SphereGeometry(r, 28, 28);

              const mesh = new THREE.Mesh(geom, mat);
              group.add(mesh);

              // Soft outer halo for vector store nodes
              if (n.kind === "vector_store") {
                const haloMat = new THREE.MeshBasicMaterial({
                  color: n.color,
                  transparent: true,
                  opacity: 0.18 * opacity,
                  side: THREE.BackSide,
                });
                const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.55, 24, 24), haloMat);
                group.add(halo);
              }

              if (n.kind === "hub" || n.kind === "vector_store") {
                group.userData.__pulse = true;
              }

              return group;
            }}
            linkColor={(l: any) => {
              const sId = typeof l.source === "object" ? l.source.id : l.source;
              const tId = typeof l.target === "object" ? l.target.id : l.target;
              const active =
                hoverIdRef.current && (sId === hoverIdRef.current || tId === hoverIdRef.current);
              if (active) return ACCENT;
              if (l.kind === "skill") return "rgba(244,114,182,0.35)";
              if (l.kind === "cross") return "rgba(123,224,200,0.35)";
              if (l.kind === "decision") return "rgba(167,139,250,0.35)";
              if (l.kind === "session") return "rgba(96,165,250,0.3)";
              if (l.kind === "core") return "rgba(61,220,151,0.5)";
              return "rgba(180,190,210,0.18)";
            }}
            linkWidth={(l: any) => {
              const sId = typeof l.source === "object" ? l.source.id : l.source;
              const tId = typeof l.target === "object" ? l.target.id : l.target;
              if (hoverIdRef.current && (sId === hoverIdRef.current || tId === hoverIdRef.current))
                return 1.6;
              return l.kind === "core" ? 0.8 : 0.4;
            }}
            linkOpacity={linkOpacity}
            linkDirectionalParticles={(l: any) => {
              if (!particles) return 0;
              if (l.kind === "core") return 3;
              if (l.kind === "session") return 2;
              if (l.kind === "skill") return 2;
              if (l.kind === "cross") return 2;
              return 0;
            }}
            linkDirectionalParticleSpeed={(l: any) => (l.kind === "session" ? 0.006 : 0.0035)}
            linkDirectionalParticleColor={(l: any) =>
              l.kind === "skill"
                ? "#f472b6"
                : l.kind === "session"
                  ? "#60a5fa"
                  : l.kind === "cross"
                    ? ACCENT2
                    : ACCENT
            }
            linkDirectionalParticleWidth={1.4}
            linkCurvature={(l: any) => (l.kind === "cross" ? 0.4 : l.kind === "skill" ? 0.25 : 0)}
            onNodeHover={(n: any) => setHoverId(n?.id ?? null)}
            onNodeClick={(n: any) => onSelect(n)}
            enableNodeDrag={false}
          />
        ) : (
          <MemoryGraphLoader height={680} />
        )}

        {/* Legend overlay */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg border border-border/70 bg-background/70 backdrop-blur px-3 py-2 text-[10px] text-muted-foreground">
          <LegendDot c={ACCENT} label="Memory Core" />
          <LegendDot c={WS_COL} label="Workspace" />
          <LegendDot c={FILE_COL} label="File" shape="sphere" />
          <LegendDot c={DEC_COL} label="Decision" shape="diamond" />
          <LegendDot c={SES_COL} label="Session" shape="tri" />
          <LegendDot c={SKILL_COL} label="Skill" shape="hex" />
        </div>
      </div>

      {/* Controls — sit BELOW the canvas */}
      {!embedded && (
        <div className="mt-3 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-3 text-[11px] text-muted-foreground">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-5">
            {/* Layout selector with thumbnails */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  Layout
                </span>
                <span className="text-[9px] text-muted-foreground/60 capitalize">{view}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { key: "structured", label: "Macro", hint: "Semantic structure" },
                    { key: "blend", label: "Mid", hint: "Structure + density" },
                    { key: "spheres", label: "Micro", hint: "Every memory mote" },
                    { key: "random", label: "Full", hint: "Pure graph view" },
                  ] as { key: ViewMode; label: string; hint: string }[]
                ).map((v) => {
                  const active = view === v.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      title={v.hint}
                      className={`group relative rounded-lg border p-1.5 transition-all ${
                        active
                          ? "border-foreground/50 bg-foreground/[0.06]"
                          : "border-border/60 hover:border-foreground/30 hover:bg-foreground/[0.03]"
                      }`}
                    >
                      <ViewThumb kind={v.key} active={active} />
                      <div
                        className={`mt-1 text-[9px] uppercase tracking-wider text-center ${active ? "text-foreground" : ""}`}
                      >
                        {v.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:block w-px self-stretch bg-border/60" />

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setRotating((r) => !r)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 hover:bg-foreground/5 transition-colors"
                title={rotating ? "Pause rotation" : "Resume rotation"}
              >
                {rotating ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                <span className="text-[10px]">{rotating ? "Pause" : "Play"}</span>
              </button>
              <button
                onClick={() => setParticles((p) => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                  particles
                    ? "border-foreground/40 text-foreground bg-foreground/5"
                    : "border-border/60 hover:bg-foreground/5"
                }`}
                title="Toggle flow particles"
              >
                <Sparkles className="h-3 w-3" />
                <span className="text-[10px]">Flow</span>
              </button>
              <div className="flex rounded-md border border-border/60 overflow-hidden">
                <button
                  onClick={() => setDensity("lite")}
                  className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider transition-colors ${
                    density === "lite" ? "text-foreground bg-foreground/5" : "hover:bg-foreground/5"
                  }`}
                >
                  Lite
                </button>
                <button
                  onClick={() => setDensity("full")}
                  className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider transition-colors flex items-center gap-1 border-l border-border/60 ${
                    density === "full" ? "text-foreground bg-foreground/5" : "hover:bg-foreground/5"
                  }`}
                >
                  <Zap className="h-2.5 w-2.5" />
                  Full
                </button>
              </div>
            </div>

            {/* Stats + slider */}
            <div className="flex items-center gap-4 lg:ml-auto">
              <div className="flex items-center gap-2 min-w-[140px]">
                <span className="text-[9px] uppercase tracking-wider opacity-70">Links</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={linkOpacity}
                  onChange={(e) => setLinkOpacity(parseFloat(e.target.value))}
                  className="flex-1 accent-foreground/60 h-px opacity-60 hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="hidden md:flex gap-3 text-[10px] tabular-nums">
                <span>
                  <span className="text-muted-foreground/70">Nodes</span>{" "}
                  <span className="text-foreground">{data.nodes.length}</span>
                </span>
                <span>
                  <span className="text-muted-foreground/70">Edges</span>{" "}
                  <span className="text-foreground">{data.links.length}</span>
                </span>
                <span>
                  <span className="text-muted-foreground/70">Recall 7d</span>{" "}
                  <span className="text-foreground">{memorySignals.recalledThisWeek}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ViewThumb({ kind, active }: { kind: ViewMode; active: boolean }) {
  const accent = active ? ACCENT : "rgba(180,190,210,0.55)";
  const glow = active ? `drop-shadow(0 0 4px ${ACCENT})` : "none";
  if (kind === "structured") {
    return (
      <svg viewBox="0 0 40 28" className="w-full h-7" style={{ filter: glow }}>
        <line x1="20" y1="14" x2="6" y2="6" stroke={accent} strokeWidth="0.5" opacity="0.6" />
        <line x1="20" y1="14" x2="34" y2="6" stroke={accent} strokeWidth="0.5" opacity="0.6" />
        <line x1="20" y1="14" x2="6" y2="22" stroke={accent} strokeWidth="0.5" opacity="0.6" />
        <line x1="20" y1="14" x2="34" y2="22" stroke={accent} strokeWidth="0.5" opacity="0.6" />
        <circle cx="20" cy="14" r="3.5" fill={accent} />
        <circle cx="6" cy="6" r="1.6" fill={accent} opacity="0.9" />
        <circle cx="34" cy="6" r="1.6" fill={accent} opacity="0.9" />
        <circle cx="6" cy="22" r="1.6" fill={accent} opacity="0.9" />
        <circle cx="34" cy="22" r="1.6" fill={accent} opacity="0.9" />
      </svg>
    );
  }
  if (kind === "spheres") {
    const dots = Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const r = 6 + (i % 3) * 3;
      return { x: 20 + Math.cos(a) * r, y: 14 + Math.sin(a) * r * 0.7, s: 0.9 + (i % 3) * 0.5 };
    });
    return (
      <svg viewBox="0 0 40 28" className="w-full h-7" style={{ filter: glow }}>
        <circle cx="20" cy="14" r="2.4" fill={accent} />
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.s} fill={accent} opacity="0.85" />
        ))}
      </svg>
    );
  }
  if (kind === "blend") {
    // structured spokes + a few extra motes
    const motes = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = 9 + (i % 2) * 2;
      return { x: 20 + Math.cos(a) * r, y: 14 + Math.sin(a) * r * 0.7 };
    });
    return (
      <svg viewBox="0 0 40 28" className="w-full h-7" style={{ filter: glow }}>
        <line x1="20" y1="14" x2="6" y2="6" stroke={accent} strokeWidth="0.5" opacity="0.5" />
        <line x1="20" y1="14" x2="34" y2="6" stroke={accent} strokeWidth="0.5" opacity="0.5" />
        <line x1="20" y1="14" x2="6" y2="22" stroke={accent} strokeWidth="0.5" opacity="0.5" />
        <line x1="20" y1="14" x2="34" y2="22" stroke={accent} strokeWidth="0.5" opacity="0.5" />
        <circle cx="20" cy="14" r="3" fill={accent} />
        <circle cx="6" cy="6" r="1.4" fill={accent} opacity="0.9" />
        <circle cx="34" cy="6" r="1.4" fill={accent} opacity="0.9" />
        <circle cx="6" cy="22" r="1.4" fill={accent} opacity="0.9" />
        <circle cx="34" cy="22" r="1.4" fill={accent} opacity="0.9" />
        {motes.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="0.8" fill={accent} opacity="0.7" />
        ))}
      </svg>
    );
  }
  // random
  const rnd = [
    [5, 6],
    [12, 19],
    [18, 8],
    [25, 22],
    [32, 11],
    [9, 14],
    [22, 16],
    [30, 4],
    [36, 19],
    [15, 24],
    [28, 14],
    [3, 18],
  ];
  return (
    <svg viewBox="0 0 40 28" className="w-full h-7" style={{ filter: glow }}>
      {rnd.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1 + (i % 3) * 0.5} fill={accent} opacity="0.85" />
      ))}
    </svg>
  );
}

function LegendDot({
  c,
  label,
  shape = "sphere",
}: {
  c: string;
  label: string;
  shape?: "sphere" | "diamond" | "tri" | "hex";
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5"
        style={{
          background: c,
          boxShadow: `0 0 8px ${c}`,
          borderRadius: shape === "sphere" ? "50%" : shape === "hex" ? "20%" : "2px",
          transform:
            shape === "diamond" ? "rotate(45deg)" : shape === "tri" ? "rotate(15deg)" : undefined,
        }}
      />
      {label}
    </span>
  );
}

export default MemoryGraph3D;
