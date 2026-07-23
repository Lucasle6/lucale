# Seguridad — Bodegón de José

Pediste "el estándar más alto". Esto es lo que eso significa en concreto: 20 controles,
cada uno con el ataque que detiene y el día en que se implementa.

La referencia es **OWASP Top 10 (2021)** y las **OWASP Cheat Sheets**. No inventamos
seguridad — seguimos a quien ya la resolvió.

---

## Autenticación

### 1 · Hashing con argon2id · Día 4

Parámetros OWASP: `m=19456 KiB`, `t=2`, `p=1`, salt de 16 bytes.

**Detiene:** que un volcado de la base de datos se convierta en contraseñas en texto plano.
argon2id resiste ataques con GPU, que es donde bcrypt empieza a mostrar su edad.

### 2 · Tokens de acceso cortos + refresh rotativo · Día 4

Access token JWT de 15 min. Refresh token opaco de 30 días que **rota en cada uso**.

**Detiene:** que un token robado sirva indefinidamente. La ventana de daño es de minutos.

### 3 · Detección de reuso de refresh token · Día 4

Si llega un refresh token ya rotado → se revoca la **familia entera** de sesiones.

**Detiene:** el robo de sesión. Cuando el atacante y el usuario legítimo usan la misma
cadena de tokens, uno de los dos presentará uno viejo — y ahí los expulsamos a ambos. El
usuario vuelve a entrar; el atacante no puede.

### 4 · 2FA TOTP obligatorio para administradores · Día 5

`otplib`, ventana de ±1 periodo, secreto cifrado en reposo, 10 códigos de respaldo de un
solo uso.

**Detiene:** que una contraseña de admin filtrada baste para entrar. Es el control con
mejor relación beneficio/esfuerzo de toda la lista.

### 5 · Sin enumeración de usuarios · Día 4

El mismo mensaje y el mismo tiempo de respuesta ante email inexistente o contraseña
incorrecta (hash simulado en la rama negativa para igualar la latencia).

**Detiene:** que alguien construya la lista de tus clientes probando emails.

### 6 · Bloqueo progresivo de cuenta · Día 4

5 intentos fallidos → 15 min de bloqueo, con backoff exponencial.

**Detiene:** fuerza bruta contra una cuenta concreta.

---

## Sesión y transporte

### 7 · Cookies endurecidas · Día 4

`__Host-` prefix · `httpOnly` · `Secure` · `SameSite=Strict` · `Path=/`

**Detiene:** que JavaScript lea el token (XSS), que viaje por HTTP plano, y que se envíe
desde otro sitio (CSRF). El prefijo `__Host-` impide además que un subdominio comprometido
sobrescriba la cookie.

### 8 · Aislamiento de admin en subdominio · Día 8

Cookie de admin con `Domain=admin.bodegon.mx`, audiencia de JWT `aud: "admin"`, y una
aplicación Next.js **distinta**.

**Detiene:** que un token de cliente sirva en el panel, y que el código del dashboard llegue
siquiera al navegador de un cliente. Es tu requisito original, implementado en tres capas.

### 9 · Protección CSRF double-submit · Día 12

Token en cookie + header `X-CSRF-Token` en toda mutación, comparados con
`timingSafeEqual`.

**Detiene:** que un sitio ajeno dispare acciones con tus cookies. `SameSite=Strict` ya
cubre casi todo; esto es defensa en profundidad.

### 10 · HSTS + TLS obligatorio · Día 15

`max-age=31536000; includeSubDomains; preload`.

**Detiene:** downgrade a HTTP y ataques de intermediario.

---

## Entrada y salida de datos

### 11 · Validación con Zod en cada frontera · Día 3

Whitelist estricta, nunca blacklist. El mismo esquema valida en el cliente (UX) y en el
servidor (seguridad).

**Detiene:** inyecciones, mass assignment y corrupción de datos. La regla: **la validación
del cliente es para el usuario, la del servidor es para el atacante**. Nunca sustituye.

### 12 · Consultas parametrizadas siempre · Día 2

Prisma parametriza por defecto. Todo `$queryRaw` va con template tag, jamás con
concatenación de strings.

**Detiene:** SQL injection.

### 13 · Validación real de archivos subidos · Día 7

Magic bytes (no la extensión ni el `Content-Type`), límite de 5 MB, renombrado a UUID,
servido desde un dominio separado.

**Detiene:** subir un script disfrazado de `.png`. El navegador ejecuta según el contenido,
no según el nombre.

### 14 · CSP estricta con nonces · Día 12

`default-src 'self'`, sin `unsafe-inline`, nonce por request.

**Detiene:** que un XSS que se cuele llegue a ejecutar algo útil. Es la última línea de
defensa cuando todo lo demás falló.

---

## Autorización

### 15 · RBAC verificado en el servidor · Día 5

Middleware por rol en cada ruta protegida. El frontend **oculta**, el backend **prohíbe**.

**Detiene:** escalada de privilegios. Esconder un botón no es seguridad; es decoración.

### 16 · Comprobación de propiedad en cada recurso (anti-IDOR) · Día 12

`/api/orders/:id` verifica que la orden pertenece al usuario autenticado, siempre.

**Detiene:** IDOR — la vulnerabilidad más común del OWASP Top 10 y la más fácil de
introducir por descuido. Sin esto, cambiar un número en la URL expone las compras de todos.

### 17 · Audit log de acciones administrativas · Día 5

Append-only: actor, acción, entidad, IP, user-agent, timestamp.

**Detiene:** no previene, pero permite responder _quién hizo qué_ — y disuade al insider.

---

## Dinero

### 18 · Los precios solo salen de la base de datos · Día 10

El cliente manda `variantId` y `quantity`. Nada más. El servidor busca precios, calcula
subtotal, envío, impuestos y total.

**Detiene:** manipulación de precios. Si el importe llega desde el navegador, alguien
comprará tu catálogo a un centavo. Es la vulnerabilidad más cara de un e-commerce.

### 19 · Firma e idempotencia de webhooks · Día 11–12

Verificación de firma con el secreto de Stripe, sobre el **cuerpo crudo** (no parseado), y
tabla `WebhookEvent` con `externalId` único.

**Detiene:** que cualquiera falsifique un "pago confirmado" con un POST, y que un reenvío
legítimo de Stripe duplique la orden.

### 20 · Datos de tarjeta fuera de nuestro alcance · Día 11

Stripe Checkout hospedado. Nunca vemos, transmitimos ni almacenamos un número de tarjeta.

**Detiene:** todo el problema. Nos deja en PCI DSS SAQ-A, el nivel más liviano.

---

## Higiene continua

| Práctica                                                      | Cuándo  |
| ------------------------------------------------------------- | ------- |
| Secretos fuera de git, validados con Zod al arrancar          | Día 1   |
| `pnpm audit` en CI, bloqueando el merge en severidad alta     | Día 14  |
| Logs con redacción de PII (`pino.redact`)                     | Día 3   |
| Rate limiting global 100 req/min · login 5/15 min             | Día 3–4 |
| Helmet: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` | Día 3   |
| Errores genéricos al cliente, detalle solo en el log          | Día 3   |
| Dependabot activo                                             | Día 14  |

---

## Checklist de auditoría del Día 12

Se ejecuta contra la app ya construida. Cada línea se marca solo tras **comprobarla en
vivo**, no tras leer el código.

- [ ] Token de `CUSTOMER` contra endpoint de admin → **403**
- [ ] `/api/orders/:id` de otro usuario → **404** (no 403: no confirmamos que exista)
- [ ] Modificar `priceCents` en el request del carrito → total **sin cambios**
- [ ] Reusar un refresh token ya rotado → **familia revocada**
- [ ] 6 logins fallidos → **cuenta bloqueada**
- [ ] Webhook de Stripe con firma inválida → **400**
- [ ] Reenviar el mismo evento de Stripe 3 veces → **una sola orden**
- [ ] `.exe` renombrado a `.png` → **rechazado**
- [ ] `<script>alert(1)</script>` en el nombre de un producto → **escapado, no ejecutado**
- [ ] Mutación sin token CSRF → **403**
- [ ] `admin.bodegon.mx` no aparece en el bundle ni en el sitemap público
- [ ] Cabeceras verificadas en securityheaders.com → **A o superior**
- [ ] `pnpm audit` → **sin vulnerabilidades altas o críticas**
- [ ] Ningún secreto en el historial de git (`gitleaks`)

---

## Lo que este proyecto _no_ cubre

Honestidad de alcance — decirlo tú antes de que te lo pregunten vale más que omitirlo:

- **WAF / protección DDoS** más allá de lo que da Cloudflare por defecto
- **Cifrado a nivel de campo** para PII en reposo (más allá del cifrado de disco)
- **Pentest profesional externo** — la auditoría del Día 12 es propia
- **Cumplimiento formal** SOC 2 / ISO 27001
- **Detección de fraude** propia (delegada a Stripe Radar)
