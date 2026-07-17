export interface InspirationScrape {
  url: string;
  title: string;
  description: string;
  headings: string[];
  ctaTexts: string[];
  navLabels: string[];
  colors: string[];
  fonts: string[];
  designNotes: string[];
  briefPrompt: string;
  screenshotDataUrl?: string;
  scrapedAt: string;
  source: "worker" | "stub";
}

export interface ScrapeRequest {
  url: string;
  /** Include full-page screenshot as data URL (heavier) */
  screenshot?: boolean;
  timeoutMs?: number;
}
