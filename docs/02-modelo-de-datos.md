# Modelo de datos — LuCaLe

PostgreSQL 17 vía Prisma. Este es el diseño objetivo del **Día 2**; el esquema real vivirá
en `packages/db/prisma/schema.prisma`.

---

## Reglas que aplican a todo el esquema

1. **IDs `uuid` v7**, no enteros autoincrementales. Un ID secuencial le dice al mundo
   cuántas órdenes llevas y permite enumerar recursos ajenos. v7 mantiene el orden temporal
   para que los índices no se fragmenten.
2. **Dinero en centavos enteros** (`Int`), nunca `Float` ni `Decimal` de punto flotante.
   `0.1 + 0.2 !== 0.3`; en dinero eso es un descuadre contable.
3. **`createdAt` / `updatedAt`** en toda tabla, sin excepción.
4. **Soft delete** (`deletedAt`) donde haya historial que preservar. Un producto vendido
   nunca se borra.
5. **Snapshots** en las órdenes: la orden guarda copia de nombre, tamaño y precio del
   momento de la compra, no una referencia viva.

---

## Entidades

### Identidad y sesión

**`User`**
`id` · `email` (único, `citext`) · `passwordHash` · `role` · `emailVerifiedAt` ·
`twoFactorSecret` (cifrado) · `twoFactorEnabledAt` · `failedLoginAttempts` ·
`lockedUntil` · `createdAt` · `updatedAt` · `deletedAt`

`role` ∈ `CUSTOMER` | `ADMIN` | `SUPER_ADMIN`.

> `citext` hace el email insensible a mayúsculas a nivel de base de datos. Sin él,
> `Jose@x.com` y `jose@x.com` son dos cuentas distintas — y eso es un vector de suplantación.

**`RefreshToken`**
`id` · `userId` · `tokenHash` · `familyId` · `expiresAt` · `revokedAt` · `replacedById` ·
`ip` · `userAgent` · `createdAt`

> El token se guarda **hasheado**, igual que una contraseña: si te roban la base de datos,
> no se llevan sesiones activas. `familyId` es lo que permite la detección de reuso — al
> rotar, el token viejo apunta al nuevo vía `replacedById`; si alguien presenta uno ya
> rotado, se revoca la familia completa.

**`VerificationToken`**
`id` · `userId` · `tokenHash` · `type` (`EMAIL_VERIFY` | `PASSWORD_RESET`) · `expiresAt` ·
`usedAt`

**`BackupCode`** — códigos de recuperación de 2FA, hasheados, de un solo uso.

**`Address`**
`id` · `userId` · `recipientName` · `line1` · `line2` · `city` · `state` · `postalCode` ·
`country` · `phone` · `isDefault`

### Catálogo

**`Category`** — `id` · `name` · `slug` (único) · `parentId` (jerarquía opcional) ·
`position`

**`Product`**
`id` · `name` · `slug` (único) · `description` · `categoryId` · `status` · `createdById` ·
`createdAt` · `updatedAt` · `deletedAt`

`status` ∈ `DRAFT` | `ACTIVE` | `ARCHIVED`. Un producto se crea en `DRAFT`: puedes armarlo
con calma sin que sea visible en la tienda.

**`ProductVariant`** — aquí viven tus tres atributos: nombre (heredado del producto),
**valor** y **tamaño**.
`id` · `productId` · `size` · `sku` (único) · `priceCents` · `currency` · `stock` ·
`weightGrams` · `deletedAt`

> El precio está en la **variante**, no en el producto: una impresión 3D grande cuesta más
> que la pequeña. Esta separación es lo que hace el modelo genérico — mañana `size` puede
> ser talla de ropa, capacidad, o lo que sea, sin migrar nada.

**`ProductImage`** — `id` · `productId` · `url` · `alt` · `position` · `width` · `height`

### Comercio

**`Cart`** — `id` · `userId` (nullable, para invitados) · `sessionToken` · `expiresAt`
**`CartItem`** — `id` · `cartId` · `variantId` · `quantity`

> El carrito guarda **solo IDs y cantidades**, jamás precios. El total se calcula en el
> servidor leyendo la base de datos, en cada request. Es la defensa contra manipulación de
> precios.

**`Order`**
`id` · `orderNumber` (legible, único) · `userId` (nullable) · `email` · `status` ·
`subtotalCents` · `shippingCents` · `taxCents` · `totalCents` · `currency` ·
`stripeSessionId` · `stripePaymentIntentId` · `shippingAddress` (JSON, snapshot) ·
`placedAt` · `paidAt` · `fulfilledAt` · `cancelledAt`

`status` ∈ `PENDING` | `PAID` | `PROCESSING` | `FULFILLED` | `CANCELLED` | `REFUNDED`.

**`OrderItem`**
`id` · `orderId` · `variantId` (referencia débil) · `productNameSnapshot` ·
`sizeSnapshot` · `skuSnapshot` · `unitPriceCents` · `quantity` · `lineTotalCents`

> Los `*Snapshot` son el punto importante. Si dentro de un año renombras el producto o
> subes el precio, la factura de hoy debe seguir diciendo lo que decía hoy. Guardar solo
> `variantId` te reescribiría la historia contable.

### Operación

**`AuditLog`** — `id` · `actorId` · `action` · `entityType` · `entityId` ·
`metadata` (jsonb) · `ip` · `userAgent` · `createdAt`

Cada acción administrativa deja rastro. Es append-only: nadie lo edita, ni el admin.

**`WebhookEvent`** — `id` · `provider` · `externalId` (**único**) · `type` ·
`payload` (jsonb) · `processedAt` · `error`

> La restricción de unicidad sobre `externalId` es toda la idempotencia. Stripe reenvía
> eventos ante cualquier duda de entrega; sin esto, un reenvío duplicaría la orden.

---

## Índices deliberados

| Tabla            | Índice                    | Para qué                      |
| ---------------- | ------------------------- | ----------------------------- |
| `User`           | `email` (único)           | login                         |
| `Product`        | `slug` (único)            | ficha de producto por URL     |
| `Product`        | `(status, categoryId)`    | listado filtrado de la tienda |
| `ProductVariant` | `sku` (único)             | búsqueda en admin             |
| `ProductVariant` | `productId`               | cargar variantes de una ficha |
| `Order`          | `orderNumber` (único)     | consulta del cliente          |
| `Order`          | `(userId, placedAt DESC)` | historial de pedidos          |
| `RefreshToken`   | `tokenHash` (único)       | validación en cada refresh    |
| `RefreshToken`   | `familyId`                | revocación en cascada         |
| `WebhookEvent`   | `externalId` (único)      | idempotencia                  |

---

## Transacciones críticas

Dos operaciones **deben** ir dentro de una transacción, o el sistema pierde dinero:

**1. Confirmación de pago** (webhook `checkout.session.completed`)

```
BEGIN
  registrar WebhookEvent          ← falla si es duplicado, y aborta todo
  Order.status → PAID
  decrementar stock de cada variante
  verificar que ningún stock quedó negativo
COMMIT
```

**2. Cancelación / reembolso** — devolver stock y cambiar estado, juntos o nada.

Sin transacción, un fallo a mitad de camino deja una orden pagada con el stock intacto
(vendes de más) o stock descontado sin orden (vendes de menos). Ambos son reales y ambos
duelen.
