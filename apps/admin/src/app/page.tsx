import { redirect } from "next/navigation";

/** La raíz del panel no muestra nada: lleva al listado o al login. */
export default function RootPage(): never {
  redirect("/productos");
}
