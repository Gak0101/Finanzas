CREATE TABLE `inversiones_seguimiento_estado` (
	`usuario_id` integer PRIMARY KEY NOT NULL,
	`heartbeat_at` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inversiones_seguimiento_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`run_key` text NOT NULL,
	`slot` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`report` text,
	`error` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_seguimiento_run` ON `inversiones_seguimiento_runs` (`usuario_id`,`run_key`);