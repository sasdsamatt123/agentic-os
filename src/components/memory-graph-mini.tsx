import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";

type ForceGraphModule = typeof import("react-force-graph-3d").default;
type ThreeModule = typeof import("three");

// Brand-locked palette — match the rest of Agentic OS.
const HUB = "#C19A6B"; // amber primary
const WS_OBSIDIAN = "#C19A6B";
const WS_CLAUDE = "#4A9EFF";
const WS_PINECONE = "#3ddc97";
const SKILL_COL = "#D4B17E";
const SES_COL = "#60a5fa";

/**
 * Pre-flight WebGL check — react-force-graph-3d initializes a WebGL context
 * on mount, and if the browser refuses (battery saver, GPU recovery, locked
 * compositor) the throw propagates up to the root error boundary and takes
 * the whole page down. This check lets us swap in a 2D fallback before the
 * 3D module is even imported.
 */
function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function buildData(ld: any) {
  const nodes: any[] = [];
  const links: any[] = [];

  const stats = ld?.memory?.stats ?? {};
  const sources = (ld?.memory?.sources ?? []) as any[];
  const topSkills = ((ld?.skills?.active ?? []) as any[]).slice(0, 6);
  const recentRuns = ((ld?.runs ?? []) as any[]).slice(0, 6);

  // Hub
  nodes.push({
    id: "hub",
    name: `Memory Core · ${(stats.totalFiles ?? 0).toLocaleString()} files`,
    kind: "hub",
    val: 60,
    color: HUB,
  });

  // Sources — each Obsidian vault / Claude memory dir / Pinecone index
  sources.forEach((s, i) => {
    const id = `ws-${i}`;
    const kind = s.kind || "claude";
    const color =
      kind === "obsidian" ? WS_OBSIDIAN : kind === "pinecone" ? WS_PINECONE : WS_CLAUDE;
    nodes.push({
      id,
      name: s.label || s.name || s.root || "source",
      kind: "workspace",
      sourceKind: kind,
      color,
    });
    links.push({ source: "hub", target: id, kind: "core" });
  });

  // Top skills — circle around the hub
  topSkills.forEach((sk, i) => {
    const id = `sk-${i}`;
    nodes.push({
      id,
      name: sk.name || "skill",
      kind: "skill",
      color: SKILL_COL,
    });
    links.push({ source: id, target: "hub", kind: "skill" });
  });

  // Recent sessions — attached to first few sources for visual life
  recentRuns.forEach((r, i) => {
    const id = `ses-${i}`;
    nodes.push({
      id,
      name: r.id || (r.sessionId ? r.sessionId.slice(0, 8) : "session"),
      kind: "session",
      color: SES_COL,
    });
    if (sources.length > 0) {
      const wsIdx = i % sources.length;
      links.push({ source: `ws-${wsIdx}`, target: id, kind: "session" });
    } else {
      links.push({ source: "hub", target: id, kind: "session" });
    }
  });

  // Sparse cross-links — gives the graph organic feel
  for (let i = 0; i < sources.length; i++) {
    const j = (i + 2) % sources.length;
    if (i !== j) {
      links.push({ source: `ws-${i}`, target: `ws-${j}`, kind: "cross" });
    }
  }

  return { nodes, links };
}

function MemoryGraphFallback({
  stats,
  sources,
}: {
  stats: any;
  sources: any[];
}) {
  const byKind = sources.reduce(
    (acc: Record<string, number>, s: any) => {
      const k = s.kind || "claude";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const kindColor: Record<string, string> = {
    obsidian: "#C19A6B",
    claude: "#4A9EFF",
    pinecone: "#3ddc97",
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="text-center max-w-[320px]">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 mb-2">
          Memory at a glance
        </div>
        <div
          className="font-mono text-[44px] font-semibold tabular-nums tracking-tight leading-none mb-1.5"
          style={{ color: "oklch(0.78 0.10 70)" }}
        >
          {(stats.totalFiles ?? 0).toLocaleString()}
        </div>
        <div className="text-[12px] text-muted-foreground mb-5">
          files across {stats.totalWorkspaces ?? 0} workspaces
          {typeof stats.stale === "number" && stats.stale > 0 && (
            <>
              {" · "}
              <span className="text-foreground/70">{stats.stale} stale</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap text-[10.5px] mb-4">
          {Object.entries(byKind).map(([kind, n]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: kindColor[kind] || "#8a93a3" }}
              />
              <span className="font-mono tabular-nums text-foreground/85">{n as number}</span>
              <span className="text-muted-foreground capitalize">{kind}</span>
            </span>
          ))}
        </div>
        <Link
          to="/memory"
          className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/85 hover:text-foreground transition-colors"
        >
          full 3D graph
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export function MemoryGraphMini() {
  const ld = useLiveData() as any;
  const stats = ld?.memory?.stats ?? {};
  const sources = (ld?.memory?.sources ?? []) as any[];

  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  useEffect(() => {
    setWebglOk(hasWebGL());
  }, []);

  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [Graph, setGraph] = useState<ForceGraphModule | null>(null);
  const [THREE, setThree] = useState<ThreeModule | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const data = useMemo(() => buildData(ld), [ld]);

  const isLinkActive = (l: any) => {
    if (!hoverId) return false;
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    return s === hoverId || t === hoverId;
  };

  useEffect(() => {
    if (webglOk !== true) return;
    let alive = true;
    Promise.all([import("react-force-graph-3d"), import("three")])
      .then(([g, t]) => {
        if (!alive) return;
        setGraph(() => g.default);
        setThree(t);
      })
      .catch((err) => {
        if (!alive) return;
        console.warn("[memory-graph-mini] dynamic import failed", err);
        setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [webglOk]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fgRef.current || !THREE) return;
    const fg = fgRef.current;
    try {
      const charge = fg.d3Force("charge");
      if (charge) charge.strength(-60);
      const linkF = fg.d3Force("link");
      if (linkF)
        linkF.distance((l: any) => {
          if (l.kind === "core") return 50;
          if (l.kind === "skill") return 70;
          if (l.kind === "session") return 30;
          if (l.kind === "cross") return 90;
          return 40;
        });
    } catch {}

    const scene = fg.scene();
    if (!scene.userData.__miniEnhanced) {
      scene.userData.__miniEnhanced = true;
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.PointLight(0xc19a6b, 3.2, 900);
      key.position.set(80, 120, 140);
      scene.add(key);
      const rim = new THREE.PointLight(0x4a9eff, 1.4, 800);
      rim.position.set(-140, -80, -100);
      scene.add(rim);
      const accent = new THREE.PointLight(0xffd9a8, 2.0, 600);
      accent.position.set(0, 0, 200);
      scene.add(accent);
    }

    let raf = 0;
    let angle = 0;
    const tick = () => {
      angle += 0.0014;
      const distance = 280;
      fg.cameraPosition({
        x: distance * Math.sin(angle),
        y: 60 + Math.sin(angle * 0.7) * 20,
        z: distance * Math.cos(angle),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [THREE, Graph]);

  // WebGL refused or dynamic import bombed → safe fallback, no crash.
  if (webglOk === false || loadFailed) {
    return (
      <div className="relative w-full h-full">
        <MemoryGraphFallback stats={stats} sources={sources} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      {Graph && THREE ? (
        <Graph
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data as any}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          enableNodeDrag={false}
          enableNavigationControls={false}
          warmupTicks={60}
          cooldownTicks={120}
          nodeRelSize={4}
          nodeLabel={(n: any) => {
            const cap =
              n.kind === "hub"
                ? "MEMORY CORE"
                : n.kind === "workspace"
                  ? (n.sourceKind ?? "WORKSPACE").toString().toUpperCase()
                  : n.kind === "skill"
                    ? "SKILL"
                    : n.kind === "session"
                      ? "SESSION"
                      : "NODE";
            return `<div style="font:500 11px Geist,ui-sans-serif,system-ui;padding:6px 9px;background:rgba(11,14,19,0.92);border:1px solid #2a2f3a;border-radius:6px;color:#fff">
              <div style="font-size:9px;letter-spacing:.18em;color:#8a93a3;margin-bottom:2px">${cap}</div>
              <div style="font-weight:600">${escapeHtml(n.name)}</div>
            </div>`;
          }}
          nodeThreeObject={(n: any) => {
            let r = 4;
            if (n.kind === "hub") r = 14;
            else if (n.kind === "workspace") r = 8;
            else if (n.kind === "skill") r = 6;
            else if (n.kind === "session") r = 4;
            else r = 3;
            const emissive = n.kind === "hub" ? 3.6 : n.kind === "workspace" ? 1.4 : 1.0;
            const mat = new THREE.MeshStandardMaterial({
              color: n.color,
              emissive: n.color,
              emissiveIntensity: emissive,
              roughness: 0.35,
              metalness: 0.1,
            });
            let geom: any;
            if (n.kind === "skill") geom = new THREE.IcosahedronGeometry(r, 0);
            else if (n.kind === "session") geom = new THREE.TetrahedronGeometry(r, 0);
            else geom = new THREE.SphereGeometry(r, 20, 20);
            return new THREE.Mesh(geom, mat);
          }}
          linkColor={(l: any) => {
            if (isLinkActive(l)) return "rgba(193,154,107,0.95)";
            return l.kind === "core"
              ? "rgba(193,154,107,0.55)"
              : l.kind === "cross"
                ? "rgba(193,154,107,0.20)"
                : l.kind === "skill"
                  ? "rgba(212,177,126,0.40)"
                  : l.kind === "session"
                    ? "rgba(74,158,255,0.40)"
                    : "rgba(180,190,200,0.25)";
          }}
          linkWidth={(l: any) => (isLinkActive(l) ? 2.4 : l.kind === "core" ? 1.2 : 0.5)}
          linkDirectionalParticles={(l: any) => (isLinkActive(l) ? 5 : l.kind === "core" ? 2 : 0)}
          linkDirectionalParticleWidth={(l: any) => (isLinkActive(l) ? 3 : 1.5)}
          linkDirectionalParticleSpeed={(l: any) => (isLinkActive(l) ? 0.018 : 0.006)}
          linkDirectionalParticleColor={(l: any) =>
            isLinkActive(l) ? "rgba(193,154,107,1)" : "rgba(193,154,107,0.9)"
          }
          onNodeHover={(n: any) => {
            setHoverId(n ? n.id : null);
            if (wrapRef.current) wrapRef.current.style.cursor = n ? "pointer" : "default";
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
          Loading…
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.5)_92%)]" />
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export default MemoryGraphMini;
