import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * El recorrido de compra, en un navegador de verdad.
 *
 * Cada prueba de aquí cubre algo que `app.inject()` NO puede ver, porque no
 * pasa por la red ni por un navegador. Los tres fallos que se nos escaparon
 * durante el proyecto vivían justo en ese hueco:
 *
 *   Día 10  CORS sin anunciar PATCH ni DELETE
 *   Día 13  CSRF dejando la tienda sin poder añadir al carrito
 *   Día 13  CSP capaz de bloquear un script y dejar la página muerta
 *
 * Las 191 pruebas siguieron en verde en los tres casos.
 */

/** Recoge violaciones de CSP y errores de consola durante una prueba. */
function vigilarConsola(page: Page): string[] {
  const problemas: string[] = [];

  page.on("console", (mensaje) => {
    const texto = mensaje.text();
    if (
      mensaje.type() === "error" &&
      // Ruido del servidor de desarrollo, no de la aplicación:
      //
      //  · el aviso de HMR aparece al arrancar
      //  · "destination stream closed early" salta cuando la prueba navega a
      //    otra página antes de que termine una respuesta en streaming. Una
      //    persona no lo provoca porque no cambia de página en 40 ms; hizo
      //    fallar esta prueba una vez de cada tres.
      !texto.includes("_next/hmr") &&
      !texto.includes("destination stream closed early")
    ) {
      problemas.push(texto);
    }
  });

  page.on("pageerror", (error) => {
    problemas.push(`pageerror: ${error.message}`);
  });

  return problemas;
}

/**
 * Añade el producto de la ficha al carrito, esperando a que React esté listo.
 *
 * ESTO NO ES PARANOIA, ES LA CARRERA MÁS COMÚN DE LAS PRUEBAS E2E CON NEXT.
 *
 * El servidor manda HTML completo, así que el botón se ve y Playwright lo
 * considera "accionable" de inmediato. Pero hasta que React no hidrata, ese
 * botón es un dibujo: el clic no dispara nada y la prueba falla por una
 * carrera, no por un fallo real.
 *
 * Una persona no lo nota porque tarda medio segundo en mover el ratón.
 * Playwright tarda cero.
 *
 * Se espera a que el elemento tenga las claves internas de React —la señal de
 * que sus manejadores están atados— y después se espera a la respuesta del
 * servidor, que además confirma que la petición llegó a salir.
 */
async function agregarAlCarrito(page: Page): Promise<void> {
  const boton = page.getByRole("button", { name: "Agregar al carrito" });
  await expect(boton).toBeVisible();

  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      x.textContent?.includes("Agregar al carrito"),
    );
    return b !== undefined && Object.keys(b).some((k) => k.startsWith("__react"));
  });

  const respuesta = page.waitForResponse(
    (r) => r.url().includes("/cart/items") && r.request().method() === "POST",
  );
  await boton.click();
  await respuesta;
}

test.describe("catálogo", () => {
  test("la portada muestra productos con sus presentaciones", async ({ page }) => {
    const problemas = vigilarConsola(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Salsas");
    await expect(page.getByText("Salsa Macha de Cacahuate").first()).toBeVisible();
    // Las presentaciones vienen del modelo de variantes del Día 2.
    await expect(page.getByText("250 ml · 500 ml · 1 L").first()).toBeVisible();

    expect(problemas).toEqual([]);
  });

  test("la CSP viaja en la respuesta y no rompe la página", async ({ page }) => {
    const respuesta = await page.goto("/");
    const csp = respuesta?.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");

    // Y lo que de verdad importa: que con esa política puesta la página siga
    // pintándose. Una CSP que rompe la tienda no es seguridad, es una caída.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("carrito", () => {
  test("se puede añadir un producto con CSRF activo", async ({ page }) => {
    const problemas = vigilarConsola(page);

    await page.goto("/productos/salsa-macha-cacahuate");
    await agregarAlCarrito(page);

    await page.goto("/carrito");
    await expect(page.getByText("Salsa Macha de Cacahuate").first()).toBeVisible();

    // Esta es la prueba que habría cazado el fallo del Día 13: al activar el
    // CSRF, este clic devolvía 403 y el carrito se quedaba vacío, con las 172
    // pruebas de la API en verde.
    expect(problemas).toEqual([]);
  });

  test("calcula el IVA línea por línea con tasas mixtas", async ({ page }) => {
    // Alimento al 0% y utensilio al 16%, que es el caso que ninguna tasa
    // global puede describir.
    await page.goto("/productos/salsa-macha-cacahuate");
    await agregarAlCarrito(page);

    await page.goto("/productos/molcajete-piedra-volcanica");
    await agregarAlCarrito(page);

    await page.goto("/carrito");

    const resumen = page.getByText(/IVA incluido:/);
    await expect(resumen).toBeVisible();

    // El IVA declarado NO puede ser el 16% del total: la salsa no lo causa.
    const texto = (await resumen.textContent()) ?? "";
    const iva = Number(texto.replace(/[^\d.]/g, ""));
    const totalTexto =
      (await page
        .getByText(/^\$[\d,]+\.\d{2}$/)
        .last()
        .textContent()) ?? "";
    const total = Number(totalTexto.replace(/[^\d.]/g, ""));

    expect(iva).toBeGreaterThan(0);
    // Si alguien volviera a la tasa global, el IVA rondaría total × 16/116.
    expect(iva).toBeLessThan((total * 16) / 116);
  });

  test.describe("sin cookies previas", () => {
    // Contexto limpio: el carrito está vacío POR CONSTRUCCIÓN, en vez de
    // intentar vaciarlo con clics que dependen de lo que dejaron las pruebas
    // anteriores. La versión previa fallaba justo por eso, y el fallo no decía
    // nada sobre la tienda.
    test.use({ storageState: { cookies: [], origins: [] } });

    test("no deja pagar con el carrito vacío", async ({ page }) => {
      await page.goto("/checkout");
      await expect(page.getByText("No hay nada que pagar")).toBeVisible();
      // Y ofrece salida en vez de dejar al cliente en un callejón.
      await expect(page.getByRole("link", { name: "Ver catálogo" })).toBeVisible();
    });
  });
});

test.describe("checkout", () => {
  test("valida la dirección antes de mandar nada al servidor", async ({ page }) => {
    await page.goto("/productos/salsa-macha-cacahuate");
    await agregarAlCarrito(page);

    await page.goto("/checkout");
    await page.getByRole("button", { name: "Continuar al pago" }).click();

    // Los mensajes salen del MISMO esquema Zod que usa la API, importado de
    // @bodegon/shared. No están escritos en el frontend.
    await expect(page.getByText("no parece un correo válido")).toBeVisible();
    await expect(page.getByText("falta la colonia")).toBeVisible();
    await expect(page.getByText("el código postal son 5 dígitos")).toBeVisible();
    await expect(page.getByText("el teléfono son 10 dígitos")).toBeVisible();
  });

  test("el precio mostrado incluye el IVA y lo dice", async ({ page }) => {
    await page.goto("/productos/salsa-macha-cacahuate");
    await agregarAlCarrito(page);
    await page.goto("/checkout");

    // En México el precio al consumidor ya incluye impuestos, y decirlo evita
    // la duda de "¿me van a cobrar 16% más al final?" — motivo real de
    // abandono del carrito.
    await expect(page.getByText(/IVA incluido:/)).toBeVisible();
  });
});
