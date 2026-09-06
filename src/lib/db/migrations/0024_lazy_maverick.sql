ALTER TABLE `inversiones_seguimiento_estado` ADD `enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `timezone` text DEFAULT 'Europe/Madrid' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `weekdays` text DEFAULT '[1,2,3,4,5]' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `slots` text DEFAULT '["08:00","14:00"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `max_notifications_per_day` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `canal_whatsapp` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `canal_telegram` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `inversiones_seguimiento_estado` ADD `updated_at` text DEFAULT '' NOT NULL;
