CREATE TABLE `inversiones_movimientos_efectivo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`custodia` text NOT NULL,
	`divisa` text DEFAULT 'EUR' NOT NULL,
	`fecha` text NOT NULL,
	`importe` real NOT NULL,
	`tipo` text NOT NULL,
	`operacion_id` integer,
	`referencia` text NOT NULL,
	`descripcion` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operacion_id`) REFERENCES `inversiones_operaciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inversion_movimiento_efectivo_saldo` ON `inversiones_movimientos_efectivo` (`usuario_id`,`custodia`,`divisa`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_movimiento_efectivo_referencia` ON `inversiones_movimientos_efectivo` (`referencia`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_movimiento_efectivo_operacion_tipo` ON `inversiones_movimientos_efectivo` (`operacion_id`,`tipo`);--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `origen_fondos` text;

--> statement-breakpoint

-- Preserve the legacy "available capital" visible before the ledger existed.
-- This deliberately seeds only the latest sale net per custody/currency; it
-- does not invent cash from historical purchases or other imported operations.
WITH latest_sale AS (
  SELECT
    `usuario_id`,
    `custodia`,
    `divisa`,
    `fecha`,
    ABS(`importe`) - ABS(`comision`) - ABS(`impuesto`) AS `importe_neto`,
    ROW_NUMBER() OVER (
      PARTITION BY `usuario_id`, `custodia`, `divisa`
      ORDER BY `fecha` DESC, COALESCE(`fecha_hora`, '') DESC, `id` DESC
    ) AS `fila`
  FROM `inversiones_operaciones`
  WHERE `tipo` = 'Venta'
)
INSERT INTO `inversiones_movimientos_efectivo` (
  `usuario_id`,
  `custodia`,
  `divisa`,
  `fecha`,
  `importe`,
  `tipo`,
  `operacion_id`,
  `referencia`,
  `descripcion`
)
SELECT
  `usuario_id`,
  `custodia`,
  `divisa`,
  `fecha`,
  `importe_neto`,
  'APERTURA_LEGACY',
  NULL,
  'legacy-opening-v1:' || `usuario_id` || ':' || `custodia` || ':' || `divisa`,
  'Saldo inicial legacy: neto de la última venta; no incluye compras históricas'
FROM latest_sale
WHERE `fila` = 1
  AND NOT EXISTS (
    SELECT 1
    FROM `inversiones_movimientos_efectivo` AS existing
    WHERE existing.`referencia` = 'legacy-opening-v1:' || latest_sale.`usuario_id` || ':' || latest_sale.`custodia` || ':' || latest_sale.`divisa`
  );
