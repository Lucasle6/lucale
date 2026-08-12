/**
 * Validación de imágenes (control de seguridad nº 13).
 *
 * El caso central: un archivo llamado "foto.png" que en realidad contiene un
 * script. La extensión y el Content-Type los elige el atacante; solo los
 * primeros bytes dicen la verdad.
 */

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  detectImageFormat,
  validateAndProcessImage,
} from "./image-validation.js";

/** Genera un PNG real y decodificable. */
function pngReal(width = 40, height = 40): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 150, b: 120 } },
  })
    .png()
    .toBuffer();
}

describe("detección por magic bytes", () => {
  it("reconoce un PNG por su firma", async () => {
    expect(detectImageFormat(await pngReal())).toBe("png");
  });

  it("reconoce un JPEG por su firma", async () => {
    const jpeg = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();
    expect(detectImageFormat(jpeg)).toBe("jpeg");
  });

  it("reconoce un WebP y NO confunde otros formatos RIFF", () => {
    // RIFF es un contenedor genérico que también usan los WAV. La marca
    // "WEBP" del byte 8 es lo que los distingue.
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WEBP"),
    ]);
    const wav = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from("WAVE"),
    ]);

    expect(detectImageFormat(webp)).toBe("webp");
    expect(detectImageFormat(wav)).toBeNull();
  });

  it("rechaza un script aunque se llame .png", () => {
    // Este es EL ataque: el nombre y el Content-Type dicen "imagen", el
    // contenido dice otra cosa.
    const script = Buffer.from('<?php system($_GET["cmd"]); ?>');
    expect(detectImageFormat(script)).toBeNull();
  });

  it("rechaza un archivo vacío o demasiado corto", () => {
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
    expect(detectImageFormat(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("validación completa", () => {
  it("acepta una imagen real y la normaliza a WebP", async () => {
    const resultado = await validateAndProcessImage(await pngReal(100, 60));

    expect(resultado.format).toBe("webp");
    expect(resultado.width).toBe(100);
    expect(resultado.height).toBe(60);
    expect(resultado.bytes).toBeGreaterThan(0);
  });

  it("rechaza un script disfrazado de imagen", async () => {
    const script = Buffer.from('<?php system($_GET["cmd"]); ?>');
    await expect(validateAndProcessImage(script)).rejects.toThrow(/no es una imagen/i);
  });

  it("rechaza contenido malicioso con firma PNG falsificada", async () => {
    // Alguien podría anteponer los bytes correctos a basura para pasar la
    // primera capa. El reprocesado con sharp es donde eso muere: los magic
    // bytes solos no bastan.
    const firmaFalsa = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('<?php system($_GET["cmd"]); ?>'),
    ]);

    expect(detectImageFormat(firmaFalsa)).toBe("png"); // pasa la capa 1...
    // ...y muere en la capa 2.
    await expect(validateAndProcessImage(firmaFalsa)).rejects.toThrow();
  });

  it("rechaza un archivo por encima del límite de tamaño", async () => {
    const enorme = Buffer.alloc(MAX_IMAGE_BYTES + 1, 0x89);
    await expect(validateAndProcessImage(enorme)).rejects.toThrow(/MB/);
  });

  it("rechaza un archivo vacío", async () => {
    await expect(validateAndProcessImage(Buffer.alloc(0))).rejects.toThrow(/vacío/i);
  });

  it("reduce las imágenes muy grandes", async () => {
    const gigante = await pngReal(4000, 3000);
    const resultado = await validateAndProcessImage(gigante);

    // Se acota el lado mayor a 2000 px, manteniendo la proporción.
    expect(resultado.width).toBe(2000);
    expect(resultado.height).toBe(1500);
  });

  it("no agranda las imágenes pequeñas", async () => {
    const resultado = await validateAndProcessImage(await pngReal(50, 50));
    expect(resultado.width).toBe(50);
  });

  it("BORRA los metadatos EXIF", async () => {
    // Una foto de teléfono lleva EXIF, y ahí suelen ir las COORDENADAS GPS de
    // dónde se tomó. Publicar fotos de producto sin limpiarlas equivale a
    // publicar tu dirección.
    // Se usan campos IFD0 porque son los que tipa sharp, pero el bloque EXIF
    // que se elimina es el mismo donde una cámara guarda las coordenadas GPS.
    const conExif = await sharp({
      create: { width: 30, height: 30, channels: 3, background: "#abc" },
    })
      .withExif({ IFD0: { Copyright: "Jose", Software: "prueba" } })
      .jpeg()
      .toBuffer();

    // El original SÍ lleva metadatos.
    const antes = await sharp(conExif).metadata();
    expect(antes.exif).toBeDefined();

    const procesada = await validateAndProcessImage(conExif);
    const despues = await sharp(procesada.buffer).metadata();

    expect(despues.exif).toBeUndefined();
  });
});
