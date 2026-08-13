import { fromCents } from "@bodegon/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { Footer } from "../../page";
import { Header } from "../../../components/header";
import { NotFound, getProduct, imageUrl } from "../../../lib/api";
import type { ProductDetail } from "../../../lib/api";
import { SelectorTamano } from "./selector-tamano";

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

async function cargar(slug: string): Promise<ProductDetail> {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (error instanceof NotFound) notFound();
    throw error;
  }
}

/**
 * Metadatos por producto.
 *
 * generateMetadata se ejecuta en el servidor ANTES de renderizar, así que el
 * título y la descripción llegan en el HTML inicial. Si se pusieran desde el
 * navegador, quien comparte el enlace en WhatsApp o Twitter vería el título
 * genérico del sitio: esos servicios leen el HTML crudo y no ejecutan
 * JavaScript.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const producto = await cargar(slug);

  const descripcion =
    producto.description ??
    `${producto.name} — disponible desde ${producto.priceFromFormatted}.`;

  return {
    title: producto.name,
    description: descripcion.slice(0, 160),
    alternates: { canonical: `${SITIO}/productos/${producto.slug}` },
    openGraph: {
      title: producto.name,
      description: descripcion.slice(0, 200),
      type: "website",
      url: `${SITIO}/productos/${producto.slug}`,
      ...(producto.image === null
        ? {}
        : { images: [{ url: imageUrl(producto.image.url) }] }),
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactElement> {
  const { slug } = await params;
  const producto = await cargar(slug);

  return (
    <>
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <nav aria-label="Ruta de navegación" className="mb-6 text-sm text-ink-500">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:underline">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/productos" className="hover:underline">
                Catálogo
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink-700">{producto.name}</li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <Galeria producto={producto} />

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="font-display text-3xl text-ink-900 sm:text-4xl">
                {producto.name}
              </h1>
              {producto.description !== null ? (
                <p className="mt-3 max-w-prose text-ink-700">{producto.description}</p>
              ) : null}
            </div>

            <SelectorTamano variantes={producto.variants} />
          </div>
        </div>
      </main>

      <Footer />

      <DatosEstructurados producto={producto} />
    </>
  );
}

function Galeria({ producto }: { producto: ProductDetail }): ReactElement {
  if (producto.images.length === 0) {
    return (
      <div
        className="grid aspect-square place-items-center rounded-lg bg-surface text-brand-300"
        aria-hidden="true"
      >
        <svg className="size-16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M18 9h.008M2.25 19.5V4.5A2.25 2.25 0 0 1 4.5 2.25h15A2.25 2.25 0 0 1 21.75 4.5v15a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 19.5Z"
          />
        </svg>
      </div>
    );
  }

  const [principal, ...resto] = producto.images;

  return (
    <div className="flex flex-col gap-3">
      <img
        src={imageUrl(principal?.url ?? "")}
        alt={principal?.alt ?? producto.name}
        className="aspect-square w-full rounded-lg border border-border-subtle object-cover"
        // La imagen principal NO es lazy: es lo primero que se ve, y
        // retrasarla empeora la métrica de carga percibida.
        loading="eager"
      />
      {resto.length > 0 ? (
        <ul className="grid grid-cols-4 gap-3">
          {resto.map((imagen) => (
            <li key={imagen.url}>
              <img
                src={imageUrl(imagen.url)}
                alt={imagen.alt ?? producto.name}
                className="aspect-square w-full rounded-md border border-border-subtle object-cover"
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Datos estructurados JSON-LD (schema.org).
 *
 * Le dice a Google, en un formato que entiende, que esto es un PRODUCTO con
 * precio y disponibilidad — no un artículo cualquiera. Con eso puede mostrar
 * el precio y el "en stock" directamente en los resultados de búsqueda.
 *
 * Sin esto, el buscador solo ve texto y tiene que adivinar.
 */
function DatosEstructurados({ producto }: { producto: ProductDetail }): ReactElement {
  const datos = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.name,
    ...(producto.description === null ? {} : { description: producto.description }),
    ...(producto.images.length === 0
      ? {}
      : { image: producto.images.map((i) => imageUrl(i.url)) }),
    // Cada variante es una oferta distinta: schema.org lo modela igual que
    // nuestra base de datos.
    offers: producto.variants.map((variante) => ({
      "@type": "Offer",
      name: variante.size,
      sku: variante.sku,
      // schema.org espera el precio en unidades, no en centavos.
      price: fromCents(variante.priceCents).toFixed(2),
      priceCurrency: "MXN",
      availability: variante.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${SITIO}/productos/${producto.slug}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      // El contenido lo generamos nosotros a partir de datos ya validados, no
      // viene del usuario. Aun así se escapa "<" para cerrar cualquier vía de
      // inyección si un nombre de producto llevara etiquetas.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(datos).replace(/</g, "\\u003c"),
      }}
    />
  );
}
