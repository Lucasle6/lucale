# Despliegue y operación — LuCaLe

Todo lo necesario para poner esto en internet, y para operarlo después. Escrito
para que lo siga alguien que no participó en el proyecto.

---

## La forma en producción

Lo que hay desplegado hoy, con los dominios reales:

```
                    ┌──────────────────────────┐
   navegador ──────▶│  Vercel · tienda         │  Next.js
                    │  lucale.vercel.app       │  SSR + estáticos + CDN
                    └────────────┬─────────────┘
                                 │  reenvío /v1/*  (mismo origen
                                 │  para el navegador: ver abajo)
                    ┌────────────▼─────────────┐
                    │  Render · API            │  Fastify
                    │  lucale-api.onrender.com │
                    └────────────┬─────────────┘
                                 │
                       ┌─────────▼─────────┐
                       │  Neon             │
                       │  PostgreSQL 18    │
                       └───────────────────┘

                    ┌──────────────────────────┐
   admin ──────────▶│  Vercel · panel          │  aplicación SEPARADA
                    │  lucale-admin.vercel.app │
                    └──────────────────────────┘
```

Las imágenes viven en **Vercel Blob**, fuera del proceso que sirve la tienda. Es
una decisión de supervivencia, no de rendimiento: el disco de un contenedor de
Render es efímero, así que guardarlas junto a la API significaba perderlas en
cada despliegue, sin que fallara nada ni avisara nadie.

En desarrollo se siguen guardando en `uploads/` y las sirve la propia API. Lo
elige la presencia de `BLOB_READ_WRITE_TOKEN`, y en producción es obligatoria:
la API no arranca sin ella.

**Por qué el panel es otra aplicación y no una ruta.** Fue un requisito desde el
primer día: que un cliente no vea "siquiera nada relacionado con el dashboard".
Siendo otra aplicación en otro dominio, el código del panel **nunca se descarga**
al navegador de un cliente. Ocultar una ruta con un `if` deja el JavaScript en el
bundle público, y cualquiera lo lee.

**Por qué la API va aparte de Vercel.** Fastify es un servidor de larga vida con
un pool de conexiones a Postgres. Las funciones serverless se crean y destruyen,
y cada una abriría su propia conexión hasta agotar el límite de la base. Render
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
pnpm test             # 211 pruebas: 186 de la API y 25 de aritmética y URLs
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

### API — Render

El servicio no se configura a mano en su panel: está descrito en
[`render.yaml`](../render.yaml), en la raíz del repositorio. Render lo lee al
conectar el repo. Un despliegue que solo existe en la interfaz de alguien no se
puede repetir ni revisar — cuando algo cambie, nadie sabrá qué había antes.

Ahí viven también las tres variables que cuestan una tarde si faltan: `HOST`
en `0.0.0.0` (si no, el contenedor arranca, se declara sano y no responde a
nadie), `COREPACK_ENABLE_DOWNLOAD_PROMPT` en `0`, y el `--prod=false` del
`pnpm install`. Las tres están comentadas allí con el fallo concreto que
provocan.

Variables de entorno mínimas:

```
NODE_ENV=production
DATABASE_URL=...
JWT_ACCESS_SECRET=...      JWT_REFRESH_SECRET=...
PASSWORD_PEPPER=...        COOKIE_SECRET=...
TOTP_ENCRYPTION_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
BLOB_READ_WRITE_TOKEN=...       # Vercel → Storage → el almacén → .env.local
WEB_ORIGIN=https://lucale.mx
ADMIN_ORIGIN=https://admin.lucale.mx
```

La validación de entorno **rechaza el arranque** si falta alguna, si dos secretos
coinciden, o si la configuración se contradice (controles 21 y 22 de
[`03-seguridad.md`](03-seguridad.md)):

| Combinación                                    | Por qué no arranca                          |
| ---------------------------------------------- | ------------------------------------------- |
| producción + `sk_test_` sin `STRIPE_DEMO_MODE` | la tienda parece cobrar y no cobra          |
| fuera de producción + `sk_live_`               | cada prueba con una tarjeta cobra de verdad |
| `sk_live_` + `STRIPE_DEMO_MODE=true`           | cobra mientras anuncia que no cobra         |
| producción sin `BLOB_READ_WRITE_TOKEN`         | las imágenes se pierden en cada despliegue  |

Las dos últimas se añadieron **después de que el fallo ocurriera**. La de Stripe,
porque el primer despliegue quedó publicado con la clave real mientras el cartel
de arranque decía que no cobraba. La del almacén, porque las imágenes se
guardaban en un disco que desaparece con el contenedor.

Las dos son la misma clase de fallo, y por eso las dos se resuelven negándose a
arrancar: **el sistema seguía adelante sin que fallara nada visible**, haciendo
algo que nadie quería. Un error ruidoso se arregla el mismo día; uno silencioso
se descubre semanas después, cuando ya nadie recuerda qué se desplegó.

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
API_ORIGIN=https://lucale-api.onrender.com          # servidor: absoluta, NO lleva NEXT_PUBLIC_
NEXT_PUBLIC_FILES_URL=https://lucale-api.onrender.com   # imágenes subidas
NEXT_PUBLIC_SITE_URL=https://lucale.vercel.app      # solo en la tienda
```

Esos son los valores reales de hoy. Con dominio propio serían
`https://lucale-api.onrender.com` y `https://lucale.mx`, y no cambiaría nada más: el
reenvío de abajo funciona igual en los dos casos.

**Las variables se congelan en el build.** Añadirlas no basta: hay que volver a
desplegar para que surtan efecto. Un despliegue lanzado antes de crearlas usa el
valor por defecto del código —`http://localhost:4000`— y falla al generar la
portada con un `ECONNREFUSED 127.0.0.1:4000` que no menciona ninguna variable.
Costó un despliegue entender de dónde salía.

**El navegador nunca llama a la API directamente.** Next reenvía `/v1/*` al
`API_ORIGIN` desde el servidor, así que para el navegador todo ocurre en el mismo
dominio.

No es una optimización, es lo único que hace funcionar las cookies. Con la tienda
en `lucale.vercel.app` y la API en `lucale-api.onrender.com`, cualquier cookie que
ponga la API es de terceros y el navegador la descarta: se cae el carrito y se cae
el CSRF, porque su token viaja en una cookie que nunca llega a guardarse.

En desarrollo no se ve, porque `localhost:3000` y `localhost:4000` son el mismo
host — el puerto no cuenta para las cookies. Es un fallo que solo existe en
producción, y solo si el frontend y la API viven en dominios distintos.

### Webhook de Stripe

**Este paso es el que se olvida, y su síntoma es engañoso**: sin él la tienda
cobra perfectamente, manda al cliente a pagar, y el pedido se queda en `PENDING`
para siempre con el inventario intacto. Todo parece funcionar hasta que alguien
mira los pedidos. El webhook firmado es nuestra ÚNICA fuente de verdad sobre el
pago —a propósito, porque el navegador del cliente no es de fiar—, así que sin él
no hay ninguna otra vía por la que un pedido llegue a `PAID`.

En el panel de Stripe → Workbench → Webhooks → **Añade un destino**:

```
https://lucale-api.onrender.com/v1/webhooks/stripe
```

- Ámbito: **Tu cuenta**
- Carga útil: **Resumen** (el objeto completo). La "ligera" solo trae
  identificadores, y nuestro manejador lee `amount_total` y los metadatos
- Eventos: `checkout.session.completed` y `checkout.session.expired`

El secreto que te dé ahí va a `STRIPE_WEBHOOK_SECRET`. **Es distinto del de
desarrollo**: cada endpoint tiene el suyo, y el que da `stripe listen` en local
no vale aquí.

#### Prueba y producción son dos mundos separados

Un destino registrado en **modo prueba** solo recibe eventos de modo prueba. Los
pedidos creados con una clave `sk_live_` no generarán ninguna entrega hacia él, y
se quedarán en `PENDING` indefinidamente aunque el webhook esté sano.

Pasó aquí: `LCL-2026-1000` se creó mientras la clave era la real y nunca podrá
cerrarse. Al pasar a cobrar de verdad hay que **registrar el endpoint otra vez en
modo real** y poner su `whsec_` —que es otro— en `STRIPE_WEBHOOK_SECRET`.

#### Comprobarlo sin hacer una compra

En la página del destino, **Enviar eventos de prueba**. El evento llega firmado
de verdad pero sin nuestros metadatos, y la respuesta distingue lo que importa:

| Respuesta | Qué significa                                                                |
| --------- | ---------------------------------------------------------------------------- |
| `400`     | el secreto no coincide: la firma no cuadra                                   |
| `500`     | la firma se verificó y el evento entró; falla después al no hallar `orderId` |

Un `500` ahí es buena noticia.

---

## Después de desplegar — comprobar, no suponer

Ninguna de estas se marca leyendo código.

```bash
# 1. La API vive
curl https://lucale-api.onrender.com/health

# 2. La documentación NO está publicada
curl -o /dev/null -w "%{http_code}\n" https://lucale-api.onrender.com/docs      # → 404

# 3. La página interna del design system tampoco
curl -o /dev/null -w "%{http_code}\n" https://lucale.vercel.app/design-system # → 404

# 4. Un origen ajeno no pasa el CORS
curl -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  https://lucale-api.onrender.com/v1/cart/items -H 'Origin: https://sitio-ajeno.com' \
  -H 'Access-Control-Request-Method: POST'
# → 403

# 5. Una mutación sin token CSRF se rechaza
curl -o /dev/null -w "%{http_code}\n" -X POST \
  https://lucale-api.onrender.com/v1/cart/items -H 'Content-Type: application/json' -d '{}'
# → 403

# 6. El webhook rechaza una firma falsa
#    El Content-Type NO es opcional aquí: sin él curl manda
#    x-www-form-urlencoded, la petición muere en 415 y nunca llega a
#    comprobarse la firma. Un 415 no prueba nada; el que prueba es el 400.
curl -o /dev/null -w "%{http_code}\n" -X POST \
  https://lucale-api.onrender.com/v1/webhooks/stripe \
  -H 'stripe-signature: t=1,v1=falsa' -H 'Content-Type: application/json' -d '{}'
# → 400

# 7. Las cabeceras de seguridad viajan
curl -sD - -o /dev/null https://lucale.vercel.app | grep -i "content-security-policy"
```

Las siete, ejecutadas contra el despliegue real el 14 de agosto de 2026: `ok`,
404, 404, 403, 403, 400 y una cabecera CSP.

Y falta la única que no se puede automatizar sin tocar una tarjeta: **una compra
completa**. En modo demostración se hace con la tarjeta de prueba de Stripe
`4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. Después hay que
comprobar en la base, no en la pantalla de "gracias por tu compra", que el pedido
quedó en `PAID`, que el evento del webhook figura como procesado, y que el stock
de lo comprado bajó. La pantalla de gracias la pinta el navegador del cliente y
no demuestra nada sobre lo que pasó en el servidor.

---

## Operación

### Copias de seguridad

Neon hace _point-in-time recovery_ automático. **Compruébalo restaurando una
copia a una base de prueba antes de necesitarla de verdad** — una copia que nunca
se ha restaurado no es una copia, es una suposición.

### Volver atrás

- **Tienda y panel:** Vercel guarda todos los despliegues; se promueve el
  anterior desde el panel. Segundos.
- **API:** Render guarda las imágenes de despliegues anteriores y ofrece
  **Rollback** en cada uno de ellos.
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
- **La API se duerme a los 15 minutos sin tráfico.** Plan gratuito de Render: la
  siguiente visita espera unos 50 segundos a que despierte. Medido: 42 s en un
  arranque en frío real. Un ping externo cada 10 minutos lo evita.
- **Sin correos transaccionales.** El envío está detrás de una interfaz y hoy
  escribe en el log. Cambiarlo por Resend es sustituir una implementación.
- **Sin panel de pedidos.** El admin gestiona catálogo, no ventas. Los pedidos se
  consultan en la base de datos.
- **Sin reembolsos desde el panel.** Se hacen desde Stripe.
- **Sin caducidad ni lote en los productos.** Para alimentos hace falta poder
  saber a quién le vendiste un lote concreto. Son dos campos y una consulta, pero
  no están.
- **Un solo país y una sola moneda.** El modelo lo asume en varios sitios.
