-- Secuencia del número de pedido legible (p. ej. LCL-2026-0042).
--
-- POR QUÉ UNA SECUENCIA Y NO `SELECT count(*) + 1`:
--   nextval() es atómico. Dos compras en el mismo instante reciben números
--   distintos sin que la aplicación ponga ningún candado ni transacción extra.
--   Con el conteo, ambas leerían 41 y ambas escribirían 42: dos pedidos con el
--   mismo número, y la restricción UNIQUE de orders.orderNumber haría fallar
--   una compra que era perfectamente válida.
--
-- POR QUÉ NO SE REINICIA CADA AÑO:
--   El contador nunca retrocede, así que el número identifica al pedido de
--   forma única para siempre. El año del prefijo sirve para leerlo de un
--   vistazo, no para numerar. Reiniciarlo obligaría a que la unicidad
--   dependiera del par (año, contador), y eso es una fuente de errores en
--   cualquier consulta que olvide el año.
--
-- POR QUÉ EMPIEZA EN 1000:
--   Un primer pedido llamado LCL-2026-0001 le anuncia a quien lo reciba que es
--   el cliente número uno. Empezar más arriba no engaña a nadie de forma
--   relevante, pero evita regalar el dato de volumen de negocio en cada correo.

CREATE SEQUENCE IF NOT EXISTS order_number_seq
  AS bigint
  START WITH 1000
  INCREMENT BY 1;
