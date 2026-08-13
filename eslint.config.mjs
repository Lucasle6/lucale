import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/generated/**",
    ],
  },

  js.configs.recommended,

  {
    // Reglas con información de tipos: typescript-eslint lee el tsconfig y puede
    // detectar cosas que el análisis sintáctico no ve, como una promesa sin await.
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // Archivos de configuración que NO pertenecen a ningún tsconfig
          // (viven junto a él, fuera de su `include`). Sin esto, el análisis
          // con tipos los rechaza por no encontrarles proyecto.
          //
          // La lista es explícita a propósito: un patrón amplio como
          // `*/*/*.config.ts` también captura next.config.ts, que SÍ está
          // dentro del proyecto de la app web, y eso provoca el error opuesto.
          allowDefaultProject: [
            "*.config.ts",
            "apps/*/vitest.config.ts",
            // packages/shared tiene su propio runner desde el Día 11: la
            // aritmética del IVA se prueba donde vive, no desde la API.
            "packages/*/vitest.config.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // Un argumento con guion bajo delante señala "sé que no lo uso, es a propósito".
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `import type` se borra al compilar. Marcarlo explícitamente evita arrastrar
      // módulos enteros al bundle solo por importar un tipo.
      "@typescript-eslint/consistent-type-imports": "error",
      // Toda promesa se espera o se descarta con `void`. Es el origen de los errores
      // que desaparecen sin dejar rastro en los logs.
      "@typescript-eslint/no-floating-promises": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Debe ir el último: apaga las reglas de formato de ESLint para que no peleen
  // con Prettier. ESLint se ocupa de la corrección; Prettier, del formato.
  prettier,
);
