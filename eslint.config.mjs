import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deploy artifacts / deps (not app source)
    ".netlify/**",
    "node_modules/**",
    "workers/**/node_modules/**",
  ]),
  {
    rules: {
      // Common valid patterns: reset dialog state on open, hydrate from URL/localStorage.
      // Keep as warn so real issues still surface without blocking CI.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
