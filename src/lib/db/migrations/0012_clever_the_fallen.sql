CREATE TABLE `inversiones_alertas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`alcance` text DEFAULT 'activo' NOT NULL,
	`posicion_id` integer,
	`activo` text,
	`ticker` text,
	`tipo_activo` text,
	`price_ticker` text,
	`crypto_id` text,
	`market_symbol` text,
	`precio_referencia` real,
	`precio_actual` real,
	`rendimiento_pct` real,
	`umbral_subida_pct` real,
	`umbral_caida_pct` real,
	`rearmar_pct` real DEFAULT 0.01 NOT NULL,
	`estado` text DEFAULT 'normal' NOT NULL,
	`canal_telegram` integer DEFAULT true NOT NULL,
	`canal_email` integer DEFAULT true NOT NULL,
	`activa` integer DEFAULT true NOT NULL,
	`ultima_comprobacion_at` text,
	`ultima_alerta_at` text,
	`ultimo_error` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`posicion_id`) REFERENCES `inversiones_posiciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_inversion_alerta_usuario_alcance_posicion` ON `inversiones_alertas` (`usuario_id`,`alcance`,`posicion_id`);
--> statement-breakpoint
INSERT INTO `inversiones_alertas` (
	`usuario_id`, `alcance`, `posicion_id`, `activo`, `ticker`, `tipo_activo`,
	`price_ticker`, `crypto_id`, `market_symbol`, `precio_actual`,
	`rendimiento_pct`, `umbral_subida_pct`, `umbral_caida_pct`, `estado`
)
SELECT
	`usuario_id`, 'activo', `id`, `activo`, `ticker`, `tipo`, `price_ticker`,
	`crypto_id`, `market_symbol`, `precio_actual`, `pnl_pct`,
	`alerta_subida_pct`, `alerta_caida_pct`, 'normal'
FROM `inversiones_posiciones`
WHERE `alerta_subida_pct` IS NOT NULL OR `alerta_caida_pct` IS NOT NULL;
