// ─── Type definitions + generic sample data ─────────────────────────
// These types are used across the dashboard. The sample data below is
// purely fictional — generic developer scenarios, nothing personal.
// Real data comes from useLiveData() at runtime.

export const operator = {
  name: "Operator",
  handle: "operator",
  role: "Developer",
};

export type WorkspaceStatus = "healthy" | "stale" | "missing" | "needs review";

export interface Workspace {
  id: string;
  name: string;
  path: string;
  claudeMdStatus: WorkspaceStatus;
  lastRun: string;
  activeSkills: string[];
  recentFiles: { name: string; changed: string }[];
  recentOutputs: { name: string; type: string }[];
  memoryFreshness: number;
  usageToday: number;
  runs7d: number;
  description: string;
  summary: string;
  memoryFiles: { name: string; size: string; updated: string }[];
  sessions: { id: string; started: string; duration: string; status: string }[];
  warnings: string[];
}

export const workspaces: Workspace[] = [
  {
    id: "ecommerce-api",
    name: "E-Commerce API",
    path: "~/projects/ecommerce-api",
    claudeMdStatus: "healthy",
    lastRun: "20m ago",
    activeSkills: ["Code Reviewer", "Unit Test Writer"],
    recentFiles: [
      { name: "src/routes/checkout.ts", changed: "20m ago" },
      { name: "src/models/order.ts", changed: "1h ago" },
    ],
    recentOutputs: [{ name: "checkout-refactor.md", type: "report" }],
    memoryFreshness: 88,
    usageToday: 3.50,
    runs7d: 24,
    description: "REST API for the online store.",
    summary: "Active workspace. Good skill coverage.",
    memoryFiles: [
      { name: "CLAUDE.md", size: "6.2 KB", updated: "1d ago" },
      { name: "decisions.md", size: "2.8 KB", updated: "2d ago" },
    ],
    sessions: [
      { id: "run_a1b2", started: "20m ago", duration: "5m 30s", status: "success" },
      { id: "run_a1b1", started: "2h ago", duration: "8m 12s", status: "success" },
    ],
    warnings: [],
  },
  {
    id: "mobile-app",
    name: "Mobile App",
    path: "~/projects/mobile-app",
    claudeMdStatus: "needs review",
    lastRun: "3h ago",
    activeSkills: ["Bug Fixer", "API Doc Generator"],
    recentFiles: [
      { name: "lib/screens/home.dart", changed: "3h ago" },
      { name: "lib/services/auth.dart", changed: "5h ago" },
    ],
    recentOutputs: [{ name: "auth-flow-review.md", type: "review" }],
    memoryFreshness: 62,
    usageToday: 5.10,
    runs7d: 31,
    description: "Cross-platform mobile application.",
    summary: "CLAUDE.md needs a refresh. Two skills active.",
    memoryFiles: [
      { name: "CLAUDE.md", size: "4.1 KB", updated: "9d ago" },
    ],
    sessions: [
      { id: "run_c3d4", started: "3h ago", duration: "12m 08s", status: "success" },
    ],
    warnings: ["CLAUDE.md older than 7 days"],
  },
  {
    id: "internal-docs",
    name: "Internal Docs",
    path: "~/projects/internal-docs",
    claudeMdStatus: "healthy",
    lastRun: "45m ago",
    activeSkills: ["API Doc Generator"],
    recentFiles: [
      { name: "docs/api-reference.md", changed: "45m ago" },
      { name: "docs/getting-started.md", changed: "2h ago" },
    ],
    recentOutputs: [{ name: "api-v2-docs.md", type: "documentation" }],
    memoryFreshness: 91,
    usageToday: 1.80,
    runs7d: 12,
    description: "Team documentation and API references.",
    summary: "Clean workspace. Documentation up to date.",
    memoryFiles: [
      { name: "CLAUDE.md", size: "3.5 KB", updated: "2d ago" },
    ],
    sessions: [
      { id: "run_e5f6", started: "45m ago", duration: "3m 50s", status: "success" },
    ],
    warnings: [],
  },
  {
    id: "design-system",
    name: "Design System",
    path: "~/projects/design-system",
    claudeMdStatus: "stale",
    lastRun: "4d ago",
    activeSkills: ["Code Reviewer"],
    recentFiles: [{ name: "src/components/Button.tsx", changed: "4d ago" }],
    recentOutputs: [],
    memoryFreshness: 35,
    usageToday: 0,
    runs7d: 3,
    description: "Shared component library.",
    summary: "Quiet this week. Memory drifting.",
    memoryFiles: [
      { name: "CLAUDE.md", size: "2.9 KB", updated: "14d ago" },
    ],
    sessions: [
      { id: "run_g7h8", started: "4d ago", duration: "6m 22s", status: "success" },
    ],
    warnings: ["Memory freshness below 50%"],
  },
];

export const skills = [
  {
    name: "Code Reviewer",
    category: "Coding",
    scope: "global",
    workspace: null,
    lastUsed: "20m ago",
    status: "active",
    inputs: ["diff"],
    outputs: ["md"],
    uses: 85,
    score: 91,
  },
  {
    name: "Unit Test Writer",
    category: "Coding",
    scope: "global",
    workspace: null,
    lastUsed: "1h ago",
    status: "active",
    inputs: ["source"],
    outputs: ["test"],
    uses: 54,
    score: 87,
  },
  {
    name: "API Doc Generator",
    category: "Automation",
    scope: "global",
    workspace: null,
    lastUsed: "45m ago",
    status: "active",
    inputs: ["routes"],
    outputs: ["md"],
    uses: 32,
    score: 82,
  },
  {
    name: "Bug Fixer",
    category: "Coding",
    scope: "global",
    workspace: null,
    lastUsed: "3h ago",
    status: "active",
    inputs: ["error"],
    outputs: ["patch"],
    uses: 41,
    score: 78,
  },
  {
    name: "Dependency Auditor",
    category: "Review",
    scope: "global",
    workspace: null,
    lastUsed: "2d ago",
    status: "stale",
    inputs: ["lockfile"],
    outputs: ["report"],
    uses: 12,
    score: 65,
  },
  {
    name: "Migration Planner",
    category: "Automation",
    scope: "global",
    workspace: null,
    lastUsed: "5d ago",
    status: "stale",
    inputs: ["schema"],
    outputs: ["plan"],
    uses: 8,
    score: 58,
  },
];

export const skillCategories = [
  "Research",
  "Coding",
  "Review",
  "Memory",
  "Video",
  "Design",
  "Automation",
  "Reporting",
] as const;

export const runs = [
  {
    id: "run_a1b2",
    workspace: "E-Commerce API",
    skill: "Code Reviewer",
    started: "20m ago",
    duration: "5m 30s",
    status: "success",
    files: 4,
    outputs: 1,
    tools: ["git", "file edit"],
    tokens: 15200,
    cost: 0.38,
    errors: 0,
    summary: "Reviewed checkout refactor.",
  },
  {
    id: "run_c3d4",
    workspace: "Mobile App",
    skill: "Bug Fixer",
    started: "3h ago",
    duration: "12m 08s",
    status: "success",
    files: 7,
    outputs: 1,
    tools: ["shell", "file edit"],
    tokens: 28400,
    cost: 0.72,
    errors: 0,
    summary: "Fixed auth token refresh loop.",
  },
  {
    id: "run_e5f6",
    workspace: "Internal Docs",
    skill: "API Doc Generator",
    started: "45m ago",
    duration: "3m 50s",
    status: "success",
    files: 3,
    outputs: 1,
    tools: ["file edit"],
    tokens: 9800,
    cost: 0.24,
    errors: 0,
    summary: "Generated API v2 reference docs.",
  },
  {
    id: "run_g7h8",
    workspace: "Design System",
    skill: "Code Reviewer",
    started: "4d ago",
    duration: "6m 22s",
    status: "success",
    files: 5,
    outputs: 0,
    tools: ["file edit"],
    tokens: 18100,
    cost: 0.45,
    errors: 0,
    summary: "Reviewed Button component variants.",
  },
];

export const outputs = [
  {
    name: "checkout-refactor.md",
    type: "report",
    workspace: "E-Commerce API",
    run: "run_a1b2",
    skill: "Code Reviewer",
    updated: "20m ago",
    size: "6 KB",
  },
  {
    name: "auth-flow-review.md",
    type: "review",
    workspace: "Mobile App",
    run: "run_c3d4",
    skill: "Bug Fixer",
    updated: "3h ago",
    size: "4 KB",
  },
  {
    name: "api-v2-docs.md",
    type: "documentation",
    workspace: "Internal Docs",
    run: "run_e5f6",
    skill: "API Doc Generator",
    updated: "45m ago",
    size: "12 KB",
  },
];

export type MemorySourceId = string;

export interface MemorySource {
  id: string;
  label: string;
  kind: "local" | "vector";
  color: string;
  vectorCount?: number;
  namespaces?: number;
  dimension?: number;
  tooltip: string;
}

export const memorySources: MemorySource[] = [
  {
    id: "local-notes",
    label: "Local Notes",
    kind: "local",
    color: "#7c3aed",
    tooltip: "Your local markdown notes.",
  },
  {
    id: "claude-memory",
    label: "Claude Memory",
    kind: "local",
    color: "#C19A6B",
    tooltip: "~/.claude/projects/*/memory/ — captured by Claude.",
  },
  {
    id: "knowledge-base",
    label: "Knowledge Base",
    kind: "vector",
    color: "#3b82f6",
    vectorCount: 4200,
    namespaces: 3,
    dimension: 1024,
    tooltip: "Vector store for project knowledge.",
  },
];

export type MemoryEventType = "edit" | "vectorize" | "recall";
export interface MemoryEvent {
  id: string;
  type: MemoryEventType;
  target: string;
  destination?: string;
  time: string;
  source: string;
  meta?: { hits?: number };
}

export const memoryEvents: MemoryEvent[] = [
  { id: "e1", type: "edit", target: "docs/architecture.md", time: "30m ago", source: "local-notes" },
  { id: "e2", type: "recall", target: "API design patterns", time: "1h ago", source: "knowledge-base", meta: { hits: 3 } },
  { id: "e3", type: "vectorize", target: "session-a1b2", destination: "knowledge-base", time: "2h ago", source: "claude-memory" },
];

export const memorySignals = {
  freshness: 72,
  recentlyUpdated: [
    { name: "E-Commerce API / CLAUDE.md", updated: "1d ago" },
    { name: "Internal Docs / CLAUDE.md", updated: "2d ago" },
  ],
  stale: [
    { name: "Design System / CLAUDE.md", updated: "14d ago" },
    { name: "Mobile App / CLAUDE.md", updated: "9d ago" },
  ],
  conflicts: [],
  missing: [],
  archiveCandidates: [],
  recalledThisWeek: 12,
};

export const memoryStats = {
  activeLast7d: 3,
  activatedLast7d: 12,
  totalDataSources: 3,
  missing: 0,
};

export const usageDaily = [
  { day: "Mon", cost: 2.8, runs: 8 },
  { day: "Tue", cost: 4.1, runs: 11 },
  { day: "Wed", cost: 3.5, runs: 9 },
  { day: "Thu", cost: 5.2, runs: 14 },
  { day: "Fri", cost: 4.8, runs: 12 },
  { day: "Sat", cost: 1.2, runs: 3 },
  { day: "Sun", cost: 3.9, runs: 10 },
];

export const overviewStats = {
  runsToday: 10,
  activeSkills: 4,
  estUsageToday: 10.40,
  filesChangedToday: 19,
  failedRuns: 0,
  staleMemories: 2,
};
