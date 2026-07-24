/**
 * @bodegon/db — acceso a la base de datos.
 *
 * Exporta una única instancia compartida de PrismaClient. Importa: cada
 * instancia abre su propio pool de conexiones a Postgres, así que crear varias
 * agotaría el límite del servidor. Toda la aplicación usa esta.
 */

import { PrismaClient } from "./generated/prisma/index.js";

export const prisma = new PrismaClient();

// Reexporta los tipos y enums generados (User, Product, OrderStatus, ...) para
// que el resto del monorepo importe todo desde "@bodegon/db".
export * from "./generated/prisma/index.js";
