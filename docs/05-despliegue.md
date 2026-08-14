# Despliegue y operación — LuCaLe

Todo lo necesario para poner esto en internet, y para operarlo después. Escrito
para que lo siga alguien que no participó en el proyecto.

---

## La forma en producción

```
                    ┌──────────────────────────┐
   navegador ──────▶│  Vercel · tienda         │  Next.js
                    │  lucale.mx               │  SSR + estáticos + CDN
                    └────────────┬─────────────┘
                                 │ fetch (CORS + CSRF)
                    ┌────────────▼─────────────┐
                    │  Railway · API           │  Fastify
                    │  api.lucale.mx           │
                    └────┬───────────────┬─────┘
                         │               │
              ┌──────────▼──────┐  ┌─────▼──────────┐
              │  Neon           │  │  Cloudflare R2 │
              │  PostgreSQL 17  │  │  imágenes      │
              └─────────────────┘  └────────────────┘

                    ┌──────────────────────────┐
   admin ──────────▶│  Vercel · panel          │  aplicación SEPARADA
                    │  admin.lucale.mx         │
                    └──────────────────────────┘
```

**Por qué el panel es otra aplicación y no una ruta.** Fue un requisito desde el
primer día: que un cliente no vea "siquiera nada relacionado con el dashboard".
Siendo otra aplicación en otro dominio, el código del panel **nunca se descarga**
al navegador de un cliente. Ocultar una ruta con un `if` deja el JavaScript en el
bundle público, y cualquiera lo lee.

**Por qué la API va aparte de Vercel.** Fastify es un servidor de larga vida con
un pool de conexiones a Postgres. Las funciones serverless se crean y destruyen,
y cada una abriría su propia conexión hasta agotar el límite de la base. Railway
mantiene un proceso, que es lo que este diseño necesita.

---

## Antes de desplegar

### 1. Decidir el dominio

Dos caminos válidos:

|                                 | Subdominio gratuito | Dominio propio         |
| ------------------------------- | ------------------- | ---------------------- |
| Coste                           | 0                   | ~600 MXN el primer año |
| Sirve para defender el proyecto | **Sí**              | Sí                     |
| Sirve para cobrar de verdad     | No                  | **Sí**                 |
| URL                             | `lucale.vercel.app` | `lucale.mx`            |

El subdominio gratuito de Vercel trae HTTPS y certificado renovado solo. Para la
defensa no cambia nada. El dominio propio hace falta el día que Stripe pida
verificar un sitio para activar cobros reales.

### 2. Generar los secretos

```bash
pnpm secretos
```

Imprime en pantalla, no escribe archivos. Cópialos al panel del proveedor.

**Dos que no se rotan a la ligera:**

- `PASSWORD_PEPPER` — si cambia, **ninguna contraseña vuelve a validar**. No es
  recuperable: el pepper no está en la base de datos, por diseño.
- `TOTP_ENCRYPTION_KEY` — si cambia, **todos los 2FA dejan de funcionar** y hay
  que reconfigurarlos uno a uno.

### 3. Comprobar que compila

```bash
pnpm build            # los tres paquetes y las tres aplicaciones
pnpm test             # 191 pruebas de API y aritmética
pnpm test:e2e         # 7 recorridos en navegador (necesita el navegador instalado)
```

---

## Desplegar

### Base de datos — Neon

1. Crear proyecto, región `us-east` o la más cercana a tus clientes.
2. Copiar la cadena de conexión **con `?sslmode=require`**.
3. Aplicar migraciones:

```bash
DATABASE_URL="<la de Neon>" pnpm --filter @bodegon/db exec prisma migrate deploy
```

`migrate deploy` y no `migrate dev`: el segundo puede **reiniciar la base** si
detecta divergencias. En producción eso es catastrófico y no hay confirmación.

4. Sembrar el catálogo inicial solo la primera vez, y con cuidado: **la semilla
   borra todo antes de sembrar**.

### API — Railway

Variables de entorno mínimas:

```
NODE_ENV=production
DATABASE_URL=...
JWT_ACCESS_SECRET=...      JWT_REFRESH_SECRET=...
PASSWORD_PEPPER=...        COOKIE_SECRET=...
TOTP_ENCRYPTION_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
WEB_ORIGIN=https://lucale.mx
ADMIN_ORIGIN=https://admin.lucale.mx
```

La validación de entorno **rechaza el arranque** si falta alguna, si dos secretos
coinciden, o si usas una clave `sk_test_` con `NODE_ENV=production`. Eso último
evita el fallo más silencioso posible: una tienda que parece cobrar y no cobra.

### Desplegar como demostración

Para publicar la tienda **sin cobrar de verdad** —lo que quieres para defender el
proyecto— usa las claves de prueba y añade:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...     # del endpoint en modo prueba
STRIPE_DEMO_MODE=true
```

Es una variable aparte, y no un valor más suave de otra, porque tiene que ser
imposible de activar por descuido. Con ella puesta la API imprime un aviso en
**cada arranque**: el peor final de un modo demostración es que se quede puesto
sin que nadie lo recuerde.

Para pasar a cobrar de verdad: quitar `STRIPE_DEMO_MODE` y cambiar las dos claves
por las reales.

Comando de arranque: `pnpm --filter @bodegon/api start`

### Tienda y panel — Vercel

Dos proyectos, mismo repositorio, distinta raíz (`apps/web` y `apps/admin`).

```
NEXT_PUBLIC_API_URL=https://api.lucale.mx/v1
NEXT_PUBLIC_SITE_URL=https://lucale.mx
```

### Webhook de Stripe

En el panel de Stripe → Developers → Webhooks → añadir endpoint:

```
https://api.lucale.mx/v1/webhooks/stripe
```

Eventos: `checkout.session.completed` y `checkout.session.expired`.

El secreto que te dé ahí va a `STRIPE_WEBHOOK_SECRET`. **Es distinto del de
desarrollo**: cada endpoint tiene el suyo.

---

## Después de desplegar — comprobar, no suponer

Ninguna de estas se marca leyendo código.

```bash
# 1. La API vive
curl https://api.lucale.mx/health

# 2. La documentación NO está publicada
curl -o /dev/null -w "%{http_code}\n" https://api.lucale.mx/docs      # → 404

# 3. La página interna del design system tampoco
curl -o /dev/null -w "%{http_code}\n" https://lucale.mx/design-system # → 404

# 4. Un origen ajeno no pasa el CORS
curl -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://api.lucale.mx/v1/cart/items -H 'Origin: https://sitio-ajeno.com' \
  -H 'Access-Control-Request-Method: POST'

# 5. Una mutación sin token CSRF se rechaza
curl -o /dev/null -w "%{http_code}\n" -X POST \
  https://api.lucale.mx/v1/cart/items -H 'Content-Type: application/json' -d '{}'
# → 403

# 6. El webhook rechaza una firma falsa
curl -o /dev/null -w "%{http_code}\n" -X POST \
  https://api.lucale.mx/v1/webhooks/stripe \
  -H 'stripe-signature: t=1,v1=falsa' -d '{}'
# → 400

# 7. Las cabeceras de seguridad viajan
curl -sD - -o /dev/null https://lucale.mx | grep -i "content-security-policy"
```

Y una compra completa de punta a punta con una tarjeta real de importe pequeño,
comprobando después que el pedido quedó en `PAID` y que el stock bajó.

---

## Operación

### Copias de seguridad

Neon hace _point-in-time recovery_ automático. **Compruébalo restaurando una
copia a una base de prueba antes de necesitarla de verdad** — una copia que nunca
se ha restaurado no es una copia, es una suposición.

### Volver atrás

- **Tienda y panel:** Vercel guarda todos los despliegues; se promueve el
  anterior desde el panel. Segundos.
- **API:** Railway hace lo mismo con las imágenes anteriores.
- **Base de datos:** aquí NO hay vuelta atrás fácil. Una migración que borra una
  columna se lleva los datos. Por eso las migraciones destructivas se separan en
  dos despliegues: primero dejar de usar la columna, después borrarla en un
  despliegue posterior.

### Qué mirar cuando algo va mal

| Síntoma                        | Dónde mirar primero                                       |
| ------------------------------ | --------------------------------------------------------- |
| Pedidos atascados en `PENDING` | Entregas del webhook en el panel de Stripe                |
| "Firma inválida" en el webhook | ¿El `STRIPE_WEBHOOK_SECRET` es el de ESTE endpoint?       |
| El carrito no guarda nada      | CORS y CSRF: ¿coincide `WEB_ORIGIN` con el dominio real?  |
| Todo devuelve 401              | ¿Rotaste `JWT_ACCESS_SECRET`? Invalida todas las sesiones |
| Nadie puede iniciar sesión     | ¿Rotaste `PASSWORD_PEPPER`? No tiene arreglo              |
| La tienda se ve sin estilos    | CSP: mirar violaciones en la consola del navegador        |

La tabla `webhook_events` guarda cada evento recibido con su error, si lo hubo.
Es el primer sitio donde mirar ante cualquier problema de pagos.

---

## Lo que este despliegue NO incluye

Dicho aquí y no escondido, porque en una defensa lo van a preguntar:

- **Sin monitoreo ni alertas.** Si la API se cae a las 3 de la mañana, nadie se
  entera hasta que un cliente escribe. Lo mínimo sería un ping externo al
  `/health` y avisos por correo.
- **Sin correos transaccionales.** El envío está detrás de una interfaz y hoy
  escribe en el log. Cambiarlo por Resend es sustituir una implementación.
- **Sin panel de pedidos.** El admin gestiona catálogo, no ventas. Los pedidos se
  consultan en la base de datos.
- **Sin reembolsos desde el panel.** Se hacen desde Stripe.
- **Sin caducidad ni lote en los productos.** Para alimentos hace falta poder
  saber a quién le vendiste un lote concreto. Son dos campos y una consulta, pero
  no están.
- **Un solo país y una sola moneda.** El modelo lo asume en varios sitios.
