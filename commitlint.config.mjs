/**
 * Commits convencionales: `tipo(ámbito): descripción`
 *
 *   feat(api): añade rotación de refresh tokens
 *   fix(web): corrige el cálculo del subtotal del carrito
 *   docs: actualiza el plan maestro
 *
 * No es burocracia: un historial con tipos consistentes se puede leer, filtrar y
 * convertir en changelog automáticamente. En la defensa, `git log --oneline` cuenta
 * la historia del proyecto solo.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["api", "web", "admin", "e2e", "db", "shared", "ui", "infra", "docs", "deps"],
    ],
    // El plan y los docs están en español; los mensajes también.
    "subject-case": [0],
    "header-max-length": [2, "always", 100],
  },
};
