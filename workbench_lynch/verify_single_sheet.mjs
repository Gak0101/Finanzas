import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_20mas_single_sheet/watchlist_lynch_2026-08-05_maestro_20mas.xlsx";
const outputDir = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_20mas_single_sheet";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Maestro_Lynch");

const top = await workbook.inspect({ kind: "table", sheetId: "Maestro_Lynch", range: "A1:Q15", include: "values,formulas", tableMaxRows: 15, tableMaxCols: 17, tableMaxCellChars: 120, maxChars: 12000 });
const agenda = await workbook.inspect({ kind: "table", sheetId: "Maestro_Lynch", range: "A63:L69", include: "values,formulas", tableMaxRows: 7, tableMaxCols: 12, tableMaxCellChars: 120, maxChars: 8000 });
const sources = await workbook.inspect({ kind: "table", sheetId: "Maestro_Lynch", range: "A408:H416", include: "values,formulas", tableMaxRows: 9, tableMaxCols: 8, tableMaxCellChars: 120, maxChars: 8000 });
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "reimported single-sheet formula error scan" });

const summaryValues = sheet.getRange("A4:L4").values;
const records = sheet.getRange("D9:D60").values.flat().filter((value) => value !== null && value !== "");
const reviewDates = sheet.getRange("B9:B60").values.flat().filter((value) => value !== null && value !== "");
const scoreValues = sheet.getRange("O9:O60").values.flat().filter((value) => value !== null && value !== "");
const used = sheet.getUsedRange(true);
const preview = await workbook.render({ sheetName: "Maestro_Lynch", range: "A1:Q62", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/preview_maestro_reimport.png`, new Uint8Array(await preview.arrayBuffer()));
const rankingPreview = await workbook.render({ sheetName: "Maestro_Lynch", range: "A231:S287", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/preview_maestro_ranking_reimport.png`, new Uint8Array(await rankingPreview.arrayBuffer()));
const registerPreview = await workbook.render({ sheetName: "Maestro_Lynch", range: "A683:M693", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/preview_maestro_register_reimport.png`, new Uint8Array(await registerPreview.arrayBuffer()));

const result = {
  sheetCount: workbook.worksheets.items.length,
  sheetNames: workbook.worksheets.items.map((item) => item.name),
  usedRange: used?.address ?? null,
  summaryValues,
  counts: { records: records.length, reviewDates: reviewDates.length, scoreValues: scoreValues.length },
  top: top.ndjson,
  agenda: agenda.ndjson,
  sources: sources.ndjson,
  formulaErrors: errors.ndjson,
};
await fs.writeFile(`${outputDir}/verify_single_sheet.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  sheetCount: result.sheetCount,
  sheetNames: result.sheetNames,
  usedRange: result.usedRange,
  counts: result.counts,
  summaryValues: result.summaryValues,
  formulaErrors: result.formulaErrors,
}, null, 2));
