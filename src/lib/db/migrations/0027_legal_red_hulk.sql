CREATE TABLE `inversiones_notificaciones_config` (
	`usuario_id` integer PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`canal_telegram` integer DEFAULT true NOT NULL,
	`canal_email` integer DEFAULT true NOT NULL,
	`canal_whatsapp` integer DEFAULT true NOT NULL,
	`alertas_porcentaje` integer DEFAULT true NOT NULL,
	`alertas_precio` integer DEFAULT true NOT NULL,
	`alertas_fecha` integer DEFAULT true NOT NULL,
	`alertas_cartera` integer DEFAULT true NOT NULL,
	`seguimiento_lynch` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
