CREATE TABLE `aportaciones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hucha_id` integer NOT NULL,
	`cantidad` real NOT NULL,
	`fecha` text NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`hucha_id`) REFERENCES `huchas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`porcentaje` real NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`icono` text DEFAULT '💰',
	`orden` integer DEFAULT 0,
	`activa` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `huchas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`nombre` text NOT NULL,
	`objetivo` real NOT NULL,
	`descripcion` text,
	`color` text DEFAULT '#4ECDC4',
	`icono` text DEFAULT '🐷',
	`activa` integer DEFAULT true,
	`fecha_objetivo` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `registros_mensuales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`usuario_id` integer NOT NULL,
	`anio` integer NOT NULL,
	`mes` integer NOT NULL,
	`ingreso_bruto` real NOT NULL,
	`notas` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_usuario_anio_mes` ON `registros_mensuales` (`usuario_id`,`anio`,`mes`);--> statement-breakpoint
CREATE TABLE `snapshots_categorias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registro_id` integer NOT NULL,
	`categoria_nombre` text NOT NULL,
	`porcentaje` real NOT NULL,
	`color` text NOT NULL,
	`icono` text DEFAULT '💰',
	`monto_calculado` real NOT NULL,
	FOREIGN KEY (`registro_id`) REFERENCES `registros_mensuales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_username_unique` ON `usuarios` (`username`);