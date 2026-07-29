CREATE TABLE `inversiones_excel_filas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`hoja` text NOT NULL,
	`fila` integer NOT NULL,
	`tipo` text DEFAULT 'fila' NOT NULL,
	`datos` text NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_excel_usuario_hoja_fila` ON `inversiones_excel_filas` (`usuario_id`,`hoja`,`fila`);--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `hoja_origen` text DEFAULT 'Portfolio Nuevo' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `fila_origen` integer;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `incluido_resumen` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `divisa` text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `sector` text;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `market_symbol` text;