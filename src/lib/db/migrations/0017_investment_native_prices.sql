ALTER TABLE `inversiones_posiciones` ADD `precio_actual_nativo` real;
--> statement-breakpoint
ALTER TABLE `inversiones_posiciones` ADD `divisa_nativa` text;
--> statement-breakpoint
ALTER TABLE `inversiones_alertas` ADD `precio_actual_nativo` real;
--> statement-breakpoint
ALTER TABLE `inversiones_alertas` ADD `divisa_nativa` text;