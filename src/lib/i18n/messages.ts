export type Locale = "en" | "fr";

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "fr", label: "Français", short: "FR" },
];

/** Flat keys — keep short and reusable. */
export type MessageKey =
  | "app.name"
  | "app.tagline"
  | "app.subtitle"
  | "nav.chat"
  | "nav.preview"
  | "nav.code"
  | "nav.hideChat"
  | "nav.showChat"
  | "nav.newProject"
  | "nav.projects"
  | "nav.starred"
  | "nav.recent"
  | "nav.search"
  | "nav.settings"
  | "nav.upgrade"
  | "nav.signIn"
  | "nav.signInGitHub"
  | "nav.signInGoogle"
  | "nav.signOut"
  | "nav.templates"
  | "chat.placeholder"
  | "chat.placeholderIterate"
  | "chat.placeholderStreaming"
  | "chat.send"
  | "chat.stop"
  | "chat.queue"
  | "chat.redirect"
  | "chat.building"
  | "chat.planning"
  | "chat.thinking"
  | "chat.connecting"
  | "chat.ready"
  | "chat.plan"
  | "chat.planningLabel"
  | "chat.summary"
  | "chat.uiReady"
  | "chat.openCode"
  | "chat.buildingPreview"
  | "chat.files"
  | "chat.iterateOn"
  | "chat.switchVersion"
  | "chat.fixFromQa"
  | "chat.inspire"
  | "chat.inspireHint"
  | "chat.inspirePro"
  | "chat.scrape"
  | "chat.scraping"
  | "chat.improvePrompt"
  | "chat.style"
  | "chat.forDevelopers"
  | "chat.heroTitle"
  | "chat.heroAccent"
  | "chat.heroBody"
  | "chat.tipImprove"
  | "chat.failed"
  | "chat.dismiss"
  | "chat.limitReached"
  | "chat.upgradeNeeded"
  | "preview.latest"
  | "preview.viewing"
  | "preview.building"
  | "preview.editsBase"
  | "preview.fork"
  | "preview.restore"
  | "preview.restoreTitle"
  | "preview.forkTitle"
  | "preview.tabPreview"
  | "preview.tabCode"
  | "preview.tabEdit"
  | "preview.tabAudit"
  | "audit.title"
  | "audit.subtitle"
  | "audit.runLive"
  | "audit.fixFromQa"
  | "audit.generateFirst"
  | "lang.en"
  | "lang.fr"
  | "lang.toggle"
  | "common.loading"
  | "common.cancel"
  | "common.save"
  | "common.close"
  | "status.building"
  | "gens.used";

type Dict = Record<MessageKey, string>;

const en: Dict = {
  "app.name": "AdGenAI",
  "app.tagline": "Describe the idea. Get the UI.",
  "app.subtitle": "Production React + Tailwind. Live preview while it builds.",
  "nav.chat": "Chat",
  "nav.preview": "Preview",
  "nav.code": "Code",
  "nav.hideChat": "Hide",
  "nav.showChat": "Show chat",
  "nav.newProject": "New project",
  "nav.projects": "Projects",
  "nav.starred": "Starred",
  "nav.recent": "Recent",
  "nav.search": "Search projects…",
  "nav.settings": "Settings",
  "nav.upgrade": "Upgrade",
  "nav.signIn": "Sign in",
  "nav.signInGitHub": "Continue with GitHub",
  "nav.signInGoogle": "Continue with Google",
  "nav.signOut": "Sign out",
  "nav.templates": "Starters",
  "chat.placeholder": "What are you building? Describe the product or UI…",
  "chat.placeholderIterate": "Iterate… e.g. make the hero punchier, add pricing",
  "chat.placeholderStreaming": "Type a follow-up — queues until this build finishes…",
  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.queue": "Queue",
  "chat.redirect": "Redirect",
  "chat.building": "Building",
  "chat.planning": "Planning your UI…",
  "chat.thinking": "Thinking…",
  "chat.connecting": "Connecting…",
  "chat.ready": "Ready",
  "chat.plan": "Plan",
  "chat.planningLabel": "Planning",
  "chat.summary": "Summary",
  "chat.uiReady": "UI ready · see preview",
  "chat.openCode": "open Code tab for source",
  "chat.buildingPreview": "Building UI in the preview…",
  "chat.files": "files",
  "chat.iterateOn": "Iterate on",
  "chat.switchVersion": "switch chips in preview to pick another",
  "chat.fixFromQa": "Fix from QA",
  "chat.inspire": "Inspire from URL",
  "chat.inspireHint": "Live scrape → palette, CTAs, headlines into your prompt.",
  "chat.inspirePro": "Unlock on Pro / Max.",
  "chat.scrape": "Scrape",
  "chat.scraping": "Scraping…",
  "chat.improvePrompt": "Improve prompt",
  "chat.style": "Style",
  "chat.forDevelopers": "AdGenAI · for developers",
  "chat.heroTitle": "Describe the idea.",
  "chat.heroAccent": "Get the UI.",
  "chat.heroBody":
    "Production React + Tailwind. Live preview while it builds. Iterate in chat, then push to GitHub.",
  "chat.tipImprove": "Tip: type a rough idea, tap Improve prompt, then send",
  "chat.failed": "Generation failed",
  "chat.dismiss": "Dismiss",
  "chat.limitReached": "Daily limit reached",
  "chat.upgradeNeeded": "Upgrade needed",
  "preview.latest": "Latest",
  "preview.viewing": "Viewing",
  "preview.building": "Building",
  "preview.editsBase": "Edits use this version as base",
  "preview.fork": "Fork",
  "preview.restore": "Restore as latest",
  "preview.restoreTitle": "Copy this version to the end as latest",
  "preview.forkTitle": "New project starting from this version",
  "preview.tabPreview": "Preview",
  "preview.tabCode": "Code",
  "preview.tabEdit": "Edit",
  "preview.tabAudit": "Audit",
  "audit.title": "AdGen Browser QA",
  "audit.subtitle": "Owned preview checks · not browser-use cloud",
  "audit.runLive": "Run live QA",
  "audit.fixFromQa": "Fix from QA",
  "audit.generateFirst": "Generate a UI first, then audit it here.",
  "lang.en": "English",
  "lang.fr": "Français",
  "lang.toggle": "Language",
  "common.loading": "Loading…",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "status.building": "Building…",
  "gens.used": "gens",
};

const fr: Dict = {
  "app.name": "AdGenAI",
  "app.tagline": "Décrivez l’idée. Obtenez l’UI.",
  "app.subtitle": "React + Tailwind production. Aperçu en direct pendant la génération.",
  "nav.chat": "Chat",
  "nav.preview": "Aperçu",
  "nav.code": "Code",
  "nav.hideChat": "Masquer",
  "nav.showChat": "Afficher le chat",
  "nav.newProject": "Nouveau projet",
  "nav.projects": "Projets",
  "nav.starred": "Favoris",
  "nav.recent": "Récents",
  "nav.search": "Rechercher…",
  "nav.settings": "Réglages",
  "nav.upgrade": "Passer au plan",
  "nav.signIn": "Connexion",
  "nav.signInGitHub": "Continuer avec GitHub",
  "nav.signInGoogle": "Continuer avec Google",
  "nav.signOut": "Déconnexion",
  "nav.templates": "Modèles",
  "chat.placeholder": "Que construisez-vous ? Décrivez le produit ou l’UI…",
  "chat.placeholderIterate": "Itérer… ex. renforcer le hero, ajouter les tarifs",
  "chat.placeholderStreaming": "Écrivez une suite — en file d’attente…",
  "chat.send": "Envoyer",
  "chat.stop": "Arrêter",
  "chat.queue": "File",
  "chat.redirect": "Rediriger",
  "chat.building": "Génération",
  "chat.planning": "Planification de l’UI…",
  "chat.thinking": "Réflexion…",
  "chat.connecting": "Connexion…",
  "chat.ready": "Prêt",
  "chat.plan": "Plan",
  "chat.planningLabel": "Planification",
  "chat.summary": "Résumé",
  "chat.uiReady": "UI prête · voir l’aperçu",
  "chat.openCode": "onglet Code pour le source",
  "chat.buildingPreview": "Construction de l’UI dans l’aperçu…",
  "chat.files": "fichiers",
  "chat.iterateOn": "Itérer sur",
  "chat.switchVersion": "changez de version dans l’aperçu",
  "chat.fixFromQa": "Corriger via QA",
  "chat.inspire": "S’inspirer d’une URL",
  "chat.inspireHint": "Scraping live → palette, CTA et titres dans le prompt.",
  "chat.inspirePro": "Débloqué en Pro / Max.",
  "chat.scrape": "Analyser",
  "chat.scraping": "Analyse…",
  "chat.improvePrompt": "Améliorer le prompt",
  "chat.style": "Style",
  "chat.forDevelopers": "AdGenAI · pour développeurs",
  "chat.heroTitle": "Décrivez l’idée.",
  "chat.heroAccent": "Obtenez l’UI.",
  "chat.heroBody":
    "React + Tailwind production. Aperçu en direct. Itérez dans le chat, puis poussez sur GitHub.",
  "chat.tipImprove": "Astuce : idée brute → Améliorer le prompt → envoyer",
  "chat.failed": "Échec de la génération",
  "chat.dismiss": "Fermer",
  "chat.limitReached": "Limite quotidienne atteinte",
  "chat.upgradeNeeded": "Mise à niveau requise",
  "preview.latest": "Dernière",
  "preview.viewing": "Consultation",
  "preview.building": "Génération",
  "preview.editsBase": "Les edits partent de cette version",
  "preview.fork": "Bifurquer",
  "preview.restore": "Restaurer comme dernière",
  "preview.restoreTitle": "Copier cette version à la fin comme dernière",
  "preview.forkTitle": "Nouveau projet à partir de cette version",
  "preview.tabPreview": "Aperçu",
  "preview.tabCode": "Code",
  "preview.tabEdit": "Éditer",
  "preview.tabAudit": "Audit",
  "audit.title": "QA navigateur AdGen",
  "audit.subtitle": "Contrôles d’aperçu intégrés",
  "audit.runLive": "QA en direct",
  "audit.fixFromQa": "Corriger via QA",
  "audit.generateFirst": "Générez d’abord une UI, puis auditez ici.",
  "lang.en": "English",
  "lang.fr": "Français",
  "lang.toggle": "Langue",
  "common.loading": "Chargement…",
  "common.cancel": "Annuler",
  "common.save": "Enregistrer",
  "common.close": "Fermer",
  "status.building": "Génération…",
  "gens.used": "gén.",
};

export const messages: Record<Locale, Dict> = { en, fr };

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key] ?? key;
}

/** Injected into the model system prompt when UI locale is French. */
export function localeSystemHint(locale: Locale): string {
  if (locale !== "fr") return "";
  return `

## UI LANGUAGE (USER PREFERENCE)
The product UI is set to French (fr-CA). Write ALL user-facing copy in the generated React UI in French (Québec-friendly fr-CA where natural): headlines, buttons, nav, pricing, FAQ, empty states, toasts. Keep code identifiers (function names, file paths, Component) in English. Chat plan/summary may be in French.`;
}
