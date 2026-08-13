/**
 * Datos de ejemplo para desarrollo.
 *
 * Siembra un catálogo de salsas, aceites infusionados y utensilios de cocina,
 * con categorías en árbol, productos y variantes. Sirve para trabajar contra
 * datos realistas y para que quien clone el repo tenga una tienda funcional con
 * un solo comando.
 *
 * El catálogo mezcla los dos regímenes fiscales a propósito: los alimentos
 * llevan tasa 0% y los utensilios 16%. Sin esa mezcla, el cálculo de IVA por
 * línea nunca se ejercitaría en desarrollo y un error ahí pasaría inadvertido.
 *
 * Es idempotente: borra antes de sembrar, así que se puede correr las veces
 * que haga falta.
 *
 *   pnpm --filter @bodegon/db seed
 */

import { TAX_RATE_STANDARD_BPS, TAX_RATE_ZERO_BPS, toCents } from "@bodegon/shared";
import { PrismaClient, ProductStatus } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Alias con nombre de negocio, no de impuesto.
 *
 * Quien da de alta un producto no se pregunta "¿1600 o 0?", se pregunta "¿esto
 * se come?". El código debería preguntar lo mismo.
 */
const SE_COME = TAX_RATE_ZERO_BPS; // art. 2-A de la Ley del IVA
const NO_SE_COME = TAX_RATE_STANDARD_BPS;

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

  const salsas = await prisma.category.create({
    data: { name: "Salsas", slug: "salsas", position: 1 },
  });
  const aceites = await prisma.category.create({
    data: { name: "Aceites", slug: "aceites", position: 2 },
  });
  const despensa = await prisma.category.create({
    data: { name: "Despensa", slug: "despensa", position: 3 },
  });
  const utensilios = await prisma.category.create({
    data: { name: "Utensilios", slug: "utensilios", position: 4 },
  });

  const machas = await prisma.category.create({
    data: { name: "Machas", slug: "machas", position: 1, parentId: salsas.id },
  });
  const picantes = await prisma.category.create({
    data: { name: "Picantes", slug: "picantes", position: 2, parentId: salsas.id },
  });
  const salesEspecias = await prisma.category.create({
    data: {
      name: "Sales y especias",
      slug: "sales-y-especias",
      position: 1,
      parentId: despensa.id,
    },
  });
  const mieles = await prisma.category.create({
    data: { name: "Mieles", slug: "mieles", position: 2, parentId: despensa.id },
  });

  // ── Productos ──────────────────────────────────────────────────────────────
  // Los precios se escriben legibles y toCents los pasa a centavos enteros.
  //
  // Los pesos son de producto envasado, con el frasco incluido: un tarro de
  // vidrio de 250 ml pesa cerca de medio kilo lleno. De ahí sale el cálculo de
  // envío, y por eso no se pueden inventar a la ligera.
  console.warn("Creando productos y variantes...");

  const productos = [
    // ── Salsas macha ─────────────────────────────────────────────────────────
    {
      name: "Salsa Macha de Cacahuate",
      slug: "salsa-macha-cacahuate",
      description:
        "Chile morita y guajillo tostados a fuego lento, con cacahuate y ajo en aceite de oliva. Picor medio, textura crujiente.",
      categoryId: machas.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "250 ml", sku: "SAL-MAC-CAC-250", price: 180, stock: 40, weight: 450 },
        { size: "500 ml", sku: "SAL-MAC-CAC-500", price: 320, stock: 22, weight: 800 },
        // Formato de restaurante. Tres presentaciones con tres precios es lo
        // que la prueba del catálogo usa para comprobar que el modelo de
        // variantes llega intacto hasta la respuesta HTTP.
        { size: "1 L", sku: "SAL-MAC-CAC-1L", price: 580, stock: 8, weight: 1500 },
      ],
    },
    {
      name: "Salsa Macha de Ajonjolí",
      slug: "salsa-macha-ajonjoli",
      description:
        "La misma base de chiles tostados, con ajonjolí en lugar de cacahuate. Apta para quien evita los frutos secos.",
      categoryId: machas.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "250 ml", sku: "SAL-MAC-AJO-250", price: 185, stock: 30, weight: 450 },
      ],
    },

    // ── Salsas picantes ──────────────────────────────────────────────────────
    {
      name: "Salsa de Habanero Tatemado",
      slug: "salsa-habanero-tatemado",
      description:
        "Habanero yucateco tatemado en comal, con cebolla morada y jugo de naranja agria. Pica de verdad.",
      categoryId: picantes.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "200 ml", sku: "SAL-HAB-200", price: 95, stock: 45, weight: 380 },
        { size: "400 ml", sku: "SAL-HAB-400", price: 165, stock: 25, weight: 690 },
      ],
    },
    {
      name: "Salsa de Chile Morita",
      slug: "salsa-chile-morita",
      description:
        "Ahumada y espesa, de picor amable. La de diario, para huevos y tacos de canasta.",
      categoryId: picantes.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "200 ml", sku: "SAL-MOR-200", price: 95, stock: 38, weight: 380 },
      ],
    },
    {
      name: "Salsa de Chile de Árbol",
      slug: "salsa-chile-de-arbol",
      description:
        "Chile de árbol y ajo, sin más. Picor directo y seco, sin dulzor que lo suavice.",
      categoryId: picantes.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "200 ml", sku: "SAL-ARB-200", price: 89, stock: 33, weight: 380 },
      ],
    },

    // ── Aceites infusionados ─────────────────────────────────────────────────
    {
      name: "Aceite de Ajo Rostizado",
      slug: "aceite-ajo-rostizado",
      description:
        "Aceite de oliva infusionado en frío con ajo rostizado durante dos semanas. Para pastas, pan y verduras al horno.",
      categoryId: aceites.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "250 ml", sku: "ACE-AJO-250", price: 220, stock: 28, weight: 470 },
        { size: "500 ml", sku: "ACE-AJO-500", price: 390, stock: 15, weight: 830 },
      ],
    },
    {
      name: "Aceite de Chile de Árbol",
      slug: "aceite-chile-de-arbol",
      description:
        "Picante y limpio. Unas gotas bastan para levantar una sopa o una pizza.",
      categoryId: aceites.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "250 ml", sku: "ACE-ARB-250", price: 220, stock: 24, weight: 470 },
      ],
    },
    {
      name: "Aceite de Romero y Limón",
      slug: "aceite-romero-limon",
      description:
        "Romero fresco y ralladura de limón amarillo. El más suave de los tres, para pescados y ensaladas.",
      categoryId: aceites.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "250 ml", sku: "ACE-ROM-250", price: 235, stock: 18, weight: 470 },
      ],
    },

    // ── Despensa ─────────────────────────────────────────────────────────────
    {
      name: "Sal de Gusano",
      slug: "sal-de-gusano",
      description:
        "Gusano de maguey, sal de mar y chile pasilla, molidos en metate. Para el mezcal y para la fruta.",
      categoryId: salesEspecias.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "80 g", sku: "DES-SAL-GUS-80", price: 85, stock: 50, weight: 150 },
      ],
    },
    {
      name: "Chile Piquín Molido",
      slug: "chile-piquin-molido",
      description: "Piquín seco de Veracruz, molido grueso. Pica más de lo que aparenta.",
      categoryId: salesEspecias.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [{ size: "60 g", sku: "DES-PIQ-60", price: 75, stock: 44, weight: 120 }],
    },
    {
      name: "Miel de Agave con Vainilla",
      slug: "miel-agave-vainilla",
      description:
        "Agave azul con vaina de vainilla de Papantla infusionada en frío. Para café, yogur y hot cakes.",
      categoryId: mieles.id,
      taxRateBps: SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "330 g", sku: "DES-MIE-VAI-330", price: 145, stock: 26, weight: 560 },
      ],
    },

    // ── Utensilios ───────────────────────────────────────────────────────────
    // Estos NO son alimento: llevan 16%. Es lo que obliga a que la tasa viva en
    // el producto y no en una constante global.
    {
      name: "Cuchara de Madera de Encino",
      slug: "cuchara-madera-encino",
      description:
        "Tallada a mano en encino, tratada con aceite de linaza. No raya el sartén ni transmite el calor.",
      categoryId: utensilios.id,
      taxRateBps: NO_SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "25 cm", sku: "UTE-CUC-25", price: 80, stock: 30, weight: 95 },
        { size: "30 cm", sku: "UTE-CUC-30", price: 95, stock: 25, weight: 120 },
      ],
    },
    {
      name: "Molcajete de Piedra Volcánica",
      slug: "molcajete-piedra-volcanica",
      description:
        "Basalto curado y listo para usar. Pesa lo que debe pesar: si es ligero, no es piedra.",
      categoryId: utensilios.id,
      taxRateBps: NO_SE_COME,
      status: ProductStatus.ACTIVE,
      variants: [
        { size: "Mediano (18 cm)", sku: "UTE-MOL-M", price: 650, stock: 8, weight: 3200 },
        { size: "Grande (22 cm)", sku: "UTE-MOL-G", price: 890, stock: 4, weight: 4800 },
      ],
    },

    // ── En borrador ──────────────────────────────────────────────────────────
    {
      name: "Salsa Macha con Chapulín",
      slug: "salsa-macha-chapulin",
      description:
        "En pruebas de conservación. No visible en la tienda hasta validar la caducidad.",
      categoryId: machas.id,
      taxRateBps: SE_COME,
      // En borrador a propósito: demuestra que DRAFT no aparece en la tienda.
      status: ProductStatus.DRAFT,
      variants: [
        { size: "250 ml", sku: "SAL-MAC-CHA-250", price: 260, stock: 6, weight: 450 },
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
  const [categorias, totalProductos, activos, variantes, conIva] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
    prisma.productVariant.count(),
    prisma.product.count({ where: { taxRateBps: TAX_RATE_STANDARD_BPS } }),
  ]);

  console.warn(
    [
      "",
      "Seed completado:",
      `  ${String(categorias)} categorías`,
      `  ${String(totalProductos)} productos (${String(activos)} activos, ${String(totalProductos - activos)} en borrador)`,
      `  ${String(variantes)} variantes`,
      `  ${String(totalProductos - conIva)} con tasa 0% (alimentos), ${String(conIva)} con 16%`,
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
