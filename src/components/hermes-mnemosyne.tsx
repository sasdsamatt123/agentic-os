/*
 * Mnemosyne — Hermes-specific 3D memory constellation.
 *
 * Visual goals (per the operator's feedback 2026-05-12):
 *   - The CENTER node is Hermes — a big, orange-glowing sprite using
 *     the hermes-portrait.png pixel-art mascot. Pinned to origin so the
 *     graph radiates outward from her.
 *   - Real bloom post-processing so emissive nodes actually glow, not
 *     just look brightly coloured.
 *   - Slow auto-orbit camera so the field feels alive, not frozen.
 *   - View modes (structured / spheres / random) so users can play with
 *     layouts, same vocabulary as the main dashboard's MemoryGraph3D.
 *
 * Data source — Hermes' own filesystem only:
 *   - USER.md / MEMORY.md `§`-fragments
 *   - SOUL.md (when not the default template)
 *   - 10 Pantheon personas from ~/.hermes/pantheon/personas/
 *   - Recent sessions (capped at 12)
 *   - Obsidian vault (when the bridge is confirmed connected via localStorage)
 *
 * Toggle pills (Hermes / Obsidian) flip each source on/off live.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Type-only imports — the actual modules are dynamically imported below
// so the three.js chunk only ships when this component renders.
type ThreeModule = typeof import("three");
type UnrealBloomPassCtor =
  typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass;

// Local assets
import hermesLogo from "@/assets/hermes-agent.png";
// The new high-detail Hermes portrait — teal anime girl with headphones,
// the operator's preferred mascot image. Particles sampled from her pixels build
// the constellation at the center of Mnemosyne.
import hermesPortrait from "@/assets/hermes-portrait-v2.png";
import logoObsidian from "@/assets/logos/obsidian.svg";
import pantheon01 from "@/assets/hermes-art/01-hermes-messenger.png";
import pantheon02 from "@/assets/hermes-art/02-oracle-delphi.png";
import pantheon03 from "@/assets/hermes-art/03-athena-owl.png";
import pantheon04 from "@/assets/hermes-art/04-scribe-scrolls.png";
import pantheon05 from "@/assets/hermes-art/05-orpheus-lyre.png";
import pantheon06 from "@/assets/hermes-art/06-labyrinth.png";
import pantheon07 from "@/assets/hermes-art/07-alchemist-workshop.png";
import pantheon08 from "@/assets/hermes-art/08-philosopher.png";
import pantheon09 from "@/assets/hermes-art/09-mapmaker.png";
import pantheon10 from "@/assets/hermes-art/10-mercury-flight.png";

const CREAM = "#FFE6CB";
const HERMES_GLOW = "#FFD21E";
const OBSIDIAN_CONNECTED_KEY = "claude-os.hermes.obsidian-connected.v1";

const PERSONA_AVATAR_BY_ID: Record<string, string> = {
  messenger: pantheon01,
  oracle: pantheon02,
  athena: pantheon03,
  scribe: pantheon04,
  orpheus: pantheon05,
  labyrinth: pantheon06,
  alchemist: pantheon07,
  philosopher: pantheon08,
  mapmaker: pantheon09,
  mercury: pantheon10,
};

// Lazy-load the 3D force-graph (~400 KB gzipped) only when this component
// mounts. The component is itself wrapped in lazy() from agents.hermes.tsx.
const ForceGraph3D = lazy(() => import("react-force-graph-3d"));

// ────────────────────────────────────────────────────────────────────────────
// Portrait → particle constellation
// ────────────────────────────────────────────────────────────────────────────
// Loads an image, samples its pixels at low resolution, and pushes a
// THREE.Points cloud into the supplied group where each visible pixel
// becomes a particle in 3D space at (x, y, jitter_z). Vertex colors
// preserve the portrait's actual palette. The group's animation tick
// rotates + wobbles the cloud on z so it reads as a real 3D object,
// not a flat image.
//
// Image load is async; we add the Points to the group when it lands.
// force-graph needs a sync return from nodeThreeObject, so callers pass
// us the already-returned group.
function buildPortraitParticles(
  THREE: any,
  group: any,
  imageSrc: string,
  opts: { resolution?: number; scale?: number; jitter?: number } = {},
): void {
  const { resolution = 96, scale = 60, jitter = 4 } = opts;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const W = resolution;
      const H = resolution;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // object-fit: contain — preserve aspect ratio into a WxH square.
      const aspect = img.width / img.height;
      let drawW = W;
      let drawH = H;
      if (aspect > 1) drawH = W / aspect;
      else drawW = H * aspect;
      const dx = (W - drawW) / 2;
      const dy = (H - drawH) / 2;
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, dx, dy, drawW, drawH);
      const data = ctx.getImageData(0, 0, W, H).data;

      const positions: number[] = [];
      const colors: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          const r = data[i]! / 255;
          const g = data[i + 1]! / 255;
          const b = data[i + 2]! / 255;
          const a = data[i + 3]! / 255;
          if (a < 0.3) continue;
          // Skip near-white background pixels (typical of portrait PNGs)
          const lum = (r + g + b) / 3;
          if (lum > 0.94 && a < 0.96) continue;
          // Down-sample by random skip — particle density tuning
          if (Math.random() > 0.55) continue;

          // Center & flip Y (image coords → world coords)
          const px = (x / W - 0.5) * scale;
          const py = (0.5 - y / H) * scale;
          const pz = (Math.random() - 0.5) * jitter;
          positions.push(px, py, pz);
          // Boost brightness slightly so colours pop after additive blend
          colors.push(Math.min(1, r * 1.1), Math.min(1, g * 1.1), Math.min(1, b * 1.1));
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(positions), 3),
      );
      geom.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 3),
      );
      // Store original positions on userData so the wobble animation
      // can deform around them without losing the silhouette.
      const original = new Float32Array(positions);
      const mat = new THREE.PointsMaterial({
        size: 0.85,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        sizeAttenuation: true,
        depthWrite: false,
        // Additive blending makes overlapping particles glow brighter
        // — looks great with the bloom pass.
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geom, mat);
      points.userData.__portraitOriginal = original;
      points.userData.__portraitPoints = true;
      group.add(points);
    } catch {
      /* canvas not ready / CORS issue — silently skip */
    }
  };
  img.src = imageSrc;
}

// ────────────────────────────────────────────────────────────────────────────
// Data hooks
// ────────────────────────────────────────────────────────────────────────────
interface HermesMemoryData {
  hermesHome: string;
  user: { content: string; charCount: number; charLimit: number; path: string };
  memory: {
    content: string;
    charCount: number;
    charLimit: number;
    path: string;
  };
  soul: {
    content: string;
    charCount: number;
    isTemplate: boolean;
    path: string;
  };
}
interface PersonaYaml {
  id: string;
  name: string;
}
interface HermesSession {
  id: string;
  firstUserMessage: string | null;
}

function useHermesMemory() {
  return useQuery<HermesMemoryData>({
    queryKey: ["hermes-memory"],
    queryFn: async () => {
      const res = await fetch("/__hermes_memory");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 10_000,
  });
}
function useHermesPantheon() {
  return useQuery<{ personas: PersonaYaml[] }>({
    queryKey: ["hermes-pantheon"],
    queryFn: async () => {
      const res = await fetch("/__hermes_pantheon");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
  });
}
function useHermesSessions() {
  return useQuery<{ sessions: HermesSession[] }>({
    queryKey: ["hermes-sessions"],
    queryFn: async () => {
      const res = await fetch("/__hermes_sessions");
      if (!res.ok) throw new Error(`status ${res.status}`);
      return res.json();
    },
    staleTime: 15_000,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type NodeGroup =
  | "hermes"
  | "user"
  | "memory"
  | "soul"
  | "persona"
  | "session"
  | "obsidian";

interface GraphNode {
  id: string;
  label: string;
  group: NodeGroup;
  val?: number;
  /** Persona avatar src for persona nodes (rendered as a sprite). */
  image?: string;
  /** Anchoring coords — set on the Hermes node so it stays at origin. */
  fx?: number;
  fy?: number;
  fz?: number;
}
interface GraphLink {
  source: string;
  target: string;
  strength?: number;
}

const NODE_COLORS: Record<NodeGroup, string> = {
  hermes: HERMES_GLOW,
  user: "#86efac",
  memory: "#60a5fa",
  soul: "#f0abfc",
  persona: "#FFE6CB",
  session: "rgba(255,230,203,0.55)",
  obsidian: "#a78bfa",
};

type ViewMode = "structured" | "spheres" | "drift";

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────
export function HermesMnemosyne() {
  const { data: memData } = useHermesMemory();
  const { data: pantheonData } = useHermesPantheon();
  const { data: sessionData } = useHermesSessions();
  const [showHermes, setShowHermes] = useState(true);
  const [showObsidian, setShowObsidian] = useState(false);
  const [view, setView] = useState<ViewMode>("structured");
  const [orbiting, setOrbiting] = useState(true);

  // Track Obsidian connection state reactively — re-read on focus so
  // the toggle un-disables the moment the bridge is confirmed.
  const [obsidianConnected, setObsidianConnected] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(OBSIDIAN_CONNECTED_KEY) === "true";
  });
  useEffect(() => {
    function recheck() {
      setObsidianConnected(
        typeof window !== "undefined" &&
          window.localStorage.getItem(OBSIDIAN_CONNECTED_KEY) === "true",
      );
    }
    window.addEventListener("storage", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      window.removeEventListener("storage", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, []);
  // If user disconnects via the bridge, kill the toggle state.
  useEffect(() => {
    if (!obsidianConnected) setShowObsidian(false);
  }, [obsidianConnected]);

  const graph = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    if (showHermes && memData) {
      // CENTER — pinned to origin so everything radiates around her.
      nodes.push({
        id: "hermes",
        label: "Hermes",
        group: "hermes",
        val: 22,
        fx: 0,
        fy: 0,
        fz: 0,
      });

      memData.user.content
        .split(/\n?§\n?/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((f, i) => {
          const id = `user-${i}`;
          nodes.push({
            id,
            label: f.length > 80 ? f.slice(0, 78) + "…" : f,
            group: "user",
            val: 4,
          });
          links.push({ source: "hermes", target: id, strength: 0.7 });
        });

      memData.memory.content
        .split(/\n?§\n?/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((f, i) => {
          const id = `memory-${i}`;
          nodes.push({
            id,
            label: f.length > 80 ? f.slice(0, 78) + "…" : f,
            group: "memory",
            val: 4,
          });
          links.push({ source: "hermes", target: id, strength: 0.7 });
        });

      if (memData.soul.content && !memData.soul.isTemplate) {
        nodes.push({
          id: "soul",
          label: "Soul · personality",
          group: "soul",
          val: 5,
        });
        links.push({ source: "hermes", target: "soul", strength: 0.9 });
      }

      pantheonData?.personas?.forEach((p) => {
        const id = `persona-${p.id}`;
        nodes.push({
          id,
          label: p.name,
          group: "persona",
          val: 6,
          image: PERSONA_AVATAR_BY_ID[p.id.toLowerCase()],
        });
        links.push({ source: "hermes", target: id, strength: 0.4 });
      });

      sessionData?.sessions?.slice(0, 12).forEach((s, i) => {
        const id = `session-${i}`;
        nodes.push({
          id,
          label:
            s.firstUserMessage?.slice(0, 60) || `Session ${s.id.slice(0, 6)}`,
          group: "session",
          val: 2.5,
        });
        links.push({ source: "hermes", target: id, strength: 0.25 });
      });
    }

    if (showObsidian && obsidianConnected) {
      nodes.push({
        id: "obsidian",
        label: "Obsidian vault",
        group: "obsidian",
        val: 12,
      });
      if (showHermes) {
        for (const n of nodes.filter(
          (x) => x.group === "user" || x.group === "memory",
        )) {
          links.push({ source: "obsidian", target: n.id, strength: 0.5 });
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const id = `vault-${i}`;
          nodes.push({
            id,
            label: `Vault note ${i + 1}`,
            group: "obsidian",
            val: 3,
          });
          links.push({ source: "obsidian", target: id, strength: 0.6 });
        }
      }
    }

    return { nodes, links };
  }, [
    memData,
    pantheonData,
    sessionData,
    showHermes,
    showObsidian,
    obsidianConnected,
  ]);

  return (
    <div
      className="relative border overflow-hidden"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        background: "rgba(0,0,0,0.55)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3 border-b flex-wrap"
        style={{ borderColor: "rgba(255,230,203,0.25)" }}
      >
        <div className="min-w-0">
          <div
            className="hermes-display uppercase leading-none"
            style={{ color: CREAM, fontSize: "16px", letterSpacing: "0.04em" }}
          >
            Mnemosyne
          </div>
          <div
            className="hermes-mono text-[10px] uppercase tracking-[0.22em] mt-1"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            {graph.nodes.length} nodes · Hermes-native · drag to rotate · scroll
            to zoom
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View-mode pills — match the dashboard graph's vocabulary
              (structured/spheres/random) so the affordance is consistent. */}
          <ViewModePills view={view} setView={setView} />
          {/* Orbit pause toggle */}
          <button
            type="button"
            onClick={() => setOrbiting((v) => !v)}
            title={orbiting ? "Pause auto-orbit" : "Resume auto-orbit"}
            className="hermes-mono inline-flex items-center justify-center w-7 h-7 border text-[10px] transition-all"
            style={{
              color: orbiting ? CREAM : "rgba(255,230,203,0.5)",
              borderColor: orbiting ? CREAM : "rgba(255,230,203,0.35)",
              background: orbiting ? "rgba(255,230,203,0.08)" : "transparent",
            }}
          >
            {orbiting ? "⏸" : "▶"}
          </button>
          <span
            className="inline-block"
            style={{
              width: 1,
              height: 18,
              background: "rgba(255,230,203,0.2)",
            }}
          />
          <SourceTogglePill
            active={showHermes}
            onToggle={() => setShowHermes((v) => !v)}
            logoSrc={hermesLogo}
            label="Hermes"
          />
          <SourceTogglePill
            active={showObsidian}
            onToggle={() => setShowObsidian((v) => !v)}
            logoSrc={logoObsidian}
            label="Obsidian"
            disabled={!obsidianConnected}
            disabledHint="Connect Obsidian below to enable this view"
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height: 620 }}>
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: CREAM }}
              />
            </div>
          }
        >
          <ConstellationCanvas
            data={graph}
            view={view}
            orbiting={orbiting}
          />
        </Suspense>
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="hermes-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.45)" }}
            >
              Toggle a source on to populate the constellation
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-2 border-t"
        style={{ borderColor: "rgba(255,230,203,0.2)" }}
      >
        <LegendSwatch color={HERMES_GLOW} label="Hermes" />
        <LegendSwatch color="#86efac" label="User" />
        <LegendSwatch color="#60a5fa" label="Memory" />
        <LegendSwatch color="#f0abfc" label="Soul" />
        <LegendSwatch color="#FFE6CB" label="Persona" />
        <LegendSwatch color="rgba(255,230,203,0.5)" label="Session" />
        <LegendSwatch color="#a78bfa" label="Obsidian" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// View-mode pills
// ────────────────────────────────────────────────────────────────────────────
function ViewModePills({
  view,
  setView,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  const opts: Array<{ key: ViewMode; label: string }> = [
    { key: "structured", label: "Constellation" },
    { key: "spheres", label: "Spheres" },
    { key: "drift", label: "Drift" },
  ];
  return (
    <div
      className="inline-flex border overflow-hidden"
      style={{ borderColor: "rgba(255,230,203,0.35)" }}
    >
      {opts.map((o) => {
        const active = view === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setView(o.key)}
            className="hermes-mono px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] transition-all"
            style={{
              background: active ? CREAM : "transparent",
              color: active ? "#071D1C" : "rgba(255,230,203,0.6)",
              borderRight: "1px solid rgba(255,230,203,0.2)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Source toggle pill
// ────────────────────────────────────────────────────────────────────────────
function SourceTogglePill({
  active,
  onToggle,
  logoSrc,
  label,
  disabled = false,
  disabledHint,
}: {
  active: boolean;
  onToggle: () => void;
  logoSrc: string;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      title={disabled ? disabledHint : `Toggle ${label}`}
      className="hermes-mono inline-flex items-center gap-2 px-2.5 py-1 border text-[10.5px] uppercase tracking-[0.22em] transition-all disabled:cursor-not-allowed"
      style={{
        background: active ? "rgba(255,230,203,0.1)" : "transparent",
        color: disabled
          ? "rgba(255,230,203,0.35)"
          : active
            ? CREAM
            : "rgba(255,230,203,0.55)",
        borderColor: disabled
          ? "rgba(255,230,203,0.15)"
          : active
            ? CREAM
            : "rgba(255,230,203,0.35)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <img
        src={logoSrc}
        alt=""
        className="object-contain shrink-0"
        style={{
          width: 14,
          height: 14,
          opacity: disabled ? 0.4 : active ? 1 : 0.6,
        }}
      />
      {label}
      <span
        className="inline-block rounded-full ml-0.5"
        style={{
          width: 5,
          height: 5,
          background: disabled
            ? "rgba(255,230,203,0.2)"
            : active
              ? "#86efac"
              : "rgba(255,230,203,0.25)",
          boxShadow: active ? "0 0 6px rgba(134,239,172,0.6)" : "none",
        }}
      />
    </button>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="hermes-mono inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.2em]"
      style={{ color: "rgba(255,230,203,0.6)" }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 7,
          height: 7,
          background: color,
          boxShadow: `0 0 6px ${color}66`,
        }}
      />
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Canvas — the actual ForceGraph3D + custom node sprites + bloom pass.
// ────────────────────────────────────────────────────────────────────────────
function ConstellationCanvas({
  data,
  view,
  orbiting,
}: {
  data: { nodes: GraphNode[]; links: GraphLink[] };
  view: ViewMode;
  orbiting: boolean;
}) {
  const fgRef = useRef<any>(null);
  const [THREE, setThree] = useState<ThreeModule | null>(null);
  const [BloomPass, setBloomPass] = useState<UnrealBloomPassCtor | null>(null);
  const orbitingRef = useRef(orbiting);
  orbitingRef.current = orbiting;

  // Dynamically import three + UnrealBloomPass on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("three"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    ]).then(([threeMod, bloomMod]) => {
      if (cancelled) return;
      setThree(threeMod as unknown as ThreeModule);
      setBloomPass(() => bloomMod.UnrealBloomPass);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Wire up post-processing bloom + camera auto-orbit + force tuning
  // once the graph + three are both ready. Bloom = real glow on
  // emissives. Force tuning = nodes spread out instead of collapsing
  // into a tight ring around the hub.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !THREE || !BloomPass) return;

    // Custom forces — same pattern as the main dashboard graph. Default
    // forces collapse N spokes into a ring around the hub; tuned forces
    // push them outward by group. Per-link distance + stronger charge
    // repulsion = readable constellation.
    try {
      const charge = fg.d3Force?.("charge");
      if (charge) charge.strength(-220);
      const linkF = fg.d3Force?.("link");
      if (linkF) {
        linkF.distance((l: any) => {
          // Anchor link kinds to specific node group pairings so the
          // layout reads as concentric rings: personas closest, memory
          // mid, sessions outer.
          const target =
            (typeof l.target === "object" ? l.target.group : null) ?? "";
          switch (target) {
            case "persona":
              return 110;
            case "soul":
              return 140;
            case "user":
              return 170;
            case "memory":
              return 170;
            case "session":
              return 240;
            case "obsidian":
              return 220;
            default:
              return 130;
          }
        });
        linkF.strength(0.7);
      }
    } catch {
      /* graph not ready yet — useEffect will re-run when refs settle */
    }

    // Scene depth — soft ambient, key + rim point lights, fog, and a
    // starfield so the canvas reads as space rather than a flat panel.
    try {
      const scene = fg.scene?.();
      if (scene && !scene.userData.__memEnhanced) {
        scene.userData.__memEnhanced = true;
        scene.fog = new (THREE as any).FogExp2(0x000000, 0.0018);

        const amb = new THREE.AmbientLight(0xffe6cb, 0.4);
        scene.add(amb);

        const key = new THREE.PointLight(0xffd21e, 1.5, 1200, 1.4);
        key.position.set(120, 180, 200);
        scene.add(key);

        const rim = new THREE.PointLight(0x60a5fa, 0.7, 1000);
        rim.position.set(-220, -120, -160);
        scene.add(rim);

        // Starfield — 1200 points on a sphere shell at random radius.
        const starGeom = new (THREE as any).BufferGeometry();
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
        starGeom.setAttribute(
          "position",
          new (THREE as any).BufferAttribute(positions, 3),
        );
        const starMat = new (THREE as any).PointsMaterial({
          color: 0xffe6cb,
          size: 1.1,
          transparent: true,
          opacity: 0.55,
          sizeAttenuation: true,
          depthWrite: false,
        });
        const stars = new (THREE as any).Points(starGeom, starMat);
        stars.userData.__stars = true;
        scene.add(stars);
      }
    } catch {
      /* scene not ready */
    }

    // Bloom — only the brightest (Hermes hub + persona avatars) really pop.
    try {
      const composer =
        typeof fg.postProcessingComposer === "function"
          ? fg.postProcessingComposer()
          : null;
      const scene = fg.scene?.();
      if (composer && scene && !scene.userData.__bloom) {
        // Dialled WAY back from v1 — earlier values (0.95 / 0.25
        // threshold) turned the whole hub into a featureless white
        // blob. These settings let the Hermes core shimmer without
        // blowing out every emissive neighbour.
        const bloom = new BloomPass(
          new THREE.Vector2(800, 600),
          0.45, // strength
          0.65, // radius (wider, softer)
          0.72, // threshold — only the very brightest emissive blooms hard
        );
        composer.addPass(bloom);
        scene.userData.__bloom = bloom;
      }
    } catch {
      /* composer not ready — try again next render */
    }

    // Initial camera position
    try {
      fg.cameraPosition({ x: 0, y: 60, z: 420 });
    } catch {
      /* ignore */
    }

    // Auto-orbit camera, slow + cinematic
    let raf = 0;
    let angle = 0;
    const tick = () => {
      if (orbitingRef.current) {
        try {
          angle += 0.0012;
          const distance = 420;
          fg.cameraPosition({
            x: distance * Math.sin(angle),
            y: 80 + Math.sin(angle * 0.7) * 30,
            z: distance * Math.cos(angle),
          });
        } catch {
          /* ignore */
        }
      }

      // Per-frame Hermes effects:
      //   - __hermesPulse  → gentle breathing on the halo
      //   - __hermesSpin   → slow Y-axis rotation on the medallion so
      //                      its 3D thickness reads from any angle
      //   - __stars        → slow drift on the starfield
      try {
        const scene = fg.scene?.();
        if (scene) {
          const t = performance.now() * 0.001;
          scene.children.forEach((obj: any) => {
            if (obj.userData?.__hermesPulse) {
              const s = 1 + Math.sin(t * 2) * 0.04;
              obj.scale.set(s, s, s);
            }
            if (obj.userData?.__stars) {
              obj.rotation.y = t * 0.008;
            }
          });
          // Spin + wobble the portrait point clouds. Spinning gives the
          // constellation its 3D feel (depth ordering changes as it
          // rotates); the per-particle sin wave on z gives the surface
          // a gentle "breathing" motion that's much more alive than a
          // rigid spin.
          scene.traverse((obj: any) => {
            if (obj.userData?.__portraitPoints) {
              obj.rotation.y = t * 0.18;
              const orig = obj.userData.__portraitOriginal as Float32Array | undefined;
              const posAttr = obj.geometry?.attributes?.position;
              if (orig && posAttr) {
                const arr = posAttr.array as Float32Array;
                for (let i = 0; i < arr.length; i += 3) {
                  const x = orig[i] ?? 0;
                  const y = orig[i + 1] ?? 0;
                  const z = orig[i + 2] ?? 0;
                  // Wave parameter — distance from center + a slow phase
                  const r = Math.sqrt(x * x + y * y);
                  arr[i + 2] = z + Math.sin(t * 1.4 + r * 0.06) * 1.6;
                }
                posAttr.needsUpdate = true;
              }
            }
          });
        }
      } catch {
        /* ignore */
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [THREE, BloomPass]);

  // Texture cache for persona avatar sprites
  const textureCacheRef = useRef<Map<string, any>>(new Map());
  function getTexture(src: string) {
    if (!THREE) return null;
    const cache = textureCacheRef.current;
    if (cache.has(src)) return cache.get(src);
    const loader = new (THREE as any).TextureLoader();
    const tex = loader.load(src);
    cache.set(src, tex);
    return tex;
  }

  if (!THREE) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: CREAM }} />
      </div>
    );
  }

  // react-force-graph-3d's typings are loose; `any` keeps us out of the
  // SSR-vs-CSR type wrangling.
  const Graph: any = ForceGraph3D as unknown as any;

  return (
    <Graph
      ref={fgRef}
      graphData={data}
      backgroundColor="rgba(0,0,0,0)"
      nodeRelSize={5}
      nodeOpacity={1}
      // Use a custom three object per node so we can put the Hermes
      // portrait at the center + persona avatars on persona nodes + emissive
      // glowing spheres for the rest.
      nodeThreeObject={(n: any) => {
        const group = new (THREE as any).Group();
        const node = n as GraphNode;

        // HERMES — a particle constellation built from the actual pixels
        // of the portrait. Genuinely 3D (every point has its own xyz),
        // dynamic (slow rotation + sin-wave depth wobble), and matches
        // the Mnemosyne theme: memory as a swarm of glowing points that
        // collectively form a face.
        //
        // How: load the portrait into an offscreen canvas, sample its
        // pixels at a low resolution (~96x96), and for every non-bg
        // pixel push a particle at (x, y, tiny_random_z). Vertex colors
        // pull each particle's RGB from the source so the portrait's
        // own palette is preserved.
        //
        // The group is returned synchronously (force-graph needs that),
        // and the image-load + particle-build happens async — the
        // points get added to the group when ready.
        if (node.group === "hermes") {
          buildPortraitParticles(THREE, group, hermesPortrait);
          // Outer halo so the bloom pass picks up an aura where the
          // particles cluster densest.
          const haloGeom = new (THREE as any).SphereGeometry(60, 32, 32);
          const haloMat = new (THREE as any).MeshBasicMaterial({
            color: HERMES_GLOW,
            transparent: true,
            opacity: 0.05,
            side: (THREE as any).BackSide,
          });
          const halo = new (THREE as any).Mesh(haloGeom, haloMat);
          group.add(halo);

          group.userData.__hermesPulse = true;
          group.userData.__hermesSpin = true;
          return group;
        }

        // PERSONA — design call: kill the flat sprites. Personas now
        // render as simple cream-tinted emissive spheres so they read
        // as a uniform ring of "agents" around Hermes without competing
        // with the central portrait for attention.
        if (node.group === "persona") {
          const geom = new (THREE as any).SphereGeometry(6, 20, 20);
          const mat = new (THREE as any).MeshStandardMaterial({
            color: NODE_COLORS.persona,
            emissive: NODE_COLORS.persona,
            emissiveIntensity: 0.55,
            roughness: 0.35,
            metalness: 0.1,
          });
          const mesh = new (THREE as any).Mesh(geom, mat);
          group.add(mesh);
          return group;
        }

        // OBSIDIAN — purple cube. Slightly emissive so it reads as
        // distinct from the regular memory nodes, but well below the
        // bloom threshold so it doesn't turn into a white blob.
        if (node.group === "obsidian") {
          const geom = new (THREE as any).BoxGeometry(12, 12, 12);
          const mat = new (THREE as any).MeshStandardMaterial({
            color: NODE_COLORS.obsidian,
            emissive: NODE_COLORS.obsidian,
            emissiveIntensity: 0.6,
            roughness: 0.4,
            metalness: 0.1,
          });
          const mesh = new (THREE as any).Mesh(geom, mat);
          group.add(mesh);
          return group;
        }

        // Everything else — emissive spheres sized per group + view
        const baseR = (() => {
          if (view === "spheres") return 4 + (node.val ?? 2) * 1.2;
          if (view === "drift") return 3 + (node.val ?? 2) * 0.8;
          // structured
          switch (node.group) {
            case "soul":
              return 8;
            case "user":
              return 6;
            case "memory":
              return 6;
            case "session":
              return 4;
            default:
              return 5;
          }
        })();

        const geom =
          view === "drift"
            ? new (THREE as any).OctahedronGeometry(baseR, 0)
            : new (THREE as any).SphereGeometry(baseR, 24, 24);
        const color = NODE_COLORS[node.group];
        const mat = new (THREE as any).MeshStandardMaterial({
          color,
          emissive: color,
          // Lowered from v1 — these nodes used to bloom hard alongside
          // the Hermes core and washed the whole canvas out. Now only
          // SOUL gets a noticeable glow; the rest sit below the bloom
          // threshold and stay readable as distinct nodes.
          emissiveIntensity: node.group === "soul" ? 1.0 : 0.45,
          roughness: 0.4,
          metalness: 0.1,
        });
        const mesh = new (THREE as any).Mesh(geom, mat);
        group.add(mesh);

        // Soft outer halo on important nodes (SOUL is unique enough to
        // deserve a glow; HERMES already has its own halo above).
        if (node.group === "soul") {
          const haloMat = new (THREE as any).MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.12,
            side: (THREE as any).BackSide,
          });
          const halo = new (THREE as any).Mesh(
            new (THREE as any).SphereGeometry(baseR * 1.55, 20, 20),
            haloMat,
          );
          group.add(halo);
        }

        return group;
      }}
      nodeLabel={(n: any) => n.label || n.id}
      linkColor={(l: any) =>
        l.strength && l.strength > 0.5
          ? "rgba(255,230,203,0.45)"
          : "rgba(255,230,203,0.18)"
      }
      linkOpacity={0.6}
      linkWidth={(l: any) => (l.strength && l.strength > 0.5 ? 0.9 : 0.5)}
      enableNodeDrag={true}
      showNavInfo={false}
      warmupTicks={80}
      cooldownTicks={view === "drift" ? Infinity : 200}
    />
  );
}

// Re-export for convenience
export { PERSONA_AVATAR_BY_ID };
export default HermesMnemosyne;
