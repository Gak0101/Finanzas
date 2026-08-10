import { SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const outDir = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_10mas";
const xlsxPath = outDir + "/watchlist_lynch_2026-08-05_10mas.xlsx";
const bytes = await fs.readFile(xlsxPath);
const workbook = await SpreadsheetFile.importXlsx(bytes.buffer);

const checks = await workbook.inspect({ kind: "table", sheetId: "Checks", range: "A4:D14" });
const watch = await workbook.inspect({ kind: "table", sheetId: "Watchlist", range: "A4:AB26" });
const priority = await workbook.inspect({ kind: "table", sheetId: "Analisis_Prioritario", range: "A4:V8" });
const ranking = await workbook.inspect({ kind: "table", sheetId: "Ranking_10Bagger", range: "A4:S26" });
const follow = await workbook.inspect({ kind: "table", sheetId: "Seguimiento", range: "A4:L26" });
const newIdeas = await workbook.inspect({ kind: "table", sheetId: "Nuevas_10", range: "A4:AL14" });
const newRanking = await workbook.inspect({ kind: "table", sheetId: "Ranking_Nuevas10", range: "A4:M14" });
const newFollow = await workbook.inspect({ kind: "table", sheetId: "Seguimiento_Nuevas10", range: "A4:N14" });
const newHistory = await workbook.inspect({ kind: "table", sheetId: "Historial_Nuevas10", range: "A4:Q14" });
const newSources = await workbook.inspect({ kind: "table", sheetId: "Fuentes_Nuevas10", range: "A4:H34" });
const newChecks = await workbook.inspect({ kind: "table", sheetId: "Checks", range: "A17:D21" });
const agenda = await workbook.inspect({ kind: "table", sheetId: "Agenda_Revision", range: "A10:S42" });
const masterChecks = await workbook.inspect({ kind: "table", sheetId: "Checks", range: "A23:D25" });
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
const errors = [];
for (const item of [checks, watch, priority, ranking, follow, newIdeas, newRanking, newFollow, newHistory, newSources, newChecks, agenda, masterChecks]) {
  const text = JSON.stringify(item);
  for (const token of ["#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NUM!", "#SPILL!", "#CALC!"]) {
    if (text.includes(token)) errors.push(token);
  }
}

const portadaPng = await workbook.render({ sheetName: "Portada", range: "A1:H52", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${outDir}/preview_portada.png`, new Uint8Array(await portadaPng.arrayBuffer()));
const watchPng = await workbook.render({ sheetName: "Watchlist", range: "A1:AB32", autoCrop: "all", scale: 0.7, format: "png" });
await fs.writeFile(`${outDir}/preview_watchlist.png`, new Uint8Array(await watchPng.arrayBuffer()));
const priorityPng = await workbook.render({ sheetName: "Analisis_Prioritario", range: "A1:V15", autoCrop: "all", scale: 0.8, format: "png" });
await fs.writeFile(`${outDir}/preview_analisis_prioritario.png`, new Uint8Array(await priorityPng.arrayBuffer()));
const rankingPng = await workbook.render({ sheetName: "Ranking_10Bagger", range: "A1:S34", autoCrop: "all", scale: 0.7, format: "png" });
await fs.writeFile(`${outDir}/preview_ranking_10bagger.png`, new Uint8Array(await rankingPng.arrayBuffer()));
const followPng = await workbook.render({ sheetName: "Seguimiento", range: "A1:L34", autoCrop: "all", scale: 0.9, format: "png" });
await fs.writeFile(outDir + "/preview_seguimiento.png", new Uint8Array(await followPng.arrayBuffer()));
const newIdeasPng = await workbook.render({ sheetName: "Nuevas_10", range: "A1:AL14", autoCrop: "all", scale: 0.55, format: "png" });
await fs.writeFile(outDir + "/preview_nuevas_10.png", new Uint8Array(await newIdeasPng.arrayBuffer()));
const newRankingPng = await workbook.render({ sheetName: "Ranking_Nuevas10", range: "A1:M14", autoCrop: "all", scale: 0.8, format: "png" });
await fs.writeFile(outDir + "/preview_ranking_nuevas10.png", new Uint8Array(await newRankingPng.arrayBuffer()));
const newFollowPng = await workbook.render({ sheetName: "Seguimiento_Nuevas10", range: "A1:N14", autoCrop: "all", scale: 0.7, format: "png" });
await fs.writeFile(outDir + "/preview_seguimiento_nuevas10.png", new Uint8Array(await newFollowPng.arrayBuffer()));
const newSourcesPng = await workbook.render({ sheetName: "Fuentes_Nuevas10", range: "A1:H34", autoCrop: "all", scale: 0.75, format: "png" });
await fs.writeFile(outDir + "/preview_fuentes_nuevas10.png", new Uint8Array(await newSourcesPng.arrayBuffer()));
const agendaPng = await workbook.render({ sheetName: "Agenda_Revision", range: "A1:S42", autoCrop: "all", scale: 0.65, format: "png" });
await fs.writeFile(outDir + "/preview_agenda_revision.png", new Uint8Array(await agendaPng.arrayBuffer()));
const checksPng = await workbook.render({ sheetName: "Checks", range: "A1:D25", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(outDir + "/preview_checks.png", new Uint8Array(await checksPng.arrayBuffer()));
const fichaPng = await workbook.render({ sheetName: "Plantilla_Ficha", range: "A1:H50", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(`${outDir}/preview_ficha.png`, new Uint8Array(await fichaPng.arrayBuffer()));

console.log(JSON.stringify({
  errors: [...new Set(errors)],
  checks,
  priority,
  ranking,
  newChecks,
  newIdeas,
  newRanking,
  newFollow,
  newHistory,
  newSources,
  agenda,
  masterChecks,
  formulaErrors,
  followRows: follow?.values?.length ?? null,
  watchRows: watch?.values?.length ?? null,
  previews: [
    outDir + "/preview_portada.png",
    outDir + "/preview_watchlist.png",
    outDir + "/preview_analisis_prioritario.png",
    outDir + "/preview_ranking_10bagger.png",
    outDir + "/preview_seguimiento.png",
    outDir + "/preview_agenda_revision.png",
    outDir + "/preview_nuevas_10.png",
    outDir + "/preview_ranking_nuevas10.png",
    outDir + "/preview_seguimiento_nuevas10.png",
    outDir + "/preview_fuentes_nuevas10.png",
    outDir + "/preview_checks.png",
    outDir + "/preview_ficha.png",
  ],
}));
