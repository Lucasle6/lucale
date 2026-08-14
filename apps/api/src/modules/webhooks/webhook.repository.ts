/**
 * Acceso a datos de los webhooks.
 */

import { OrderStatus, Prisma, prisma } from "@bodegon/db";

/** Qué pasó al intentar registrar un evento entrante. */
export type RegistroDeEvento =
  /** Primera vez que lo vemos: hay que procesarlo. */
  | { estado: "nuevo"; id: string }
  /** Ya lo procesamos con éxito: no hacer nada. */
  | { estado: "ya-procesado" }
  /** Otra entrega lo está procesando AHORA MISMO: no duplicar el trabajo. */
  | { estado: "en-vuelo" }
  /** Lo vimos antes y falló: Stripe reintenta y volvemos a intentarlo. */
  | { estado: "reintento"; id: string };

/**
 * Cuánto puede estar un evento "en vuelo" antes de darlo por abandonado.
 *
 * Si el proceso muere entre insertar la fila y marcar el resultado, esa fila se
 * queda sin `processedAt` y sin `error` para siempre. Pasado este tiempo se
 * asume que nadie lo está procesando y se permite reintentarlo, para que un
 * reinicio en mal momento no deje un pago sin aplicar.
 */
const MINUTOS_ANTES_DE_DAR_POR_ABANDONADO = 5;

/**
 * Registra el evento, y de paso decide si toca procesarlo.
 *
 * LA IDEMPOTENCIA ES LA RESTRICCIÓN `@unique` DE `externalId`, no un `if`.
 *
 * Comprobar antes con un SELECT y luego insertar deja una ventana entre las
 * dos consultas: dos entregas simultáneas del mismo evento pasarían las dos la
 * comprobación y se procesarían dos veces. Aquí se intenta insertar y es la
 * BASE DE DATOS la que arbitra — solo una de las dos gana, siempre.
 *
 * La distinción entre "ya procesado" y "reintento" importa: si diéramos por
 * visto cualquier evento repetido, un fallo transitorio (la base caída medio
 * segundo) dejaría un pago sin aplicar para siempre, porque el reintento de
 * Stripe chocaría con la fila que escribimos justo antes de fallar.
 */
export async function registrarEvento(evento: {
  externalId: string;
  type: string;
  payload: Prisma.InputJsonValue;
}): Promise<RegistroDeEvento> {
  try {
    const creado = await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        externalId: evento.externalId,
        type: evento.type,
        payload: evento.payload,
      },
      select: { id: true },
    });
    return { estado: "nuevo", id: creado.id };
  } catch (error) {
    // P2002 = violación de restricción única. Es decir: ya lo habíamos visto.
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }

    const existente = await prisma.webhookEvent.findUniqueOrThrow({
      where: { externalId: evento.externalId },
      select: { id: true, processedAt: true, error: true, createdAt: true },
    });

    if (existente.processedAt !== null) return { estado: "ya-procesado" };

    /**
     * PROCESADO, FALLIDO Y EN VUELO SON TRES COSAS DISTINTAS.
     *
     * La primera versión solo miraba `processedAt`, y trataba cualquier fila sin
     * él como un intento fallido que había que repetir. Eso abría una ventana:
     * tres entregas simultáneas del mismo evento veían `processedAt` en null
     * —porque la primera aún no había terminado— y las tres procesaban. El
     * inventario se descontaba tres veces.
     *
     * Lo cazó la integración continua, no las pruebas locales: aquí la primera
     * entrega terminaba antes de que las otras miraran, y en un runner más
     * lento no.
     *
     * `error` es lo que distingue "falló" de "está ocurriendo ahora": solo se
     * escribe cuando un intento se cayó de verdad.
     */
    if (existente.error !== null) return { estado: "reintento", id: existente.id };

    const abandonadoDesde = new Date(
      Date.now() - MINUTOS_ANTES_DE_DAR_POR_ABANDONADO * 60 * 1000,
    );
    if (existente.createdAt < abandonadoDesde) {
      return { estado: "reintento", id: existente.id };
    }

    return { estado: "en-vuelo" };
  }
}

export function marcarProcesado(id: string): Promise<{ id: string }> {
  return prisma.webhookEvent.update({
    where: { id },
    data: { processedAt: new Date(), error: null },
    select: { id: true },
  });
}

/** Deja el fallo escrito para poder investigarlo sin bucear en los logs. */
export function marcarFallido(id: string, mensaje: string): Promise<{ id: string }> {
  return prisma.webhookEvent.update({
    where: { id },
    // processedAt sigue en null a propósito: así el reintento de Stripe lo
    // vuelve a intentar en vez de darlo por hecho.
    data: { error: mensaje.slice(0, 1000) },
    select: { id: true },
  });
}

// ─── Pedidos ─────────────────────────────────────────────────────────────────

const ordenParaConfirmarSelect = {
  id: true,
  orderNumber: true,
  status: true,
  totalCents: true,
  userId: true,
  email: true,
  items: {
    select: { id: true, variantId: true, quantity: true, productNameSnapshot: true },
  },
} satisfies Prisma.OrderSelect;

export type OrdenParaConfirmar = Prisma.OrderGetPayload<{
  select: typeof ordenParaConfirmarSelect;
}>;

export function buscarOrden(orderId: string): Promise<OrdenParaConfirmar | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: ordenParaConfirmarSelect,
  });
}

/** Resultado de intentar descontar una línea del inventario. */
export interface FaltanteDeStock {
  variantId: string;
  productName: string;
  pedidas: number;
}

/**
 * Marca el pedido como pagado y descuenta el inventario, todo o nada.
 *
 * Dos cosas que merecen atención.
 *
 * PRIMERA: la transición de estado va en el `where`, no en un `if` previo.
 * `status: PENDING` dentro de la condición hace que la actualización solo
 * ocurra si el pedido sigue pendiente. Si dos entregas del mismo evento llegan
 * a la vez, la segunda no encuentra fila que actualizar y devuelve 0. La base
 * arbitra otra vez, en lugar de que lo haga una comprobación que puede quedar
 * obsoleta entre la lectura y la escritura.
 *
 * SEGUNDA: el descuento de stock lleva su propia guarda, `stock: { gte: n }`.
 * Sin ella, dos pedidos simultáneos de la última unidad dejarían el inventario
 * en -1 y prometerías mercancía que no tienes.
 */
export async function confirmarPago(
  orden: OrdenParaConfirmar,
  paymentIntentId: string | null,
  cartId: string | null,
): Promise<{ aplicado: boolean; faltantes: FaltanteDeStock[] }> {
  return prisma.$transaction(async (tx) => {
    const actualizados = await tx.order.updateMany({
      // La condición ES la máquina de estados: solo PENDING puede pasar a PAID.
      where: { id: orden.id, status: OrderStatus.PENDING },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
        ...(paymentIntentId === null ? {} : { stripePaymentIntentId: paymentIntentId }),
      },
    });

    // 0 = alguien se nos adelantó, o el pedido ya no estaba pendiente.
    if (actualizados.count === 0) {
      return { aplicado: false, faltantes: [] };
    }

    const faltantes: FaltanteDeStock[] = [];

    for (const linea of orden.items) {
      if (linea.variantId === null) continue;

      const descontados = await tx.productVariant.updateMany({
        // La guarda que impide el stock negativo.
        where: { id: linea.variantId, stock: { gte: linea.quantity } },
        data: { stock: { decrement: linea.quantity } },
      });

      if (descontados.count === 0) {
        faltantes.push({
          variantId: linea.variantId,
          productName: linea.productNameSnapshot,
          pedidas: linea.quantity,
        });
      }
    }

    // El carrito se vacía AQUÍ, no al ir a pagar: quien abandonó la pantalla
    // de Stripe conserva lo que había elegido.
    //
    // Se vacía por `cartId`, que viaja en los metadatos de la sesión, y NO por
    // userId. Comprobar el usuario dejaría intacto el carrito de quien compra
    // sin cuenta — es decir, de la mayoría— y ese carrito lleno después de
    // pagar invita a pagar dos veces lo mismo.
    if (cartId !== null) {
      await tx.cartItem.deleteMany({ where: { cartId } });
    } else if (orden.userId !== null) {
      // Respaldo para pedidos anteriores a que se anotara el carrito.
      await tx.cartItem.deleteMany({ where: { cart: { userId: orden.userId } } });
    }

    return { aplicado: true, faltantes };
  });
}

/** Cancela un pedido cuya sesión de pago caducó sin completarse. */
export async function cancelarPorCaducidad(orderId: string): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
  });
  return count > 0;
}
