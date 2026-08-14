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

  /**
   * Ningún origen escrito a mano dentro de una vista.
   *
   * Se acota a `app/` y `components/` a propósito: en `lib/` y en `proxy.ts` un
   * `http://localhost:4000` es un valor por defecto legítimo, la única puerta
   * por la que entra la configuración. En una vista, en cambio, siempre es un
   * error — significa que alguien compuso una URL saltándose esa puerta.
   *
   * No es una regla teórica. La lista de productos del panel llevaba
   * `src={`http://localhost:4000${url}`}` con una nota de "se arregla el Día
   * 15" que nadie volvió a leer. No mostró una sola imagen en producción, y
   * nadie lo notó porque desde fuera no fallaba nada: la parte pública iba bien.
   */
  {
    files: ["apps/*/src/app/**/*.tsx", "apps/*/src/components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        // `schema.org` y `w3.org` quedan fuera: no son servidores a los que se
        // pida nada, son VOCABULARIOS. `https://schema.org/InStock` es un
        // identificador que los buscadores leen como una palabra, y cambiarlo
        // por una variable no arreglaría nada — rompería el marcado.
        //
        // La exclusión no es un parche por comodidad: una regla que salta donde
        // no hay problema se acaba desactivando entera, y ese día vuelve a
        // colarse el localhost de verdad.
        {
          selector: "Literal[value=/^https?:\\/\\/(?!schema\\.org|www\\.w3\\.org)/]",
          message:
            "No escribas un origen a mano en una vista. Compón la URL con urlDeImagen() de @bodegon/shared, o tómalo de lib/api.",
        },
        {
          selector:
            "TemplateElement[value.raw=/https?:\\/\\/(?!schema\\.org|www\\.w3\\.org)/]",
          message:
            "No escribas un origen a mano en una vista. Compón la URL con urlDeImagen() de @bodegon/shared, o tómalo de lib/api.",
        },
      ],
    },
  },

  // Debe ir el último: apaga las reglas de formato de ESLint para que no peleen
  // con Prettier. ESLint se ocupa de la corrección; Prettier, del formato.
  prettier,
);
