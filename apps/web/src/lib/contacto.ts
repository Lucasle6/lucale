/**
 * Datos de contacto de LuCaLe. Fuente única.
 *
 * Viven aquí y no dentro de la página por la misma razón que los orígenes de la
 * API: son configuración. Un número de teléfono cambia, y cuando cambia hay que
 * poder encontrarlo en un sitio y no en tres vistas distintas.
 *
 * La regla de ESLint que prohíbe URLs literales en `app/` y `components/` señaló
 * exactamente esto cuando estaban escritas en la vista.
 */

/** Base de los enlaces de WhatsApp. El número va sin espacios ni signos. */
const WHATSAPP_BASE = "https://wa.me/";

export interface Telefono {
  /** Cómo se muestra. Con espacios, para poder leerlo. */
  visible: string;
  /** Enlace listo para abrir la conversación. */
  enlace: string;
}

function whatsapp(visible: string, marcar: string): Telefono {
  return { visible, enlace: `${WHATSAPP_BASE}${marcar}` };
}

/** El de México se publica. */
export const WHATSAPP_MX = whatsapp("+52 993 342 6493", "529933426493");

/**
 * El de Europa NO se publica: solo vive detrás del botón, como pidieron los
 * dueños. Por eso su `visible` no se usa en ninguna vista.
 */
export const WHATSAPP_EU = whatsapp("+49 152 0396 2704", "4915203962704");

export const CORREOS = ["j.luisleon6@gmail.com", "karokale@gmail.com"] as const;

/** Correo para ejercer derechos ARCO (aviso de privacidad). */
export const CORREO_PRIVACIDAD = CORREOS[0];

export const UBICACION = { ciudad: "Zapopan", estado: "Jalisco" } as const;
