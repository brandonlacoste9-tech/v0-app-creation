/**
 * Canonical BYOB storage copy. Privacy, BYOB marketing, and docs must
 * quote this verbatim so we never imply server-side schema-map storage.
 *
 * Truth: AppSettings (including byob.schema) persist in browser localStorage
 * under Shipboard.studio.settings.v1. The connection string is request-scoped
 * for introspection and is not kept. See src/lib/settings-storage.ts.
 */
export const BYOB_SCHEMA_MAP_STORAGE =
  "The schema map (table names, columns, and foreign keys) is stored in this browser only — localStorage key Shipboard.studio.settings.v1. It is not uploaded to Shipboard servers. The connection string is used for a single read-only introspect request and is not persisted. Database rows are never copied.";
