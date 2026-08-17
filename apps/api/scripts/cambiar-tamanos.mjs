/**
 * Reajusta la línea de presentaciones en mililitros a 125 / 250 / 750 ml.
 *
 * Decidido por los dueños el 15 de agosto de 2026: el litro resultaba
 * demasiado grande para el uso real del producto.
 *
 * QUÉ NO TOCA. Solo variantes cuyo tamaño esté en mililitros o litros. Las
 * sales (80 g), el chile molido (60 g), la miel (330 g), las cucharas (25 cm) y
 * los molcajetes ("Mediano", "Grande") se quedan como están: su unidad no es de
 * volumen y meterlas en esta línea no significaría nada.
 *
 * CÓMO ASIGNA. Por RANGO dentro de cada producto, no por cercanía al valor
 * viejo. La cercanía provoca colisiones —200 ml y 400 ml caen los dos en 250—
 * y dos variantes del mismo producto no pueden llamarse igual.
 *
 *   1 variante  → 250 ml
 *   2 variantes → 250 y 750 ml
 *   3 variantes → 125, 250 y 750 ml
 *
 * LOS PRECIOS NO SE TOCAN, por instrucción expresa. Tiene una consecuencia que
 * conviene tener presente: en Salsa Macha de Cacahuate, el único producto con
 * tres presentaciones, las dos pequeñas pasan a la mitad de volumen por el
 * mismo dinero — el precio por mililitro se duplica. En el resto del catálogo
 * ocurre lo contrario y el producto sale más barato por mililitro.
 *
 *   node apps/api/scripts/cambiar-tamanos.mjs            # local, simulando
 *   node apps/api/scripts/cambiar-tamanos.mjs --aplicar  # local, de verdad
 *   node apps/api/scripts/cambiar-tamanos.mjs --produccion --aplicar
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@bodegon/db";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

const esProduccion = process.argv.includes("--produccion");
const aplicar = process.argv.includes("--aplicar");

/** Lee una variable de un .env sin depender de ninguna librería. */
async function leerEnv(archivo, clave) {
  let texto;
  try {
    texto = await readFile(path.join(repoRoot, archivo), "utf8");
  } catch {
    return null;
  }
  for (const linea of texto.split("\n")) {
    const l = linea.trim();
    if (l.startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    if (l.slice(0, i).trim() !== clave) continue;
    return l
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return null;
}

const archivoEnv = esProduccion ? ".env.produccion.local" : ".env";
const databaseUrl =
  process.env.DATABASE_URL ?? (await leerEnv(archivoEnv, "DATABASE_URL"));
if (databaseUrl === null) {
  process.stderr.write(`\n✖  No encuentro DATABASE_URL en ${archivoEnv}\n\n`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

/** Devuelve el volumen en ml, o null si la unidad no es de volumen. */
function volumenEnMl(tamano) {
  const t = tamano.trim();
  const enMl = /^(\d+)\s*ml$/i.exec(t);
  if (enMl !== null) return Number(enMl[1]);
  const enLitros = /^([\d.]+)\s*l$/i.exec(t);
  if (enLitros !== null) return Math.round(Number(enLitros[1]) * 1000);
  return null;
}

const LINEA_NUEVA = { 1: [250], 2: [250, 750], 3: [125, 250, 750] };

try {
  const productos = await prisma.product.findMany({
    select: {
      name: true,
      variants: { select: { id: true, size: true, priceCents: true } },
    },
    orderBy: { name: "asc" },
  });

  process.stdout.write(
    `\n  base: ${esProduccion ? "PRODUCCIÓN" : "local"}   modo: ${aplicar ? "APLICANDO" : "simulación"}\n`,
  );

  let cambios = 0;

  for (const producto of productos) {
    const enVolumen = producto.variants
      .map((v) => ({ ...v, ml: volumenEnMl(v.size) }))
      .filter((v) => v.ml !== null)
      .sort((a, b) => a.ml - b.ml);

    if (enVolumen.length === 0) continue;

    const destino = LINEA_NUEVA[enVolumen.length];
    if (destino === undefined) {
      process.stdout.write(
        `\n  ${producto.name}: ${String(enVolumen.length)} presentaciones, sin regla definida. Se omite.\n`,
      );
      continue;
    }

    process.stdout.write(`\n  ${producto.name}\n`);

    for (const [indice, variante] of enVolumen.entries()) {
      const nuevoTamano = `${String(destino[indice])} ml`;
      if (variante.size === nuevoTamano) {
        process.stdout.write(`    ${variante.size.padEnd(7)} sin cambio\n`);
        continue;
      }

      process.stdout.write(`    ${variante.size.padEnd(7)} → ${nuevoTamano}\n`);
      cambios += 1;

      if (aplicar) {
        await prisma.productVariant.update({
          where: { id: variante.id },
          data: { size: nuevoTamano },
        });
      }
    }
  }

  process.stdout.write(
    aplicar
      ? `\n  ${String(cambios)} variantes actualizadas.\n\n`
      : `\n  ${String(cambios)} variantes cambiarían. Añade --aplicar para hacerlo.\n\n`,
  );
} finally {
  await prisma.$disconnect();
}
