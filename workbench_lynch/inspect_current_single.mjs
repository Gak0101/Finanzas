import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_10mas/watchlist_lynch_2026-08-05_10mas.xlsx";
const outputDir = "C:/Users/Cesar/Desktop/desarrollador/finanzas/workbench_lynch/current_inspect";
await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 4,
  tableMaxCols: 8,
  tableMaxCellChars: 100,
});
await fs.writeFile(`${outputDir}/summary.ndjson`, summary.ndjson ?? String(summary));

for (const sheetName of [
  "Agenda_Revision",
  "Watchlist",
  "Nuevas_10",
  "Historial",
  "Historial_Nuevas10",
  "Fuentes_Audit",
  "Fuentes_Nuevas10",
  "Seguimiento",
  "Seguimiento_Nuevas10",
  "Checklist_Lynch",
  "Ranking_10Bagger",
  "Ranking_Nuevas10",
  "Analisis_Prioritario",
  "Dossier_KN_ATYM",
  "Registro_KN_ATYM",
  "Descartadas",
  "Checks",
]) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const used = sheet.getUsedRange(true);
  const values = used ? used.values : [];
  await fs.writeFile(`${outputDir}/${sheetName}.json`, JSON.stringify({ values }, null, 2));
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/preview_${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

console.log(summary.ndjson);
