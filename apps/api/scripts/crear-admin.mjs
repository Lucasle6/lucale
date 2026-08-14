/**
 * Crea la PRIMERA cuenta de administrador.
 *
 * POR QUÉ HACE FALTA UN SCRIPT. Ninguna ruta de la API concede el rol de
 * administrador, y eso es correcto: una que lo hiciera sería una escalada de
 * privilegios esperando a que alguien la encontrara. Pero deja un hueco — un
 * despliegue recién hecho no tiene con qué administrarse. Esto lo cubre, y solo
 * desde una terminal con acceso a la base.
 *
 * QUÉ HACE, EN DOS PASOS QUE NO SE PUEDEN JUNTAR:
 *
 *   1. Registra la cuenta llamando al endpoint PÚBLICO de registro. No se
 *      escribe el hash a mano a propósito: así la contraseña pasa por el mismo
 *      argon2id con el mismo pepper que la de cualquier cliente. Una segunda
 *      ruta de hasheo se desviaría de la primera el día que alguien cambie los
 *      parámetros en un sitio y olvide el otro.
 *
 *   2. Asciende esa cuenta a SUPER_ADMIN con una única escritura en la base.
 *
 * LA CONTRASEÑA NO SE VE NI SE GUARDA. Se pide con la entrada oculta, así que
 * no queda en el historial de la terminal, no pasa por ningún archivo y no se
 * imprime en ningún momento. Va directa al cuerpo de la petición y se descarta.
 *
 *   pnpm admin:crear                # contra la API local
 *   pnpm admin:crear --produccion   # contra el despliegue real
 *
 * SE USA TECLEANDO, no canalizando la entrada. Con una tubería, readline emite
 * todas las líneas de golpe y las preguntas posteriores se quedan sin nada que
 * leer. No se ha añadido soporte para tuberías a propósito: la única forma de
 * alimentarlo así sería poner la contraseña en un archivo o en el historial de
 * la terminal, que es justo lo que este script evita.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@bodegon/db";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");

const ENV_PRODUCCION = ".env.produccion.local";
const API_PRODUCCION = "https://lucale-api.onrender.com";
const API_LOCAL = "http://localhost:4000";

const rojo = (t) => `[31m${t}[0m`;
const verde = (t) => `[32m${t}[0m`;
const gris = (t) => `[90m${t}[0m`;
const negrita = (t) => `[1m${t}[0m`;

function salirCon(mensaje) {
  process.stderr.write(`\n${rojo("✖")}  ${mensaje}\n\n`);
  process.exit(1);
}

// ─── Entrada por terminal ────────────────────────────────────────────────────

/**
 * UNA SOLA interfaz para todas las preguntas, y no una por pregunta.
 *
 * Crear una nueva cada vez parece más limpio y está mal: la primera consume
 * todo lo que haya disponible en la entrada, así que la siguiente se queda sin
 * nada y su promesa no se resuelve nunca. Tecleando no se nota —cada línea
 * llega cuando toca—, pero con la entrada canalizada el proceso se cuelga.
 * Lo destapó la primera prueba automatizada de este script.
 */
let rl = null;
let ocultandoEco = false;
let enunciadoEnCurso = "";

/**
 * Se crea PEREZOSAMENTE, justo antes de la primera pregunta.
 *
 * Crearla arriba del todo parece lo natural y falla: entre la carga del módulo
 * y la primera pregunta hay varios `await`, y si la entrada no es un teclado
 * llega el fin de fichero durante esa espera, readline se cierra sola, y la
 * pregunta revienta con ERR_USE_AFTER_CLOSE. Con teclado no ocurre porque la
 * entrada nunca termina.
 */
function interfaz() {
  if (rl !== null) return rl;

  rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Silencia el eco mientras se pide algo oculto. Sin esto la contraseña
  // quedaría a la vista de quien mire la pantalla, y en cualquier grabación.
  rl._writeToOutput = function escribir(cadena) {
    if (!ocultandoEco) {
      rl.output.write(cadena);
      return;
    }
    // Solo se deja pasar el propio enunciado; lo tecleado, no.
    if (cadena.includes(enunciadoEnCurso)) rl.output.write(enunciadoEnCurso);
  };

  return rl;
}

function preguntar(texto) {
  const i = interfaz();
  ocultandoEco = false;
  return new Promise((resolve) => {
    i.question(texto, (respuesta) => {
      resolve(respuesta.trim());
    });
  });
}

/** Pide un valor sin mostrarlo. No se recorta: un espacio puede ser parte de él. */
function preguntarOculto(texto) {
  const i = interfaz();
  ocultandoEco = true;
  enunciadoEnCurso = texto;
  return new Promise((resolve) => {
    i.question(texto, (respuesta) => {
      ocultandoEco = false;
      process.stdout.write("\n");
      resolve(respuesta);
    });
  });
}

// ─── Validaciones locales ────────────────────────────────────────────────────

/**
 * Se repiten aquí las reglas del servidor para fallar ANTES de mandar nada.
 * No sustituyen a las suyas —la validación del servidor sigue siendo la que
 * manda— pero evitan que teclees una contraseña larga para que te la rechacen
 * después, y que un intento fallido quede contado en el rate limiting.
 */
const LONGITUD_MINIMA = 12;

function problemaDelCorreo(correo) {
  if (correo.length === 0) return "no puede estar vacío";
  if (correo.length > 254) return "no puede pasar de 254 caracteres";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return "no parece un correo válido";
  return null;
}

function problemaDeLaContrasena(contrasena) {
  if (contrasena.length < LONGITUD_MINIMA) {
    return `debe tener al menos ${String(LONGITUD_MINIMA)} caracteres`;
  }
  if (contrasena.length > 128) return "no puede pasar de 128 caracteres";
  return null;
}

// ─── Entorno ─────────────────────────────────────────────────────────────────

/** Lee una variable de un archivo .env sin depender de ninguna librería. */
async function leerDelArchivoEnv(archivo, clave) {
  let contenido;
  try {
    contenido = await readFile(path.join(repoRoot, archivo), "utf8");
  } catch {
    return null;
  }

  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (limpia.startsWith("#") || !limpia.includes("=")) continue;
    const indice = limpia.indexOf("=");
    if (limpia.slice(0, indice).trim() !== clave) continue;
    return limpia
      .slice(indice + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return null;
}

async function resolverEntorno(esProduccion) {
  if (!esProduccion) {
    const url =
      process.env.DATABASE_URL ?? (await leerDelArchivoEnv(".env", "DATABASE_URL"));
    if (url === null) salirCon("No encuentro DATABASE_URL. ¿Existe el .env en la raíz?");
    return { etiqueta: "LOCAL", api: process.env.API_URL ?? API_LOCAL, databaseUrl: url };
  }

  const url = await leerDelArchivoEnv(ENV_PRODUCCION, "DATABASE_URL");
  if (url === null) {
    salirCon(
      `No encuentro DATABASE_URL en ${ENV_PRODUCCION}.\n` +
        `   Ese archivo está en el .gitignore y guarda la cadena de Neon.`,
    );
  }
  return {
    etiqueta: "PRODUCCIÓN",
    api: process.env.API_URL ?? API_PRODUCCION,
    databaseUrl: url,
  };
}

// ─── Programa ────────────────────────────────────────────────────────────────

const esProduccion = process.argv.includes("--produccion");
const forzar = process.argv.includes("--forzar");
const entorno = await resolverEntorno(esProduccion);

process.stdout.write(
  `\n${negrita("Crear cuenta de administrador")}\n\n` +
    `  entorno   ${esProduccion ? rojo(entorno.etiqueta) : entorno.etiqueta}\n` +
    `  API       ${entorno.api}\n` +
    // La cadena de conexión lleva credenciales: solo se muestra el servidor.
    `  base      ${gris(new URL(entorno.databaseUrl.replace(/^postgres/, "http")).host)}\n\n`,
);

const prisma = new PrismaClient({ datasources: { db: { url: entorno.databaseUrl } } });

try {
  const yaExisten = await prisma.user.count({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
  });

  if (yaExisten > 0 && !forzar) {
    salirCon(
      `Ya hay ${String(yaExisten)} cuenta(s) de administrador en esta base.\n\n` +
        `   Este script existe para arrancar un despliegue vacío, no para\n` +
        `   repartir permisos: conceder el rol de administrador debe ser algo\n` +
        `   que cueste y se note. Si de verdad hace falta otra, añade --forzar.`,
    );
  }

  const correo = await preguntar("  correo:      ");
  const problemaCorreo = problemaDelCorreo(correo);
  if (problemaCorreo !== null) salirCon(`El correo ${problemaCorreo}.`);

  process.stdout.write(
    gris(
      `\n  Mínimo ${String(LONGITUD_MINIMA)} caracteres. Una frase larga vale más que\n`,
    ) + gris("  un jeroglífico corto, y se recuerda mejor. No se mostrará.\n\n"),
  );

  const contrasena = await preguntarOculto("  contraseña:  ");
  const problemaContrasena = problemaDeLaContrasena(contrasena);
  if (problemaContrasena !== null) salirCon(`La contraseña ${problemaContrasena}.`);

  const repetida = await preguntarOculto("  repítela:    ");
  if (repetida !== contrasena) salirCon("Las contraseñas no coinciden.");

  if (esProduccion) {
    process.stdout.write(rojo("\n  Esto escribe en la base de PRODUCCIÓN.\n"));
    const confirmacion = await preguntar('  Escribe "producción" para continuar: ');
    if (confirmacion !== "producción" && confirmacion !== "produccion") {
      salirCon("Cancelado, no se ha tocado nada.");
    }
  }

  // ── 1. Registro por el endpoint público ────────────────────────────────────
  //
  // Antes hay que pasar por el CSRF. El registro es una mutación, así que la
  // API exige el patrón de doble envío: una cookie que el cliente puede leer y
  // el mismo valor repetido en una cabecera. Un navegador ajeno puede provocar
  // que se MANDE la cookie, pero no puede LEERLA para copiarla a la cabecera.
  //
  // Aquí no hay navegador, pero la regla es la misma para todos — y que lo sea
  // es lo que la hace fiable. Se descubrió probando: sin esto, 403.
  process.stdout.write("\n  pidiendo el token CSRF… ");

  let cookieCsrf;
  let tokenCsrf;
  try {
    const csrf = await fetch(`${entorno.api}/v1/csrf`);
    const setCookie = csrf.headers.get("set-cookie");
    if (setCookie === null) salirCon("La API no entregó la cookie de CSRF.");

    // El nombre cambia con el entorno: `__Host-` solo se puede usar sobre HTTPS.
    const encontrado = /(?:^|,\s*)((?:__Host-)?csrf_token)=([^;]+)/.exec(setCookie);
    if (encontrado === null)
      salirCon(`No reconozco la cookie de CSRF: ${setCookie.slice(0, 80)}`);

    cookieCsrf = `${encontrado[1]}=${encontrado[2]}`;
    tokenCsrf = encontrado[2];
  } catch (causa) {
    salirCon(
      `No se pudo hablar con la API en ${entorno.api}\n` +
        `   ${causa instanceof Error ? causa.message : String(causa)}\n\n` +
        (esProduccion
          ? "   Si lleva rato dormida, el plan gratuito tarda ~50 s en despertar."
          : "   ¿Está corriendo `pnpm dev`?"),
    );
  }

  process.stdout.write(verde("hecho\n"));
  process.stdout.write("  registrando… ");

  let respuesta;
  try {
    respuesta = await fetch(`${entorno.api}/v1/auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": tokenCsrf,
        cookie: cookieCsrf,
      },
      body: JSON.stringify({ email: correo, password: contrasena }),
    });
  } catch (causa) {
    salirCon(
      `No se pudo hablar con la API en ${entorno.api}\n` +
        `   ${causa instanceof Error ? causa.message : String(causa)}\n\n` +
        (esProduccion
          ? "   Si lleva rato dormida, el plan gratuito tarda ~50 s en despertar."
          : "   ¿Está corriendo `pnpm dev`?"),
    );
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    // 409 = el correo ya existe. Es el caso amable: la cuenta está, solo le
    // falta el rol, y el paso 2 lo arregla igual.
    if (respuesta.status !== 409) {
      salirCon(
        `El registro falló con HTTP ${String(respuesta.status)}\n   ${cuerpo.slice(0, 300)}`,
      );
    }
    process.stdout.write(gris("(ya existía) "));
  }

  process.stdout.write(verde("hecho\n"));

  // ── 2. Ascenso a SUPER_ADMIN ───────────────────────────────────────────────
  process.stdout.write("  concediendo el rol… ");

  const actualizados = await prisma.user.updateMany({
    where: { email: correo.toLowerCase() },
    data: { role: "SUPER_ADMIN" },
  });

  if (actualizados.count === 0) {
    salirCon(
      "La cuenta se registró pero no la encuentro en la base para ascenderla.\n" +
        "   ¿Apuntan la API y este script a la MISMA base de datos?",
    );
  }

  process.stdout.write(verde("hecho\n"));

  process.stdout.write(
    `\n${verde("✔")}  ${negrita(correo)} es ahora SUPER_ADMIN.\n\n` +
      "   Lo que falta, y lo haces tú desde el navegador:\n\n" +
      "   1. Entra al panel e inicia sesión con ese correo.\n" +
      "   2. Te pedirá dar de alta el segundo factor: escanea el código QR con\n" +
      "      tu aplicación de autenticación y confirma con los seis dígitos.\n" +
      "   3. GUARDA LOS CÓDIGOS DE RESPALDO que te muestre. Son de un solo uso\n" +
      "      y son la única forma de entrar si pierdes el teléfono.\n\n" +
      gris("   El 2FA no es opcional para administradores: es el control nº 4.\n\n"),
  );
} finally {
  rl?.close();
  await prisma.$disconnect();
}
