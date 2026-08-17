"use client";

/**
 * Formulario de envío y pago.
 *
 * Valida con `checkoutSchema`, el MISMO esquema que usa la API. No una copia:
 * el mismo archivo, importado de `@bodegon/shared`.
 *
 * Y aun así el servidor vuelve a validarlo todo. Esta validación es comodidad
 * —enterarte de que falta la colonia sin esperar un viaje de red—, no
 * seguridad: cualquiera puede abrir la consola y llamar a la API saltándose
 * esta pantalla entera. La regla es la de siempre: el navegador nunca decide.
 */

import { MEXICAN_STATES, checkoutSchema } from "@bodegon/shared";
import { Button, Input, Select, Textarea } from "@bodegon/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { crearSesionDePago } from "../../lib/checkout-client";

interface Campos {
  email: string;
  recipientName: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  references: string;
}

const VACIO: Campos = {
  email: "",
  recipientName: "",
  street: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  references: "",
};

export function FormularioDeCheckout(): ReactElement {
  const [campos, setCampos] = useState<Campos>(VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo: keyof Campos, valor: string): void {
    setCampos((previos) => ({ ...previos, [campo]: valor }));
  }

  function alEnviar(evento: React.FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    setFallo(null);

    // Los opcionales se omiten cuando están vacíos en vez de mandarse como "".
    // Una cadena vacía es un dato; la ausencia es la verdad.
    const candidato = {
      email: campos.email,
      shippingAddress: {
        recipientName: campos.recipientName,
        street: campos.street,
        exteriorNumber: campos.exteriorNumber,
        ...(campos.interiorNumber.trim() === ""
          ? {}
          : { interiorNumber: campos.interiorNumber }),
        neighborhood: campos.neighborhood,
        city: campos.city,
        state: campos.state,
        postalCode: campos.postalCode,
        phone: campos.phone,
        ...(campos.references.trim() === "" ? {} : { references: campos.references }),
      },
    };

    const resultado = checkoutSchema.safeParse(candidato);

    if (!resultado.success) {
      // Cada problema trae la ruta del campo que lo causó. Nos quedamos con el
      // último tramo ("street", "postalCode"…) para colgarlo del control.
      const nuevos: Partial<Record<keyof Campos, string>> = {};
      for (const problema of resultado.error.issues) {
        const clave = problema.path.at(-1);
        if (typeof clave === "string" && clave in VACIO) {
          const campo = clave as keyof Campos;
          nuevos[campo] ??= problema.message;
        }
      }
      setErrores(nuevos);
      return;
    }

    setErrores({});
    setEnviando(true);

    crearSesionDePago(resultado.data)
      .then((sesion) => {
        // location.href y no router.push: el destino es el dominio de Stripe,
        // fuera de esta aplicación. El enrutador de Next no sale de aquí.
        window.location.href = sesion.checkoutUrl;
      })
      .catch((e: unknown) => {
        setFallo(e instanceof Error ? e.message : "No pudimos iniciar el pago");
        setEnviando(false);
      });
    // Sin `finally`: si todo va bien nos estamos yendo a Stripe, y reactivar el
    // botón durante la redirección solo invita a un segundo clic.
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl text-ink-900">Tus datos</h2>

        <Input
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          hint="Aquí te mandamos el recibo y el aviso de envío."
          value={campos.email}
          {...(errores.email === undefined ? {} : { error: errores.email })}
          onChange={(e) => {
            actualizar("email", e.target.value);
          }}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-3xl text-ink-900">¿A dónde lo enviamos?</h2>

        <Input
          label="Nombre de quien recibe"
          name="recipientName"
          autoComplete="name"
          value={campos.recipientName}
          {...(errores.recipientName === undefined
            ? {}
            : { error: errores.recipientName })}
          onChange={(e) => {
            actualizar("recipientName", e.target.value);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_140px_140px]">
          <Input
            label="Calle"
            name="street"
            autoComplete="address-line1"
            value={campos.street}
            {...(errores.street === undefined ? {} : { error: errores.street })}
            onChange={(e) => {
              actualizar("street", e.target.value);
            }}
          />
          <Input
            label="Número ext."
            name="exteriorNumber"
            value={campos.exteriorNumber}
            {...(errores.exteriorNumber === undefined
              ? {}
              : { error: errores.exteriorNumber })}
            onChange={(e) => {
              actualizar("exteriorNumber", e.target.value);
            }}
          />
          <Input
            label="Número int."
            name="interiorNumber"
            hint="Opcional"
            value={campos.interiorNumber}
            {...(errores.interiorNumber === undefined
              ? {}
              : { error: errores.interiorNumber })}
            onChange={(e) => {
              actualizar("interiorNumber", e.target.value);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Colonia"
            name="neighborhood"
            autoComplete="address-level3"
            value={campos.neighborhood}
            {...(errores.neighborhood === undefined
              ? {}
              : { error: errores.neighborhood })}
            onChange={(e) => {
              actualizar("neighborhood", e.target.value);
            }}
          />
          <Input
            label="Ciudad o municipio"
            name="city"
            autoComplete="address-level2"
            value={campos.city}
            {...(errores.city === undefined ? {} : { error: errores.city })}
            onChange={(e) => {
              actualizar("city", e.target.value);
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Estado"
            name="state"
            autoComplete="address-level1"
            value={campos.state}
            {...(errores.state === undefined ? {} : { error: errores.state })}
            onChange={(e) => {
              actualizar("state", e.target.value);
            }}
          >
            <option value="">Elige un estado</option>
            {MEXICAN_STATES.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </Select>

          <Input
            label="Código postal"
            name="postalCode"
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={5}
            value={campos.postalCode}
            {...(errores.postalCode === undefined ? {} : { error: errores.postalCode })}
            onChange={(e) => {
              actualizar("postalCode", e.target.value);
            }}
          />
        </div>

        <Input
          label="Teléfono"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          hint="Lo pide la paquetería para avisarte de la entrega."
          value={campos.phone}
          {...(errores.phone === undefined ? {} : { error: errores.phone })}
          onChange={(e) => {
            actualizar("phone", e.target.value);
          }}
        />

        <Textarea
          label="Referencias"
          name="references"
          rows={3}
          hint="Opcional, pero ayuda: entre qué calles, color del portón, con quién preguntar."
          value={campos.references}
          {...(errores.references === undefined ? {} : { error: errores.references })}
          onChange={(e) => {
            actualizar("references", e.target.value);
          }}
        />
      </section>

      {fallo !== null ? (
        <p role="alert" className="text-sm text-danger">
          {fallo}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="lg" fullWidth disabled={enviando}>
          {enviando ? "Abriendo el pago…" : "Continuar al pago"}
        </Button>
        <p className="mt-2 text-center text-sm text-ink-500">
          Te llevamos a Stripe para introducir la tarjeta. Nosotros nunca vemos sus datos.
        </p>
      </div>
    </form>
  );
}
