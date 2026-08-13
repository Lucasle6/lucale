"use client";

import { Button } from "@bodegon/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useState } from "react";
import { apiClient } from "../../lib/api";

export function CerrarSesion(): ReactElement {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  function cerrar(): void {
    setCargando(true);
    void apiClient("/admin/auth/logout", { method: "POST" })
      .catch(() => undefined) // cerrar sesión nunca debe fallar hacia el usuario
      .finally(() => {
        router.replace("/login");
        router.refresh();
      });
  }

  return (
    <Button variant="ghost" size="sm" onClick={cerrar} isLoading={cargando}>
      Salir
    </Button>
  );
}
