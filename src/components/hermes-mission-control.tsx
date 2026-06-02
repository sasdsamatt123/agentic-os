import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Trash2,
  Copy,
  RotateCcw,
} from "lucide-react";
import confetti from "canvas-confetti";
import athenaImg from "@/assets/hermes-art/mission-athena.webp";
// Hermes avatar — the same anime portrait the chat interface uses, not
// the small yellow pixel logo. The card avatar reuses the chat-bubble
// icon so the persona reads as continuous across surfaces.
import hermesPortrait from "@/assets/hermes-portrait.png";
// Hand-picked Athena clip — played at 0.7x so the motion stretches.
// Starts in grayscale and drains to color when the user hovers/touches the
// panel.
import athenaLoop from "@/assets/hermes-art/mission-athena-v2.mp4";
// Claude logo — still used as the card avatar on home + Claude pages.
import claudeLogo from "@/assets/claude-logo.png";
// Claude hero video — Higgsfield-generated clip. Compressed from a 45 MB
// 4K source down to ~3 MB at 1280×720 H.264, audio stripped, faststart
// header so the browser can begin playback before the full file lands.
// Plays on home + Claude pages. Hermes page still uses Athena.
import claudeVideo from "@/assets/claude-art/mission-claude.mp4";

// ────────────────────────────────────────────────────────────────────────────
// Operator avatar (mirrors the SidebarIdentity in app-sidebar.tsx). The
// dashboard wizard stores the uploaded avatar at localStorage key
// "claude-os.avatar.v1" and the operator's name at "claude-os.operator-name.v1".
// We read both so the mini-goal "You" cards show the same face the user sees
// on the rest of the dashboard.
// ────────────────────────────────────────────────────────────────────────────
const OPERATOR_AVATAR_KEY = "claude-os.avatar.v1";
const OPERATOR_NAME_KEY = "claude-os.operator-name.v1";

// ────────────────────────────────────────────────────────────────────────────
// AthenaPanel — reusable Athena media block. Forces the video to play (some
// browsers ignore autoplay when the element first mounts via HMR / React
// strict-mode double-render) and keeps the cloud loop quietly moving. ONE
// faint scan-line layer instead of the old three-layer chromatic mess Jack
// was reading as "stupid lines going up and down."
// ────────────────────────────────────────────────────────────────────────────
function AthenaPanel(
  panelProps: { minHeight?: number; agent?: MissionControlAgent } = {},
) {
  const minHeight = panelProps.minHeight ?? 460;
  // Athena is the Hermes-page hero. Home + Claude pages get a static
  // Claude logo on the same frame (same scan-lines, vignette, cream
  // border) so the visual language matches but the face changes.
  const isHermesAgent = panelProps.agent === "hermes";
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Color drains in ONCE — the moment the panel scrolls into view. After
  // that, stays in color. No going back to gray.
  const [colorActive, setColorActive] = useState(false);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    // Athena plays at 0.7× for the lingering Da Vinci feel. Claude
    // (Higgsfield clip) plays at native speed — it was authored at the
    // right cadence already.
    const rate = isHermesAgent ? 0.7 : 1.0;
    v.playbackRate = rate;
    const kick = () => {
      v.playbackRate = rate;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };
    kick();
    v.addEventListener("loadeddata", kick);
    return () => {
      v.removeEventListener("loadeddata", kick);
    };
  }, [isHermesAgent]);

  // Drain color in once. Two triggers (whichever fires first):
  //   1. IntersectionObserver if the panel is below the fold
  //   2. A short mount-delay so first-page-load Athena (which is already
  //      in view) still drains naturally
  // Once flipped on, stays on — no reverse.
  useEffect(() => {
    if (colorActive) return;
    const el = frameRef.current;
    let io: IntersectionObserver | null = null;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setColorActive(true);
              io?.disconnect();
              break;
            }
          }
        },
        { threshold: 0.25, rootMargin: "0px" },
      );
      io.observe(el);
    }
    // Fallback / first-paint trigger — if the panel is already visible
    // when the route mounts, drain in after a beat.
    const t = window.setTimeout(() => setColorActive(true), 700);
    return () => {
      io?.disconnect();
      window.clearTimeout(t);
    };
  }, [colorActive]);

  return (
    <div
      ref={frameRef}
      className="athena-frame relative overflow-hidden"
      style={{
        background: "#071D1C",
        borderRight: "1px solid rgba(255,230,203,0.25)",
        minHeight,
      }}
    >
      {isHermesAgent ? (
        <video
          ref={vidRef}
          src={athenaLoop}
          poster={athenaImg}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: "scale(1.04)",
            objectPosition: "center 40%",
            // Grayscale by default. Drain to full color on hover/touch over
            // 1.4s so the saturation creeps in rather than snapping.
            filter: colorActive
              ? "grayscale(0%) saturate(1.05)"
              : "grayscale(100%) saturate(0)",
            transition: "filter 1400ms cubic-bezier(.4,0,.2,1)",
          }}
        />
      ) : (
        // Claude hero — Higgsfield clip, cropped to a clean square at
        // the ffmpeg level. The source clip is framed with the figure's
        // head right at the top edge, so a pure edge-to-edge fill makes
        // his head touch the ceiling. Slight scale(0.96) + 4% downshift
        // gives him head-clearance while still filling the square ~96%
        // (much closer than the previous scale(0.86) matte).
        <video
          ref={vidRef}
          src={claudeVideo}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: "scale(0.96) translateY(4%)",
            transformOrigin: "center center",
            objectPosition: "center center",
            filter: colorActive
              ? "grayscale(0%) saturate(1.05)"
              : "grayscale(100%) saturate(0)",
            transition: "filter 1400ms cubic-bezier(.4,0,.2,1)",
          }}
        />
      )}
      {/* Faint scan-line overlay — texture only. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          mixBlendMode: "overlay",
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent 0 2px, rgba(255,230,203,0.04) 2px 3px)",
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,29,28,0.35) 0%, transparent 18%, transparent 78%, rgba(7,29,28,0.6) 100%)",
        }}
      />
      {/* Inner cream frame */}
      <div
        aria-hidden
        className="absolute inset-2 pointer-events-none"
        style={{ border: "1px solid rgba(255,230,203,0.45)" }}
      />
    </div>
  );
}

function useOperatorIdentity() {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setAvatar(window.localStorage.getItem(OPERATOR_AVATAR_KEY));
        setName(window.localStorage.getItem(OPERATOR_NAME_KEY));
      } catch {
        /* ignore */
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === OPERATOR_AVATAR_KEY || e.key === OPERATOR_NAME_KEY || e.key === null) {
        read();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const initials = useMemo(() => {
    const t = (name ?? "").trim();
    if (!t) return "OP";
    const parts = t.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "OP";
  }, [name]);
  return { avatar, name, initials };
}

// ────────────────────────────────────────────────────────────────────────────
// Hermes Mission Control
// ────────────────────────────────────────────────────────────────────────────
// ONE consolidated panel. No modals. No popups.
//
// Empty state = Athena image on the left, headline + selector + copy-paste
// prompt on the right. User picks Short-term goal (a /goal template) or
// Long-term mission (a comprehensive prompt that tells Hermes to decompose
// the mission and write it to ~/.hermes/missions.json directly). User pastes
// into the Hermes chat at the top of the page. Dashboard polls the file
// every 5 seconds and renders the mission the moment Hermes writes it.
//
// Active state = the mission card with the flowing-gradient bar + mini-goal
// cards. Tick = mini confetti. Drop = clears the file and returns to empty.
//
// Backend (unchanged from earlier):
//   GET  /__hermes_missions       → { mission | null }
//   POST /__hermes_missions/tick  → { mission }   (toggles a mini-goal)
//   POST /__hermes_missions/clear → { ok: true }
// ────────────────────────────────────────────────────────────────────────────

const CREAM = "#FFE6CB";
const HERMES_YELLOW = "#FFD21E";
const HERMES_AMBER = "#FFB300";
const GREEN = "#86efac";
// Status-light colours — used by the Mission Control header dot. These
// are deliberately MORE saturated/luminous than the brand cream/amber
// so the dot reads from across the room. STATUS_AMBER is a luminous
// gold (between the brand yellow and amber); STATUS_GREEN is a vivid
// emerald (a notch brighter than the pastel GREEN above so it pops).
const STATUS_GREEN = "#22e07a";
const STATUS_AMBER = "#FFC400";
const CODE_BG = "#0A1413";

type Actor = "hermes" | "human";
type Status = "queued" | "active" | "done";

interface MiniGoal {
  id: string;
  num: number;
  title: string;
  actor: Actor;
  done_when?: string;
  full_prompt?: string;
  estimate?: string;
  status: Status;
}

interface Mission {
  id: string;
  title: string;
  binary_outcome?: string;
  deadline_days: number;
  deadline_iso: string;
  created_at: string;
  mini_goals: MiniGoal[];
  image_path?: string | null;
}

async function getToken(): Promise<string> {
  try {
    const r = await fetch("/__token");
    const j = await r.json();
    return j.token;
  } catch {
    return "";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// THE PROMPT — paste-into-Hermes-chat copy. This is the whole product.
// Short-term /goal flow lives outside the dashboard (Notion free-resource).
// ────────────────────────────────────────────────────────────────────────────

// LONG_PROMPT_BODY is everything from "This is NOT a /goal run..." onward.
// The opening line gets personalised per page via buildLongPrompt() below:
//   - On the Hermes page → "You are Hermes acting as my…"
//   - On the Claude page → "You are Claude Code acting as my…"
//   - On the home page   → neutral "You are my strategic planning partner…"
// The behavioural rules and JSON contract stay 100% identical between
// versions, so a mission created from one page runs unchanged in the other
// runtime. Only the prompt's self-addressing changes.
const LONG_PROMPT_BODY = `This is NOT a /goal run. Don't activate the Ralph loop. Don't start the mini-goals. Your single job: take ONE great goal from me, interrogate me until you actually understand it, decompose it carefully, then POST the result to my local Mission Control endpoint.

## ONE tool call. Total.

The first and ONLY tool you call is in Step 4 — a curl POST. The HTTP response is the verification. No filesystem tools. No write_file. No python. Just curl.

## What appears in chat vs. what stays silent

You think in passes. I only see three things:
  1. Your one-line greeting.
  2. Clarifying questions and discovery questions, as clean numbered lists.
  3. The final "Mission set" confirmation after curl returns success.

That's it. **Do not** print labels like "Pass 1", "Pass 2a", "Vet:", "Draft:", "Critique:", "Completeness", "Building curl payload", "Server response:". **Do not** print the rubric back at me. **Do not** print the JSON payload before or after the curl. **Do not** narrate your reasoning. If you're about to dump a numbered audit of mini-goals into chat — stop. That's scratch paper, not output.

## The model

- Great goal = a ship-able outcome with a binary deliverable. YES or NO at the deadline.
- Decomposed into 4–10 mini-goals. Sweet spot 5–7. **HARD CAP at 10.**
- Each mini-goal has ONE actor: **agent** (tagged \`"hermes"\` in the JSON schema for backwards-compatibility — but it just means "an agent runs this", and either Hermes or Claude Code can pick the card up) or **human**. Tag using the decision tree below — don't guess.
- **NOT a "You" task:** approvals, reviews, sign-offs. Those happen in chat, not on the dashboard.
- The goal is complete only when every mini-goal is checked off.

### The actor rule — ONE question. The session boundary.

For each candidate mini-goal, ask exactly this:

> **Can the agent (Hermes or Claude Code) finish this inside a single working session — with me sitting in the chat, picking and tweaking and answering as needed — without me having to leave the chat to do something the agent can't do, or wait on someone outside the chat?**

  - **YES** → tag actor \`"hermes"\` (the schema name; semantically "an agent runs this"). Tag it that way no matter how many chat messages it takes, no matter how many decisions I make along the way. Within a session I am present. I pick, tweak, give the nod. The agent figures out tools and skills on its own and doesn't stop until the work ships. All of that is agent-runnable.
  - **NO** → tag actor \`"human"\`. The work cannot finish in this session because of one of:
    - I have to be elsewhere physically (recording on camera as myself, on a live call with another person, attending an event in person, signing a contract legally as myself, biometric checks)
    - We're blocked waiting on someone outside the chat (a collaborator's reply, a counterparty's signature, a vendor's confirmation)
    - The work needs real time to pass beyond a single session

That's the whole rule. The chat IS the work surface for everything an agent can do. The card flips to human only when the work cannot finish in a session.

### Examples — generic patterns, no specific brands or tools

  - Draft and send outreach to a list of prospects → **agent** (\`hermes\`)
  - Reply to a contact on round 3 of an email negotiation → **agent** (agent drafts, I tweak tone in chat until it sounds like me, agent sends)
  - Run a live call with another person → **human** (must leave the chat)
  - Pick the final cut from a long video edit → **agent** (agent walks me through scenes in chat, I pick)
  - Record on-camera content → **human** (face + voice as deliverable)
  - Reply blitz across launch week → **agent** (agent drafts, I approve in chat, agent posts — even hundreds of messages, still chat)
  - Sign a contract → **human** (legal act as me)
  - Attend an in-person event → **human** (physical presence)
  - Wait for an editor's first cut, then ship → **human** (third party we're blocked on)

### When in doubt, tag agent.

The chat absorbs almost everything. The bar for a human card is high: my body, my face, my voice, my legal name, my physical presence elsewhere, OR a third party we cannot progress without.

### Mixed missions → split into two sequential cards

If a candidate has both halves (preparation the agent can do alone + a real-world step that needs me out of the chat), split it into TWO cards: **agent prep → human execute**. The agent card delivers the artifact; the human card uses it.

Generic patterns:
  - "Pitch a prospect on a deal" → split: [agent: Pre-call brief on the prospect + draft of the offer] + [human: Run the call]
  - "Launch a video" → split: [agent: Upload + schedule + thumbnail/title variants] + [human: Record on-camera intro]
  - "Close a batch of deals" → split: [agent: Outreach + reply handling] + [human: Run the discovery calls]

## STEP 0 — Greet, then wait.

Reply with EXACTLY this single line and STOP. Wait for my next message:

"What's the great goal you want me to help you ship? Give me a sentence or short paragraph and I'll turn it into a structured mission."

Don't preface. Don't list the rubric. Just ask, then wait.

## STEP 1 — Vet the goal silently. Speak only to fix it.

Run the rubric against my reply WITHOUT showing your work:

  1. **Binary deliverable.** YES or NO at the deadline. Concrete artifact, count, or revenue figure.
  2. **Time horizon 7–42 days.** Less = single /goal. More = strategy, not execution.
  3. **Decomposes into ≤10 mini-goals.**
  4. **At least one human action and one agent action.** Human action = physical/real-world, NOT an approval.
  5. **Mine to do.** Not "help my friend launch X".
  6. **No vague verbs.** "Improve", "optimize", "grow", "polish" — reject unless paired with a count or artifact.

If ANY criterion fails, ask ONE specific clarifying question and stop. Don't list the rubric. Don't announce "vetting". Just ask the missing piece:

  - Missing binary → "What's the YES/NO check at the deadline — a number, an artifact, or a revenue figure?"
  - Too big → "That feels like 3+ months. What's the smallest version that's still a win in 4 weeks?"
  - Vague verb → "Say more — 'grow' how? More signups? More revenue? What's the number?"

Loop silently until the rubric passes. Then move to Step 2 without announcing it.

## STEP 2 — Discovery. ALWAYS run this step. No skipping.

Before you write a single mini-goal, you need to know where I actually am. A mission built without current-state context produces generic done_when fields and wastes 4 weeks. This is the most important step in the whole flow.

Generate **4–8 discovery questions tailored to MY specific goal**. Ask them as one clean numbered list. Cover, where relevant:

  - **Current state** — what's already built, written, recorded, shipped? Real numbers if any.
  - **Subject / scope** — what's the actual topic, niche, deliverable, audience?
  - **Access** — what accounts, credentials, or assets can I hand you to work with? Don't name specific tools — let me tell you.
  - **Constraints** — fixed deadlines, dependencies on other people, non-negotiables, third parties we'd be waiting on.
  - **Definition of "ready"** — what does shipped look like from MY point of view, not yours?
  - **Past attempts** — have I tried this before? What worked, what didn't, what reusable assets exist?
  - **Audience reality** — who am I shipping to, where do they live, how big is the warm pool?

The questions must be SHARP and SPECIFIC to my goal — never generic. Lazy: "what's your timeline?" Sharp: "You said 500 signups — what's the current list size, where does the warm pool live, and have you run a launch like this before?"

Wait for my answers. If my reply reveals new gaps, ONE follow-up round only (max 2 rounds total). Then move silently to Step 3.

## STEP 3 — Decompose. SILENT.

Internally — none of this appears in chat — run:

  - **Draft** — 4–10 mini-goal candidates. Title ≤5 words, actor (\`hermes\`/\`human\`), done_when ≤8 words.
  - **Critique** — each one: title is action-phrase H1, done_when is punchy and USES THE STATE I gave you (not generic phrasing), measurable, right-sized (agent card ≈ 20 turns; human = one session/call/event), self-served (the agent has every credential it needs), right actor (approvals ≠ human — delete them).
  - **Completeness + balance** — does the union actually ship the binary outcome? Is the actor split between 40/60 and 60/40? If not, rebalance.
  - **Author full_prompt for every mini-goal.** done_when is the *card label*. full_prompt is the *briefing the operator copies into whichever agent they're working with (Hermes or Claude Code) to actually execute that mini-goal*. Write each one from scratch using the discovery state — never a template. See the full_prompt spec below.

Lock the list. Pick deadline_days (default 28, range 7–42). Write a binary_outcome (≤12 words). Mission title is 6–8 words, no articles, ship-able statement.

### full_prompt spec — the briefing that gets copied from each card

The Copy button on each mini-goal card hands this string straight to the operator. It must stand on its own — the agent (Hermes, Claude Code, or any other /goal-capable agent) reads it cold and knows exactly what to ship.

For **agent** (\`hermes\`) mini-goals, write a /goal slash-command prompt that:
  - **MUST begin with the literal 6 characters \`/goal \` (forward slash, the word \`goal\`, then a single space)**. The user copies this string straight into their Claude Code or Hermes chat; if the \`/goal \` prefix is missing, the agent treats it as a normal message and the slash command doesn't fire. The FIRST character of the string is \`/\`. No leading whitespace, no markdown fence, no preamble before it.
  - Right after \`/goal \`, names the mission, mini-goal number, and the binary outcome so the agent knows the larger context.
  - States the specific deliverable using the state from discovery. Describe WHAT needs to be accomplished, not WHICH tools to use — the agent figures out tools on its own.
  - Notes which accounts, credentials, or assets I told you are available, ONLY if they exist (don't invent tool names; don't prescribe a stack).
  - Explicitly tells the agent: "I'll be in the chat session with you. Pause and ask me in chat any time you need a decision, a taste pick, a tone tweak, or any input — I'm there. Don't stall, don't guess, just ask."
  - Names a workspace folder for artifacts.
  - Ends with: cap at 20 turns then pause; do NOT self-tick the Mission Control card; leave a one-paragraph summary in the workspace when done.
  - 80–250 words. No fluff. Plain text, no markdown headers, agent-agnostic (don't say "Hermes" or "Claude Code" — say "you").

For **human** mini-goals, write a structured briefing with these 8 sections, in order. 120–200 words total. The human reads it cold and knows what to do in the next 30 seconds without thinking. Use generic placeholders unless I gave you specifics in discovery — never invent names of people, brands, or tools.

  1. **Headline** — verb-first imperative, ≤8 words. ("Run the 30-minute discovery call.")
  2. **Why this matters** — one sentence tying the action to the mission outcome.
  3. **When / Where** — concrete time window + location/setup, if known.
  4. **What you need on hand** — short checklist (3–5 items: gear, tabs, doc, login).
  5. **Next physical action** — the literal first 30 seconds of motion.
  6. **Definition of done** — the artifact or status update that marks it complete + where it lands so the agent can pick up.
  7. **Agent has prepared** — links/paths to upstream prep artifacts. Skip the section if there are none.
  8. **Time-box** — expected minutes including any follow-up dump.

Render each section with its label, then a colon, then the content. Plain text, no markdown headers. Skip a section only if it's genuinely N/A — never pad with fluff.

## STEP 4 — POST the mission. Then confirm.

Execute exactly this curl in your bash tool. Substitute the JSON you built between the heredoc markers. **Do NOT print the JSON in chat before or after the curl.**

curl -sS -X POST http://localhost:8081/__hermes_missions/create \\
  -H "Content-Type: application/json" \\
  --data @- <<'JSON_BODY'
{
  "title": "<6-8 word ship-able mission statement>",
  "binary_outcome": "<≤12 words: the YES/NO check at the deadline>",
  "deadline_days": 28,
  "mini_goals": [
    {
      "num": 1,
      "title": "<≤5 word action phrase>",
      "actor": "hermes",
      "done_when": "<≤8 words, contextual, uses state from discovery>",
      "full_prompt": "<self-contained briefing per the full_prompt spec above — 80–250 words for hermes, 30–80 for human>"
    }
  ]
}
JSON_BODY

Schema (strict — server will 400 on violation):
  - mission title: 6–8 words, no articles
  - binary_outcome: ≤12 words
  - mini_goal title: ≤5 words
  - mini_goal done_when: ≤8 words
  - mini_goal full_prompt: REQUIRED, plain text, written using discovery state
  - deadline_days: integer 7–42
  - mini_goals array: 4–10 items, num 1-indexed sequential
  - actor: exactly "hermes" or "human"
  - No estimate field, no emojis, no comments

Read the response. Branch:

  - **Starts with {"mission":{** → success. Reply with EXACTLY this single line and stop:
    "✓ Mission set: \\"<title>\\" — <N> mini-goals (<H> for the agent, <M> for you), ship-by <human deadline date>. Check your Mission Control panel."
  - **Starts with {"error":** → read the error, silently fix the payload, re-run. Try at most 3 times. If still failing, ONE line: "Endpoint rejected: <short reason>. Need to check the dashboard server." Stop.
  - **HTML / 404 / connection refused** → the dashboard isn't registering the endpoint. ONE line: "Dashboard endpoint not live at localhost:8081/__hermes_missions/create. Start the dashboard or check the vite route." Stop. Do NOT pretend the mission was set.

## Hard rules (read these every turn)

  - Greet → vet silently → discovery (always) → decompose silently → POST → confirm.
  - **No internal labels in chat.** Never "Pass 1", "Vet:", "Draft:", "Critique:", "Building curl payload", "Server response:". I see questions and a final confirmation. Nothing else.
  - **No JSON in chat.** The payload goes through curl. The dashboard renders it.
  - **Discovery is non-negotiable.** Skipping it = generic done_when = useless mission. If you're about to decompose without asking discovery questions, stop and ask them.
  - HARD CAP at 10 mini-goals. Sweet spot 5–7.
  - Mix is non-negotiable. All-agent or all-human = you misread the work.
  - **NEVER claim "Mission set" without a {"mission":{ response in your context.**
  - **done_when reads like a prompt to a contractor**, written using the specifics from discovery. Not "Five course emails ready to load" — "Five 800-word emails on <my topic> drafted in <my platform>".
  - Don't activate /goal. Don't spawn sub-agents. Don't start working on the mini-goals.`;

// buildLongPrompt — prepends a page-specific opening line to LONG_PROMPT_BODY.
// The body is agent-agnostic (it talks about "the agent" throughout); only
// the self-address at the top changes per page so the operator sees the
// runtime they're about to paste into named explicitly.
function buildLongPrompt(agent?: MissionControlAgent): string {
  const opening =
    agent === "hermes"
      ? "You are Hermes acting as my strategic planning partner for Mission Control — the layer above /goal."
      : agent === "claude-code"
        ? "You are Claude Code acting as my strategic planning partner for Mission Control — the layer above /goal."
        : "You are my strategic planning partner for Mission Control — the layer above /goal. Either of my agents (Hermes or Claude Code) can run this prompt; the output is identical and works in either runtime.";
  return `${opening}\n\n${LONG_PROMPT_BODY}`;
}

// ────────────────────────────────────────────────────────────────────────────

// `agent` controls the page-specific copy on the panel. The same mission
// data renders identically on all pages — the prop just swaps "Paste to
// Hermes" / "Paste to Claude Code" / neutral "Copy prompt" on the Copy
// buttons and the actor pill in the briefing. Defaults to neutral so the
// home dashboard's embed doesn't lean toward either runtime.
export type MissionControlAgent = "hermes" | "claude-code";

export function HermesMissionControl(
  props: { agent?: MissionControlAgent } = {},
) {
  // No intermediate `pageAgent` variable. SWC's transform consistently
  // renames any local binding named `pageAgent` to `pageAgent2` but
  // misses some JSX usages in long function bodies, producing a runtime
  // `pageAgent is not defined` ReferenceError. We bypass it entirely by
  // referencing `props.agent` directly at the JSX call site below —
  // property access is not subject to variable renaming.
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  async function refetch(silent = false) {
    try {
      const r = await fetch("/__hermes_missions");
      const j = await r.json();
      setMission(j.mission ?? null);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refetch();
  }, []);

  const done = useMemo(
    () => (mission?.mini_goals ?? []).filter((g) => g.status === "done").length,
    [mission],
  );
  const total = mission?.mini_goals.length ?? 0;
  // Use the EXACT decimal here so the bar fill ends exactly under the
  // milestone tick for the current goal. Rounding (e.g. 33% vs 33.33%)
  // happens only at the display label, never in the geometry.
  const pct = total > 0 ? (done / total) * 100 : 0;

  const daysLeft = useMemo(() => {
    if (!mission?.deadline_iso) return 0;
    const ms = new Date(mission.deadline_iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  }, [mission]);

  function fireMiniConfetti(rect: DOMRect) {
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({
      particleCount: 28,
      spread: 55,
      startVelocity: 22,
      gravity: 0.9,
      scalar: 0.7,
      ticks: 90,
      origin: { x, y },
      colors: ["#FFD21E", "#FFE6CB", "#86efac", "#FFB300", "#fff8d6"],
      disableForReducedMotion: true,
    });
  }

  async function toggle(goalId: string) {
    const el = cardRefs.current.get(goalId);
    const wasDone =
      mission?.mini_goals.find((g) => g.id === goalId)?.status === "done";
    if (mission) {
      setMission({
        ...mission,
        mini_goals: mission.mini_goals.map((g) =>
          g.id === goalId
            ? { ...g, status: wasDone ? "queued" : "done" }
            : g,
        ),
      });
    }
    if (!wasDone && el) fireMiniConfetti(el.getBoundingClientRect());
    try {
      const token = await getToken();
      const r = await fetch("/__hermes_missions/tick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-claude-os-token": token,
        },
        body: JSON.stringify({ goalId }),
      });
      const j = await r.json();
      if (j.mission) setMission(j.mission);
    } catch {
      void refetch();
    }
  }

  async function clearMission() {
    if (
      !confirm(
        "Drop this mission? You can paste a new long-term prompt right after.",
      )
    )
      return;
    const token = await getToken();
    await fetch("/__hermes_missions/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-claude-os-token": token,
      },
    });
    setMission(null);
  }

  return (
    <section className="mb-12">
      {/* SectionHead — matches the rest of the dashboard exactly */}
      <div
        className="px-1 pb-3 mb-4 flex items-end justify-between border-b gap-4"
        style={{ borderColor: "rgba(255,230,203,0.55)" }}
      >
        <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
          <h2
            className="hermes-display leading-none inline-flex items-center gap-2.5"
            style={{ color: CREAM, fontSize: "26px", letterSpacing: "0.01em" }}
          >
            {/* Status light — vivid green when a mission is active,
                bright amber-gold when idle. Always visible next to the
                title. `items-center` on the flex keeps the dot
                optically centred against the cap-height of the 26px
                display glyphs (a few px above the text midpoint).
                Tiny extra translateY trims that to feel hand-placed. */}
            <span
              aria-label={mission ? "Mission active" : "No mission active"}
              title={mission ? "Mission active" : "No mission active"}
              className="inline-block shrink-0"
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: mission ? STATUS_GREEN : STATUS_AMBER,
                boxShadow: mission
                  ? `0 0 14px ${STATUS_GREEN}, 0 0 4px ${STATUS_GREEN}, inset 0 0 2px rgba(255,255,255,0.6)`
                  : `0 0 14px ${STATUS_AMBER}, 0 0 4px ${STATUS_AMBER}, inset 0 0 2px rgba(255,255,255,0.6)`,
                animation: "missionPulse 1.8s ease-in-out infinite",
                transform: "translateY(-1px)",
                transition: "background 220ms ease, box-shadow 220ms ease",
              }}
            />
            Mission Control
          </h2>
          {mission && (
            <span
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] inline-flex items-center gap-2"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              <span
                className="inline-block"
                style={{
                  width: 6,
                  height: 6,
                  background: HERMES_YELLOW,
                  boxShadow: `0 0 8px ${HERMES_YELLOW}`,
                  animation: "missionPulse 1.8s ease-in-out infinite",
                }}
              />
              Active · {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining
            </span>
          )}
        </div>
        {mission && (
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              {done} of {total} complete
            </span>
            <button
              type="button"
              onClick={clearMission}
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,230,203,0.55)",
                borderColor: "rgba(255,230,203,0.25)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fca5a5";
                e.currentTarget.style.borderColor = "rgba(252,165,165,0.55)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,230,203,0.55)";
                e.currentTarget.style.borderColor = "rgba(255,230,203,0.25)";
              }}
              title="Drop this mission"
            >
              <Trash2 size={11} /> Drop
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingPanel />
      ) : !mission ? (
        <EmptyPanel onRefresh={() => refetch(true)} agent={props.agent} />
      ) : (
        <MissionBody
          mission={mission}
          pct={pct}
          total={total}
          onToggle={toggle}
          cardRefs={cardRefs}
          agent={props.agent}
        />
      )}

      <style>{`
        @keyframes missionPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes missionFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
      `}</style>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LOADING
// ────────────────────────────────────────────────────────────────────────────
function LoadingPanel() {
  return (
    <div
      className="border flex items-center justify-center"
      style={{
        borderColor: "rgba(255,230,203,0.4)",
        background: "rgba(0,0,0,0.18)",
        padding: "48px",
        color: "rgba(255,230,203,0.5)",
      }}
    >
      <Loader2 className="animate-spin" size={20} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — ONE consolidated panel
// ────────────────────────────────────────────────────────────────────────────
function EmptyPanel(emptyProps: {
  onRefresh: () => void;
  agent?: MissionControlAgent;
}) {
  const { onRefresh } = emptyProps;
  const [copied, setCopied] = useState(false);
  // Page-aware prompt — "You are Hermes…" / "You are Claude Code…" /
  // neutral on home. Same body, only the self-address changes.
  const longPrompt = buildLongPrompt(emptyProps.agent);

  // Poll for missions.json every 5s while empty. The moment an agent writes
  // the file (from the pasted long-term prompt), the panel re-renders with
  // the live mission.
  useEffect(() => {
    const id = setInterval(onRefresh, 5000);
    return () => clearInterval(id);
  }, [onRefresh]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(longPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }

  return (
    <section
      className="border"
      style={{
        borderColor: "rgba(255,230,203,0.55)",
        background: "rgba(0,0,0,0.25)",
      }}
    >
      {/* Body — tall hero left (Athena on Hermes page, Claude logo on
          home + Claude pages), content right. */}
      <div className="grid grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)] items-stretch">
        <AthenaPanel minHeight={380} agent={emptyProps.agent} />

        <div className="px-6 md:px-9 py-6 md:py-8 flex flex-col gap-5 min-w-0">
          <div
            className="hermes-display"
            style={{
              color: CREAM,
              fontSize: "clamp(30px, 3.2vw, 44px)",
              letterSpacing: "-0.018em",
              lineHeight: 1,
              fontWeight: 600,
              textWrap: "balance",
            }}
          >
            Every hero needs a{" "}
            <span
              style={{
                color: HERMES_YELLOW,
                textShadow: "0 0 24px rgba(255,210,30,0.25)",
              }}
            >
              great goal.
            </span>
          </div>

          {/* Copy block — matches RunInTerminalCard pattern */}
          <div
            className="border"
            style={{ borderColor: "rgba(255,230,203,0.55)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2 border-b"
              style={{ borderColor: "rgba(255,230,203,0.4)" }}
            >
              <span
                className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,230,203,0.65)" }}
              >
                Long-term mission prompt
              </span>
              <button
                type="button"
                onClick={copy}
                className="hermes-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors inline-flex items-center gap-1.5"
                style={{ color: copied ? GREEN : CREAM }}
              >
                {copied ? (
                  <>
                    <Check size={12} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy prompt
                  </>
                )}
              </button>
            </div>
            <div
              className="px-5 py-4 max-h-[180px] overflow-y-auto"
              style={{ background: CODE_BG }}
            >
              <pre
                className="hermes-mono text-[12px] whitespace-pre-wrap break-words m-0"
                style={{
                  color: CREAM,
                  fontFamily:
                    '"Courier Prime", "Courier New", ui-monospace, monospace',
                  lineHeight: 1.55,
                  letterSpacing: 0,
                }}
              >
                {longPrompt}
              </pre>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onRefresh()}
              className="hermes-mono inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[10px] uppercase tracking-[0.18em] transition-colors"
              style={{
                background: "transparent",
                color: "rgba(255,230,203,0.65)",
                borderColor: "rgba(255,230,203,0.3)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = CREAM)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor =
                  "rgba(255,230,203,0.3)")
              }
            >
              <RotateCcw size={11} /> Check now
            </button>
            <span
              className="hermes-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.55)" }}
            >
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: GREEN,
                  boxShadow: `0 0 8px ${GREEN}`,
                  animation: "missionPulse 1.8s ease-in-out infinite",
                }}
              />
              Watching ~/.hermes/missions.json
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MISSION BODY — Athena video left, header + 5-up card grid + click-to-expand
// detail panel on the right. Mirrors the empty state's chrome.
// ────────────────────────────────────────────────────────────────────────────
function MissionBody(bodyProps: {
  mission: Mission;
  pct: number;
  total: number;
  onToggle: (id: string) => void;
  cardRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
  agent?: MissionControlAgent;
}) {
  const { mission, pct, total, onToggle, cardRefs } = bodyProps;
  const deadlineLabel = new Date(mission.deadline_iso).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" },
  );
  const done = mission.mini_goals.filter((g) => g.status === "done").length;

  return (
    <section
      className="border"
      style={{
        borderColor: "rgba(255,230,203,0.55)",
        background: "rgba(0,0,0,0.25)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)] items-stretch">
        {/* LEFT — Hero panel. Athena on the Hermes page; Claude logo on
            home + Claude pages. Same frame, different face. */}
        <AthenaPanel minHeight={460} agent={bodyProps.agent} />

        {/* RIGHT — mission header + status + horizontal scroll cards.
            Eyebrow line ("Goal · by Jun 15") removed: redundant with the
            "Active · N days remaining" pill in the section header above,
            and the saved vertical lets the whole panel fit the viewport
            without scrolling. */}
        <div className="px-6 md:px-8 py-4 md:py-5 flex flex-col gap-3 min-w-0">
          <div>
            {/* H1 — the mission title, the headline. */}
            <div
              className="hermes-display"
              style={{
                color: CREAM,
                fontSize: "clamp(20px, 1.85vw, 26px)",
                letterSpacing: "-0.005em",
                lineHeight: 1.08,
              }}
            >
              {mission.title}
            </div>
            {mission.binary_outcome && (
              // Small subtitle — the binary outcome lives one register down,
              // not glued to the H1.
              <div
                className="text-[12.5px] mt-1.5 max-w-2xl"
                style={{
                  color: "rgba(255,230,203,0.62)",
                  fontFamily: '"Fraunces", serif',
                  lineHeight: 1.5,
                }}
              >
                {mission.binary_outcome}
              </div>
            )}
          </div>

          {/* Status line + pagination arrows */}
          <MissionGoalRail
            mission={mission}
            done={done}
            total={total}
            pct={pct}
            onToggle={onToggle}
            cardRefs={cardRefs}
            agent={bodyProps.agent}
          />
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// GoalPanel — single mini-goal at a time. Pagination dots + arrows.
// Renders a clear Mark-complete tick. Copy-as-prompt is the full Hermes-
// ready /goal prompt (mission context + goal + done_when), not just the
// done_when text.

// ────────────────────────────────────────────────────────────────────────────
// Time visualization — parse an estimate string into a 0–9 pip count so each
// card shows a caloric bar of how long this mini-goal takes relative to a
// 2-week ceiling. Bigger investment → more filled pips.
// ────────────────────────────────────────────────────────────────────────────
function estimateToPips(estimate: string | undefined): number {
  if (!estimate) return 2;
  const e = estimate.toLowerCase();
  // Minutes
  const min = e.match(/(\d+)\s*min/);
  if (min) {
    const m = parseInt(min[1], 10);
    if (m <= 15) return 1;
    if (m <= 45) return 2;
    return 3;
  }
  // Hours
  const hr = e.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour)/);
  if (hr) {
    const h = parseFloat(hr[1]);
    if (h <= 1) return 3;
    if (h <= 4) return 4;
    return 5;
  }
  // Days
  const day = e.match(/(\d+)\s*day/);
  if (day) {
    const d = parseInt(day[1], 10);
    if (d <= 1) return 6;
    if (d <= 3) return 7;
    return 8;
  }
  // Weeks
  const wk = e.match(/(\d+)\s*week/);
  if (wk) {
    const w = parseInt(wk[1], 10);
    return Math.min(9, 7 + w);
  }
  // Session / live / in-person / call → mid-low
  if (/(session|live|in[ -]person|call|meeting)/.test(e)) return 3;
  return 2;
}

// ────────────────────────────────────────────────────────────────────────────
// buildCopyText — shared by the card's Copy button and the BriefingDrawer.
// Prefers the Hermes-authored full_prompt (rich, context-aware), falls back
// to a synthesized template for legacy missions that pre-date the field.
// ────────────────────────────────────────────────────────────────────────────
function buildCopyText(
  goal: MiniGoal,
  mission: Mission,
  index: number,
  total: number,
  opName: string | null,
): string {
  const authored = goal.full_prompt?.trim();
  if (authored) {
    // SAFETY NET: agent (hermes) cards MUST start with the literal "/goal "
    // slash command so Claude Code / Hermes recognise the prompt when the
    // user pastes it. Legacy missions and older Hermes runs sometimes drop
    // the prefix — auto-prepend if it's missing. Human cards stay as-is
    // (they're briefings for the operator, not slash commands).
    if (goal.actor === "hermes" && !authored.match(/^\/goal\b/)) {
      return `/goal ${authored}`;
    }
    return authored;
  }
  const missionSlug = mission.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const deadlineDate = new Date(mission.deadline_iso).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );
  if (goal.actor === "hermes") {
    return `/goal CONTEXT: This is mini-goal ${index + 1} of ${total} in my long-term mission "${mission.title}".
Mission deadline: ${deadlineDate}.
Mission binary outcome: ${mission.binary_outcome || "(see Mission Control panel)"}

MINI-GOAL: ${goal.title}
${goal.done_when ? `Done when: ${goal.done_when}` : ""}

INSTRUCTIONS:
- Use any relevant skills you have (code execution, file write, browser, terminal, web search) to ship this autonomously.
- Save any artifacts you produce under ~/Desktop/${missionSlug}/ — create the folder if it doesn't exist.
- When the "Done when" condition is met, leave a one-paragraph summary at ~/Desktop/${missionSlug}/${String(goal.num).padStart(2, "0")}-summary.md
- Cap at 20 turns, then pause for review.
- Do NOT mark Mission Control complete yourself — I'll tick it in the panel.`;
  }
  return `${opName?.trim() || "You"}'s gating action for the "${mission.title}" mission:

${goal.title}

${goal.done_when ? `Done when: ${goal.done_when}` : ""}

Hermes can't proceed past this point until you've done this in the real world.`;
}

// ────────────────────────────────────────────────────────────────────────────
// formatHumanBrief — turns the Hermes-authored human briefing text into a
// structured list of {label, content} blocks. The prompt asks for 8 labelled
// sections (Headline / Why / When-Where / What you need / Next action / Done /
// Hermes prepared / Time-box). We detect those labels at line starts and split
// the text into blocks. Falls back gracefully if the briefing is prose-only.
// ────────────────────────────────────────────────────────────────────────────
const HUMAN_BRIEF_LABELS = [
  { match: /^headline\s*:/i, label: "Headline" },
  { match: /^why( this matters)?\s*:/i, label: "Why this matters" },
  { match: /^when ?\/ ?where\s*:/i, label: "When / Where" },
  { match: /^what you need( on hand)?\s*:/i, label: "What you need on hand" },
  { match: /^next( physical)? action\s*:/i, label: "Next physical action" },
  {
    match: /^(definition of )?done( when)?\s*:/i,
    label: "Definition of done",
  },
  {
    // Match the new agent-neutral label AND the legacy "Hermes has prepared"
    // for missions created before the rename.
    match: /^(agent|hermes) (has )?prepared\s*:/i,
    label: "Agent has prepared",
  },
  { match: /^time[- ]?box\s*:/i, label: "Time-box" },
];

function formatHumanBrief(text: string): { label: string | null; content: string }[] {
  const lines = text.split("\n");
  const blocks: { label: string | null; content: string }[] = [];
  let current: { label: string | null; content: string } | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    let matched = false;
    for (const { match, label } of HUMAN_BRIEF_LABELS) {
      if (match.test(line.trimStart())) {
        if (current) blocks.push(current);
        const colonIdx = line.indexOf(":");
        const content = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : "";
        current = { label, content };
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (current) {
        current.content = current.content
          ? current.content + "\n" + line
          : line;
      } else if (line.trim()) {
        // No section detected yet — collect as a prose-only opening block.
        if (!blocks.length || blocks[blocks.length - 1].label) {
          blocks.push({ label: null, content: line });
        } else {
          blocks[blocks.length - 1].content += "\n" + line;
        }
      }
    }
  }
  if (current) blocks.push(current);
  // If no labels were detected at all, return a single prose block (the
  // briefing is unstructured but still render-able).
  if (blocks.every((b) => !b.label) && blocks.length > 1) {
    return [{ label: null, content: blocks.map((b) => b.content).join("\n") }];
  }
  return blocks;
}

// ────────────────────────────────────────────────────────────────────────────
// BriefingModal — opens as a centered fixed-position popup overlay when a
// mini-goal card is clicked. The page underneath stays completely untouched
// (no layout shift, no scroll jump). Athena, mission header, and the rail
// are all visible behind a dim backdrop.
//
// Switching cards (←/→ keys, or clicking another card while open) cross-
// fades the modal contents in-place — never collapses + re-opens. Esc or
// click on the backdrop closes.
//
// Declared ABOVE MissionGoalRail because Vite's React Fast Refresh
// transform doesn't reliably hoist later-declared function components.
// ────────────────────────────────────────────────────────────────────────────
function BriefingDrawer(briefProps: {
  goal: MiniGoal | null;
  mission: Mission;
  index: number;
  total: number;
  onClose: () => void;
  onToggle: () => void;
  agent?: MissionControlAgent;
}) {
  const {
    goal,
    mission,
    index,
    total,
    onClose,
    onToggle,
  } = briefProps;
  // Keep the LAST goal around during the close animation so the content
  // doesn't blank-flash on the way out.
  const [renderedGoal, setRenderedGoal] = useState<MiniGoal | null>(goal);
  useEffect(() => {
    if (goal) {
      setRenderedGoal(goal);
      return;
    }
    const t = setTimeout(() => setRenderedGoal(null), 200);
    return () => clearTimeout(t);
  }, [goal?.id, goal]);

  const isOpen = !!goal;
  const { name: opName } = useOperatorIdentity();
  const [copied, setCopied] = useState(false);

  const displayGoal = goal ?? renderedGoal;
  const copyText = displayGoal
    ? buildCopyText(displayGoal, mission, index >= 0 ? index : 0, total, opName)
    : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }

  if (!isOpen && !renderedGoal) return null;

  const isHermes = displayGoal?.actor === "hermes";
  const isDone = displayGoal?.status === "done";
  const goalNum = displayGoal?.num ?? 0;
  // The schema value "hermes" means "an agent runs this" — either Hermes
  // or Claude Code can pick the card up. The pill label respects the page
  // context: "Hermes" on the Hermes page, "Claude Code" on the Claude Code
  // page, neutral "Agent" on the home dashboard.
  const agentLabel =
    briefProps.agent === "hermes"
      ? "Hermes"
      : briefProps.agent === "claude-code"
        ? "Claude Code"
        : "Agent";
  const actorLabel = isHermes ? agentLabel : opName?.trim() || "You";
  const humanBlocks = !isHermes && displayGoal ? formatHumanBrief(copyText) : null;

  // The briefing is absolutely positioned inside the parent's fixed-height
  // stage (the rail container). It cross-fades with the cards rail rather
  // than pushing the page taller. Athena and the page below never move.

  return (
    <div
      role="region"
      aria-label="Mini-goal briefing"
      aria-hidden={!isOpen}
      style={{
        position: "absolute",
        inset: 0,
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        // Slight delay on open so the cards finish fading out first; quick
        // out on close so the cards reappear fast.
        transition: isOpen
          ? "opacity 240ms cubic-bezier(.32,.72,0,1) 60ms"
          : "opacity 180ms cubic-bezier(.32,.72,0,1)",
      }}
    >
      {/* Inner wrapper — fills the stage. */}
      <div style={{ height: "100%" }}>
        <div
          key={displayGoal?.id}
          className="relative border briefing-fade-in"
          style={{
            borderColor: "rgba(255,210,30,0.45)",
            background:
              "linear-gradient(180deg, rgba(7,29,28,0.72) 0%, rgba(7,29,28,0.56) 100%)",
            // Generous padding — magazine-feel, not Notion-block-feel.
            padding: "22px 28px 20px 28px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            // overflow:hidden gives the inner body div a real height
            // constraint, so its `overflowY: auto` actually engages and
            // long /goal prompts scroll instead of spilling out.
            overflow: "hidden",
            boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
          }}
        >
          {/* Header — goal counter, actor tag, close button. */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span
                className="hermes-mono text-[10.5px] uppercase tracking-[0.28em]"
                style={{ color: HERMES_YELLOW }}
              >
                Briefing
              </span>
              <span
                className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,230,203,0.55)" }}
              >
                Goal {goalNum} / {total}
              </span>
              <span
                className="hermes-mono text-[10px] uppercase tracking-[0.22em] px-2 py-[3px] border"
                style={{
                  color: isHermes ? HERMES_YELLOW : CREAM,
                  borderColor: isHermes
                    ? "rgba(255,210,30,0.55)"
                    : "rgba(255,230,203,0.55)",
                  background: isHermes
                    ? "rgba(255,210,30,0.08)"
                    : "rgba(255,230,203,0.08)",
                }}
              >
                {actorLabel}
              </span>
              {isDone && (
                <span
                  className="hermes-mono text-[10px] uppercase tracking-[0.22em] px-2 py-[3px]"
                  style={{
                    color: GREEN,
                    border: `1px solid ${GREEN}`,
                    background: "rgba(134,239,172,0.08)",
                  }}
                >
                  ✓ Complete
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close briefing"
              title="Close (Esc)"
              className="hermes-mono inline-flex items-center justify-center border text-[12px] transition-colors shrink-0"
              style={{
                width: 28,
                height: 28,
                background: "transparent",
                color: "rgba(255,230,203,0.85)",
                borderColor: "rgba(255,230,203,0.4)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = CREAM;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)";
              }}
            >
              ✕
            </button>
          </div>

          {/* H1 — the action title. Title Case (per the source string) —
              no uppercase transform, since all-caps reads slower for long
              briefing headers. */}
          <div
            className="hermes-display"
            style={{
              color: CREAM,
              fontSize: "clamp(22px, 1.8vw, 30px)",
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
              marginBottom: 6,
            }}
          >
            {displayGoal?.title}
          </div>

          {/* H2 — done_when, serif italic. */}
          {displayGoal?.done_when && (
            <div
              className="text-[14px]"
              style={{
                color: "rgba(255,230,203,0.72)",
                fontFamily: '"Fraunces", serif',
                fontStyle: "italic",
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {displayGoal.done_when}
            </div>
          )}

          {/* Hairline amber rule — blueprint detail. */}
          <div
            aria-hidden
            style={{
              height: 1,
              width: "100%",
              background:
                "linear-gradient(90deg, rgba(255,210,30,0.55) 0%, rgba(255,210,30,0) 100%)",
              marginBottom: 14,
            }}
          />

          {/* Brief body. Hermes → mono code-block (the /goal prompt reads
              like a CLI command, treat it as code). Human → parsed 8-section
              briefing with eyebrow labels + serif body so each section is
              its own visible block, not one wall of text. */}
          <div
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            {isHermes ? (
              <div
                className="hermes-mono"
                style={{
                  color: "rgba(255,230,203,0.92)",
                  background: CODE_BG,
                  border: "1px solid rgba(255,210,30,0.25)",
                  padding: "18px 20px",
                  fontFamily:
                    '"Courier Prime", "Courier New", ui-monospace, monospace',
                  fontSize: 13.5,
                  lineHeight: 1.68,
                  letterSpacing: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {copyText}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {(humanBlocks ?? []).map((block, i) =>
                  block.label ? (
                    <div key={`${block.label}-${i}`}>
                      <div
                        className="hermes-mono text-[10px] uppercase tracking-[0.3em] mb-2"
                        style={{ color: HERMES_YELLOW }}
                      >
                        {block.label}
                      </div>
                      <div
                        style={{
                          color: CREAM,
                          fontFamily: '"Fraunces", serif',
                          fontSize: 16,
                          lineHeight: 1.65,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {block.content}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={`prose-${i}`}
                      style={{
                        color: "rgba(255,230,203,0.88)",
                        fontFamily: '"Fraunces", serif',
                        fontSize: 16,
                        lineHeight: 1.65,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {block.content}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Footer — Copy + Mark-done. */}
          <div
            className="flex items-stretch gap-2 mt-4"
            style={{ position: "relative", zIndex: 1 }}
          >
            <button
              type="button"
              onClick={handleCopy}
              className="hermes-mono inline-flex items-center justify-center gap-1.5 px-3 border text-[10px] uppercase tracking-[0.22em] transition-colors flex-1"
              style={{
                background: copied
                  ? "rgba(134,239,172,0.12)"
                  : "rgba(255,210,30,0.10)",
                color: copied ? GREEN : HERMES_YELLOW,
                borderColor: copied
                  ? "rgba(134,239,172,0.55)"
                  : "rgba(255,210,30,0.55)",
                height: 38,
                cursor: "pointer",
              }}
            >
              {copied ? (
                <>
                  <Check size={13} /> Copied to clipboard
                </>
              ) : (
                <>
                  <Copy size={13} />{" "}
                  {isHermes
                    ? briefProps.agent === "hermes"
                      ? "Paste to Hermes"
                      : briefProps.agent === "claude-code"
                        ? "Paste to Claude"
                        : "Copy /goal prompt"
                    : "Copy briefing"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onToggle}
              aria-label={isDone ? "Mark not complete" : "Mark complete"}
              className="hermes-mono inline-flex items-center justify-center gap-1.5 px-3 border text-[10px] uppercase tracking-[0.22em] transition-colors"
              style={{
                background: isDone ? GREEN : "transparent",
                color: isDone ? "#071D1C" : CREAM,
                borderColor: isDone ? GREEN : "rgba(255,230,203,0.4)",
                height: 38,
                cursor: "pointer",
                minWidth: 160,
              }}
              onMouseEnter={(e) => {
                if (!isDone) e.currentTarget.style.borderColor = CREAM;
              }}
              onMouseLeave={(e) => {
                if (!isDone)
                  e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)";
              }}
            >
              <Check size={13} />{" "}
              {isDone ? "Mark not done" : "Mark complete"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .briefing-fade-in {
          animation: briefFadeIn 220ms cubic-bezier(.32,.72,0,1);
        }
        @keyframes briefFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MissionGoalRail — horizontal scroll, 3 cards visible at a time, with
// prev/next arrow buttons. Click any card to expand its briefing in a drawer
// directly below the rail; Athena and the mission header stay locked.
// ────────────────────────────────────────────────────────────────────────────
function MissionGoalRail(railProps: {
  mission: Mission;
  done: number;
  total: number;
  pct: number;
  onToggle: (id: string) => void;
  cardRefs: React.MutableRefObject<Map<string, HTMLButtonElement | null>>;
  agent?: MissionControlAgent;
}) {
  const {
    mission,
    done,
    total,
    pct,
    onToggle,
    cardRefs,
  } = railProps;
  // Native horizontal scroll PLUS Prev/Next buttons. The user can drag /
  // trackpad-swipe / wheel through the cards freely; the buttons offer a
  // discrete one-card step. Whichever they prefer.
  const VISIBLE = 3;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    firstVisible: 1,
    lastVisible: Math.min(total, VISIBLE),
    canPrev: false,
    canNext: total > VISIBLE,
  });

  // Briefing-drawer state: one card can be expanded at a time. Lifted up to
  // the rail (was per-card local state in v1) so a single drawer below the
  // rail can host the brief while the rail acts as the navigation spine.
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const activeIndex = activeGoalId
    ? mission.mini_goals.findIndex((g) => g.id === activeGoalId)
    : -1;
  const activeGoal = activeIndex >= 0 ? mission.mini_goals[activeIndex] : null;

  // Keyboard: Esc closes the drawer; ← / → switch briefs while open; digits
  // 1–9 jump straight to that goal's brief (cinematic, console-feel).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing in inputs / textareas / contentEditable.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (activeGoalId && e.key === "Escape") {
        setActiveGoalId(null);
        e.preventDefault();
        return;
      }
      if (
        activeGoalId &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        const idx = mission.mini_goals.findIndex(
          (g) => g.id === activeGoalId,
        );
        if (idx < 0) return;
        const nextIdx =
          e.key === "ArrowRight"
            ? Math.min(mission.mini_goals.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        if (nextIdx !== idx) {
          setActiveGoalId(mission.mini_goals[nextIdx].id);
          e.preventDefault();
        }
        return;
      }
      if (!activeGoalId && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < mission.mini_goals.length) {
          setActiveGoalId(mission.mini_goals[idx].id);
          e.preventDefault();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeGoalId, mission.mini_goals]);

  // When the active goal changes, scroll the rail so the active card sits
  // ~1/3 from the left (Asana famously got centred-scroll wrong; ~1/3 lets
  // the operator see what's NEXT while focused on the brief).
  useEffect(() => {
    if (!activeGoalId || !scrollRef.current) return;
    const cardEl = scrollRef.current.querySelector(
      `[data-goal-id="${activeGoalId}"]`,
    ) as HTMLElement | null;
    if (!cardEl) return;
    const container = scrollRef.current;
    const targetLeft = cardEl.offsetLeft - container.clientWidth / 3;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }, [activeGoalId]);

  function scrollByCards(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.clientWidth / VISIBLE;
    el.scrollBy({ left: cardWidth * direction, behavior: "smooth" });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const cardWidth = el.clientWidth / VISIBLE;
      if (cardWidth <= 0) return;
      const startIdx = Math.round(el.scrollLeft / cardWidth);
      const first = Math.max(0, Math.min(total - 1, startIdx));
      const last = Math.min(total, first + VISIBLE);
      setScrollState({
        firstVisible: first + 1,
        lastVisible: last,
        canPrev: el.scrollLeft > 8,
        canNext: el.scrollLeft < el.scrollWidth - el.clientWidth - 8,
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [total]);

  const { firstVisible, lastVisible, canPrev, canNext } = scrollState;

  const briefingOpen = activeGoalId !== null;
  // Fixed-height stage that hosts EITHER the cards rail OR the briefing.
  // Switching modes is a cross-fade in place. The dashboard's vertical
  // layout never shifts once a mission is loaded.
  // Sized so the whole Mission Control panel fits a 13" laptop viewport
  // without scrolling (~700–800px tall page area). Athena's column
  // (items-stretch) scales with the right column.
  const STAGE_HEIGHT = 420;

  return (
    <div className="flex flex-col gap-4">
      {/* PROGRESS BAR — taller (14px), with milestone ticks for each mini-
          goal so you can feel progress as discrete stations, not just a %. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: "rgba(255,230,203,0.55)" }}
          >
            Progress
          </span>
          <span
            className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: CREAM }}
          >
            {done} of {total}
            <span style={{ color: "rgba(255,230,203,0.4)" }}> · </span>
            <span style={{ color: HERMES_YELLOW }}>{Math.round(pct)}%</span>
          </span>
        </div>
        <div
          aria-hidden
          className="relative overflow-hidden"
          style={{
            height: 12,
            width: "100%",
            background: "rgba(255,230,203,0.08)",
            border: "1px solid rgba(255,230,203,0.22)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${GREEN} 0%, ${HERMES_YELLOW} 55%, ${HERMES_AMBER} 100%)`,
              backgroundSize: "300% 100%",
              animation: "missionFlow 8s linear infinite",
              boxShadow: `0 0 24px rgba(255,210,30,0.5)`,
              transition: "width 480ms cubic-bezier(.2,.7,.2,1)",
            }}
          />
          {/* Milestone ticks — one per mini-goal so the bar reads as a
              station-by-station journey, not a percent slider. */}
          {Array.from({ length: total - 1 }).map((_, i) => {
            const left = ((i + 1) / total) * 100;
            const isPassed = left <= pct;
            return (
              <span
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: isPassed
                    ? "rgba(7,29,28,0.55)"
                    : "rgba(255,230,203,0.32)",
                  transform: "translateX(-0.5px)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* TOOLBAR — swaps content based on mode:
            - Cards mode: position readout + Prev/Next pagination
            - Briefing mode: ← Back to actions breadcrumb + Goal N / Total */}
      <div className="flex items-center justify-between gap-3 min-h-[34px]">
        {briefingOpen ? (
          <>
            <button
              type="button"
              onClick={() => setActiveGoalId(null)}
              className="hermes-mono inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] uppercase tracking-[0.22em] transition-colors"
              style={{
                background: "transparent",
                color: CREAM,
                borderColor: "rgba(255,230,203,0.5)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = HERMES_YELLOW;
                e.currentTarget.style.color = HERMES_YELLOW;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,230,203,0.5)";
                e.currentTarget.style.color = CREAM;
              }}
            >
              ‹ Back to actions
            </button>
            <span
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Goal{" "}
              <span style={{ color: HERMES_YELLOW }}>
                {(activeIndex >= 0 ? activeIndex + 1 : 1)}
              </span>
              <span style={{ color: "rgba(255,230,203,0.4)" }}> / {total}</span>
            </span>
          </>
        ) : total > VISIBLE ? (
          <>
            <span
              className="hermes-mono text-[10.5px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.6)" }}
            >
              Actions {firstVisible}
              <span style={{ color: "rgba(255,230,203,0.4)" }}>–</span>
              {lastVisible}{" "}
              <span style={{ color: "rgba(255,230,203,0.4)" }}>
                of {total}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollByCards(-1)}
                disabled={!canPrev}
                className="hermes-mono inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] uppercase tracking-[0.22em] transition-colors"
                style={{
                  background: "transparent",
                  color: canPrev ? CREAM : "rgba(255,230,203,0.3)",
                  borderColor: canPrev
                    ? "rgba(255,230,203,0.5)"
                    : "rgba(255,230,203,0.18)",
                  cursor: canPrev ? "pointer" : "not-allowed",
                }}
              >
                ‹ Prev
              </button>
              <button
                type="button"
                onClick={() => scrollByCards(1)}
                disabled={!canNext}
                className="hermes-mono inline-flex items-center gap-1.5 px-3 py-1.5 border text-[10px] uppercase tracking-[0.22em] transition-colors"
                style={{
                  background: "transparent",
                  color: canNext ? CREAM : "rgba(255,230,203,0.3)",
                  borderColor: canNext
                    ? "rgba(255,230,203,0.5)"
                    : "rgba(255,230,203,0.18)",
                  cursor: canNext ? "pointer" : "not-allowed",
                }}
              >
                Next ›
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* THE STAGE — fixed-height container that hosts either the cards rail
          or the briefing. Switching modes is a cross-fade in place. Athena
          and the page below never move. */}
      <div
        style={{
          position: "relative",
          height: STAGE_HEIGHT,
        }}
      >
        {/* CARDS RAIL — absolute, fades out when briefing opens. */}
        <div
          aria-hidden={briefingOpen}
          style={{
            position: "absolute",
            inset: 0,
            opacity: briefingOpen ? 0 : 1,
            pointerEvents: briefingOpen ? "none" : "auto",
            transition: "opacity 220ms cubic-bezier(.32,.72,0,1)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            ref={scrollRef}
            className="overflow-x-auto pb-2 mission-rail"
            style={{
              scrollSnapType: "x mandatory",
              scrollbarWidth: "thin",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              style={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: `calc((100% - ${(VISIBLE - 1) * 14}px) / ${VISIBLE})`,
                gap: 14,
              }}
            >
              {(() => {
                const activeIdx = mission.mini_goals.findIndex(
                  (x) => x.status !== "done",
                );
                return mission.mini_goals.map((g, i) => (
                  <div
                    key={g.id}
                    data-goal-id={g.id}
                    style={{
                      scrollSnapAlign: "start",
                      // Stretch each wrapper to fill the row so all cards
                      // land at the same height.
                      display: "flex",
                      height: "100%",
                    }}
                  >
                    <GoalCard
                      goal={g}
                      mission={mission}
                      index={i}
                      total={total}
                      isLive={i === activeIdx}
                      isActive={g.id === activeGoalId}
                      anyActive={activeGoalId !== null}
                      cardRef={(el) => cardRefs.current.set(g.id, el)}
                      onToggle={() => onToggle(g.id)}
                      onOpen={() => setActiveGoalId(g.id)}
                      agent={railProps.agent}
                    />
                  </div>
                ));
              })()}
            </div>
          </div>

        </div>

        {/* BRIEFING — absolute, fades in when a card is opened. Lives in
            the SAME slot as the cards rail. No page-height change ever. */}
        <BriefingDrawer
          goal={activeGoal}
          mission={mission}
          index={activeIndex}
          total={total}
          onClose={() => setActiveGoalId(null)}
          onToggle={
            activeGoal ? () => onToggle(activeGoal.id) : () => undefined
          }
          agent={railProps.agent}
        />
      </div>

      <style>{`
        .mission-rail::-webkit-scrollbar {
          height: 6px;
        }
        .mission-rail::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.3);
        }
        .mission-rail::-webkit-scrollbar-thumb {
          background: rgba(255,230,203,0.25);
        }
        .mission-rail::-webkit-scrollbar-thumb:hover {
          background: rgba(255,230,203,0.45);
        }
      `}</style>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// GOAL CARD — self-contained. Avatar + title + description + clean estimate
// label + Copy-to-Hermes CTA at the bottom (or Mark-complete for human cards).
// No click-to-expand; the card shows everything.
// ────────────────────────────────────────────────────────────────────────────
function GoalCard(cardProps: {
  goal: MiniGoal;
  mission: Mission;
  index: number;
  total: number;
  // `isLive` = this card is the first non-done one, i.e. the "next up"
  // action. Computed by the rail so we always have exactly ONE bright card.
  isLive: boolean;
  // `isActive` = this card's brief is the one currently showing in the
  // drawer below the rail. Active card gets a yellow underline + amber
  // border; non-active siblings dim to 55% when ANY card is active.
  isActive: boolean;
  anyActive: boolean;
  onToggle: () => void;
  onOpen: () => void;
  cardRef?: (el: HTMLButtonElement | null) => void;
  agent?: MissionControlAgent;
}) {
  const {
    goal,
    mission,
    index,
    total,
    isLive,
    isActive,
    anyActive,
    onToggle,
    onOpen,
    cardRef,
  } = cardProps;
  const isHermes = goal.actor === "hermes";
  const isDone = goal.status === "done";
  // Status-coloured top stripe: only the LIVE card gets the bright orange
  // glow. Done cards go gray. Future-queued cards get a calm cream tone —
  // no more sea-of-pink when you first land on the mission.
  const ORANGE = HERMES_AMBER;
  const GRAY = "rgba(255,230,203,0.3)";
  const PENDING = "rgba(255,230,203,0.45)";
  const stripeColor = isDone ? GRAY : isLive ? ORANGE : PENDING;
  const { avatar: opAvatar, initials: opInitials, name: opName } =
    useOperatorIdentity();
  const [copied, setCopied] = useState(false);

  const copyText = buildCopyText(goal, mission, index, total, opName);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    onToggle();
  }

  function handleCardClick() {
    onOpen();
  }
  function handleCardKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  }

  return (
    <div
      ref={cardRef as any}
      role="button"
      tabIndex={0}
      aria-label={`Open briefing for action ${goal.num}: ${goal.title}`}
      aria-pressed={isActive}
      onClick={handleCardClick}
      onKeyDown={handleCardKey}
      className="relative border overflow-hidden flex flex-col w-full h-full"
      style={{
        // Active beats live beats done beats queued. State changes are
        // instant (no border-color transition) so ticking one card doesn't
        // animate a yellow→orange wave across the rail.
        borderColor: isActive
          ? HERMES_YELLOW
          : isLive
            ? ORANGE
            : isDone
              ? "rgba(134,239,172,0.4)"
              : "rgba(255,230,203,0.28)",
        background: "rgba(0,0,0,0.32)",
        // Crisp inset ring on the active card — no soft glow. The live
        // (next-up) card gets a slightly softer ring so the user can
        // still see what's next.
        boxShadow: isActive
          ? `inset 0 0 0 1px ${HERMES_YELLOW}`
          : isLive
            ? `inset 0 0 0 1px ${ORANGE}`
            : "none",
        padding: "16px 16px 16px",
        minHeight: 220,
        gap: 12,
        cursor: "pointer",
        // Dim siblings when ANY brief is open so the active one reads cleanly.
        opacity: anyActive && !isActive ? 0.55 : 1,
        // Only opacity transitions — colors snap so state changes are
        // crisp, not wavy.
        transition: "opacity 220ms cubic-bezier(.32,.72,0,1)",
      }}
    >
      {/* Status-coloured top stripe — orange for the live next-up card,
          calm cream for the queued future cards, gray for done. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: stripeColor,
          boxShadow: isLive ? `0 0 12px ${ORANGE}` : "none",
          opacity: isDone ? 0.5 : 1,
        }}
      />

      {/* Top strip: avatar + ACTION N + status word. Live card glows.
          Hermes-actor cards show:
            - Hermes anime portrait on the Hermes page (agent === "hermes")
            - Claude logo on home + Claude pages (agent !== "hermes")
          Human-actor cards show the operator's photo/initials regardless. */}
      <div className="flex items-center gap-3">
        {isHermes ? (
          cardProps.agent === "hermes" ? (
            <img
              src={hermesPortrait}
              alt="Hermes"
              className="rounded-full object-cover shrink-0"
              style={{
                width: 34,
                height: 34,
                border: `1px solid ${isLive ? ORANGE : "rgba(255,210,30,0.55)"}`,
                background: "rgba(255,210,30,0.10)",
              }}
            />
          ) : (
            // Claude logo as a true circle — the orange square gets cropped
            // to a circle via border-radius on the img itself, so we see
            // an orange disc with the white asterisk centered. No outer
            // wrapper, no square-in-circle clash.
            <img
              src={claudeLogo}
              alt="Claude"
              className="object-cover shrink-0"
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: `1px solid ${isLive ? ORANGE : "rgba(217,119,87,0.55)"}`,
              }}
            />
          )
        ) : opAvatar ? (
          <img
            src={opAvatar}
            alt={opName ?? "You"}
            className="rounded-full object-cover shrink-0"
            style={{
              width: 34,
              height: 34,
              border: `1px solid ${isLive ? ORANGE : "rgba(255,230,203,0.55)"}`,
            }}
          />
        ) : (
          <div
            aria-hidden
            className="rounded-full flex items-center justify-center shrink-0"
            style={{
              width: 34,
              height: 34,
              background:
                "linear-gradient(135deg, rgba(217, 119, 87, 0.35), rgba(167, 139, 250, 0.28))",
              color: "rgba(255, 255, 255, 0.94)",
              border: `1px solid ${isLive ? ORANGE : "rgba(255,230,203,0.55)"}`,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {opInitials}
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span
            className="hermes-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: stripeColor }}
          >
            Action {goal.num}
          </span>
          <span
            className="hermes-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: "rgba(255,230,203,0.45)" }}
          >
            {isDone ? "Complete" : isLive ? "Up next" : "Queued"}
          </span>
        </div>
        {isDone && (
          <span
            aria-hidden
            className="ml-auto inline-flex items-center"
            style={{ color: GRAY, gap: 2 }}
          >
            <Check size={13} strokeWidth={3} />
            <Check size={13} strokeWidth={3} style={{ marginLeft: -6 }} />
          </span>
        )}
      </div>

      {/* H1 — the action. Title Case (per source string). All-caps reads
          slower at this size and breaks rhythm with the modal H1. */}
      <div
        className="hermes-display"
        style={{
          color: isDone ? "rgba(255,230,203,0.45)" : CREAM,
          fontSize: "20px",
          lineHeight: 1.2,
          letterSpacing: "-0.005em",
          textDecoration: isDone ? "line-through" : undefined,
          textDecorationColor: "rgba(255,230,203,0.25)",
        }}
      >
        {goal.title}
      </div>

      {goal.done_when && (
        // TLDR — always visible, full text shown (no line clamp), bigger
        // font so it's actually readable. This IS the prompt-y description
        // the user reads to know what's expected.
        <div
          className="text-[15px] flex-1"
          style={{
            color: isDone ? "rgba(255,230,203,0.4)" : "rgba(255,230,203,0.88)",
            fontFamily: '"Fraunces", serif',
            lineHeight: 1.45,
          }}
        >
          {goal.done_when}
        </div>
      )}

      {/* Hint at bottom — "Click for brief" so the user knows the card opens
          the drawer below. Replaces the old [Show prompt] toggle. */}
      <div
        aria-hidden
        className="hermes-mono text-[9px] uppercase tracking-[0.22em] mt-auto"
        style={{
          color: isActive
            ? HERMES_YELLOW
            : "rgba(255,230,203,0.42)",
          opacity: isDone ? 0.4 : 1,
          transition: "color 220ms cubic-bezier(.32,.72,0,1)",
        }}
      >
        {isActive ? "Briefing open ▾" : "Click for brief →"}
      </div>

      {/* Bottom row.
          - Hermes done: full-width green "Complete" tick.
          - Hermes pending: [Copy] + [✓] tick.
          - Human done: full-width green tick.
          - Human pending: full-width [Mark complete] tick (no Copy — Jack:
            "I shouldn't have a copy reminder, it doesn't make any sense"). */}
      <div className="flex items-stretch gap-2">
        {isHermes && !isDone && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className="hermes-mono inline-flex items-center justify-center gap-1.5 px-3 border text-[10px] uppercase tracking-[0.22em] transition-colors flex-1"
              style={{
                background: copied
                  ? "rgba(134,239,172,0.12)"
                  : "rgba(255,210,30,0.10)",
                color: copied ? GREEN : HERMES_YELLOW,
                borderColor: copied
                  ? "rgba(134,239,172,0.55)"
                  : "rgba(255,210,30,0.55)",
                height: 34,
              }}
            >
              {copied ? (
                <>
                  <Check size={12} /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleToggle}
          aria-label={isDone ? "Mark not complete" : "Mark complete"}
          title={isDone ? "Click to undo" : "Mark this action complete"}
          className="inline-flex items-center justify-center border transition-colors shrink-0"
          style={{
            width: 34,
            height: 34,
            background: isDone ? GREEN : "transparent",
            color: isDone ? "#071D1C" : "rgba(255,230,203,0.78)",
            borderColor: isDone ? GREEN : "rgba(255,230,203,0.4)",
            // On done OR on human-pending cards (no Copy button) the tick
            // expands to fill the row, so the action reads loud.
            flex: isDone || !isHermes ? "1 1 100%" : undefined,
          }}
          onMouseEnter={(e) => {
            if (!isDone)
              e.currentTarget.style.borderColor = CREAM;
          }}
          onMouseLeave={(e) => {
            if (!isDone)
              e.currentTarget.style.borderColor = "rgba(255,230,203,0.4)";
          }}
        >
          <Check size={isDone ? 14 : 13} strokeWidth={isDone ? 3 : 2} />
          {/* Human-pending cards show a "Mark complete" label inside the
              wide tick row so the affordance is obvious. */}
          {!isDone && !isHermes && (
            <span
              className="hermes-mono ml-2 text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,230,203,0.78)" }}
            >
              Mark complete
            </span>
          )}
        </button>
      </div>

      {isDone && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: GREEN,
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}


export default HermesMissionControl;
