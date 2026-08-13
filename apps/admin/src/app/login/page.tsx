import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { haySesionDeAdmin } from "../../lib/api-server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Acceso" };

export default async function LoginPage(): Promise<ReactElement> {
  // Si ya hay sesión, no tiene sentido mostrar el formulario.
  if (await haySesionDeAdmin()) {
    redirect("/productos");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
