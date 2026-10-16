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
  ]),
  {
    rules: {
      // Tailwind v4's "suggestCanonicalClasses" rule flags older but perfectly
      // valid class names (e.g., min-w-[200px] vs min-w-50, bg-gradient-to-br
      // vs bg-linear-to-br). These are cosmetic preferences, not bugs.
      // We'll do a dedicated Tailwind modernization pass later if desired.
      "tailwindcss/suggestCanonicalClasses": "off",
    },
  },
]);

export default eslintConfig;