import { useEffect, useState } from "react";

const ACCENT = "#3ddc97";
const ACCENT2 = "#4A9EFF";
const ACCENT3 = "#60a5fa";

const PHRASES = [
  "Visualizing your digital imagination…",
  "Crystallizing memories…",
  "Tracing connections between thoughts…",
  "Mapping your memory graph…",
  "Pulling decisions out of the void…",
];

// Pre-computed star field so SSR/CSR match (no Math.random at render).
const STARS = Array.from({ length: 60 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const r = seed / 233280;
  const r2 = ((seed * 7) % 233280) / 233280;
  const r3 = ((seed * 13) % 233280) / 233280;
  return {
    x: r * 100,
    y: r2 * 100,
    s: 0.5 + r3 * 1.5,
    delay: r * 4,
  };
});

// Constellation nodes positioned around a central "core" (in % of viewBox).
const NODES = [
  { x: 50, y: 50, r: 8, c: ACCENT, delay: 0 }, // core
  { x: 30, y: 30, r: 4, c: ACCENT2, delay: 0.3 },
  { x: 72, y: 28, r: 4, c: ACCENT3, delay: 0.5 },
  { x: 78, y: 60, r: 3, c: ACCENT, delay: 0.7 },
  { x: 60, y: 78, r: 5, c: ACCENT2, delay: 0.9 },
  { x: 25, y: 70, r: 4, c: ACCENT3, delay: 1.1 },
  { x: 15, y: 50, r: 3, c: ACCENT, delay: 1.3 },
  { x: 88, y: 42, r: 3, c: ACCENT2, delay: 1.5 },
  { x: 42, y: 18, r: 3, c: ACCENT3, delay: 1.7 },
  { x: 50, y: 90, r: 3, c: ACCENT, delay: 1.9 },
];

// Links (indices into NODES) — every secondary node connects back to the core,
// plus a few cross-links for character.
const LINKS: [number, number, number][] = [
  [0, 1, 0.4],
  [0, 2, 0.6],
  [0, 3, 0.8],
  [0, 4, 1.0],
  [0, 5, 1.2],
  [0, 6, 1.4],
  [0, 7, 1.6],
  [0, 8, 1.8],
  [0, 9, 2.0],
  [1, 8, 2.2],
  [2, 7, 2.4],
  [4, 5, 2.6],
  [3, 7, 2.8],
];

export function MemoryGraphLoader({ height = 680 }: { height?: number }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [memoryCount, setMemoryCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 2200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let raf: number;
    const start = Date.now();
    const target = 1247;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 3500);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setMemoryCount(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height }}
      aria-label="Loading memory graph"
    >
      {/* Star field */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.s * 0.15}
            fill="white"
            opacity={0.5}
            style={{
              animation: `mg-twinkle 3s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </svg>

      {/* Constellation */}
      <svg
        className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2"
        width="min(560px, 80%)"
        height="min(560px, 80%)"
        viewBox="0 0 100 100"
        style={{
          transform: "translate(-50%, -50%)",
          left: "50%",
          top: "50%",
          position: "absolute",
        }}
      >
        <defs>
          <radialGradient id="mg-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.7" />
            <stop offset="60%" stopColor={ACCENT} stopOpacity="0.15" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </radialGradient>
          <filter id="mg-glow">
            <feGaussianBlur stdDeviation="0.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Core soft halo */}
        <circle cx="50" cy="50" r="22" fill="url(#mg-core-glow)">
          <animate attributeName="r" values="20;26;20" dur="3.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3.5s" repeatCount="indefinite" />
        </circle>

        {/* Links */}
        {LINKS.map(([a, b, delay], i) => {
          const A = NODES[a];
          const B = NODES[b];
          return (
            <g key={i}>
              <line
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke={ACCENT2}
                strokeWidth={0.25}
                strokeOpacity={0}
                strokeDasharray="2 2"
                style={{
                  animation: `mg-link-in 0.8s ease-out ${delay}s forwards, mg-link-pulse 4s ease-in-out ${delay + 1}s infinite`,
                }}
              />
              {/* Particle traveling along the link */}
              <circle r={0.5} fill={ACCENT} opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;1;0"
                  dur="2s"
                  begin={`${delay + 1.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cx"
                  values={`${A.x};${B.x}`}
                  dur="2s"
                  begin={`${delay + 1.2}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values={`${A.y};${B.y}`}
                  dur="2s"
                  begin={`${delay + 1.2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          );
        })}

        {/* Nodes */}
        {NODES.map((n, i) => (
          <g key={i} filter="url(#mg-glow)">
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r * 0.5}
              fill={n.c}
              opacity={0}
              style={{
                animation: `mg-node-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${n.delay}s forwards, mg-node-pulse 3s ease-in-out ${n.delay + 0.6}s infinite`,
                transformOrigin: `${n.x}px ${n.y}px`,
              }}
            />
          </g>
        ))}
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <div
            className="text-2xl md:text-3xl font-semibold tabular-nums tracking-tight"
            style={{ color: ACCENT }}
          >
            {memoryCount.toLocaleString()}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
            memories indexed
          </div>
        </div>
      </div>

      {/* Bottom rotating phrase */}
      <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
        <div
          key={phraseIdx}
          className="text-xs md:text-sm text-foreground/70 animate-in fade-in slide-in-from-bottom-1 duration-500"
        >
          {PHRASES[phraseIdx]}
        </div>
      </div>

      <style>{`
        @keyframes mg-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.9; }
        }
        @keyframes mg-link-in {
          to { stroke-opacity: 0.45; }
        }
        @keyframes mg-link-pulse {
          0%, 100% { stroke-opacity: 0.3; }
          50% { stroke-opacity: 0.7; }
        }
        @keyframes mg-node-in {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes mg-node-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
      `}</style>
    </div>
  );
}
