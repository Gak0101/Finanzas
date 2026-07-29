CREATE TABLE `inversiones_operaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`fecha` text NOT NULL,
	`tipo` text NOT NULL,
	`activo` text NOT NULL,
	`ticker` text NOT NULL,
	`tipo_activo` text DEFAULT 'Otro' NOT NULL,
	`custodia` text NOT NULL,
	`cantidad` real NOT NULL,
	`precio_unitario` real NOT NULL,
	`importe` real NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inversiones_posiciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`custodia` text NOT NULL,
	`broker` text,
	`activo` text NOT NULL,
	`tipo` text NOT NULL,
	`ticker` text NOT NULL,
	`price_ticker` text,
	`crypto_id` text,
	`cantidad` real NOT NULL,
	`precio_compra` real,
	`coste` real,
	`precio_actual` real,
	`valor_actual` real,
	`pnl` real,
	`pnl_pct` real,
	`peso` real,
	`fuente` text,
	`estado_fuente` text DEFAULT 'SNAPSHOT' NOT NULL,
	`ultimo_valido` real,
	`fallback_map` real,
	`proveedor` text,
	`fuente_url` text,
	`nota` text,
	`snapshot_at` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_usuario_activo_custodia` ON `inversiones_posiciones` (`usuario_id`,`activo`,`custodia`);