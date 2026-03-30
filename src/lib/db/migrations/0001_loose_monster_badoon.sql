CREATE TABLE `desviaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registro_id` integer NOT NULL,
	`usuario_id` integer NOT NULL,
	`categoria_origen` text NOT NULL,
	`categoria_destino` text NOT NULL,
	`monto` real NOT NULL,
	`motivo` text,
	`etiqueta` text,
	`saldada` integer DEFAULT false,
	`saldada_en_registro_id` integer,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`registro_id`) REFERENCES `registros_mensuales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
