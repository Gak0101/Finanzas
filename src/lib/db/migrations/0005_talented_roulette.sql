CREATE TABLE `configuraciones_ia` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`proveedor` text DEFAULT 'openrouter' NOT NULL,
	`api_key_cifrada` text NOT NULL,
	`modelo` text DEFAULT 'openrouter/free' NOT NULL,
	`ultimo_test_at` text,
	`ultimo_test_ok` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_configuracion_ia_usuario` ON `configuraciones_ia` (`usuario_id`);