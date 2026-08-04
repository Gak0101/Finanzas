ALTER TABLE `inversiones_operaciones` ADD `fecha_hora` text;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `tipo_externo` text;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `comision` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `impuesto` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `divisa` text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `fuente` text DEFAULT 'App' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `external_id` text;--> statement-breakpoint
ALTER TABLE `inversiones_operaciones` ADD `descripcion` text;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_operacion_fuente_externa` ON `inversiones_operaciones` (`usuario_id`,`fuente`,`external_id`);
