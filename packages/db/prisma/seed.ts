/**
 * Datos de ejemplo para desarrollo.
 *
 * Siembra un catálogo de impresiones 3D con categorías en árbol, productos y
 * variantes. Sirve para trabajar contra datos realistas desde el primer día de
 * frontend y para que quien clone el repo tenga una tienda funcional con un
 * solo comando.
 *
 * Es idempotente: borra antes de sembrar, así que se puede correr las veces
 * que haga falta.
 *
 *   pnpm --filter @bodegon/db seed
 */

import { toCents } from "@bodegon/shared";
import { PrismaClient, ProductStatus } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

/** Borra el catálogo existente respetando el orden de las llaves foráneas. */
async function limpiar(): Promise<void> {
  // Primero las hijas, luego las padres: la integridad referencial impide
  // borrar un producto que todavía tiene variantes colgando.
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
}

async function main(): Promise<void> {
  console.warn("Limpiando catálogo anterior...");
  await limpiar();

  // ── Categorías (árbol de dos niveles) ──────────────────────────────────────
  console.warn("Creando categorías...");

  const decoracion = await prisma.category.create({
    data: { name: "Decoración", slug: "decoracion", position: 1 },
  });
  const escritorio = await prisma.category.create({
    data: { name: "Escritorio", slug: "escritorio", position: 2 },
  });
  const utilidad = await prisma.category.create({
    data: { name: "Utilidad", slug: "utilidad", position: 3 },
  });

  const macetas = await prisma.category.create({
    data: { name: "Macetas", slug: "macetas", position: 1, parentId: decoracion.id },
  });
  const figuras = await prisma.category.create({
    data: { name: "Figuras", slug: "figuras", position: 2, parentId: decoracion.id },
  });
  const organizadores = await prisma.category.create({
    data: {
      name: "Organizadores",
      slug: "organizadores",
      position: 1,
      parentId: escritorio.id,
    },
  });

  // ── Productos ──────────────────────────────────────────────────────────────
  // Los precios se escriben legibles y toCents los pasa a centavos enteros.
  console.warn("Creando productos y variantes...");

  const productos = [
    {
      name: "Maceta Hexagonal",
      slug: "maceta-hexagonal",
      description:
        "Maceta geométrica de líneas limpias, ideal para suculentas. Impresa en PLA mate con acabado texturizado.",
      categoryId: macetas.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Pequeña", sku: "MAC-HEX-S", price: 149.9, stock: 24, weight: 85 },
        { size: "Mediana", sku: "MAC-HEX-M", price: 219.9, stock: 18, weight: 140 },
        { size: "Grande", sku: "MAC-HEX-L", price: 319.9, stock: 9, weight: 230 },
      ],
    },
    {
      name: "Maceta Ondulada",
      slug: "maceta-ondulada",
      description:
        "Superficie ondulada que juega con la luz. Incluye plato de drenaje integrado.",
      categoryId: macetas.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Pequeña", sku: "MAC-OND-S", price: 169.9, stock: 15, weight: 95 },
        { size: "Grande", sku: "MAC-OND-L", price: 349.9, stock: 7, weight: 250 },
      ],
    },
    {
      name: "Macetero Colgante",
      slug: "macetero-colgante",
      description:
        "Diseño suspendido con cuerda de algodón natural. Para plantas de sombra.",
      categoryId: macetas.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Mediana", sku: "MAC-COL-M", price: 279.9, stock: 12, weight: 165 },
      ],
    },
    {
      name: "Lámpara Luna",
      slug: "lampara-luna",
      description:
        "Réplica topográfica de la superficie lunar con luz cálida regulable. Base de madera incluida.",
      categoryId: decoracion.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "12 cm", sku: "LAM-LUN-12", price: 449.9, stock: 11, weight: 320 },
        { size: "18 cm", sku: "LAM-LUN-18", price: 689.9, stock: 5, weight: 540 },
      ],
    },
    {
      name: "Figura Origami Zorro",
      slug: "figura-origami-zorro",
      description: "Escultura de facetas inspirada en el papiroflexia. Acabado satinado.",
      categoryId: figuras.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Pequeña", sku: "FIG-ZOR-S", price: 189.9, stock: 20, weight: 70 },
        { size: "Grande", sku: "FIG-ZOR-L", price: 379.9, stock: 8, weight: 195 },
      ],
    },
    {
      name: "Figura Origami Ballena",
      slug: "figura-origami-ballena",
      description: "Pieza de la misma serie que el zorro. Se puede colgar o apoyar.",
      categoryId: figuras.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Pequeña", sku: "FIG-BAL-S", price: 189.9, stock: 16, weight: 75 },
        { size: "Grande", sku: "FIG-BAL-L", price: 379.9, stock: 6, weight: 205 },
      ],
    },
    {
      name: "Organizador de Escritorio",
      slug: "organizador-escritorio",
      description:
        "Compartimentos para plumas, clips y tarjetas. Base antideslizante de silicona.",
      categoryId: organizadores.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "3 divisiones", sku: "ORG-ESC-3", price: 259.9, stock: 22, weight: 180 },
        { size: "5 divisiones", sku: "ORG-ESC-5", price: 389.9, stock: 14, weight: 270 },
      ],
    },
    {
      name: "Soporte para Audífonos",
      slug: "soporte-audifonos",
      description:
        "Curva ergonómica que respeta la diadema. Peso equilibrado, no se voltea.",
      categoryId: organizadores.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Única", sku: "SOP-AUD-U", price: 229.9, stock: 19, weight: 210 },
      ],
    },
    {
      name: "Portalápices Modular",
      slug: "portalapices-modular",
      description: "Módulos que se ensamblan entre sí. Crece con tu escritorio.",
      categoryId: organizadores.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Módulo simple", sku: "POR-MOD-1", price: 129.9, stock: 30, weight: 90 },
        { size: "Set de 3", sku: "POR-MOD-3", price: 339.9, stock: 12, weight: 265 },
      ],
    },
    {
      name: "Soporte para Celular",
      slug: "soporte-celular",
      description: "Ángulo de 60° para videollamadas. Ranura para el cable de carga.",
      categoryId: utilidad.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Única", sku: "SOP-CEL-U", price: 159.9, stock: 28, weight: 75 },
      ],
    },
    {
      name: "Gancho Adhesivo Reforzado",
      slug: "gancho-adhesivo-reforzado",
      description: "Soporta hasta 3 kg. Se vende por par, con cinta 3M incluida.",
      categoryId: utilidad.id,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Par", sku: "GAN-ADH-2", price: 99.9, stock: 40, weight: 45 },
        { size: "Set de 6", sku: "GAN-ADH-6", price: 249.9, stock: 17, weight: 130 },
      ],
    },
    {
      name: "Prototipo Lámpara Origami",
      slug: "prototipo-lampara-origami",
      description:
        "Todavía en pruebas de resistencia térmica. No visible en la tienda hasta aprobarse.",
      categoryId: decoracion.id,
      // En borrador a propósito: demuestra que DRAFT no aparece en la tienda.
      status: ProductStatus.DRAFT,
      variants: [
        { size: "Prototipo", sku: "PRO-LAM-X", price: 599.9, stock: 2, weight: 410 },
      ],
    },
  ];

  for (const producto of productos) {
    const { variants, ...datosProducto } = producto;
    await prisma.product.create({
      data: {
        ...datosProducto,
        // Escritura anidada: producto y variantes en una sola operación, dentro
        // de la misma transacción. No puede quedar un producto sin variantes.
        variants: {
          create: variants.map((v) => ({
            size: v.size,
            sku: v.sku,
            priceCents: toCents(v.price), // legible → centavos enteros
            stock: v.stock,
            weightGrams: v.weight,
          })),
        },
      },
    });
  }

  // ── Resumen ────────────────────────────────────────────────────────────────
  const [categorias, totalProductos, activos, variantes] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.productVariant.count(),
  ]);

  console.warn(
    [
      "",
      "Seed completado:",
      `  ${String(categorias)} categorías`,
      `  ${String(totalProductos)} productos (${String(activos)} activos, ${String(totalProductos - activos)} en borrador)`,
      `  ${String(variantes)} variantes`,
      "",
    ].join("\n"),
  );
}

try {
  await main();
} catch (error) {
  console.error("El seed falló:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
