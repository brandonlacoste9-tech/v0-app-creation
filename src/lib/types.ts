export interface Session {
  id: string;
  title: string;
  starred: boolean;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CodeVersion {
  id: string;
  sessionId: string;
  code: string;
  title: string;
  language: string;
  createdAt: string;
}

export interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  plan?: "free" | "pro";
  generationsToday?: number;
  generationsLimit?: number | null;
}

export interface UserInfo {
  plan: "free" | "pro";
  generationsToday: number;
  generationsLimit: number | null;
  projectCount: number;
  projectLimit: number | null;
  providers: string[];
  connected: boolean;
  username?: string;
  avatarUrl?: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
  description: string | null;
  url: string;
}

// ─── Preview Theme Types ────────────────────────────────────

export interface PreviewTheme {
  id: string;
  name: string;
  description: string;
  bg: string;
  fg: string;
  card: string;
  cardBorder: string;
  muted: string;
  mutedFg: string;
  accent: string;
  mode: "dark" | "light";
}

export const PREVIEW_THEMES: PreviewTheme[] = [
  {
    id: "dark-default",
    name: "Dark",
    description: "Default dark theme",
    bg: "#0a0a0a", fg: "#f2f2f2", card: "#141414", cardBorder: "#2a2a2a",
    muted: "#1e1e1e", mutedFg: "#6b6b6b", accent: "#f2f2f2", mode: "dark",
  },
  {
    id: "clean-white",
    name: "Clean White",
    description: "Crisp and minimal",
    bg: "#ffffff", fg: "#111827", card: "#ffffff", cardBorder: "#e5e7eb",
    muted: "#f9fafb", mutedFg: "#6b7280", accent: "#111827", mode: "light",
  },
  {
    id: "soft-gray",
    name: "Soft Gray",
    description: "Easy on the eyes",
    bg: "#f8f9fa", fg: "#1a1a2e", card: "#ffffff", cardBorder: "#e2e4e9",
    muted: "#f0f1f3", mutedFg: "#64748b", accent: "#334155", mode: "light",
  },
  {
    id: "warm-cream",
    name: "Warm Cream",
    description: "Warm and inviting",
    bg: "#faf8f5", fg: "#292524", card: "#ffffff", cardBorder: "#e7e2db",
    muted: "#f5f0eb", mutedFg: "#78716c", accent: "#b45309", mode: "light",
  },
  {
    id: "blue-tint",
    name: "Blue Tint",
    description: "Professional and calm",
    bg: "#f0f4ff", fg: "#1e293b", card: "#ffffff", cardBorder: "#dbeafe",
    muted: "#e8eeff", mutedFg: "#64748b", accent: "#2563eb", mode: "light",
  },
  {
    id: "rose-tint",
    name: "Rose Tint",
    description: "Soft and elegant",
    bg: "#fef2f2", fg: "#1c1917", card: "#ffffff", cardBorder: "#fecdd3",
    muted: "#fff1f2", mutedFg: "#71717a", accent: "#e11d48", mode: "light",
  },
];

// ─── App Theme Types ───────────────────────────────────────

export interface AppTheme {
  id: string;
  name: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  primary: string;
  primaryForeground: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
  emerald: string;
  scrollThumb: string;
  scrollThumbHover: string;
  tokenKeyword: string;
  tokenString: string;
  tokenComment: string;
  tokenTag: string;
  tokenFunction: string;
  tokenNumber: string;
}

export const APP_THEMES: AppTheme[] = [
  {
    id: "black-dark",
    name: "Black Dark",
    background: "#0a0a0a",
    foreground: "#f2f2f2",
    card: "#141414",
    cardForeground: "#f2f2f2",
    border: "#2a2a2a",
    muted: "#1e1e1e",
    mutedForeground: "#6b6b6b",
    accent: "#1e1e1e",
    accentForeground: "#f2f2f2",
    primary: "#f2f2f2",
    primaryForeground: "#0a0a0a",
    ring: "#404040",
    destructive: "#ef4444",
    destructiveForeground: "#f2f2f2",
    emerald: "#10b981",
    scrollThumb: "#333",
    scrollThumbHover: "#444",
    tokenKeyword: "#c084fc",
    tokenString: "#34d399",
    tokenComment: "#6b7280",
    tokenTag: "#60a5fa",
    tokenFunction: "#fbbf24",
    tokenNumber: "#f97316",
  },
  {
    id: "brown-dark",
    name: "Brown Dark",
    background: "#1a1412",
    foreground: "#f0e6dc",
    card: "#241c18",
    cardForeground: "#f0e6dc",
    border: "#3d2e24",
    muted: "#2a2018",
    mutedForeground: "#8b7b6b",
    accent: "#2a2018",
    accentForeground: "#f0e6dc",
    primary: "#f0e6dc",
    primaryForeground: "#1a1412",
    ring: "#5a4535",
    destructive: "#ef4444",
    destructiveForeground: "#f0e6dc",
    emerald: "#10b981",
    scrollThumb: "#3d2e24",
    scrollThumbHover: "#5a4535",
    tokenKeyword: "#d4a574",
    tokenString: "#7dcea0",
    tokenComment: "#8b7b6b",
    tokenTag: "#8ab4f8",
    tokenFunction: "#e8c170",
    tokenNumber: "#f0a050",
  },
  {
    id: "pure-white",
    name: "Pure White",
    background: "#ffffff",
    foreground: "#111827",
    card: "#ffffff",
    cardForeground: "#111827",
    border: "#e5e7eb",
    muted: "#f9fafb",
    mutedForeground: "#6b7280",
    accent: "#f3f4f6",
    accentForeground: "#111827",
    primary: "#111827",
    primaryForeground: "#ffffff",
    ring: "#d1d5db",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    emerald: "#059669",
    scrollThumb: "#d1d5db",
    scrollThumbHover: "#9ca3af",
    tokenKeyword: "#7c3aed",
    tokenString: "#059669",
    tokenComment: "#9ca3af",
    tokenTag: "#2563eb",
    tokenFunction: "#d97706",
    tokenNumber: "#ea580c",
  },
  {
    id: "soft-gray",
    name: "Soft Gray",
    background: "#f4f5f7",
    foreground: "#1a1a2e",
    card: "#ffffff",
    cardForeground: "#1a1a2e",
    border: "#e2e4e9",
    muted: "#eceef1",
    mutedForeground: "#64748b",
    accent: "#e8eaed",
    accentForeground: "#1a1a2e",
    primary: "#334155",
    primaryForeground: "#ffffff",
    ring: "#cbd5e1",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    emerald: "#059669",
    scrollThumb: "#cbd5e1",
    scrollThumbHover: "#94a3b8",
    tokenKeyword: "#7c3aed",
    tokenString: "#059669",
    tokenComment: "#94a3b8",
    tokenTag: "#2563eb",
    tokenFunction: "#d97706",
    tokenNumber: "#ea580c",
  },
  {
    id: "warm-cream",
    name: "Warm Cream",
    background: "#faf7f2",
    foreground: "#292524",
    card: "#ffffff",
    cardForeground: "#292524",
    border: "#e7e2db",
    muted: "#f5f0e8",
    mutedForeground: "#78716c",
    accent: "#ede8e0",
    accentForeground: "#292524",
    primary: "#78350f",
    primaryForeground: "#ffffff",
    ring: "#d6cfc4",
    destructive: "#dc2626",
    destructiveForeground: "#ffffff",
    emerald: "#059669",
    scrollThumb: "#d6cfc4",
    scrollThumbHover: "#a8a29e",
    tokenKeyword: "#92400e",
    tokenString: "#047857",
    tokenComment: "#a8a29e",
    tokenTag: "#1d4ed8",
    tokenFunction: "#b45309",
    tokenNumber: "#c2410c",
  },
];

// ─── AI Provider Types ──────────────────────────────────────

export type AIProvider = "groq" | "deepseek" | "ollama" | "openai" | "anthropic";

export interface ProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;        // For BYOK (OpenAI, Anthropic, Groq, DeepSeek)
  ollamaUrl?: string;     // Custom Ollama endpoint
  temperature: number;
}

export interface BrandKit {
  enabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string;
  buttonStyle: "rounded" | "pill" | "square";
  tone: "professional" | "casual" | "playful" | "minimal";
}

export interface AppSettings {
  provider: AIProvider;
  model: string;
  apiKey: string;
  ollamaUrl: string;
  temperature: number;
  sidebarCollapsed: boolean;
  appTheme: string;
  customSystemPrompt: string;
  maxTokens: number;
  outputFormat: "tsx" | "jsx" | "html";
  brandKit: BrandKit;
  previewTheme: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  apiKey: "",
  ollamaUrl: "http://localhost:11434",
  temperature: 0.7,
  sidebarCollapsed: false,
  appTheme: "black-dark",
  customSystemPrompt: "",
  maxTokens: 4096,
  outputFormat: "tsx",
  previewTheme: "dark-default",
  brandKit: {
    enabled: false,
    primaryColor: "#6366f1",
    secondaryColor: "#1e1e2e",
    accentColor: "#22d3ee",
    fontFamily: "",
    logoUrl: "",
    buttonStyle: "rounded",
    tone: "professional",
  },
};

// ─── Provider Model Lists ───────────────────────────────────

export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export const PROVIDER_INFO: Record<AIProvider, {
  name: string;
  description: string;
  requiresKey: boolean;
  keyPlaceholder?: string;
  keyHint?: string;
}> = {
  groq: {
    name: "Groq",
    description: "Free tier — fast inference, no cost for light usage",
    requiresKey: true,
    keyPlaceholder: "gsk_...",
    keyHint: "Get a free key at console.groq.com",
  },
  deepseek: {
    name: "DeepSeek",
    description: "DeepSeek V3 & Coder — powerful and very affordable",
    requiresKey: true,
    keyPlaceholder: "sk-...",
    keyHint: "Get a key at platform.deepseek.com",
  },
  ollama: {
    name: "Ollama (Local)",
    description: "Run models on your own machine — completely free, private",
    requiresKey: false,
  },
  openai: {
    name: "OpenAI",
    description: "GPT-4o, GPT-4o-mini — bring your own API key",
    requiresKey: true,
    keyPlaceholder: "sk-...",
    keyHint: "Get a key at platform.openai.com",
  },
  anthropic: {
    name: "Anthropic",
    description: "Claude Sonnet, Opus, Haiku — bring your own API key",
    requiresKey: true,
    keyPlaceholder: "sk-ant-...",
    keyHint: "Get a key at console.anthropic.com",
  },
};

export const PROVIDER_MODELS: Record<AIProvider, ModelOption[]> = {
  groq: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", description: "Best quality, free tier" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B", description: "Ultra fast, good for simple components" },
    { value: "mixtral-8x7b-32768", label: "Mixtral 8x7B", description: "Strong MoE model, 32K context" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B", description: "Google's efficient model" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek V3", description: "Best quality, very affordable" },
    { value: "deepseek-coder", label: "DeepSeek Coder", description: "Optimized for code generation" },
    { value: "deepseek-reasoner", label: "DeepSeek R1", description: "Chain-of-thought reasoning model" },
  ],
  ollama: [
    { value: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", description: "Best code model for 8GB VRAM" },
    { value: "deepseek-coder-v2:latest", label: "DeepSeek Coder V2", description: "Strong coding model" },
    { value: "codellama:7b", label: "CodeLlama 7B", description: "Meta's code model" },
    { value: "llama3.1:8b", label: "Llama 3.1 8B", description: "General purpose, good at code" },
    { value: "mistral:7b", label: "Mistral 7B", description: "Fast and capable" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini", description: "Cheap and fast, good for most tasks" },
    { value: "gpt-4o", label: "GPT-4o", description: "Most capable, higher cost" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "128K context, strong coding" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", description: "Best balance of speed and quality" },
    { value: "claude-haiku-4-20250514", label: "Claude Haiku 4", description: "Fast and affordable" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4", description: "Most capable" },
  ],
};

// ─── Prompt Templates ───────────────────────────────────────

export const PROMPT_TEMPLATES = [
  { label: "SaaS Landing", prompt: "Build a modern SaaS landing page with a hero section, feature grid with icons, pricing cards with a highlighted plan, testimonials, and a footer with links", icon: "layout" },
  { label: "Admin Dashboard", prompt: "Create an admin dashboard with stat cards showing KPIs, a line chart for revenue, a bar chart for users, a recent activity feed, and a data table with sorting", icon: "chart" },
  { label: "Auth Flow", prompt: "Design a login/signup form with email and password fields, OAuth buttons for Google and GitHub, a forgot password link, and form validation states", icon: "lock" },
  { label: "Product Card", prompt: "Build a product card component with image carousel, star rating, price with discount, size/color selectors, add-to-cart button, and wishlist toggle", icon: "shopping" },
  { label: "Chat UI", prompt: "Create a real-time chat interface with a contacts sidebar, message bubbles with timestamps, typing indicator, read receipts, and message input with emoji picker", icon: "message" },
  { label: "Settings Panel", prompt: "Build a settings page with tabbed navigation, profile editor with avatar upload, notification toggles, API key management section, and danger zone", icon: "settings" },
  { label: "Kanban Board", prompt: "Design a project management Kanban board with draggable cards, column headers with counts, card labels/tags, due dates, and assignee avatars", icon: "columns" },
  { label: "Pricing Page", prompt: "Create a pricing page with monthly/annual toggle, 3 tiers with feature comparison, highlighted recommended plan, FAQ accordion, and enterprise CTA", icon: "dollar" },
  { label: "File Manager", prompt: "Build a file manager with folder tree sidebar, file grid and list view toggle, breadcrumb navigation, drag-and-drop upload zone, and file action menus", icon: "folder" },
  { label: "Media Player", prompt: "Design a Spotify-style music player with album art, progress scrubber, play/pause/skip controls, volume slider, and a scrollable playlist queue", icon: "music" },
  { label: "Calendar App", prompt: "Create a calendar with month/week/day views, event creation modal, color-coded event categories, drag-to-resize events, and a mini month navigator", icon: "calendar" },
  { label: "Portfolio Site", prompt: "Build a developer portfolio with a hero intro, project showcase cards with live demo links, skills grid with proficiency bars, and a contact form", icon: "grid" },
] as const;
