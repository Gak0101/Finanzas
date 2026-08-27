ALTER TABLE `inversiones_alertas` ADD `precio_base_porcentaje` real;--> statement-breakpoint
ALTER TABLE `inversiones_alertas` ADD `precio_base_porcentaje_nativo` real;--> statement-breakpoint
ALTER TABLE `inversiones_alertas` ADD `divisa_base_porcentaje` text;--> statement-breakpoint
UPDATE `inversiones_alertas`
SET `precio_base_porcentaje` = `precio_actual`,
    `precio_base_porcentaje_nativo` = `precio_actual_nativo`,
    `divisa_base_porcentaje` = `divisa_nativa`
WHERE `precio_actual` IS NOT NULL AND `precio_actual` > 0;
