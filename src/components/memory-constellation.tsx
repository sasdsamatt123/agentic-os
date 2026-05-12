import { useEffect, useRef } from "react";
import { workspaces } from "@/lib/mock-data";

// Lightweight animated SVG constellation — home-page preview that
// echoes the full 3D Memory graph without the WebGL cost.

const ACCENT = "oklch(0.72 0.17 155)";
const STALE = "oklch(0.78 0.16 75)";
const MISSING = "oklch(0.65 0.22 25)";

interface Node {
  id: string;
  x: number;
  y: number;
  r: number;
  color: string;
  ring?: boolean;
  label?: string;
}

export function MemoryConstellation() {
  const svgRef = useRef<SVGSVGElement>(null);

  // Build nodes: 1 hub + 8 workspace satellites + 24 file motes
  const W = 720;
  const H = 260;
  const cx = W / 2;
  const cy = H / 2;

  const hub: Node = {
    id: "hub",
    x: cx,
    y: cy,
    r: 14,
    color: ACCENT,
    ring: true,
    label: "Memory Core",
  };

  const wsNodes: Node[] = workspaces.map((w, i) => {
    const angle = (i / workspaces.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 88;
    const color =
      w.claudeMdStatus === "missing" ? MISSING : w.memoryFreshness < 60 ? STALE : ACCENT;
    return {
      id: w.id,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.85,
      r: 5 + (w.memoryFreshness / 100) * 4,
      color,
      label: w.name,
    };
  });

  // Outer file motes — pseudo random but deterministic
  const motes: Node[] = Array.from({ length: 56 }).map((_, i) => {
    const a = i * 137.5 * (Math.PI / 180);
    const r = 110 + ((i * 53) % 90);
    return {
      id: `m-${i}`,
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * (r * 0.55),
      r: 1 + ((i * 7) % 3) * 0.6,
      color: i % 11 === 0 ? STALE : i % 17 === 0 ? MISSING : "oklch(0.65 0.02 250)",
    };
  });

  // Animate twinkle via requestAnimationFrame
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const svg = svgRef.current;
      if (svg) {
        const hubEl = svg.querySelector<SVGCircleElement>('[data-hub="1"]');
        if (hubEl) {
          const s = 1 + Math.sin(t * 2) * 0.08;
          hubEl.setAttribute("r", String(14 * s));
        }
        const ringEl = svg.querySelector<SVGCircleElement>('[data-ring="1"]');
        if (ringEl) {
          ringEl.setAttribute("r", String(20 + Math.sin(t * 1.6) * 4));
          ringEl.setAttribute("opacity", String(0.35 + Math.sin(t * 1.6) * 0.2));
        }
        svg.querySelectorAll<SVGCircleElement>('[data-mote="1"]').forEach((el, i) => {
          const o = 0.35 + Math.sin(t * 1.2 + i * 0.7) * 0.3;
          el.setAttribute("opacity", String(o));
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
          <stop offset="60%" stopColor={ACCENT} stopOpacity={0.04} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.9} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="link-grad" x1="0" x2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.05} />
          <stop offset="50%" stopColor={ACCENT} stopOpacity={0.45} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* background glow */}
      <rect x="0" y="0" width={W} height={H} fill="url(#bg-glow)" />

      {/* hub aura */}
      <circle cx={cx} cy={cy} r="60" fill="url(#hub-glow)" />

      {/* links from hub to workspaces */}
      {wsNodes.map((n) => (
        <line
          key={`l-${n.id}`}
          x1={cx}
          y1={cy}
          x2={n.x}
          y2={n.y}
          stroke="url(#link-grad)"
          strokeWidth="1"
        />
      ))}

      {/* file motes */}
      {motes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={n.r} fill={n.color} data-mote="1" />
      ))}

      {/* workspace satellites */}
      {wsNodes.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={n.color} opacity={0.18} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.color}>
            <title>{n.label}</title>
          </circle>
        </g>
      ))}

      {/* hub pulsing ring */}
      <circle
        cx={cx}
        cy={cy}
        r="20"
        fill="none"
        stroke={ACCENT}
        strokeWidth="1"
        opacity="0.4"
        data-ring="1"
      />

      {/* hub core */}
      <circle cx={cx} cy={cy} r={hub.r} fill={ACCENT} data-hub="1">
        <title>Memory Core</title>
      </circle>
    </svg>
  );
}
