import { useEffect, useMemo, useRef, useState } from "react";
import { workspaces, skills, runs } from "@/lib/mock-data";

type ForceGraphModule = typeof import("react-force-graph-3d").default;
type ThreeModule = typeof import("three");

const ACCENT = "#3ddc97";
const STALE = "#f5b14c";
const MISSING = "#ef5a5a";
const FILE_COL = "#8a93a3";
const WS_COL = "#e6ebf2";
const DEC_COL = "#4A9EFF";
const SES_COL = "#60a5fa";
const SKILL_COL = "#f472b6";

function buildData() {
  const nodes: any[] = [];
  const links: any[] = [];

  nodes.push({ id: "hub", name: "Memory Core", kind: "hub", val: 60, color: ACCENT });

  const decisions = [
    "use-claude-md-everywhere",
    "skills-as-units",
    "outputs-immutable",
    "memory-wrap-nightly",
  ];
  decisions.forEach((d) => {
    nodes.push({ id: `dec-${d}`, name: d, kind: "decision", color: DEC_COL });
    links.push({ source: "hub", target: `dec-${d}`, kind: "decision" });
  });

  workspaces.forEach((w) => {
    const status =
      w.claudeMdStatus === "missing" ? "missing" : w.memoryFreshness < 60 ? "stale" : "healthy";
    const wsColor = status === "missing" ? MISSING : status === "stale" ? STALE : WS_COL;
    nodes.push({ id: `ws-${w.id}`, name: w.name, kind: "workspace", status, color: wsColor });
    links.push({ source: "hub", target: `ws-${w.id}`, kind: "core" });

    w.memoryFiles.slice(0, 4).forEach((f, j) => {
      const id = `f-${w.id}-${j}`;
      nodes.push({ id, name: f.name, kind: "file", color: FILE_COL });
      links.push({ source: `ws-${w.id}`, target: id, kind: "file" });
    });
  });

  runs.slice(0, 6).forEach((r, i) => {
    const sid = `ses-${i}`;
    nodes.push({ id: sid, name: r.id, kind: "session", color: SES_COL });
    const ws = workspaces.find((w) => w.name === r.workspace);
    if (ws) links.push({ source: `ws-${ws.id}`, target: sid, kind: "session" });
  });

  const topSkills = [...skills].sort((a, b) => b.uses - a.uses).slice(0, 5);
  topSkills.forEach((s) => {
    const sid = `sk-${s.name.replace(/\s+/g, "-").toLowerCase()}`;
    nodes.push({ id: sid, name: s.name, kind: "skill", color: SKILL_COL });
    if (s.scope === "global") {
      workspaces
        .slice(0, 3)
        .forEach((w) => links.push({ source: sid, target: `ws-${w.id}`, kind: "skill" }));
    } else if (s.workspace) {
      links.push({ source: sid, target: `ws-${s.workspace}`, kind: "skill" });
    }
  });

  for (let i = 0; i < workspaces.length; i++) {
    const j = (i + 1) % workspaces.length;
    links.push({
      source: `ws-${workspaces[i].id}`,
      target: `ws-${workspaces[j].id}`,
      kind: "cross",
    });
  }

  return { nodes, links };
}

export function MemoryGraphMini() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 400, h: 300 });
  const [Graph, setGraph] = useState<ForceGraphModule | null>(null);
  const [THREE, setThree] = useState<ThreeModule | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const data = useMemo(() => buildData(), []);

  const isLinkActive = (l: any) => {
    if (!hoverId) return false;
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    return s === hoverId || t === hoverId;
  };

  useEffect(() => {
    let alive = true;
    Promise.all([import("react-force-graph-3d"), import("three")]).then(([g, t]) => {
      if (!alive) return;
      setGraph(() => g.default);
      setThree(t);
    });
    return () => {
      alive = false;
    };
  }, []);

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
          if (l.kind === "file") return 18;
          if (l.kind === "skill") return 70;
          if (l.kind === "decision") return 40;
          if (l.kind === "cross") return 90;
          return 40;
        });
    } catch {}

    const scene = fg.scene();
    if (!scene.userData.__miniEnhanced) {
      scene.userData.__miniEnhanced = true;
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.PointLight(0x3ddc97, 3.2, 900);
      key.position.set(80, 120, 140);
      scene.add(key);
      const rim = new THREE.PointLight(0x60a5fa, 1.4, 800);
      rim.position.set(-140, -80, -100);
      scene.add(rim);
      const accent = new THREE.PointLight(0xaaffd9, 2.0, 600);
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
                  ? "WORKSPACE"
                  : n.kind === "file"
                    ? "FILE"
                    : n.kind === "decision"
                      ? "DECISION"
                      : n.kind === "session"
                        ? "SESSION"
                        : "SKILL";
            return `<div style="font:500 11px ui-sans-serif,system-ui;padding:6px 9px;background:rgba(11,14,19,0.92);border:1px solid #2a2f3a;border-radius:6px;color:#fff">
              <div style="font-size:9px;letter-spacing:.18em;color:#8a93a3;margin-bottom:2px">${cap}</div>
              <div style="font-weight:600">${n.name}</div>
            </div>`;
          }}
          nodeThreeObject={(n: any) => {
            let r = 4;
            if (n.kind === "hub") r = 14;
            else if (n.kind === "workspace") r = 8;
            else if (n.kind === "skill") r = 6;
            else if (n.kind === "decision") r = 5;
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
            if (n.kind === "decision") geom = new THREE.OctahedronGeometry(r, 0);
            else if (n.kind === "skill") geom = new THREE.IcosahedronGeometry(r, 0);
            else if (n.kind === "session") geom = new THREE.TetrahedronGeometry(r, 0);
            else geom = new THREE.SphereGeometry(r, 20, 20);
            return new THREE.Mesh(geom, mat);
          }}
          linkColor={(l: any) => {
            if (isLinkActive(l)) return "rgba(170,255,217,0.95)";
            return l.kind === "core"
              ? "rgba(61,220,151,0.55)"
              : l.kind === "cross"
                ? "rgba(123,224,200,0.25)"
                : l.kind === "skill"
                  ? "rgba(244,114,182,0.35)"
                  : l.kind === "decision"
                    ? "rgba(167,139,250,0.4)"
                    : l.kind === "session"
                      ? "rgba(96,165,250,0.35)"
                      : "rgba(180,190,200,0.25)";
          }}
          linkWidth={(l: any) => (isLinkActive(l) ? 2.4 : l.kind === "core" ? 1.2 : 0.5)}
          linkDirectionalParticles={(l: any) => (isLinkActive(l) ? 5 : l.kind === "core" ? 2 : 0)}
          linkDirectionalParticleWidth={(l: any) => (isLinkActive(l) ? 3 : 1.5)}
          linkDirectionalParticleSpeed={(l: any) => (isLinkActive(l) ? 0.018 : 0.006)}
          linkDirectionalParticleColor={(l: any) =>
            isLinkActive(l) ? "rgba(170,255,217,1)" : "rgba(61,220,151,0.9)"
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

export default MemoryGraphMini;
