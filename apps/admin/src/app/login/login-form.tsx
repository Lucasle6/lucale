"use client";

import { Button, Card, Input } from "@bodegon/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { ApiRequestError, apiClient } from "../../lib/api";

/**
 * Acceso al panel, en dos o tres pasos.
 *
 *   1. credenciales  → nunca entrega sesión, siempre pide segundo factor
 *   2a. si ya tiene 2FA  → pide el código
 *   2b. si NO lo tiene   → obliga a configurarlo ahora, con QR
 *
 * El paso 2b es lo que hace que el 2FA sea obligatorio de verdad para admins:
 * no hay forma de llegar al panel saltándoselo.
 */

type Paso =
  | { fase: "credenciales" }
  | { fase: "codigo"; challengeToken: string }
  | { fase: "configurar"; challengeToken: string; qrDataUrl: string; clave: string };

interface RespuestaLogin {
  status: "two_factor_required" | "two_factor_setup_required";
  challengeToken: string;
}

export function LoginForm(): ReactElement {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>({ fase: "credenciales" });
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  /** Envuelve una acción con el manejo de carga y error, para no repetirlo. */
  async function ejecutar(accion: () => Promise<void>): Promise<void> {
    setError(null);
    setCargando(true);
    try {
      await accion();
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.error.message : "No se pudo completar la acción",
      );
    } finally {
      setCargando(false);
    }
  }

  function enviarCredenciales(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    void ejecutar(async () => {
      const respuesta = await apiClient<RespuestaLogin>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: datos.get("email"),
          password: datos.get("password"),
        }),
      });

      if (respuesta.status === "two_factor_required") {
        setPaso({ fase: "codigo", challengeToken: respuesta.challengeToken });
        return;
      }

      // Aún no tiene segundo factor: se le obliga a configurarlo antes de
      // entrar.
      const setup = await apiClient<{ qrDataUrl: string; manualEntryKey: string }>(
        "/admin/auth/2fa/setup",
        {
          method: "POST",
          body: JSON.stringify({ challengeToken: respuesta.challengeToken }),
        },
      );

      setPaso({
        fase: "configurar",
        challengeToken: respuesta.challengeToken,
        qrDataUrl: setup.qrDataUrl,
        clave: setup.manualEntryKey,
      });
    });
  }

  function enviarCodigo(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (paso.fase === "credenciales") return;

    const datos = new FormData(evento.currentTarget);
    // FormData.get puede devolver File además de string; nos quedamos solo con
    // el caso de texto, que es lo único que este campo puede producir.
    const valor = datos.get("totpCode");
    const codigo = typeof valor === "string" ? valor : "";

    void ejecutar(async () => {
      const ruta =
        paso.fase === "configurar" ? "/admin/auth/2fa/confirm" : "/admin/auth/login/2fa";

      const respuesta = await apiClient<{ backupCodes?: string[] }>(ruta, {
        method: "POST",
        body: JSON.stringify({ challengeToken: paso.challengeToken, totpCode: codigo }),
      });

      // Los códigos de respaldo se muestran UNA sola vez, así que se pasan a
      // la siguiente pantalla en vez de perderse.
      if (respuesta.backupCodes !== undefined) {
        sessionStorage.setItem(
          "codigosDeRespaldo",
          JSON.stringify(respuesta.backupCodes),
        );
      }

      // refresh() vuelve a ejecutar los Server Components, que ahora sí verán
      // la cookie de sesión.
      router.replace("/productos");
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md">
      <header className="mb-6">
        <p className="text-sm font-medium tracking-wide text-brand-600 uppercase">
          LuCaLe
        </p>
        <h1 className="mt-1 text-2xl text-ink-900">
          {paso.fase === "credenciales"
            ? "Panel de administración"
            : paso.fase === "configurar"
              ? "Configura tu segundo factor"
              : "Verificación en dos pasos"}
        </h1>
      </header>

      {paso.fase === "credenciales" ? (
        <form onSubmit={enviarCredenciales} className="flex flex-col gap-4">
          <Input
            label="Correo"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {error !== null ? <MensajeError texto={error} /> : null}
          <Button type="submit" isLoading={cargando} fullWidth>
            Continuar
          </Button>
        </form>
      ) : (
        <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
          {paso.fase === "configurar" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-ink-700">
                Escanea este código con tu app de autenticación (Google Authenticator,
                1Password, Authy…).
              </p>
              <Image
                src={paso.qrDataUrl}
                alt="Código QR para configurar el segundo factor"
                width={200}
                height={200}
                className="rounded-md border border-border-subtle"
                unoptimized
              />
              <details className="w-full text-sm text-ink-500">
                <summary className="cursor-pointer">¿No puedes escanear?</summary>
                <p className="mt-2 font-mono text-xs break-all">{paso.clave}</p>
              </details>
            </div>
          ) : (
            <p className="text-sm text-ink-700">
              Escribe el código de 6 dígitos de tu app de autenticación.
            </p>
          )}

          <Input
            label="Código de verificación"
            name="totpCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
          />
          {error !== null ? <MensajeError texto={error} /> : null}
          <Button type="submit" isLoading={cargando} fullWidth>
            {paso.fase === "configurar" ? "Activar y entrar" : "Entrar"}
          </Button>
        </form>
      )}
    </Card>
  );
}

function MensajeError({ texto }: { texto: string }): ReactElement {
  // role="alert" para que el lector de pantalla lo anuncie al aparecer.
  return (
    <p role="alert" className="text-sm text-danger">
      {texto}
    </p>
  );
}
