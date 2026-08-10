import { SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const outDir = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260804";
const xlsxPath = `${outDir}/watchlist_lynch_2026-08-04.xlsx`;
const bytes = await fs.readFile(xlsxPath);
const workbook = await SpreadsheetFile.importXlsx(bytes.buffer);

const checks = await workbook.inspect({ kind: "table", sheetId: "Checks", range: "A4:D14" });
const watch = await workbook.inspect({ kind: "table", sheetId: "Watchlist", range: "A4:AB26" });
const priority = await workbook.inspect({ kind: "table", sheetId: "Analisis_Prioritario", range: "A4:V8" });
const ranking = await workbook.inspect({ kind: "table", sheetId: "Ranking_10Bagger", range: "A4:S26" });
const follow = await workbook.inspect({ kind: "table", sheetId: "Seguimiento", range: "A4:L26" });
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
const errors = [];
for (const item of [checks, watch, priority, ranking, follow]) {
  const text = JSON.stringify(item);
  for (const token of ["#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#SPILL!", "#CALC!"]) {
    if (text.includes(token)) errors.push(token);
  }
}

const portadaPng = await workbook.render({ sheetName: "Portada", range: "A1:H43", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${outDir}/preview_portada.png`, new Uint8Array(await portadaPng.arrayBuffer()));
const watchPng = await workbook.render({ sheetName: "Watchlist", range: "A1:AB32", autoCrop: "all", scale: 0.7, format: "png" });
await fs.writeFile(`${outDir}/preview_watchlist.png`, new Uint8Array(await watchPng.arrayBuffer()));
const priorityPng = await workbook.render({ sheetName: "Analisis_Prioritario", range: "A1:V15", autoCrop: "all", scale: 0.8, format: "png" });
await fs.writeFile(`${outDir}/preview_analisis_prioritario.png`, new Uint8Array(await priorityPng.arrayBuffer()));
const rankingPng = await workbook.render({ sheetName: "Ranking_10Bagger", range: "A1:S34", autoCrop: "all", scale: 0.7, format: "png" });
await fs.writeFile(`${outDir}/preview_ranking_10bagger.png`, new Uint8Array(await rankingPng.arrayBuffer()));
const followPng = await workbook.render({ sheetName: "Seguimiento", range: "A1:L34", autoCrop: "all", scale: 0.9, format: "png" });
await fs.writeFile(`${outDir}/preview_seguimiento.png`, new Uint8Array(await followPng.arrayBuffer()));
const fichaPng = await workbook.render({ sheetName: "Plantilla_Ficha", range: "A1:H50", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${outDir}/preview_ficha.png`, new Uint8Array(await fichaPng.arrayBuffer()));

console.log(JSON.stringify({
  errors: [...new Set(errors)],
  checks,
  priority,
  ranking,
  formulaErrors,
  followRows: follow?.values?.length ?? null,
  watchRows: watch?.values?.length ?? null,
  previews: [`${outDir}/preview_portada.png`, `${outDir}/preview_watchlist.png`, `${outDir}/preview_analisis_prioritario.png`, `${outDir}/preview_ranking_10bagger.png`, `${outDir}/preview_seguimiento.png`, `${outDir}/preview_ficha.png`],
}));
