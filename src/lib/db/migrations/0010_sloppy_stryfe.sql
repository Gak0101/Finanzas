CREATE TABLE `inversiones_snapshots_diarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`posicion_id` integer NOT NULL,
	`fecha_valoracion` text NOT NULL,
	`cantidad` real NOT NULL,
	`coste_eur` real,
	`precio_eur` real,
	`valor_eur` real,
	`pnl_no_realizado_eur` real,
	`precio_as_of` text,
	`proveedor` text,
	`estado_precio` text DEFAULT 'sin_precio' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`posicion_id`) REFERENCES `inversiones_posiciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_snapshot_inversion_usuario_posicion_fecha` ON `inversiones_snapshots_diarios` (`usuario_id`,`posicion_id`,`fecha_valoracion`);--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `pais` text;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `objetivo_precio` real;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `alerta_subida_pct` real;--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `alerta_caida_pct` real;