/**
 * @bodegon/shared — contratos y utilidades que comparten la API y el frontend.
 *
 * Todo lo que viva aquí lo importan los dos lados. Ese es el punto: si cambia un
 * esquema Zod de este paquete, la compilación se rompe en la API *y* en el
 * formulario que lo consume, en el mismo instante. Un contrato roto deja de ser
 * un bug de producción y pasa a ser un error de compilación.
 */

export * from "./money.js";
export * from "./slug.js";
