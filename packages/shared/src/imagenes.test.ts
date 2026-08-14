/**
 * La regla es corta pero se equivocarse sale caro: si falla, el catálogo entero
 * se queda sin fotos y el fallo solo aparece en producción, que es donde las
 * URLs son absolutas.
 */

import { describe, expect, it } from "vitest";
import { urlDeImagen } from "./imagenes.js";

const API = "https://lucale-api.onrender.com";

describe("urlDeImagen", () => {
  it("deja intacta una URL de almacén de objetos, que ya viene completa", () => {
    const blob = "https://abc123.public.blob.vercel-storage.com/productos/x.webp";
    expect(urlDeImagen(API, blob)).toBe(blob);
  });

  it("antepone el origen a una ruta relativa del disco local", () => {
    expect(urlDeImagen(API, "/uploads/abc.webp")).toBe(`${API}/uploads/abc.webp`);
  });

  it("respeta http:// además de https://, por si el almacén es propio", () => {
    const local = "http://localhost:9000/bucket/x.webp";
    expect(urlDeImagen(API, local)).toBe(local);
  });

  it("no duplica la barra cuando la base trae una de más", () => {
    expect(urlDeImagen(`${API}/`, "/uploads/abc.webp")).toBe(`${API}/uploads/abc.webp`);
  });

  it("tampoco la pierde cuando ninguna de las dos partes la trae", () => {
    expect(urlDeImagen(API, "uploads/abc.webp")).toBe(`${API}/uploads/abc.webp`);
  });

  /**
   * Esta es la que importa: es el fallo concreto que provocó escribir la
   * función. Concatenar sin mirar producía una URL con dos esquemas dentro.
   */
  it("NO concatena una URL absoluta detrás de la base", () => {
    const blob = "https://abc123.public.blob.vercel-storage.com/productos/x.webp";
    expect(urlDeImagen(API, blob)).not.toContain(`${API}/https`);
  });
});
