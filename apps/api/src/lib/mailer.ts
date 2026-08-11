/**
 * Envío de correos transaccionales.
 *
 * Hoy los escribe en el log; el proveedor real (Resend) llega en la Semana 3.
 * La interfaz es lo que permite ese cambio sin tocar la lógica de negocio: los
 * services dependen de `Mailer`, no de Resend.
 *
 * Los dos últimos métodos no son cortesía, son seguridad. Cuando no podemos
 * decirle algo a quien hace la petición —porque revelaría si una cuenta
 * existe— se lo decimos al dueño real por un canal que solo él controla.
 */

import type { FastifyBaseLogger } from "fastify";
import { env } from "../config/env.js";

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
  /** Alguien intentó registrarse con un email que ya tiene cuenta. */
  sendDuplicateRegistrationNotice(to: string): Promise<void>;
  /** La cuenta se bloqueó por intentos fallidos. */
  sendAccountLockedNotice(to: string, until: Date): Promise<void>;
  /** Se detectó reuso de un refresh token y se cerraron todas las sesiones. */
  sendSessionRevokedNotice(to: string): Promise<void>;
}

/**
 * Implementación de desarrollo: registra el correo en el log en vez de
 * enviarlo. Los enlaces salen completos para poder copiarlos y probarlos.
 */
export function createLoggerMailer(log: FastifyBaseLogger): Mailer {
  function correo(asunto: string, to: string, cuerpo: Record<string, unknown>): void {
    log.info({ correo: { para: to, asunto, ...cuerpo } }, `[correo] ${asunto}`);
  }

  return {
    sendVerificationEmail(to, token) {
      correo("Verifica tu correo", to, {
        enlace: `${env.WEB_ORIGIN}/verificar-correo?token=${token}`,
      });
      return Promise.resolve();
    },

    sendPasswordResetEmail(to, token) {
      correo("Restablece tu contraseña", to, {
        enlace: `${env.WEB_ORIGIN}/restablecer?token=${token}`,
        validez: "1 hora",
      });
      return Promise.resolve();
    },

    sendDuplicateRegistrationNotice(to) {
      correo("Alguien intentó registrarse con tu correo", to, {
        nota: "Si fuiste tú, inicia sesión. Si no, ignora este mensaje: tu cuenta está intacta.",
      });
      return Promise.resolve();
    },

    sendAccountLockedNotice(to, until) {
      correo("Tu cuenta se bloqueó temporalmente", to, {
        motivo: "demasiados intentos de inicio de sesión fallidos",
        hasta: until.toISOString(),
      });
      return Promise.resolve();
    },

    sendSessionRevokedNotice(to) {
      correo("Cerramos todas tus sesiones por seguridad", to, {
        motivo: "se detectó el uso de una sesión ya caducada, señal de posible robo",
        accion: "Vuelve a iniciar sesión. Si no reconoces esto, cambia tu contraseña.",
      });
      return Promise.resolve();
    },
  };
}
