CREATE TABLE `configuraciones_fuentes_inversion` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`fiscal_api_key_cifrada` text,
	`finnhub_token_cifrado` text,
	`alpha_vantage_api_key_cifrada` text,
	`sec_contact_email` text,
	`financial_datasets_api_key_cifrada` text,
	`newsapi_key_cifrada` text,
	`permitir_busqueda_web_pago` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_fuentes_inversion_usuario` ON `configuraciones_fuentes_inversion` (`usuario_id`);