/**
 * Composición de URLs de imagen.
 *
 * Vive en el paquete compartido, y no en cada aplicación, porque hace falta en
 * tres sitios distintos: la tienda (servidor), el carrito (cliente) y el panel.
 * Repetir la regla en los tres es garantizar que un día alguien añada un cuarto
 * sitio sin ella — que es exactamente lo que pasó antes de existir esta función.
 */

/**
 * Devuelve la URL con la que el navegador puede pedir una imagen.
 *
 * EL PROBLEMA QUE RESUELVE. El almacenamiento devuelve dos formas distintas
 * según dónde estén los archivos:
 *
 *   - almacén de objetos → `https://xxx.public.blob.vercel-storage.com/…`
 *   - disco local        → `/uploads/abc.webp`
 *
 * La primera ya está completa. La segunda necesita el origen de la API delante.
 * Concatenar sin mirar produce `https://api.ejemplo.com/https://otro-dominio/…`,
 * que no es una URL de nada y deja el catálogo entero sin fotos.
 *
 * @param base URL del servidor que sirve los archivos, sin barra final.
 * @param url  Lo que guardamos en la base de datos.
 */
export function urlDeImagen(base: string, url: string): string {
  // `https:` y `http:`. No sirve comprobar solo "https" porque en desarrollo
  // un almacén propio podría servirse por http.
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }

  // Se normaliza la unión en vez de confiar en que ninguna de las dos partes
  // traiga barra de más: `base` viene de una variable de entorno que escribe
  // una persona, y una barra final sobrante es el error más fácil de cometer.
  return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}
