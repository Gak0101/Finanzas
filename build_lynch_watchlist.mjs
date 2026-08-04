import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const AS_OF = new Date("2026-08-04T00:00:00Z");
const OUT_DIR = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260804";
const OUT_FILE = `${OUT_DIR}/watchlist_lynch_2026-08-04.xlsx`;

await fs.mkdir(OUT_DIR, { recursive: true });

const workbook = Workbook.create();

const C = {
  navy: "#17365D",
  blue: "#1F4E78",
  paleBlue: "#D9EAF7",
  lightBlue: "#EAF3F8",
  green: "#E2F0D9",
  paleGreen: "#C6E0B4",
  yellow: "#FFF2CC",
  orange: "#FCE4D6",
  red: "#F4CCCC",
  gray: "#F2F2F2",
  darkGray: "#666666",
  white: "#FFFFFF",
  black: "#000000",
  input: "#0000FF",
  link: "#008000",
};

const date = (iso) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

function styleTitle(sheet, range, title) {
  sheet.mergeCells(range);
  const r = sheet.getRange(range);
  r.values = [[title]];
  r.format = {
    fill: C.navy,
    font: { bold: true, color: C.white, size: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "center",
  };
  r.format.rowHeight = 30;
}

function styleSubtitle(sheet, range, text) {
  sheet.mergeCells(range);
  const r = sheet.getRange(range);
  r.values = [[text]];
  r.format = {
    fill: C.lightBlue,
    font: { italic: true, color: C.darkGray, size: 10 },
    wrapText: true,
    verticalAlignment: "center",
  };
  r.format.rowHeight = 30;
}

function styleHeader(sheet, range) {
  const r = sheet.getRange(range);
  r.format = {
    fill: C.blue,
    font: { bold: true, color: C.white, size: 10 },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  r.format.rowHeight = 34;
}

function styleSection(sheet, range, text) {
  sheet.mergeCells(range);
  const r = sheet.getRange(range);
  r.values = [[text]];
  r.format = {
    fill: C.paleBlue,
    font: { bold: true, color: C.navy, size: 11 },
    verticalAlignment: "center",
  };
  r.format.rowHeight = 22;
}

function setTableStyle(sheet, address, name) {
  const table = sheet.tables.add(address, true, name);
  try { table.style = "TableStyleMedium2"; } catch {}
  return table;
}

function finishSheet(sheet, usedRange, freezeRows = 0) {
  sheet.showGridLines = false;
  const r = sheet.getRange(usedRange);
  r.format.verticalAlignment = "center";
  r.format.wrapText = true;
  try { r.format.autofitRows(); } catch {}
  try { r.format.autofitColumns(); } catch {}
  if (freezeRows > 0) sheet.freezePanes.freezeRows(freezeRows);
}

// -----------------------------------------------------------------------------
// Portada
// -----------------------------------------------------------------------------
const portada = workbook.worksheets.add("Portada");
styleTitle(portada, "A1:H1", "Watchlist de acciones — enfoque Lynch");
styleSubtitle(portada, "A2:H2", "Plantilla de investigación y seguimiento. Fecha de corte: 2026-08-04. Las conclusiones son hipótesis de trabajo, no una recomendación personalizada.");

portada.getRange("A4:B8").values = [
  ["Objetivo", "Convertir una idea en una tesis comprobable y actualizable."],
  ["Método", "Negocio comprensible + historia/catalizador + crecimiento + PER/valoración + balance + riesgos."],
  ["Cómo usarlo", "Actualiza en azul; conserva el enlace y la fecha de cada dato en Fuentes_Audit."],
  ["Regla", "Una puntuación alta no sustituye revisar deuda, dilución, resultados y precio de entrada."],
  ["Universo actual", "12 compañías: 7 ya estudiadas y 5 incorporaciones nuevas. Usa Seguimiento para saber qué revisar y cuándo."],
];
portada.getRange("A4:A8").format = { fill: C.gray, font: { bold: true, color: C.navy } };
portada.getRange("B4:B8").format = { wrapText: true, font: { color: C.black } };

styleSection(portada, "A10:H10", "Lectura rápida de la watchlist");
portada.getRange("A11:H11").values = [["Empresa", "Ticker", "Tipo", "Precio", "PER", "Score", "Veredicto", "Prioridad"]];
styleHeader(portada, "A11:H11");
const quickRows = [
  ["Atalaya Mining", "ATYM", "Existente / cíclica", 917, 17.29, "='Watchlist'!AA5", "='Watchlist'!V5", "='Watchlist'!W5"],
  ["Rio Tinto", "RIO", "Existente / cíclica", 7313, 16.05, "='Watchlist'!AA6", "='Watchlist'!V6", "='Watchlist'!W6"],
  ["eToro", "ETOR", "Nueva / alto crecimiento", 37.06, 15.47, "='Watchlist'!AA7", "='Watchlist'!V7", "='Watchlist'!W7"],
  ["HBX Group", "HBX", "Nueva / crecimiento-cíclica", 7.71, 10.21, "='Watchlist'!AA8", "='Watchlist'!V8", "='Watchlist'!W8"],
  ["Figma", "FIG", "Nueva / alto crecimiento", 27.26, -6.78, "='Watchlist'!AA9", "='Watchlist'!V9", "='Watchlist'!W9"],
  ["JD Sports", "JD.", "Madura / crecimiento", 86.18, 9.99, "='Watchlist'!AA10", "='Watchlist'!V10", "='Watchlist'!W10"],
  ["PayPal", "PYPL", "Madura / recuperable", 58.335, 11.03, "='Watchlist'!AA11", "='Watchlist'!V11", "='Watchlist'!W11"],
  ["Wise", "WISE", "Alto crecimiento / calidad", 905.60, 24.38, "='Watchlist'!AA12", "='Watchlist'!V12", "='Watchlist'!W12"],
  ["Auto Trader", "AUTO", "Madura / crecimiento", 532.40, 15.58, "='Watchlist'!AA13", "='Watchlist'!V13", "='Watchlist'!W13"],
  ["B&M European Value Retail", "BME", "Recuperable / cíclica", 225.80, 13.85, "='Watchlist'!AA14", "='Watchlist'!V14", "='Watchlist'!W14"],
  ["Kainos Group", "KNOS", "Crecimiento / nicho", 820.00, 23.10, "='Watchlist'!AA15", "='Watchlist'!V15", "='Watchlist'!W15"],
  ["Plus500", "PLUS", "Madura / cíclica", 3746.00, 12.84, "='Watchlist'!AA16", "='Watchlist'!V16", "='Watchlist'!W16"],
];
portada.getRange("A12:H23").values = quickRows;
portada.getRange("F12:H23").format.font = { color: C.link };
portada.getRange("D12:D23").format.numberFormat = "0.00";
portada.getRange("E12:E23").format.numberFormat = "0.00\"x\"";
portada.getRange("F12:F23").format.numberFormat = "0";
setTableStyle(portada, "A11:H23", "QuickView");

styleSection(portada, "A26:H26", "Cómo interpretar la puntuación");
portada.getRange("A27:B31").values = [
  ["12–16", "Candidato: merece profundizar y definir precio de entrada."],
  ["9–11", "Vigilancia: hay algo interesante, pero falta confirmar una pieza."],
  ["0–8", "Revisar: no hay suficiente margen de seguridad o claridad."],
  ["Importante", "La puntuación es una ayuda de proceso creada para esta hoja; no es una escala oficial de Peter Lynch."],
  ["Siguiente paso", "Ve a Seguimiento: compara precio, PER, crecimiento, FCF, deuda y el dato que puede invalidar la tesis."],
];
portada.getRange("A27:A31").format = { fill: C.gray, font: { bold: true, color: C.navy } };
portada.getRange("B27:B31").format.wrapText = true;

portada.getRange("D27:H31").values = [
  ["Hoja", "Uso", "", "", ""],
  ["Watchlist", "Panel principal y datos de mercado/resultados.", "", "", ""],
  ["Checklist_Lynch", "Puntuación y preguntas pendientes.", "", "", ""],
  ["Historial / Fuentes_Audit", "Series y trazabilidad de cada afirmación.", "", "", ""],
  ["Seguimiento", "Próxima revisión, métricas a comparar y condición de invalidación.", "", "", ""],
];
portada.getRange("D27:E27").format = { fill: C.gray, font: { bold: true, color: C.navy } };
portada.getRange("D28:E31").format.wrapText = true;
finishSheet(portada, "A1:H31");
portada.getRange("A:A").format.columnWidth = 20;
portada.getRange("B:B").format.columnWidth = 55;
portada.getRange("D:D").format.columnWidth = 20;
portada.getRange("E:E").format.columnWidth = 18;
portada.getRange("G:G").format.columnWidth = 35;

// -----------------------------------------------------------------------------
// Watchlist
// -----------------------------------------------------------------------------
const watch = workbook.worksheets.add("Watchlist");
styleTitle(watch, "A1:AB1", "Watchlist principal");
styleSubtitle(watch, "A2:AB2", "Los campos de mercado y resultados son instantáneas con fecha; las fórmulas están en negro/verde. Las unidades de cada compañía pueden variar: consulta Fuentes_Audit antes de comparar.");
watch.getRange("A4:AB4").values = [[
  "Empresa", "Ticker", "Bolsa", "Tipo / categoría Lynch", "Fecha salida", "Moneda / cuentas", "Precio", "Capitalización (m)", "PER informado", "EPS", "Dividendo anual", "Yield", "Ventas / net contribution último (m)", "Crec. ventas", "Crec. EBITDA / beneficio", "FCF último (m)", "Deuda neta (+) / caja neta (-) (m)", "PEG heurístico*", "Catalizador", "Riesgo principal", "Próximo evento", "Veredicto Lynch", "Prioridad", "As of", "Fuente mercado", "Fuente resultados", "Score Lynch", "Estado"
]];
styleHeader(watch, "A4:AB4");

const watchRows = [
  ["Atalaya Mining", "ATYM", "LSE", "Existente / cíclica", null, "GBX / EUR", 917, 1410, 17.29, 53.03, 6.10, 0.00665, 482.9, 0.478, 1.708, 107.4, -122, null, "Cobre, caja reforzada y posible Touro; comprobar conversión de caja.", "Precio del cobre, inventario, ley/recuperación, capex y ejecución.", "Próxima actualización: pendiente", "Esperar / vigilar", 2, AS_OF, "ATYM-MKT", "ATYM-FY25", null, null],
  ["Rio Tinto", "RIO", "LSE / ASX", "Existente / cíclica", null, "GBX / USD", 7313, 118930, 16.05, 455.72, 284.57, 0.03891, 57638, null, null, 4025, 14362, null, "Cobre y producción; H1 2026 con EBITDA/FCF sólidos y disciplina de costes.", "Ciclo de materias primas, China, grandes proyectos y deuda/capex.", "Resultados FY2026: pendiente", "Compra escalonada / vigilar precio", 1, AS_OF, "RIO-MKT", "RIO-H1-26", null, null],
  ["eToro", "ETOR", "NASDAQ", "Nueva / alto crecimiento", date("2025-05-14"), "USD", 37.06, 3010, 15.47, 2.64, 0, 0, 868, 0.10, 0.04, null, -1300, null, "Q1 2026: net contribution +19%, EBITDA ajustado +35%; resultados Q2 el 11-ago y recompra autorizada.", "Ciclicidad de trading/cripto, historial corto, dual class y posible volatilidad de beneficios.", "Resultados Q2: 2026-08-11", "Vigilar / posible entrada pequeña", 2, AS_OF, "ETOR-MKT", "ETOR-Q1-26", null, null],
  ["HBX Group", "HBX", "BME", "Nueva / crecimiento-cíclica", date("2025-03-06"), "EUR", 7.71, 1860, 10.21, 0.75, 0.08, 0.0097, 309, 0.01, 0.09, null, 741, null, "TTV H1 2026 +17% en moneda constante, recompra de 100m y cotización ~33% bajo el precio de IPO.", "Guía recortada, deuda, geopolítica de viajes y transición CEO/CFO.", "Resultados FY2026: 2026-11-25", "Vigilar / oportunidad con margen", 1, AS_OF, "HBX-MKT", "HBX-H1-26", null, null],
  ["Figma", "FIG", "NYSE", "Nueva / alto crecimiento", date("2025-07-31"), "USD", 27.26, 14270, -6.78, -4.02, 0, 0, 1056, 0.41, null, 242.7, -1700, null, "Q2 2026 el 5-ago; guía FY26 de ingresos +35% y NDR 139% en Q1.", "Pérdida GAAP, stock-based compensation/dilución y valoración aproximada de 10x ventas FY26.", "Resultados Q2: 2026-08-05", "Esperar / no comprar antes de resultados", 3, AS_OF, "FIG-MKT", "FIG-Q1-26", null, null],
  ["JD Sports Fashion", "JD.", "LSE", "Madura / crecimiento", null, "GBX / GBP", 86.18, 4120, 9.986, 8.63, 1.00, 0.0116, 12662, 0.105, -0.054, 462, null, null, "Ventas FY26 +10.5%, FCF +36%; recompra de 200m y actualización Q2 el 20-ago.", "Márgenes y EPS cayendo, consumidor/EE. UU., competencia, inventario y divisas.", "Trading update Q2: 2026-08-20", "Oportunidad condicional / vigilar márgenes", 1, AS_OF, "JD-MKT", "JD-FY26", null, null],
  ["PayPal", "PYPL", "NASDAQ", "Madura / recuperable", null, "USD", 58.335, 51451, 11.027, 5.29, 0.56, 0.0096, 8400, 0.07, null, 1700, null, null, "FCF, recompras y dividendo; TPV Q1 2026 +11%, pero toca demostrar recuperación del checkout.", "Competencia de Apple Pay/Shopify/Affirm/Klarna, cuentas activas planas y branded checkout +2%.", "Resultados 3T26: fecha pendiente", "Oportunidad especulativa / vigilar ejecución", 2, AS_OF, "PYPL-MKT", "PYPL-Q1-26", null, null],
  ["Wise", "WISE", "LSE", "Alto crecimiento / calidad", null, "GBX / USD", 905.60, 8940, 24.38446, 37.1384, 0, 0, 2502.8, 0.19, -0.08, 407.6, -468, null, "Volumen transfronterizo, más clientes y Wise Account; Q1 FY27 net revenue +25% y recompra prevista.", "PER exigente, take rate a la baja, tipos de interés, regulación y caja mezclada con fondos salvaguardados.", "Próxima actualización trimestral: tentativa 2026-10-15", "Vigilar / crecimiento con precio exigente", 2, AS_OF, "WISE-MKT", "WISE-Q1-27", null, null],
  ["Auto Trader", "AUTO", "LSE", "Madura / crecimiento", null, "GBX / GBP", 532.40, 4170, 15.58092, 34.17, 10.90, 0.02047, 624.3, 0.04, 0.04, 306.1, 146.8, null, "Marketplace dominante, ARPR +5%, margen operativo 63% y mejora de Deal Builder tras escuchar a concesionarios.", "Presión de concesionarios, menor stock pagado, confianza en Deal Builder, endeudamiento nuevo y Autorama aún en pérdidas.", "Resultados semestrales FY27: 2026-11-05", "Oportunidad condicional / vigilar Deal Builder", 1, AS_OF, "AUTO-MKT", "AUTO-FY26", null, null],
  ["B&M European Value Retail", "BME", "LSE", "Recuperable / cíclica", null, "GBX / GBP", 225.80, 2230, 13.85, 16.30, 13.20, 0.05846, 5775, 0.036, -0.259, 321, 656, null, "Plan Back to B&M Basics, recuperación de margen UK y crecimiento de Francia; compras de consejeros en junio.", "Beneficio y margen muy deteriorados, LFL UK -2.3% en Q1, deuda y riesgo de trampa de dividendo.", "H1 FY27 / trading update: tentativa 2026-11-12", "Oportunidad de turnaround / esperar confirmación", 1, AS_OF, "BME-MKT", "BME-Q1-27", null, null],
  ["Kainos Group", "KNOS", "LSE", "Crecimiento / nicho", null, "GBX / GBP", 820.00, 945.42, 23.10, 35.50, 29.60, 0.03610, 431.1, 0.17, 0.02, 49.7, -89.1, null, "Workday Products ARR +23%, bookings +32% y backlog +18%; caja neta y recompras apoyan el nicho.", "Margen ajustado solo +2%, más contratistas/proveedores, concentración Workday y caja menor tras inversión/recompras.", "Trading update FY27: 2026-09-07", "Vigilar / posible entrada pequeña", 2, AS_OF, "KNOS-MKT", "KNOS-FY26", null, null],
  ["Plus500", "PLUS", "LSE", "Madura / cíclica", null, "GBX / USD", 3746.00, 2580, 12.83602, 291.83512, 67.01867, 0.01789, 462.9, 0.12, 0.01, 280.1, -850, null, "Resultados H1 el 10-ago, retorno de capital, crecimiento de futuros/prediction markets y caja >850m.", "CFD y volatilidad, regulación, margen EBITDA estancado, clientes FY25 -5% y mayor peso de negocios no-OTC.", "Resultados H1 2026: 2026-08-10", "Oportunidad especulativa / esperar H1", 2, AS_OF, "PLUS-MKT", "PLUS-H1-26", null, null],
];
watch.getRange("A5:AB16").values = watchRows;

// Formulas: PEG, score and status.
for (let row = 5; row <= 16; row += 1) {
  watch.getRange(`R${row}`).formulas = [[`=IF(AND(I${row}>0,O${row}>0),I${row}/(O${row}*100),"")`]];
  watch.getRange(`AA${row}`).formulas = [[`=IFERROR('Checklist_Lynch'!L${row},"")`]];
  watch.getRange(`AB${row}`).formulas = [[`=IF(AA${row}>=12,"Alta prioridad",IF(AA${row}>=9,"Vigilancia","Revisar"))`]];
}

watch.getRange("A5:Q16").format.font = { color: C.input };
watch.getRange("S5:Z16").format.font = { color: C.input };
watch.getRange("AA5:AA16").format.font = { color: C.link };
watch.getRange("R5:R16").format.font = { color: C.black };
watch.getRange("AB5:AB16").format.font = { color: C.black };
watch.getRange("E5:E16").format.numberFormat = "yyyy-mm-dd";
watch.getRange("X5:X16").format.numberFormat = "yyyy-mm-dd";
watch.getRange("G5:K16").format.numberFormat = "0.00";
watch.getRange("H5:H16").format.numberFormat = "#,##0.0";
watch.getRange("I5:I16").format.numberFormat = "0.00\"x\"";
watch.getRange("L5:L16").format.numberFormat = "0.0%";
watch.getRange("M5:Q16").format.numberFormat = "#,##0.0";
watch.getRange("N5:O16").format.numberFormat = "0.0%";
watch.getRange("R5:R16").format.numberFormat = "0.00\"x\"";
watch.getRange("AA5:AA16").format.numberFormat = "0";
watch.getRange("W5:W16").format.numberFormat = "0";
watch.getRange("A5:AB16").format.wrapText = true;
watch.getRange("A5:AB16").format.rowHeight = 66;
try {
  watch.getRange("A5:AB16").conditionalFormats.add("containsText", { text: "Alta prioridad", format: { fill: C.green } });
  watch.getRange("A5:AB16").conditionalFormats.add("containsText", { text: "Esperar", format: { fill: C.yellow } });
} catch {}
setTableStyle(watch, "A4:AB16", "WatchlistTable");
styleSection(watch, "A19:AB19", "Notas de uso");
watch.getRange("A20:A22").values = [["* PEG heurístico"], ["Datos mixtos"], ["Estado"]];
watch.getRange("B20:B22").values = [["PER dividido por el crecimiento porcentual del EBITDA/beneficio. No usar con pérdidas, cíclicas, periodos mezclados o divisas distintas."], ["Para no inventar, algunas filas usan FY2025/FY2026 y otras el último trimestre disponible. La hoja Historial separa los periodos."], ["La prioridad es una señal de trabajo, no una orden de compra. Define precio de entrada y condición de invalidación en Checklist_Lynch y Seguimiento."]];
/*
  ["* PEG heurístico", "PER dividido por el crecimiento porcentual del EBITDA/beneficio. No usar con pérdidas, cíclicas, periodos mezclados o divisas distintas.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Datos mixtos", "Para no inventar, algunas filas usan FY2025/FY2026 y otras el último trimestre disponible. La hoja Historial separa los periodos.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Estado", "La prioridad es una señal de trabajo, no una orden de compra. Define precio de entrada y condición de invalidación en Checklist_Lynch.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
*/
watch.getRange("A20:A22").format = { fill: C.gray, font: { bold: true, color: C.navy } };
watch.mergeCells("B20:AB20");
watch.mergeCells("B21:AB21");
watch.mergeCells("B22:AB22");
watch.getRange("B20:AB22").format.wrapText = true;
finishSheet(watch, "A1:AB22", 4);
const watchWidths = { A: 22, B: 9, C: 12, D: 27, E: 12, F: 14, G: 11, H: 15, I: 11, J: 10, K: 12, L: 10, M: 16, N: 11, O: 15, P: 13, Q: 15, R: 12, S: 42, T: 42, U: 26, V: 34, W: 10, X: 12, Y: 14, Z: 14, AA: 10, AB: 15 };
for (const [col, width] of Object.entries(watchWidths)) watch.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Checklist Lynch
// -----------------------------------------------------------------------------
const checklist = workbook.worksheets.add("Checklist_Lynch");
styleTitle(checklist, "A1:O1", "Checklist tipo Peter Lynch");
styleSubtitle(checklist, "A2:O2", "Puntúa 0–2 salvo donde se indique 0–1. Esta escala es una herramienta propia para obligarnos a explicitar la tesis; no es una escala publicada por Lynch.");
checklist.getRange("A4:O4").values = [[
  "Empresa", "Ticker", "Negocio comprensible (0-2)", "Historia / catalizador (0-2)", "Crecimiento (0-2)", "Valoración (0-2)", "Balance / caja (0-2)", "Dividendo / recompra (0-1)", "Insiders / ownership (0-1)", "Riesgos manejables (0-2)", "Evidencia / disciplina (0-2)", "Total", "Veredicto", "Qué falta comprobar", "Última revisión"
]];
styleHeader(checklist, "A4:O4");
const checkRows = [
  ["Atalaya Mining", "ATYM", 2, 1, 2, 1, 2, 0, 1, 1, 1, null, null, "Guía de producción, Touro, coste AISC y conversión de caja.", AS_OF],
  ["Rio Tinto", "RIO", 2, 2, 1, 2, 2, 1, 1, 1, 2, null, null, "Sensibilidad a cobre/aluminio, capex de grandes proyectos y China.", AS_OF],
  ["eToro", "ETOR", 2, 2, 2, 1, 2, 1, 0, 1, 1, null, null, "Resultados Q2, calidad de ingresos, lock-ups/dual class y sensibilidad cripto.", AS_OF],
  ["HBX Group", "HBX", 2, 2, 1, 2, 1, 1, 1, 1, 1, null, null, "Deuda neta, nueva guía, transición de CEO y conversión a caja.", AS_OF],
  ["Figma", "FIG", 2, 2, 2, 0, 2, 0, 0, 1, 1, null, null, "Q2, SBC/dilución, retención y valoración sobre FCF normalizado.", AS_OF],
  ["JD Sports Fashion", "JD.", 2, 1, 1, 2, 1, 1, 1, 1, 1, null, null, "Márgenes, LFL en EE. UU., inventario y efecto de recompras sobre EPS.", AS_OF],
  ["PayPal", "PYPL", 2, 1, 1, 2, 2, 1, 0, 1, 1, null, null, "Checkout branded, cuentas activas, nueva estrategia y competencia.", AS_OF],
  ["Wise", "WISE", 2, 2, 2, 1, 2, 0, 1, 1, 1, null, null, "Q2 FY27, take rate, margen antes de impuestos, caja utilizable y regulación.", AS_OF],
  ["Auto Trader", "AUTO", 2, 2, 1, 2, 1, 1, 1, 1, 2, null, null, "Deal Builder, stock pagado, ARPR, concesionarios y deuda neta.", AS_OF],
  ["B&M European Value Retail", "BME", 2, 2, 1, 2, 1, 1, 1, 1, 1, null, null, "LFL UK, margen EBITDA, deuda, dividendo y ejecución de Back to B&M Basics.", AS_OF],
  ["Kainos Group", "KNOS", 2, 2, 2, 1, 2, 1, 1, 1, 1, null, null, "ARR Workday, bookings/backlog, margen ajustado y caja tras recompras.", AS_OF],
  ["Plus500", "PLUS", 2, 2, 2, 2, 2, 1, 1, 1, 1, null, null, "H1: customer income, EBITDA, clientes, margen, regulación y retorno de capital.", AS_OF],
];
checklist.getRange("A5:O16").values = checkRows;
for (let row = 5; row <= 16; row += 1) {
  checklist.getRange(`L${row}`).formulas = [[`=SUM(C${row}:K${row})`]];
  checklist.getRange(`M${row}`).formulas = [[`=IF(L${row}>=12,"Candidato",IF(L${row}>=9,"Vigilancia","Revisar"))`]];
}
checklist.getRange("A5:K16").format.font = { color: C.input };
checklist.getRange("N5:O16").format.font = { color: C.input };
checklist.getRange("L5:M16").format.font = { color: C.black };
checklist.getRange("O5:O16").format.numberFormat = "yyyy-mm-dd";
checklist.getRange("C5:K16").format.horizontalAlignment = "center";
checklist.getRange("L5:L16").format.numberFormat = "0";
try {
  checklist.getRange("C5:K16").dataValidation = { rule: { type: "wholeNumber", operator: "between", formula1: 0, formula2: 2 } };
} catch {}
try {
  checklist.getRange("H5:I16").dataValidation = { rule: { type: "wholeNumber", operator: "between", formula1: 0, formula2: 1 } };
} catch {}
try {
  checklist.getRange("A5:M16").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 12, format: { fill: C.green } });
} catch {}
setTableStyle(checklist, "A4:O16", "ChecklistTable");
styleSection(checklist, "A19:O19", "Preguntas de control antes de comprar");
checklist.getRange("A20:O25").values = [
  ["1", "¿Puedo explicar cómo gana dinero en dos frases y qué variable mueve el beneficio?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["2", "¿La tesis depende de un catalizador identificable o solo de que el múltiplo se expanda?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["3", "¿El crecimiento llega a beneficio y caja, o solo a ingresos / métricas ajustadas?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["4", "¿Qué PER pagaría por beneficios normalizados y qué precio ofrece margen de seguridad?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["5", "¿Qué dato invalidaría la tesis? Escríbelo antes de comprar.", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["6", "¿He leído el último informe, las notas de deuda/dilución y la remuneración directiva?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
checklist.getRange("A20:A25").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
checklist.mergeCells("B20:O20");
checklist.mergeCells("B21:O21");
checklist.mergeCells("B22:O22");
checklist.mergeCells("B23:O23");
checklist.mergeCells("B24:O24");
checklist.mergeCells("B25:O25");
finishSheet(checklist, "A1:O25", 4);
checklist.getRange("A:A").format.columnWidth = 22;
checklist.getRange("B:B").format.columnWidth = 9;
for (const col of ["C", "D", "E", "F", "G", "H", "I", "J", "K"]) checklist.getRange(`${col}:${col}`).format.columnWidth = 14;
checklist.getRange("L:L").format.columnWidth = 9;
checklist.getRange("M:M").format.columnWidth = 14;
checklist.getRange("N:N").format.columnWidth = 48;
checklist.getRange("O:O").format.columnWidth = 12;

// -----------------------------------------------------------------------------
// Historial
// -----------------------------------------------------------------------------
const historial = workbook.worksheets.add("Historial");
styleTitle(historial, "A1:P1", "Historial financiero y operativo");
styleSubtitle(historial, "A2:P2", "Añade una fila por periodo. Mantén la moneda y el tipo de periodo para no mezclar anual, semestre y trimestre sin advertencia.");
historial.getRange("A4:P4").values = [["Empresa", "Ticker", "Periodo", "Tipo", "Moneda", "Ventas / net contribution (m)", "Crec. ventas", "EBITDA / op. profit (m)", "Crec. EBITDA", "Beneficio / PAT (m)", "EPS", "FCF (m)", "Caja neta (-) / deuda neta (+) (m)", "KPI operativo", "Fuente ID", "Nota"]];
styleHeader(historial, "A4:P4");
const historyRows = [
  ["Atalaya Mining", "ATYM", "FY2024", "Anual", "EUR", 326.8, null, 66.4, null, 32.6, 0.226, null, null, "Producción cobre: periodo anterior", "ATYM-FY25", "Comparativa del informe FY25"],
  ["Atalaya Mining", "ATYM", "FY2025", "Anual", "EUR", 482.9, 0.478, 179.8, 1.708, 85.4, 0.608, 107.4, -122, "Cobre; caja neta FY25", "ATYM-FY25", "Caja de Q2 2026 separada abajo"],
  ["Atalaya Mining", "ATYM", "Q2 2026", "Trimestral", "EUR", null, null, null, null, null, null, null, -318.4, "Producción 13.493 kt; inventario 11.362 kt", "ATYM-Q2-26", "Actualización operativa, no cuenta de resultados completa"],
  ["Rio Tinto", "RIO", "FY2025", "Anual", "USD", 57638, null, 25363, null, 9966, null, 4025, 14362, "Producción / cobre; dividendo 402c", "RIO-FY25", "Resultados oficiales FY25"],
  ["Rio Tinto", "RIO", "H1 2026", "Semestral", "USD", 31028, null, 14826, null, 6851, null, 3834, 14061, "Producción +8% y disciplina de costes", "RIO-H1-26", "Presentación/resultados H1"],
  ["eToro", "ETOR", "FY2025", "Anual", "USD", 868, 0.10, 317, 0.04, 216, 2.64, null, -1300, "AUA / cuentas financiadas", "ETOR-FY25", "Net contribution, no revenue GAAP comparable"],
  ["eToro", "ETOR", "Q1 2026", "Trimestral", "USD", 258, 0.19, 109, 0.35, 82, null, null, -1300, "AUA 17.0bn; funded accounts 4.02m", "ETOR-Q1-26", "Crecimientos interanuales"],
  ["HBX Group", "HBX", "H1 2026", "Semestral", "EUR", 309, 0.01, 163, 0.09, 28, null, null, 741, "TTV 3.77bn +17% CC; cash conversion 103%", "HBX-H1-26", "Guía FY26 revisada a la baja"],
  ["Figma", "FIG", "FY2025", "Anual", "USD", 1056, 0.41, 129.5, null, null, null, 242.7, -1700, "NDR / clientes empresariales", "FIG-FY25", "Operating profit non-GAAP; SBC distorsiona GAAP"],
  ["Figma", "FIG", "Q1 2026", "Trimestral", "USD", 333.4, 0.46, 52.1, null, -142.4, null, 88.6, -1600, "NDR 139%; paid customers ~690k", "FIG-Q1-26", "Cash and securities"],
  ["JD Sports Fashion", "JD.", "FY2026", "Anual", "GBP", 12662, 0.105, 886, -0.054, null, 0.0863, 462, null, "Q4 returned to LFL growth", "JD-FY26", "EPS estatutario 8.63p; op profit ajustado"],
  ["PayPal", "PYPL", "FY2025", "Anual", "USD", null, null, null, null, null, null, 6400, null, "Recompras 6.0bn; dividendo trimestral 0.14", "PYPL-FY25", "FCF ajustado"],
  ["PayPal", "PYPL", "Q1 2026", "Trimestral", "USD", 8400, 0.07, null, null, null, null, 1700, null, "TPV 464bn +11%; branded checkout +2%", "PYPL-Q1-26", "Cifras trimestrales"],
  ["Wise", "WISE", "FY2026", "Anual", "USD", 2502.8, 0.19, 590.7, -0.189, 498.7, 0.4843, 407.6, -468, "19m clientes; volumen cross-border 243.5bn; holdings 39bn", "WISE-FY26", "FCF y caja son proxies: el flujo incluye fondos de clientes salvaguardados"],
  ["Wise", "WISE", "Q1 FY2027", "Trimestral", "USD", 714.0, 0.25, null, null, null, null, null, null, "11.863m clientes; volumen 69.3bn; take rate 50bps", "WISE-Q1-27", "Actualización operativa; no cuenta de resultados completa"],
  ["Auto Trader", "AUTO", "FY2026", "Anual", "GBP", 624.3, 0.04, 392.7, 0.04, 293.9, 0.3417, 306.1, 146.8, "ARPR 2,995 GBP +5%; forecourts 13,942", "AUTO-FY26", "FCF aproximado: caja operativa neta más inversión"],
  ["B&M European Value Retail", "BME", "FY2026", "Anual", "GBP", 5775, 0.036, 459, -0.259, 284, 0.213, 321, 656, "Margen EBITDA 8.0%; UK plano; Francia +13.4%", "BME-FY26", "Se usa PBT ajustado como proxy de beneficio en la cabecera"],
  ["B&M European Value Retail", "BME", "Q1 FY2027", "Trimestral", "GBP", 1433, 0.02, null, null, null, null, null, null, "UK LFL -2.3%; Francia LFL +5.3%; Heron LFL +2.6%", "BME-Q1-27", "Actualización operativa; no cuenta de resultados completa"],
  ["Kainos Group", "KNOS", "FY2026", "Anual", "GBP", 431.1, 0.17, 67.1, 0.02, 42.5, 0.351, 49.7, -89.1, "Bookings 505.3m; backlog 433.9m; ARR 89.0m", "KNOS-FY26", "FCF aproximado: caja operativa neta menos capex; adquisición excluida"],
  ["Plus500", "PLUS", "FY2025", "Anual", "USD", 792.4, 0.03, 348.1, 0.02, 281.3, 3.93, 280.1, -801.6, "242,440 clientes activos; 39% del capital en treasury", "PLUS-FY25", "FCF aproximado: caja operativa neta menos capex"],
  ["Plus500", "PLUS", "H1 FY2026", "Semestral", "USD", 462.9, 0.12, 187.5, 0.01, null, null, null, -850, "Customer Income 460.8m +24%; activos 197,294 +10%", "PLUS-H1-26", "Trading update; resultados H1 completos el 10-ago-2026"],
];
historial.getRange("A5:P25").values = historyRows;
historial.getRange("A5:E25").format.font = { color: C.input };
historial.getRange("F5:N25").format.font = { color: C.input };
historial.getRange("O5:P25").format.font = { color: C.input };
historial.getRange("F5:F25").format.numberFormat = "#,##0.0";
historial.getRange("G5:G25").format.numberFormat = "0.0%";
historial.getRange("H5:H25").format.numberFormat = "#,##0.0";
historial.getRange("I5:I25").format.numberFormat = "0.0%";
historial.getRange("J5:M25").format.numberFormat = "#,##0.0";
historial.getRange("A5:P25").format.rowHeight = 48;
try { historial.getRange("G5:I25").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: C.red } }); } catch {}
setTableStyle(historial, "A4:P25", "HistoryTable");
finishSheet(historial, "A1:P25", 4);
const histWidths = { A: 22, B: 9, C: 12, D: 12, E: 10, F: 18, G: 12, H: 18, I: 12, J: 16, K: 10, L: 12, M: 20, N: 42, O: 14, P: 40 };
for (const [col, width] of Object.entries(histWidths)) historial.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Plantilla de ficha
// -----------------------------------------------------------------------------
const ficha = workbook.worksheets.add("Plantilla_Ficha");
styleTitle(ficha, "A1:H1", "Plantilla de ficha de empresa");
styleSubtitle(ficha, "A2:H2", "Duplica esta hoja o úsala como formulario para una nueva idea. Las celdas azules son entradas; las negras son cálculos.");
styleSection(ficha, "A4:D4", "Identificación");
ficha.getRange("A5:B10").values = [["Empresa", ""], ["Ticker", ""], ["Bolsa", ""], ["Tipo", ""], ["Fecha de análisis", AS_OF], ["Fuente principal", ""]];
ficha.getRange("A5:A10").format = { fill: C.gray, font: { bold: true, color: C.navy } };
ficha.getRange("B5:B10").format.font = { color: C.input };
ficha.getRange("B9").format.numberFormat = "yyyy-mm-dd";

styleSection(ficha, "A12:D12", "Valoración y caja");
ficha.getRange("A13:B21").values = [["Precio", ""], ["EPS", ""], ["PER calculado", null], ["Crec. beneficios", ""], ["PEG heurístico", null], ["FCF", ""], ["Capitalización", ""], ["FCF yield", null], ["Deuda neta (+) / caja (-)", ""]];
ficha.getRange("A13:A21").format = { fill: C.gray, font: { bold: true, color: C.navy } };
ficha.getRange("B13:B14").format.font = { color: C.input };
ficha.getRange("B16:B16").format.font = { color: C.input };
ficha.getRange("B18:B19").format.font = { color: C.input };
ficha.getRange("B21:B21").format.font = { color: C.input };
ficha.getRange("B15").formulas = [["=IFERROR(B13/B14,\"\")"]];
ficha.getRange("B17").formulas = [["=IF(AND(B15>0,B16>0),B15/(B16*100),\"\")"]];
ficha.getRange("B20").formulas = [["=IFERROR(B18/B19,\"\")"]];
ficha.getRange("B13:B15").format.numberFormat = "0.00";
ficha.getRange("B16").format.numberFormat = "0.0%";
ficha.getRange("B17").format.numberFormat = "0.00\"x\"";
ficha.getRange("B18:B21").format.numberFormat = "#,##0.0";
ficha.getRange("B20").format.numberFormat = "0.0%";
ficha.getRange("B15:B15").format.font = { color: C.black };
ficha.getRange("B17:B17").format.font = { color: C.black };
ficha.getRange("B20:B20").format.font = { color: C.black };

styleSection(ficha, "D12:H12", "Tesis Lynch");
ficha.getRange("D13:H21").values = [
  ["¿Qué hace?", "", "", "", ""],
  ["¿Por qué puede crecer?", "", "", "", ""],
  ["¿Cuál es el catalizador?", "", "", "", ""],
  ["¿Qué puede salir mal?", "", "", "", ""],
  ["¿Qué precio sería razonable?", "", "", "", ""],
  ["¿Qué dato invalida la tesis?", "", "", "", ""],
  ["¿Qué dice la dirección?", "", "", "", ""],
  ["¿Qué dicen insiders/accionistas?", "", "", "", ""],
  ["Próxima revisión", "", "", "", ""],
];
ficha.getRange("D13:D21").format = { fill: C.gray, font: { bold: true, color: C.navy } };
for (let row = 13; row <= 21; row += 1) ficha.mergeCells(`E${row}:H${row}`);
ficha.getRange("E13:H21").format.font = { color: C.input };
ficha.getRange("E13:H21").format.fill = C.yellow;
ficha.getRange("E21").format.numberFormat = "yyyy-mm-dd";

styleSection(ficha, "A24:H24", "Checklist rápida");
ficha.getRange("A25:H25").values = [["Criterio", "Puntos", "Comentario", "", "", "", "", ""]];
styleHeader(ficha, "A25:H25");
const quickChecklist = [
  ["Negocio comprensible", "", "", "", "", "", "", ""],
  ["Historia / catalizador", "", "", "", "", "", ""],
  ["Crecimiento", "", "", "", "", "", ""],
  ["Valoración", "", "", "", "", "", ""],
  ["Balance / caja", "", "", "", "", "", ""],
  ["Riesgos manejables", "", "", "", "", "", ""],
];
ficha.getRange("A26:H31").values = quickChecklist;
ficha.getRange("A26:B31").format.font = { color: C.input };
ficha.mergeCells("C26:H26"); ficha.mergeCells("C27:H27"); ficha.mergeCells("C28:H28"); ficha.mergeCells("C29:H29"); ficha.mergeCells("C30:H30"); ficha.mergeCells("C31:H31");
ficha.getRange("C26:H31").format.font = { color: C.input };
ficha.getRange("C26:H31").format.fill = C.lightBlue;
ficha.getRange("B26:B31").format.horizontalAlignment = "center";
try { ficha.getRange("B26:B31").dataValidation = { rule: { type: "wholeNumber", operator: "between", formula1: 0, formula2: 2 } }; } catch {}
ficha.getRange("A33:H34").values = [["Nota", "Escribe siempre la condición de compra, el precio de entrada y el punto de salida por tesis rota.", "", "", "", "", "", ""], ["Fuente", "No dejes una cifra sin enlace, fecha y moneda.", "", "", "", "", "", ""]];
ficha.getRange("A33:A34").format = { fill: C.gray, font: { bold: true, color: C.navy } };
ficha.mergeCells("B33:H33"); ficha.mergeCells("B34:H34");
styleSection(ficha, "A36:H36", "Las 13 señales de una empresa atractiva — completar con evidencia");
ficha.getRange("A37:H37").values = [["#", "Criterio Lynch (parafraseado)", "Evidencia / enlace", "", "", "", "", ""]];
styleHeader(ficha, "A37:H37");
const lynchSignals = [
  "Nombre o historia poco glamourosa, fácil de pasar por alto.",
  "Hace algo aburrido, rutinario o poco mediático.",
  "Hace algo desagradable que mantiene alejados a los competidores.",
  "Es una escisión reciente o una parte separada de otra empresa.",
  "Tiene poca cobertura institucional o pocos analistas siguiéndola.",
  "Arrastra rumores o un estigma que puede mantener baja la valoración.",
  "Opera en un sector deprimente o impopular, pero necesario.",
  "Está en un sector de poco crecimiento donde aún puede ganar cuota.",
  "Tiene un nicho, franquicia, marca, licencia o ventaja difícil de replicar.",
  "El cliente vuelve a comprar el producto/servicio de forma recurrente.",
  "Usa la tecnología para ahorrar costes o mejorar un negocio sencillo.",
  "La gente de dentro compra acciones y está alineada con accionistas.",
  "Recompra acciones de forma efectiva y evita la dilución innecesaria.",
].map((signal, index) => [index + 1, signal, "", "", "", "", "", ""]);
ficha.getRange("A38:H50").values = lynchSignals;
ficha.getRange("A38:A50").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
ficha.getRange("B38:B50").format.font = { color: C.black };
for (let row = 38; row <= 50; row += 1) ficha.mergeCells(`C${row}:H${row}`);
ficha.getRange("C38:H50").format = { fill: C.yellow, font: { color: C.input }, wrapText: true };
ficha.getRange("A38:H50").format.rowHeight = 32;
finishSheet(ficha, "A1:H50");
for (const [col, width] of Object.entries({ A: 28, B: 18, C: 20, D: 27, E: 22, F: 22, G: 22, H: 22 })) ficha.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Fuentes y auditoría
// -----------------------------------------------------------------------------
const sources = workbook.worksheets.add("Fuentes_Audit");
styleTitle(sources, "A1:G1", "Fuentes y auditoría");
styleSubtitle(sources, "A2:G2", "Fuente de mercado = cotización/ratios de la fecha de corte. Fuente de resultados = comunicado, informe o SEC. Prioriza las fuentes oficiales para actualizar.");
sources.getRange("A4:G4").values = [["Fuente ID", "Empresa", "Fecha", "Tipo", "Qué respalda", "URL", "Nota de calidad / uso"]];
styleHeader(sources, "A4:G4");
const sourceRows = [
  ["ATYM-MKT", "Atalaya Mining", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo", "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=Atalaya-Mining&shareprice=ATYM", "Snapshot de mercado; actualizar antes de decidir."],
  ["ATYM-FY25", "Atalaya Mining", date("2026-03-19"), "Resultados", "FY25 ventas, EBITDA, beneficio, FCF y caja", "https://wp-atalaya-mining-2022.s3.eu-west-2.amazonaws.com/media/2026/03/2026.03.19-ATYM_RNS-2025-Annual-Results-vF.pdf", "Informe anual oficial."],
  ["ATYM-Q2-26", "Atalaya Mining", date("2026-07-28"), "Operativo", "Producción Q2, inventario y caja neta", "https://www.lse.co.uk/rns/ATYM/q2-2026-operations-update-bdqqmb3wkhfb7d1.html", "Usar también la corrección posterior del mismo comunicado."],
  ["ATYM-OWN", "Atalaya Mining", AS_OF, "Ownership", "Accionistas significativos", "https://atalayamining.com/es/inversores/informacion-accionarial/", "Comprobar cambios de participaciones."],
  ["RIO-MKT", "Rio Tinto", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo", "https://www.lse.co.uk/SharePrice.html?share=Rio-tinto&shareprice=RIO", "Snapshot de mercado; actualizar antes de decidir."],
  ["RIO-FY25", "Rio Tinto", date("2026-02-19"), "Resultados", "FY25 ventas, EBITDA, beneficio, FCF, deuda y dividendo", "https://www.riotinto.com/news/releases/2026/rio-tinto-solid-results-underpinned-by-8-cueq-production-and-sharper-cost-discipline", "Comunicado oficial de resultados."],
  ["RIO-H1-26", "Rio Tinto", date("2026-07-28"), "Resultados", "H1 2026 ventas, EBITDA, FCF y deuda", "https://www.businesswire.com/news/home/20260728256050/en/Rio-Tinto-Step-change-in-performance-delivering-higher-shareholder-returns", "Resumen de resultados H1; contrastar con presentación oficial."],
  ["RIO-OWN", "Rio Tinto", AS_OF, "Ownership", "Beneficial ownership", "https://www.riotinto.com/-/media/Content/Documents/Sustainability/Ethics-and-integrity/Transparency/RT-Beneficial-ownership.pdf?rev=4d675f7ef7d6467f9f48d4f2f368402b", "Documento de transparencia."],
  ["RIO-BB", "Rio Tinto", AS_OF, "Capital allocation", "Historial de recompras", "https://www.riotinto.com/invest/shareholder-information/share-buy-backs?source=content_type%3Areact%7Cfirst_level_url%3Aarticle%7Csection%3Amain_content%7Cbutton%3Abody_link", "Revisar vigencia y saldo."],
  ["ETOR-MKT", "eToro", AS_OF, "Mercado", "Precio, capitalización y PER orientativo", "https://stockanalysis.com/stocks/etor/", "Snapshot de tercero; contrastar con IR/mercado."],
  ["ETOR-FY25", "eToro", date("2026-03-10"), "Resultados", "FY25 net contribution, EBITDA, beneficio y recompra", "https://investors.etoro.com/news-releases/news-release-details/etoro-reports-fourth-quarter-and-full-year-2025-results", "Fuente oficial de la compañía."],
  ["ETOR-Q1-26", "eToro", date("2026-05-12"), "Resultados", "Q1 2026 crecimiento, AUA, cuentas y caja", "https://investors.etoro.com/news-releases/news-release-details/etoro-reports-first-quarter-2026-results", "Fuente oficial; próximos resultados 11-ago-2026."],
  ["ETOR-20F", "eToro", date("2026-03-31"), "Filing", "Acciones Clase A/B y estructura societaria", "https://investors.etoro.com/static-files/42426819-ac6c-46e9-ba77-2aeaacf156b2", "Revisar dilución, dual class y lock-up."],
  ["HBX-MKT", "HBX Group", AS_OF, "Mercado", "Precio, capitalización, PER, EPS y dividendo", "https://stockanalysis.com/quote/bme/HBX/", "Snapshot de tercero; actualizar antes de decidir."],
  ["HBX-IPO", "HBX Group", date("2025-03-06"), "IPO", "Precio y fecha de salida a bolsa", "https://investors.hbxgroup.com/English/news/news-details/2025/HBX-Group-launches-its-IPO-on-the-Spanish-Stock-Exchanges-at-a-Price-Range-of-10.50---12.50-per-share/", "El precio de IPO fue 11.50 EUR."],
  ["HBX-H1-26", "HBX Group", date("2026-07-29"), "Resultados", "H1 2026 TTV, ventas, EBITDA, PAT, deuda, guía y recompra", "https://www.prnewswire.com/news-releases/hbx-group-announces-half-year-2026-financial-results-302770897.html", "Comunicado distribuido por la compañía."],
  ["HBX-SH", "HBX Group", AS_OF, "Ownership", "Accionistas significativos", "https://investors.hbxgroup.com/English/stock-info/significant-shareholders/default.aspx", "CPPIB/Cinven y free float; comprobar actualizaciones."],
  ["FIG-MKT", "Figma", AS_OF, "Mercado", "Precio, capitalización y PER", "https://stockanalysis.com/stocks/fig/", "Snapshot de tercero; no usar PER GAAP positivo porque hay pérdidas."],
  ["FIG-IPO", "Figma", date("2025-07-31"), "IPO", "Precio y comienzo de cotización", "https://investor.figma.com/news-events/news/news-details/2025/Figma-Announces-Pricing-of-Initial-Public-Offering/default.aspx", "36.937m acciones Clase A a 33 USD."],
  ["FIG-FY25", "Figma", date("2026-02-25"), "Resultados", "FY25 ventas, beneficio operativo no GAAP, FCF y caja", "https://investor.figma.com/news-events/news/news-details/2026/Figma-Announces-Fourth-Quarter-and-Fiscal-Year-2025-Financial-Results/default.aspx", "SBC provoca distorsión importante en GAAP."],
  ["FIG-Q1-26", "Figma", date("2026-05-07"), "Resultados", "Q1 2026 ventas, FCF, NDR, clientes y guía", "https://investor.figma.com/news-events/news/news-details/2026/Figma-Announces-First-Quarter-2026-Financial-Results/default.aspx", "Guía FY26 de ingresos 1.422–1.428bn USD."],
  ["FIG-Q2", "Figma", date("2026-07-28"), "Evento", "Fecha de resultados Q2 2026", "https://investor.figma.com/news-events/news/news-details/2026/Figma-to-Announce-Second-Quarter-2026-Financial-Results-on-August-5-2026/default.aspx", "Catalizador; a fecha de corte aún no publicado."],
  ["JD-MKT", "JD Sports Fashion", AS_OF, "Mercado", "Precio, capitalización, PER, EPS y dividendo", "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&shareprice=JD.", "Cotización retrasada; snapshot 86.18p."],
  ["JD-FY26", "JD Sports Fashion", date("2026-04-16"), "Resultados", "FY26 ventas, beneficio operativo, EPS y FCF", "https://www.jdplc.com/investor-relations/regulatory-news/regulatory-news-details/2026/FULL-YEAR-RESULTS-202526-FY26/default.aspx", "Resultados oficiales."],
  ["JD-BB", "JD Sports Fashion", date("2026-02-23"), "Capital allocation", "Programa de recompra 2026", "https://www.lse.co.uk/rns/JD./full-year-results-202526-fy26-mrde33s99qg3cu2.html", "Confirmar ejecución y acciones en circulación."],
  ["PYPL-MKT", "PayPal", AS_OF, "Mercado", "Precio, capitalización, PER y EPS", "https://stockanalysis.com/stocks/pypl/", "Snapshot de tercero; actualizar antes de decidir."],
  ["PYPL-FY25", "PayPal", date("2026-02-04"), "Resultados / SEC", "FCF, recompras y dividendo", "https://www.sec.gov/Archives/edgar/data/1633917/000163391726000021/pypl4q-25earningsrelease.htm", "Comunicado de resultados presentado ante SEC."],
  ["PYPL-Q1-26", "PayPal", date("2026-04-28"), "Resultados / SEC", "Ventas, TPV, FCF y branded checkout", "https://www.sec.gov/Archives/edgar/data/1633917/000163391726000065/pypl1q-26earningsrelease.htm", "Fuente primaria; revisar el informe completo."],
  ["PYPL-10K", "PayPal", date("2026-02-20"), "Filing", "Recompras 2025 y autorización pendiente", "https://www.sec.gov/Archives/edgar/data/1633917/000163391726000024/pypl-20251231.htm", "Filing anual."],
  ["APN-MKT", "Applied Nutrition", AS_OF, "Mercado", "Precio, capitalización, PER y evolución anual", "https://www.lse.co.uk/SharePrice.html?shareprice=APN", "Candidata descartada inicialmente por valoración."],
  ["APN-FY25", "Applied Nutrition", date("2025-10-01"), "Resultados", "FY25 ventas, EBITDA, EPS y FCF", "https://www.lse.co.uk/rns/final-results-ipv08uqh911qvg9.html", "Crecimiento bueno; PER cercano a 39x y sin dividendo."],
  ["LYNCH-BOOK", "Peter Lynch", AS_OF, "Libro", "Seis categorías, 13 señales de empresa atractiva y prioridad de beneficios/balance", "C:/Users/Cesar/Desktop/desarrollador/finanzas/src/Un paso por delante de Wall Street.pdf", "PDF local proporcionado por el usuario; usado como marco cualitativo."],
  ["WISE-MKT", "Wise", AS_OF, "Mercado", "Precio, capitalización, PER, EPS y dividendo", "https://www.lse.co.uk/SharePrice.html?share=Wise-Plc&shareprice=WISE", "Snapshot LSE; actualizar antes de decidir."],
  ["WISE-FY26", "Wise", date("2026-06-26"), "Resultados", "FY26 net revenue, beneficio antes de impuestos, caja, deuda y recompras", "https://owners.wise.com/news-releases/news-release-details/wise-fy26-results", "Fuente oficial; la caja incluye fondos salvaguardados de clientes."],
  ["WISE-Q1-27", "Wise", date("2026-07-17"), "Resultados", "Q1 FY27 clientes, volumen, holdings, net revenue y guidance", "https://owners.wise.com/news-releases/news-release-details/wise-q1-fy27-trading-update", "Fuente oficial; actualización operativa más reciente."],
  ["WISE-CAL", "Wise", date("2026-06-15"), "Calendario", "Fechas de resultados FY26 y Q1 FY27; próxima fecha por confirmar", "https://owners.wise.com/news-releases/news-release-details/notice-fy26-results-and-q1-fy27-trading-update", "No hay próximo evento confirmado; revisar el calendario."],
  ["AUTO-MKT", "Auto Trader", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/ShareFundamentals.html?shareprice=AUTO", "Snapshot LSE; actualizar antes de decidir."],
  ["AUTO-FY26", "Auto Trader", date("2026-05-21"), "Resultados", "FY26 ingresos, beneficio operativo, EPS, caja y deuda", "https://www.investegate.co.uk/announcement/rns/autotrader-group-plc--auto/full-year-results-for-the-year-ended-31-march-2026/9578760", "Comunicado oficial distribuido por RNS."],
  ["AUTO-CAL", "Auto Trader", AS_OF, "Calendario", "Resultados semestrales FY27 el 05-nov-2026", "https://plc.autotrader.co.uk/investors/financial-calendar/", "Fecha confirmada por la compañía."],
  ["BME-MKT", "B&M European Value Retail", AS_OF, "Mercado", "Precio, capitalización, EPS y dividendo; última operación visible", "https://www.lse.co.uk/SharePrice.html?shareprice=BME", "El precio de mercado puede estar retrasado; contrastar el día de revisión."],
  ["BME-FY26", "B&M European Value Retail", date("2026-06-03"), "Resultados", "FY26 ventas, EBITDA, EPS ajustado, FCF y deuda", "https://www.investegate.co.uk/index.php/announcement/rns/b-m-european-value-retail-s-a-di---bme/fy26-preliminary-results-/9598419", "Comunicado oficial de resultados."],
  ["BME-Q1-27", "B&M European Value Retail", date("2026-07-15"), "Resultados", "Q1 FY27 ventas, LFL UK/Francia/Heron y margen", "https://www.investegate.co.uk/announcement/rns/b-m-european-value-retail-s-a-di---bme/q1-fy27-trading-statement-/9668951", "Actualización operativa más reciente."],
  ["BME-CAL", "B&M European Value Retail", AS_OF, "Calendario", "Calendario de trading updates; próxima fecha aún no publicada", "https://www.bandmretail.com/investors/financial-calendar", "Usar noviembre como revisión tentativa y confirmar fecha."],
  ["KNOS-MKT", "Kainos Group", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?share=Kainos-group&shareprice=KNOS", "Snapshot LSE; actualizar antes de decidir."],
  ["KNOS-FY26", "Kainos Group", date("2026-05-18"), "Resultados", "FY26 ventas, beneficio, EPS, bookings, backlog, ARR y caja", "https://www.investegate.co.uk/announcement/rns/kainos-group--knos/full-year-results/9571881", "Comunicado oficial de resultados."],
  ["KNOS-CAL", "Kainos Group", AS_OF, "Calendario", "Trading update FY27 el 07-sep-2026 e interinos el 09-nov-2026", "https://www.kainos.com/investor-relations/regulatory-news-and-events", "Calendario provisional de la compañía."],
  ["PLUS-MKT", "Plus500", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=PLUS", "Snapshot LSE; actualizar antes de decidir."],
  ["PLUS-FY25", "Plus500", date("2026-02-09"), "Resultados", "FY25 ventas, EBITDA, PAT, EPS, caja y cash flow", "https://cdn.plus500.com/Media/Investors/Reports/Plus500_Preliminary_Results_FY2025.pdf", "Fuente oficial; resultados preliminares y estados condensados."],
  ["PLUS-H1-26", "Plus500", date("2026-07-13"), "Resultados", "H1 FY26 ventas, EBITDA, clientes, customer income y caja", "https://www.investegate.co.uk/announcement/rns/plus500-ltd-di---plus/half-year-2026-trading-update/9664194", "Actualización oficial; resultados completos el 10-ago-2026."],
  ["PLUS-CAL", "Plus500", AS_OF, "Calendario", "Resultados H1 2026 el 10-ago-2026", "https://cdn-investors.plus500.com/Shareholder", "Fecha confirmada por la compañía."],
];
sources.getRange(`A5:G${4 + sourceRows.length}`).values = sourceRows;
sources.getRange(`A5:E${4 + sourceRows.length}`).format.font = { color: C.input };
sources.getRange(`F5:F${4 + sourceRows.length}`).format.font = { color: C.link };
sources.getRange(`G5:G${4 + sourceRows.length}`).format.font = { color: C.input };
sources.getRange(`C5:C${4 + sourceRows.length}`).format.numberFormat = "yyyy-mm-dd";
sources.getRange(`A5:G${4 + sourceRows.length}`).format.rowHeight = 42;
setTableStyle(sources, `A4:G${4 + sourceRows.length}`, "SourcesTable");
finishSheet(sources, `A1:G${4 + sourceRows.length}`, 4);
for (const [col, width] of Object.entries({ A: 14, B: 22, C: 12, D: 18, E: 42, F: 72, G: 42 })) sources.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Seguimiento
// -----------------------------------------------------------------------------
const seguimiento = workbook.worksheets.add("Seguimiento");
styleTitle(seguimiento, "A1:L1", "Seguimiento y próxima revisión");
styleSubtitle(seguimiento, "A2:L2", "La fecha es el siguiente punto de control. Cuando llegue, copia los datos nuevos en Historial, actualiza Watchlist y cambia el veredicto solo si la evidencia lo exige.");
seguimiento.getRange("A4:L4").values = [[
  "Empresa", "Ticker", "Última revisión", "Próxima revisión", "Tipo", "Métricas a comparar", "Dato base", "Qué debe mejorar / mantenerse", "Condición de invalidación", "Acción siguiente", "Fuente / evento", "Estado"
]];
styleHeader(seguimiento, "A4:L4");
const followRows = [
  ["Atalaya Mining", "ATYM", AS_OF, date("2026-11-02"), "Existente / cíclica", "Cobre, producción, AISC, inventarios, FCF y caja", "PER 17.29x; FCF 107.4m; caja neta 122m", "Mantener producción y convertir EBITDA en FCF; Touro debe ser opcionalidad, no necesidad", "Costes/AISC suben, caja se consume o producción queda por debajo de guía", "Leer update; añadir periodo a Historial y revisar precio de entrada", "ATYM-FY25 / ATYM-Q2-26", null],
  ["Rio Tinto", "RIO", AS_OF, date("2026-11-02"), "Existente / cíclica", "Cobre, hierro, aluminio, China, capex, deuda y FCF", "PER 16.05x; FCF 4,025m; deuda neta 14,362m", "Producción y caja deben sostener dividendo/capex sin elevar demasiado deuda", "Caída persistente de precios, capex descontrolado o deuda al alza", "Comparar resultados y actualizar sensibilidad por commodity", "RIO-H1-26", null],
  ["eToro", "ETOR", AS_OF, date("2026-08-11"), "Nueva / alto crecimiento", "Net contribution, EBITDA, activos, cuentas financiadas, cripto y recompras", "PER 15.47x; Q1 net contribution +19%; EBITDA +35%", "Crecimiento de clientes/activos y beneficios por encima de la volatilidad del mercado", "Cuentas/activos se estancan, cripto explica el beneficio o margen se deteriora", "Leer Q2; actualizar ingresos, cash flow, estructura dual y tesis", "ETOR-Q1-26", null],
  ["HBX Group", "HBX", AS_OF, date("2026-11-25"), "Nueva / crecimiento-cíclica", "TTV, margen, FCF, deuda, recompra y guía", "PER 10.21x; deuda neta 741m; TTV H1 +17% CC", "Reducir deuda y mantener crecimiento/FCF pese a guía revisada", "Guía vuelve a recortarse, deuda/FCF empeora o transición directiva falla", "Leer FY26; revisar si el descuento frente a IPO tiene fundamento", "HBX-H1-26", null],
  ["Figma", "FIG", AS_OF, date("2026-08-05"), "Nueva / alto crecimiento", "Ingresos, FCF, NDR, clientes, SBC y guidance", "PER negativo; ingresos FY25 1,056m; FCF 242.7m", "Crecimiento >35%, NDR alto y FCF creciendo más rápido que SBC/dilución", "Crecimiento <25%, NDR cae, SBC sigue absorbiendo caja o guidance baja", "Leer Q2 antes de comprar; actualizar valoración sobre FCF normalizado", "FIG-Q2", null],
  ["JD Sports Fashion", "JD.", AS_OF, date("2026-08-20"), "Madura / crecimiento", "Ventas LFL, margen, inventario, EE. UU., FCF y recompras", "PER 9.99x; ventas +10.5%; FCF 462m; op. profit -5.4%", "Recuperación de margen y crecimiento LFL sin acumular inventario", "Margen sigue bajando, inventario aumenta o EE. UU. no recupera LFL", "Leer trading update; recalcular PER con EPS actualizado", "JD-FY26 / JD-BB", null],
  ["PayPal", "PYPL", AS_OF, date("2026-11-05"), "Madura / recuperable", "TPV, branded checkout, cuentas activas, margen, FCF y recompras", "PER 11.03x; FCF 1,700m en Q1; TPV +11%; checkout +2%", "Branded checkout y cuentas activas deben acelerar sin sacrificar margen", "Checkout sigue plano, cuentas activas caen o FCF no sostiene recompras", "Leer 3T26; actualizar tesis de recuperación y margen de seguridad", "PYPL-Q1-26", null],
  ["Wise", "WISE", AS_OF, date("2026-10-15"), "Alto crecimiento / calidad", "Clientes, volumen, holdings, take rate, margen antes de impuestos y caja utilizable", "PER 24.38x; FY26 net revenue +19%; Q1 FY27 +25%; take rate 50bps", "Mantener crecimiento 15–20% y margen cercano al 20–25% mientras baja el take rate", "Crecimiento cae claramente, take rate baja sin escala o valoración exige más de lo que entrega", "Confirmar calendario; comparar Q2 FY27 contra Q1 y FY26", "WISE-Q1-27 / WISE-CAL", null],
  ["Auto Trader", "AUTO", AS_OF, date("2026-11-05"), "Madura / crecimiento", "Forecourts, stock pagado, ARPR, margen, Deal Builder, FCF y deuda", "PER 15.58x; margen operativo 63%; ARPR +5%; deuda neta 146.8m", "Concesionarios vuelven a aceptar Deal Builder y ARPR/margen siguen creciendo", "Stock pagado cae, concesionarios abandonan la plataforma o deuda sube sin retorno", "Leer interinos; actualizar crecimiento, FCF y valoración", "AUTO-FY26 / AUTO-CAL", null],
  ["B&M European Value Retail", "BME", AS_OF, date("2026-11-12"), "Recuperable / cíclica", "LFL UK, margen EBITDA, Francia, inventarios, FCF, deuda y dividendo", "PER calculado 13.85x; FCF 321m; deuda neta 656m; UK LFL -2.3%", "LFL UK pasa a positivo y el margen se recupera hacia doble dígito a medio plazo", "LFL sigue negativo, margen no recupera o deuda/dividendo dejan de ser sostenibles", "Confirmar fecha; comparar H1 y decidir si el turnaround sigue vivo", "BME-Q1-27 / BME-CAL", null],
  ["Kainos Group", "KNOS", AS_OF, date("2026-09-07"), "Crecimiento / nicho", "ARR Workday, bookings, backlog, margen, contratistas y caja", "PER calculado 23.10x; ARR +23%; backlog +18%; caja neta 89.1m", "ARR hacia 100m y backlog convierten crecimiento en margen/caja", "Margen cae, backlog no convierte o caja se consume sin retorno", "Leer trading update; actualizar PER y conversión de backlog", "KNOS-FY26 / KNOS-CAL", null],
  ["Plus500", "PLUS", AS_OF, date("2026-08-10"), "Madura / cíclica", "Customer Income, EBITDA, margen, clientes, new customers, caja y regulación", "PER 12.84x; H1 revenue +12%; EBITDA +1%; caja >850m", "Customer Income y clientes crecen; margen no se comprime al escalar negocios no-OTC", "Resultado débil, caída de clientes, regulación adversa o margen sigue cayendo", "Leer H1; revisar dividendo/recompra y si el precio ya descuenta la mejora", "PLUS-H1-26 / PLUS-CAL", null],
];
seguimiento.getRange("A5:L16").values = followRows;
for (let row = 5; row <= 16; row += 1) {
  seguimiento.getRange(`L${row}`).formulas = [[`=IF(D${row}<=DATE(2026,8,4),"REVISAR YA",IF(D${row}<=DATE(2026,9,3),"PRÓXIMA","PROGRAMADA"))`]];
}
seguimiento.getRange("A5:K16").format.font = { color: C.input };
seguimiento.getRange("L5:L16").format.font = { color: C.black, bold: true };
seguimiento.getRange("C5:D16").format.numberFormat = "yyyy-mm-dd";
seguimiento.getRange("A5:L16").format.rowHeight = 72;
try {
  seguimiento.getRange("A5:L16").conditionalFormats.add("containsText", { text: "REVISAR YA", format: { fill: C.red } });
  seguimiento.getRange("A5:L16").conditionalFormats.add("containsText", { text: "PRÓXIMA", format: { fill: C.yellow } });
  seguimiento.getRange("A5:L16").conditionalFormats.add("containsText", { text: "PROGRAMADA", format: { fill: C.green } });
} catch {}
setTableStyle(seguimiento, "A4:L16", "FollowUpTable");
styleSection(seguimiento, "A19:L19", "Protocolo de revisión");
seguimiento.getRange("A20:B24").values = [
  ["1", "Cuando llegue la fecha, consulta primero el comunicado oficial y la presentación de resultados."],
  ["2", "Copia una nueva fila en Historial: no sobreescribas el periodo anterior."],
  ["3", "Actualiza precio, PER, EPS, ventas, crecimiento, FCF, deuda/caja y el dato operativo clave."],
  ["4", "Compara el dato nuevo con Qué debe mejorar y Condición de invalidación."],
  ["5", "Solo después cambia el veredicto/prioridad y deja constancia de la fuente y fecha."],
];
seguimiento.getRange("A20:A24").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
for (let row = 20; row <= 24; row += 1) seguimiento.mergeCells(`B${row}:L${row}`);
seguimiento.getRange("B20:L24").format.wrapText = true;
seguimiento.getRange("A20:B24").format.rowHeight = 34;
finishSheet(seguimiento, "A1:L24", 4);
const followWidths = { A: 24, B: 9, C: 14, D: 14, E: 23, F: 38, G: 36, H: 40, I: 40, J: 38, K: 20, L: 14 };
for (const [col, width] of Object.entries(followWidths)) seguimiento.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Descartadas
// -----------------------------------------------------------------------------
const descartadas = workbook.worksheets.add("Descartadas");
styleTitle(descartadas, "A1:J1", "Ideas cribadas pero no seleccionadas");
styleSubtitle(descartadas, "A2:J2", "No significa que sean malas empresas: indica que hoy no superan el filtro de precio, riesgo o evidencia para nuestra lista inicial.");
descartadas.getRange("A4:J4").values = [["Empresa", "Ticker", "Fecha salida", "Precio", "PER", "Rent. 1 año", "Ventas FY25 (m)", "Crec. ventas", "FCF FY25 (m)", "Motivo de no selección"]];
styleHeader(descartadas, "A4:J4");
descartadas.getRange("A5:J5").values = [["Applied Nutrition", "APN", date("2024-10-24"), 329, 39.17, 1.4962, 107.1, 0.242, 16.5, "Crecimiento y caja interesantes, pero el precio ya descuenta mucho: +150% en un año, PER ~39x y sin dividendo. Volver a mirar si el crecimiento acelera o corrige la cotización."]];
descartadas.getRange("A5:I5").format.font = { color: C.input };
descartadas.getRange("J5:J5").format.font = { color: C.input };
descartadas.getRange("C5:C5").format.numberFormat = "yyyy-mm-dd";
descartadas.getRange("D5:D5").format.numberFormat = "0.00";
descartadas.getRange("E5:E5").format.numberFormat = "0.00\"x\"";
descartadas.getRange("F5:F5").format.numberFormat = "0.0%";
descartadas.getRange("H5:H5").format.numberFormat = "0.0%";
setTableStyle(descartadas, "A4:J5", "RejectedTable");
finishSheet(descartadas, "A1:J5", 4);
for (const [col, width] of Object.entries({ A: 24, B: 9, C: 12, D: 11, E: 10, F: 12, G: 14, H: 12, I: 13, J: 66 })) descartadas.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------
const checks = workbook.worksheets.add("Checks");
styleTitle(checks, "A1:D1", "Checks del modelo");
styleSubtitle(checks, "A2:D2", "Estas comprobaciones son visibles para detectar una watchlist incompleta. La búsqueda de errores de fórmula se ejecuta también al exportar.");
checks.getRange("A4:D4").values = [["Comprobación", "Valor", "Estado", "Qué significa"]];
styleHeader(checks, "A4:D4");
checks.getRange("A5:D13").values = [
  ["Filas de watchlist", null, null, "Debe haber 12 compañías seleccionadas."],
  ["Totales de checklist", null, null, "Cada empresa debe tener un total calculado."],
  ["Fuentes de mercado y resultados", null, null, "Cada fila principal debe tener ambos IDs."],
  ["Celdas de score vacías", null, null, "No debe faltar el enlace al total de Checklist_Lynch."],
  ["Escala máxima", null, null, "El máximo permitido por fila es 16."],
  ["Modelo", null, null, "Resumen de las comprobaciones anteriores."],
  ["Fecha de corte", AS_OF, null, "Actualiza esta fecha cuando refresques los datos."],
  ["Recordatorio", "No es recomendación", "INFO", "Verifica siempre fuentes, precio, impuestos, divisa y tu perfil de riesgo."],
  ["Filas de seguimiento", null, null, "Cada compañía debe tener una próxima revisión."],
];
checks.getRange("B5").formulas = [["=COUNTA('Watchlist'!A5:A16)"]];
checks.getRange("C5").formulas = [["=IF(B5=12,\"OK\",\"REVISAR\")"]];
checks.getRange("B6").formulas = [["=COUNT('Checklist_Lynch'!L5:L16)"]];
checks.getRange("C6").formulas = [["=IF(B6=12,\"OK\",\"REVISAR\")"]];
checks.getRange("B7").formulas = [["=COUNTIF('Watchlist'!Y5:Y16,\"<>\")+COUNTIF('Watchlist'!Z5:Z16,\"<>\")"]];
checks.getRange("C7").formulas = [["=IF(B7=24,\"OK\",\"REVISAR\")"]];
checks.getRange("B8").formulas = [["=COUNTBLANK('Watchlist'!AA5:AA16)"]];
checks.getRange("C8").formulas = [["=IF(B8=0,\"OK\",\"REVISAR\")"]];
checks.getRange("B9").formulas = [["=MAX('Checklist_Lynch'!L5:L16)"]];
checks.getRange("C9").formulas = [["=IF(B9<=16,\"OK\",\"REVISAR\")"]];
checks.getRange("B10").formulas = [["=COUNTIF(C5:C9,\"REVISAR\")"]];
checks.getRange("C10").formulas = [["=IF(B10=0,\"MODELO OK\",\"HAY QUE REVISAR\")"]];
checks.getRange("C11").formulas = [["=IF(B11=DATE(2026,8,4),\"OK\",\"REVISAR\")"]];
checks.getRange("B13").formulas = [["=COUNTA('Seguimiento'!A5:A16)"]];
checks.getRange("C13").formulas = [["=IF(B13=12,\"OK\",\"REVISAR\")"]];
checks.getRange("A5:A13").format = { fill: C.gray, font: { bold: true, color: C.navy } };
checks.getRange("B5:B13").format.font = { color: C.black };
checks.getRange("C5:C13").format.font = { bold: true, color: C.black };
checks.getRange("D5:D13").format.wrapText = true;
checks.getRange("B11").format.numberFormat = "yyyy-mm-dd";
try { checks.getRange("C5:C13").conditionalFormats.add("containsText", { text: "OK", format: { fill: C.green } }); } catch {}
try { checks.getRange("C5:C13").conditionalFormats.add("containsText", { text: "REVISAR", format: { fill: C.red } }); } catch {}
setTableStyle(checks, "A4:D13", "ChecksTable");
finishSheet(checks, "A1:D13", 4);
for (const [col, width] of Object.entries({ A: 30, B: 20, C: 18, D: 62 })) checks.getRange(`${col}:${col}`).format.columnWidth = width;

// Basic workbook-wide formatting and active sheet.
try { workbook.worksheets.setActiveWorksheet("Portada"); } catch {}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUT_FILE);

console.log(JSON.stringify({ output: OUT_FILE, sheets: workbook.worksheets.items.map((s) => s.name) }));
