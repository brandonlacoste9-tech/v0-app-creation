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
  theme: "dark" | "light" | "system";
  customSystemPrompt: string;
  maxTokens: number;
  outputFormat: "tsx" | "jsx" | "html";
  brandKit: BrandKit;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  apiKey: "",
  ollamaUrl: "http://localhost:11434",
  temperature: 0.7,
  sidebarCollapsed: false,
  theme: "dark",
  customSystemPrompt: "",
  maxTokens: 4096,
  outputFormat: "tsx",
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
  { label: "Landing Page", prompt: "Build a modern SaaS landing page with hero section, features grid, pricing cards, and footer", icon: "layout" },
  { label: "Dashboard", prompt: "Create an analytics dashboard with stat cards, a line chart, a bar chart, and a recent activity table", icon: "chart" },
  { label: "Login Form", prompt: "Design a sleek login form with email, password, social login buttons, and forgot password link", icon: "lock" },
  { label: "E-Commerce Card", prompt: "Build a product card with image, rating stars, price, add-to-cart button, and wishlist toggle", icon: "shopping" },
  { label: "Chat Interface", prompt: "Create a messaging UI with conversation list sidebar, message bubbles, typing indicator, and input field", icon: "message" },
  { label: "Settings Page", prompt: "Build a settings page with profile section, notification toggles, theme selector, and account management", icon: "settings" },
  { label: "Kanban Board", prompt: "Design a Kanban board with draggable cards across To Do, In Progress, and Done columns", icon: "columns" },
  { label: "Pricing Table", prompt: "Create a pricing comparison table with 3 tiers, feature checkmarks, and highlighted recommended plan", icon: "dollar" },
  { label: "File Manager", prompt: "Build a file manager UI with folder tree, file grid/list toggle, breadcrumbs, and upload area", icon: "folder" },
  { label: "Music Player", prompt: "Design a music player with album art, progress bar, play/pause/skip controls, and playlist queue", icon: "music" },
  { label: "Calendar", prompt: "Create a calendar view with month grid, event indicators, day detail panel, and event creation form", icon: "calendar" },
  { label: "Portfolio", prompt: "Build a portfolio showcase with project cards, filter tabs, lightbox preview, and contact section", icon: "grid" },
] as const;
