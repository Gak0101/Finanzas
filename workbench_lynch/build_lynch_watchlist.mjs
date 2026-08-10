import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const AS_OF = new Date("2026-08-05T00:00:00Z");
const OUT_DIR = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_10mas";
const OUT_FILE = `${OUT_DIR}/watchlist_lynch_2026-08-05_10mas.xlsx`;

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
styleSubtitle(portada, "A2:H2", "Plantilla de investigación y seguimiento. Fecha de corte: 2026-08-05. Las conclusiones son hipótesis de trabajo, no una recomendación personalizada.");

portada.getRange("A4:B8").values = [
  ["Objetivo", "Convertir una idea en una tesis comprobable y actualizable."],
  ["Método", "Negocio comprensible + historia/catalizador + crecimiento + PER/valoración + balance + riesgos."],
  ["Cómo usarlo", "Actualiza en azul; conserva el enlace y la fecha de cada dato en Fuentes_Audit."],
  ["Regla", "Una puntuación alta no sustituye revisar deuda, dilución, resultados y precio de entrada."],
  ["Universo actual", "22 compañías en la lista principal + 10 candidatas nuevas en cribado. Las nuevas tienen ranking y seguimiento propios hasta superar una primera revisión."],
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
  ["Rightmove", "RMV", "Calidad / marketplace", 474.80, 16.90, "='Watchlist'!AA17", "='Watchlist'!V17", "='Watchlist'!W17"],
  ["Games Workshop", "GAW", "Calidad / IP y nicho", 19940.00, 33.52, "='Watchlist'!AA18", "='Watchlist'!V18", "='Watchlist'!W18"],
  ["Computacenter", "CCC", "Crecimiento / servicios IT", 4818.00, 32.89, "='Watchlist'!AA19", "='Watchlist'!V19", "='Watchlist'!W19"],
  ["Howdens Joinery", "HWDN", "Calidad / cíclica", 821.50, 16.70, "='Watchlist'!AA20", "='Watchlist'!V20", "='Watchlist'!W20"],
  ["Domino's Pizza Group", "DOM", "Madura / recuperable", 201.60, 13.35, "='Watchlist'!AA21", "='Watchlist'!V21", "='Watchlist'!W21"],
  ["Bellway", "BWY", "Existente / cíclica", 1986.00, 14.73, "='Watchlist'!AA22", "='Watchlist'!V22", "='Watchlist'!W22"],
  ["Babcock International", "BAB", "Defensa / turnaround", 1121.00, 18.53, "='Watchlist'!AA23", "='Watchlist'!V23", "='Watchlist'!W23"],
  ["Oxford Instruments", "OXIG", "Nicho / tecnología", 2860.00, 33.81, "='Watchlist'!AA24", "='Watchlist'!V24", "='Watchlist'!W24"],
  ["4imprint Group", "FOUR", "Madura / calidad con descuento", 4390.00, 14.62, "='Watchlist'!AA25", "='Watchlist'!V25", "='Watchlist'!W25"],
  ["Jet2", "JET2", "Cíclica / crecimiento", 1540.00, 7.29, "='Watchlist'!AA26", "='Watchlist'!V26", "='Watchlist'!W26"],
];
portada.getRange("A12:H33").values = quickRows;
portada.getRange("F12:H33").format.font = { color: C.link };
portada.getRange("D12:D33").format.numberFormat = "0.00";
portada.getRange("E12:E33").format.numberFormat = "0.00\"x\"";
portada.getRange("F12:F33").format.numberFormat = "0";
setTableStyle(portada, "A11:H33", "QuickView");

styleSection(portada, "A36:H36", "Cómo interpretar la puntuación");
portada.getRange("A37:B41").values = [
  ["12–16", "Candidato: merece profundizar y definir precio de entrada."],
  ["9–11", "Vigilancia: hay algo interesante, pero falta confirmar una pieza."],
  ["0–8", "Revisar: no hay suficiente margen de seguridad o claridad."],
  ["Importante", "La puntuación es una ayuda de proceso creada para esta hoja; no es una escala oficial de Peter Lynch."],
  ["Siguiente paso", "Ve a Seguimiento: compara precio, PER, crecimiento, FCF, deuda y el dato que puede invalidar la tesis."],
];
portada.getRange("A37:A41").format = { fill: C.gray, font: { bold: true, color: C.navy } };
portada.getRange("B37:B41").format.wrapText = true;

portada.getRange("D37:H52").values = [
  ["Hoja", "Uso", "", "", ""],
  ["Watchlist", "Panel principal y datos de mercado/resultados.", "", "", ""],
  ["Checklist_Lynch", "Puntuación y preguntas pendientes.", "", "", ""],
  ["Historial / Fuentes_Audit", "Series y trazabilidad de cada afirmación.", "", "", ""],
  ["Seguimiento", "Próxima revisión, métricas a comparar y condición de invalidación.", "", "", ""],
  ["Analisis_Prioritario", "Escenarios de valoración y precio de entrada para las 4 prioridades.", "", "", ""],
  ["Ranking_10Bagger", "Orden relativo por runway, crecimiento, valoración, balance, tamaño y catalizadores.", "", "", ""],
  ["Dossier_KN_ATYM", "Análisis profundo, escenarios, riesgos y tesis de Kainos/Atalaya.", "", "", ""],
  ["Registro_KN_ATYM", "Historial incremental de revisiones para no sobrescribir periodos anteriores.", "", "", ""],
  ["Fuentes_KN_ATYM", "Fuentes específicas, URLs y qué dato respalda cada una.", "", "", ""],
  ["Nuevas_10", "10 candidatas nuevas: mercado, resultados, tesis, riesgos y puntuación preliminar.", "", "", ""],
  ["Ranking_Nuevas10", "Orden relativo de las 10 nuevas; no se mezcla todavía con el ranking principal.", "", "", ""],
  ["Seguimiento_Nuevas10", "Qué revisar, cuándo, y qué dato confirmaría o invalidaría cada idea.", "", "", ""],
  ["Historial_Nuevas10", "Foto inicial inmutable para comparar las siguientes revisiones.", "", "", ""],
  ["Fuentes_Nuevas10", "Fuentes y limitaciones de cada dato de las 10 nuevas.", "", "", ""],
  ["Agenda_Revision", "Vista única de pendientes, fechas, métricas, señales, notas y rating de las 32 compañías.", "", "", ""],
];
portada.getRange("D37:E37").format = { fill: C.gray, font: { bold: true, color: C.navy } };
portada.getRange("D38:E52").format.wrapText = true;
finishSheet(portada, "A1:H52");
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
  ["Atalaya Mining", "ATYM", "LSE", "Existente / cíclica", null, "GBX / EUR", 917, 1410, 17.29, 53.03, 6.10, 0.00665, 482.9, 0.478, 1.708, 107.4, -340.2, null, "Q2: producción 13.493kt, recuperación 83.91% y caja neta €340.2m; comprobar FCF, AISC y proyectos.", "Precio del cobre, inventario, ley/recuperación, capex, permisos y ejecución.", "Resultados H1: 2026-08-11", "Esperar / vigilar", 2, AS_OF, "ATYM-MKT", "ATYM-FY25 / ATYM-Q2-26", null, null],
  ["Rio Tinto", "RIO", "LSE / ASX", "Existente / cíclica", null, "GBX / USD", 7313, 118930, 16.05, 455.72, 284.57, 0.03891, 57638, null, null, 4025, 14362, null, "Cobre y producción; H1 2026 con EBITDA/FCF sólidos y disciplina de costes.", "Ciclo de materias primas, China, grandes proyectos y deuda/capex.", "Resultados FY2026: pendiente", "Compra escalonada / vigilar precio", 1, AS_OF, "RIO-MKT", "RIO-H1-26", null, null],
  ["eToro", "ETOR", "NASDAQ", "Nueva / alto crecimiento", date("2025-05-14"), "USD", 37.06, 3010, 15.47, 2.64, 0, 0, 868, 0.10, 0.04, null, -1300, null, "Q1 2026: net contribution +19%, EBITDA ajustado +35%; resultados Q2 el 11-ago y recompra autorizada.", "Ciclicidad de trading/cripto, historial corto, dual class y posible volatilidad de beneficios.", "Resultados Q2: 2026-08-11", "Vigilar / posible entrada pequeña", 2, AS_OF, "ETOR-MKT", "ETOR-Q1-26", null, null],
  ["HBX Group", "HBX", "BME", "Nueva / crecimiento-cíclica", date("2025-03-06"), "EUR", 7.71, 1860, 10.21, 0.75, 0.08, 0.0097, 309, 0.01, 0.09, null, 741, null, "TTV H1 2026 +17% en moneda constante, recompra de 100m y cotización ~33% bajo el precio de IPO.", "Guía recortada, deuda, geopolítica de viajes y transición CEO/CFO.", "Resultados FY2026: 2026-11-25", "Vigilar / oportunidad con margen", 1, AS_OF, "HBX-MKT", "HBX-H1-26", null, null],
  ["Figma", "FIG", "NYSE", "Nueva / alto crecimiento", date("2025-07-31"), "USD", 27.26, 14270, -6.78, -4.02, 0, 0, 1056, 0.41, null, 242.7, -1700, null, "Q2 2026 el 5-ago; guía FY26 de ingresos +35% y NDR 139% en Q1.", "Pérdida GAAP, stock-based compensation/dilución y valoración aproximada de 10x ventas FY26.", "Resultados Q2: 2026-08-05", "Esperar / no comprar antes de resultados", 3, AS_OF, "FIG-MKT", "FIG-Q1-26", null, null],
  ["JD Sports Fashion", "JD.", "LSE", "Madura / crecimiento", null, "GBX / GBP", 86.18, 4120, 9.986, 8.63, 1.00, 0.0116, 12662, 0.105, -0.054, 462, null, null, "Ventas FY26 +10.5%, FCF +36%; recompra de 200m y actualización Q2 el 20-ago.", "Márgenes y EPS cayendo, consumidor/EE. UU., competencia, inventario y divisas.", "Trading update Q2: 2026-08-20", "Oportunidad condicional / vigilar márgenes", 1, AS_OF, "JD-MKT", "JD-FY26", null, null],
  ["PayPal", "PYPL", "NASDAQ", "Madura / recuperable", null, "USD", 58.335, 51451, 11.027, 5.29, 0.56, 0.0096, 8400, 0.07, null, 1700, null, null, "FCF, recompras y dividendo; TPV Q1 2026 +11%, pero toca demostrar recuperación del checkout.", "Competencia de Apple Pay/Shopify/Affirm/Klarna, cuentas activas planas y branded checkout +2%.", "Resultados 3T26: fecha pendiente", "Oportunidad especulativa / vigilar ejecución", 2, AS_OF, "PYPL-MKT", "PYPL-Q1-26", null, null],
  ["Wise", "WISE", "LSE", "Alto crecimiento / calidad", null, "GBX / USD", 905.60, 8940, 24.38446, 37.1384, 0, 0, 2502.8, 0.19, -0.08, 407.6, -468, null, "Volumen transfronterizo, más clientes y Wise Account; Q1 FY27 net revenue +25% y recompra prevista.", "PER exigente, take rate a la baja, tipos de interés, regulación y caja mezclada con fondos salvaguardados.", "Próxima actualización trimestral: tentativa 2026-10-15", "Vigilar / crecimiento con precio exigente", 2, AS_OF, "WISE-MKT", "WISE-Q1-27", null, null],
  ["Auto Trader", "AUTO", "LSE", "Madura / crecimiento", null, "GBX / GBP", 532.40, 4170, 15.58092, 34.17, 10.90, 0.02047, 624.3, 0.04, 0.04, 306.1, 146.8, null, "Marketplace dominante, ARPR +5%, margen operativo 63% y mejora de Deal Builder tras escuchar a concesionarios.", "Presión de concesionarios, menor stock pagado, confianza en Deal Builder, endeudamiento nuevo y Autorama aún en pérdidas.", "Resultados semestrales FY27: 2026-11-05", "Oportunidad condicional / vigilar Deal Builder", 1, AS_OF, "AUTO-MKT", "AUTO-FY26", null, null],
  ["B&M European Value Retail", "BME", "LSE", "Recuperable / cíclica", null, "GBX / GBP", 225.80, 2230, 13.85, 16.30, 13.20, 0.05846, 5775, 0.036, -0.259, 321, 656, null, "Plan Back to B&M Basics, recuperación de margen UK y crecimiento de Francia; compras de consejeros en junio.", "Beneficio y margen muy deteriorados, LFL UK -2.3% en Q1, deuda y riesgo de trampa de dividendo.", "H1 FY27 / trading update: tentativa 2026-11-12", "Oportunidad de turnaround / esperar confirmación", 1, AS_OF, "BME-MKT", "BME-Q1-27", null, null],
  ["Kainos Group", "KNOS", "LSE", "Crecimiento / nicho", null, "GBX / GBP", 820.00, 945.42, 23.10, 35.50, 29.60, 0.03610, 431.1, 0.17, 0.02, 49.7, -89.1, null, "ARR Workday +23%, bookings +32% y backlog +18%; la prueba es convertir ventas en margen/caja.", "Margen ajustado solo +2%, contratistas/proveedores, concentración Workday, NPS 61 y retención 90%.", "Trading update FY27: 2026-09-07", "Vigilar / posible entrada pequeña", 2, AS_OF, "KNOS-MKT", "KNOS-FY26", null, null],
  ["Plus500", "PLUS", "LSE", "Madura / cíclica", null, "GBX / USD", 3746.00, 2580, 12.83602, 291.83512, 67.01867, 0.01789, 462.9, 0.12, 0.01, 280.1, -850, null, "Resultados H1 el 10-ago, retorno de capital, crecimiento de futuros/prediction markets y caja >850m.", "CFD y volatilidad, regulación, margen EBITDA estancado, clientes FY25 -5% y mayor peso de negocios no-OTC.", "Resultados H1 2026: 2026-08-10", "Oportunidad especulativa / esperar H1", 2, AS_OF, "PLUS-MKT", "PLUS-H1-26", null, null],
  ["Rightmove", "RMV", "LSE", "Calidad / marketplace", null, "GBX / GBP", 474.80, 3520, 16.8968, 28.10, 10.15, 0.02138, 425.1, 0.09, 0.09, null, -29.6, null, "Network effect, consenso FY26: EPS 30.02p y guía 2026 de ingresos +8–10%; áreas estratégicas en crecimiento.", "Propiedad cíclica, presión de agentes/competencia, litigio/riesgo regulatorio y gasto en innovación.", "H1 2026 publicado 2026-07-31; revisión post-resultados 2026-08-31", "Esperar / calidad, no perseguir precio", 2, AS_OF, "RMV-MKT", "RMV-FY25", null, null],
  ["Games Workshop", "GAW", "LSE", "Calidad / IP y nicho", null, "GBX / GBP", 19940.00, 6590, 33.518, 594.90, 485.00, 0.02432, 659.7, 0.068, 0.052, 210.3, null, null, "Warhammer/IP, ingresos core +10.9%, balance sin deuda y caja creciendo antes de dividendos.", "PER exigente, dependencia de ejecución/licencias y riesgo de que el crecimiento se normalice.", "Revisión de trading pre-interinos: tentativa 2026-11-05", "Vigilar / negocio excelente, precio exigente", 2, AS_OF, "GAW-MKT", "GAW-FY26", null, null],
  ["Computacenter", "CCC", "LSE", "Crecimiento / servicios IT", null, "GBX / GBP", 4818.00, 5060, 32.887, 146.50, 71.00, 0.01550, 9193.9, 0.32, 0.113, null, -606.0, null, "Q1 2026 muy por encima de expectativas; Technology Sourcing fuerte y caja neta ajustada de £606m.", "Margen bruto bajó a 12.4%, Managed Services débil y PER alto para una empresa de servicios.", "Resultados H1 2026: 2026-09-08", "Vigilar / crecimiento con riesgo de margen", 2, AS_OF, "CCC-MKT", "CCC-Q1-26", null, null],
  ["Howdens Joinery", "HWDN", "LSE", "Calidad / cíclica", null, "GBX / GBP", 821.50, 4500, 16.69715, 49.20, 21.30, 0.02593, 1030.6, 0.033, 0.055, null, -332.8, null, "Modelo trade-only, margen bruto H1 62.8%, EBIT subyacente +5.5% y recompra de £100m en 2026.", "Sensibilidad a vivienda/remodelación, adquisición DIY Kitchens y valoración si el crecimiento se enfría.", "Trading update: 2026-11-05", "Vigilar / solo con margen", 2, AS_OF, "HWDN-MKT", "HWDN-H1-26", null, null],
  ["Domino's Pizza Group", "DOM", "LSE", "Madura / recuperable", null, "GBX / GBP", 201.60, 768.41, 13.35099, 15.10, 11.10, 0.05506, 685.4, 0.031, -0.066, null, null, null, "Franquicia/brand comprensible, dividendo 5.5% y momentum positivo en las primeras 9 semanas de 2026.", "EBITDA y PBT FY25 cayeron; presión promocional, activismo y necesidad de demostrar la estrategia.", "Resultados H1 2026: 2026-08-04; revisión 2026-08-05", "Esperar resultados / turnaround condicional", 2, AS_OF, "DOM-MKT", "DOM-FY25", null, null],
  ["Bellway", "BWY", "LSE", "Existente / cíclica", null, "GBX / GBP", 1986.00, 2240, 14.72892, 132.80, 59.00, 0.03016, 2782.8, 0.169, 0.178, null, 236.0, null, "Orderbook de £1.57bn, beneficio operativo FY26 guiado a £320–330m y potencial de normalización de vivienda.", "Tipos hipotecarios, demanda moderada, costes de construcción y carácter cíclico del beneficio.", "Trading update: 2026-08-11", "Vigilar / oportunidad cíclica", 1, AS_OF, "BWY-MKT", "BWY-TRD", null, null],
  ["Babcock International", "BAB", "LSE", "Defensa / turnaround", null, "GBX / GBP", 1121.00, 5510, 18.52893, 60.50, 7.50, 0.00669, 5273.0, 0.0915, 0.192, 262.0, -23.0, null, "Backlog £9.8bn, FCF +£109m, balance en caja neta y recompra FY27 de £200m.", "Cargo extraordinario Type 31, ejecución de contratos y diferencia entre beneficio subyacente y estatutario.", "Revisión H1 FY27: tentativa 2026-11-20", "Vigilar / recuperación con caja", 2, AS_OF, "BAB-MKT", "BAB-FY26", null, null],
  ["Oxford Instruments", "OXIG", "LSE", "Nicho / tecnología", null, "GBX / GBP", 2860.00, 1570, 33.806, 84.60, 22.50, 0.00787, 423.2, -0.046, -0.073, null, -94.0, null, "Order intake +6.4%, book-to-bill 1.067 y caja neta £94m; exposición a semiconductores/ciencia aplicada.", "Ingresos FY26 a la baja, presión de margen ajustado y PER alto mientras convierte pedidos en ventas.", "Revisión de interinos: tentativa 2026-11-12", "Vigilar / esperar conversión de pedidos", 2, AS_OF, "OXIG-MKT", "OXIG-FY26", null, null],
  ["4imprint Group", "FOUR", "LSE", "Madura / calidad con descuento", null, "GBX / USD", 4390.00, 1230, 14.61869, 300.30057, 183.80, 0.04187, 1346.8, -0.02, -0.02, null, -132.8, null, "Negocio directo con caja, clientes existentes estables y dividendo; mañana debe aclarar si el bache es temporal.", "Pedidos -3%, nuevos pedidos -12%, aranceles y riesgo de que el descenso no sea transitorio.", "Resultados H1 2026: 2026-08-05", "Esperar H1 / no perseguir precio", 2, AS_OF, "FOUR-MKT", "FOUR-FY25", null, null],
  ["Jet2", "JET2", "LSE", "Cíclica / crecimiento", null, "GBX / GBP", 1540.00, 2780, 7.291667, 211.20, 15.10, 0.00981, 7482.1, 0.043, -0.02, null, -2012.9, null, "Pasajeros +5%, capacidad verano 2026 +7.7%, caja neta £2.0bn, Gatwick y recompra £250m.", "Combustible, divisas, geopolítica, demanda de viajes y volatilidad normal del margen aéreo.", "Revisión tras temporada de verano: tentativa 2026-11-17", "Compra escalonada solo con margen", 1, AS_OF, "JET2-MKT", "JET2-FY26", null, null],
];
watch.getRange("A5:AB26").values = watchRows;

// Formulas: PEG, score and status.
for (let row = 5; row <= 26; row += 1) {
  watch.getRange(`R${row}`).formulas = [[`=IF(AND(I${row}>0,O${row}>0),I${row}/(O${row}*100),"")`]];
  watch.getRange(`AA${row}`).formulas = [[`=IFERROR('Checklist_Lynch'!L${row},"")`]];
  watch.getRange(`AB${row}`).formulas = [[`=IF(AA${row}>=12,"Alta prioridad",IF(AA${row}>=9,"Vigilancia","Revisar"))`]];
}

watch.getRange("A5:Q26").format.font = { color: C.input };
watch.getRange("S5:Z26").format.font = { color: C.input };
watch.getRange("AA5:AA26").format.font = { color: C.link };
watch.getRange("R5:R26").format.font = { color: C.black };
watch.getRange("AB5:AB26").format.font = { color: C.black };
watch.getRange("E5:E26").format.numberFormat = "yyyy-mm-dd";
watch.getRange("X5:X26").format.numberFormat = "yyyy-mm-dd";
watch.getRange("G5:K26").format.numberFormat = "0.00";
watch.getRange("H5:H26").format.numberFormat = "#,##0.0";
watch.getRange("I5:I26").format.numberFormat = "0.00\"x\"";
watch.getRange("L5:L26").format.numberFormat = "0.0%";
watch.getRange("M5:Q26").format.numberFormat = "#,##0.0";
watch.getRange("N5:O26").format.numberFormat = "0.0%";
watch.getRange("R5:R26").format.numberFormat = "0.00\"x\"";
watch.getRange("AA5:AA26").format.numberFormat = "0";
watch.getRange("W5:W26").format.numberFormat = "0";
watch.getRange("A5:AB26").format.wrapText = true;
watch.getRange("A5:AB26").format.rowHeight = 66;
try {
  watch.getRange("A5:AB26").conditionalFormats.add("containsText", { text: "Alta prioridad", format: { fill: C.green } });
  watch.getRange("A5:AB26").conditionalFormats.add("containsText", { text: "Esperar", format: { fill: C.yellow } });
} catch {}
setTableStyle(watch, "A4:AB26", "WatchlistTable");
styleSection(watch, "A29:AB29", "Notas de uso");
watch.getRange("A30:A32").values = [["* PEG heurístico"], ["Datos mixtos"], ["Estado"]];
watch.getRange("B30:B32").values = [["PER dividido por el crecimiento porcentual del EBITDA/beneficio. No usar con pérdidas, cíclicas, periodos mezclados o divisas distintas."], ["Para no inventar, algunas filas usan FY2025/FY2026 y otras el último trimestre disponible. La hoja Historial separa los periodos."], ["La prioridad es una señal de trabajo, no una orden de compra. Define precio de entrada y condición de invalidación en Checklist_Lynch y Seguimiento."]];
/*
  ["* PEG heurístico", "PER dividido por el crecimiento porcentual del EBITDA/beneficio. No usar con pérdidas, cíclicas, periodos mezclados o divisas distintas.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Datos mixtos", "Para no inventar, algunas filas usan FY2025/FY2026 y otras el último trimestre disponible. La hoja Historial separa los periodos.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Estado", "La prioridad es una señal de trabajo, no una orden de compra. Define precio de entrada y condición de invalidación en Checklist_Lynch.", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
*/
watch.getRange("A30:A32").format = { fill: C.gray, font: { bold: true, color: C.navy } };
watch.mergeCells("B30:AB30");
watch.mergeCells("B31:AB31");
watch.mergeCells("B32:AB32");
watch.getRange("B30:AB32").format.wrapText = true;
finishSheet(watch, "A1:AB32", 4);
const watchWidths = { A: 22, B: 9, C: 12, D: 27, E: 12, F: 14, G: 11, H: 15, I: 11, J: 10, K: 12, L: 10, M: 16, N: 11, O: 15, P: 13, Q: 15, R: 12, S: 42, T: 42, U: 26, V: 34, W: 10, X: 12, Y: 14, Z: 14, AA: 10, AB: 15 };
for (const [col, width] of Object.entries(watchWidths)) watch.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Analisis prioritario
// -----------------------------------------------------------------------------
const priority = workbook.worksheets.add("Analisis_Prioritario");
styleTitle(priority, "A1:V1", "Análisis prioritario — valoración por escenarios");
styleSubtitle(priority, "A2:V2", "Cuatro candidatas para profundizar primero. Precios y EPS de referencia están en GBX/pence; los escenarios y PER objetivo son hipótesis de trabajo editables, no una recomendación automática.");
priority.getRange("A4:V4").values = [[
  "Empresa", "Ticker", "Precio actual (GBX)", "EPS referencia (GBX)", "PER actual", "EPS bajo", "EPS base", "EPS alto", "PER bajo", "PER base", "PER alto", "Precio razonable bajo (GBX)", "Precio razonable base (GBX)", "Precio razonable alto (GBX)", "Margen seguridad", "Precio entrada base (GBX)", "Upside base", "Catalizador / qué comprobar", "Invalidación", "Decisión provisional", "Próxima revisión", "Fuentes"
]];
styleHeader(priority, "A4:V4");
const priorityRows = [
  ["Rightmove", "RMV", 474.80, 28.10, null, 28.10, 30.02, 31.09, 14.00, 17.00, 19.00, null, null, null, 0.20, null, null, "H1 2026: comprobar EPS, membresía, ARPA, áreas estratégicas, LLM referrals y margen.", "EPS sin crecimiento, membresía negativa, litigio/regulación o margen operativo <65%.", "Esperar: calidad alta, pero el escenario base ofrece poco margen al precio actual.", date("2026-08-31"), "RMV-MKT / RMV-FY25 / RMV-CONS"],
  ["Jet2", "JET2", 1540.00, 211.20, null, 170.00, 211.20, 230.00, 6.50, 9.00, 11.00, null, null, null, 0.20, null, null, "Interinos: reservas, yield, combustible, capacidad, Gatwick, caja neta y recompra de £250m.", "Caída de demanda o margen, combustible/divisa adversos, geopolítica o uso agresivo de la caja.", "Compra escalonada solo si el precio vuelve a la zona de entrada y se acepta la ciclicidad.", date("2026-11-17"), "JET2-MKT / JET2-FY26 / JET2-CAL"],
  ["Howdens Joinery", "HWDN", 821.50, 49.20, null, 45.00, 51.00, 55.00, 14.00, 17.50, 19.00, null, null, null, 0.20, null, null, "Trading update: ventas comparables, margen bruto, DIY Kitchens, aperturas, vivienda y caja.", "LFL negativo, margen decreciente, adquisición sin retorno o deuda/capex tensionan la caja.", "Vigilar: interesante si ofrece al menos 20% de margen de seguridad sobre el caso base.", date("2026-11-05"), "HWDN-MKT / HWDN-H1-26 / HWDN-CAL"],
  ["4imprint Group", "FOUR", 4390.00, 300.30057, null, 250.00, 300.30057, 360.00, 11.00, 14.00, 16.00, null, null, null, 0.20, null, null, "Resultados H1: pedidos nuevos/existentes, AOV, margen, aranceles, caja y guía.", "Pedidos y margen siguen bajando, aranceles erosionan beneficio o la caja se consume.", "Esperar H1: el precio actual exige recuperación; no comprar antes de confirmar pedidos.", date("2026-08-05"), "FOUR-MKT / FOUR-FY25 / FOUR-CAL"],
];
priority.getRange("A5:V8").values = priorityRows;
for (let row = 5; row <= 8; row += 1) {
  priority.getRange(`E${row}`).formulas = [[`=IFERROR(C${row}/D${row},"")`]];
  priority.getRange(`L${row}`).formulas = [[`=F${row}*I${row}`]];
  priority.getRange(`M${row}`).formulas = [[`=G${row}*J${row}`]];
  priority.getRange(`N${row}`).formulas = [[`=H${row}*K${row}`]];
  priority.getRange(`P${row}`).formulas = [[`=M${row}*(1-O${row})`]];
  priority.getRange(`Q${row}`).formulas = [[`=IFERROR(M${row}/C${row}-1,"")`]];
}
priority.getRange("A5:D8").format.font = { color: C.input };
priority.getRange("F5:K8").format.font = { color: C.input };
priority.getRange("O5:O8").format.font = { color: C.input };
priority.getRange("R5:U8").format.font = { color: C.input };
priority.getRange("V5:V8").format.font = { color: C.link };
priority.getRange("E5:E8").format.font = { color: C.black };
priority.getRange("L5:N8").format.font = { color: C.black };
priority.getRange("P5:Q8").format.font = { color: C.black };
priority.getRange("C5:D8").format.numberFormat = "0.00";
priority.getRange("E5:E8").format.numberFormat = "0.00\"x\"";
priority.getRange("F5:H8").format.numberFormat = "0.00";
priority.getRange("I5:K8").format.numberFormat = "0.00\"x\"";
priority.getRange("L5:N8").format.numberFormat = "0.00";
priority.getRange("O5:O8").format.numberFormat = "0.0%";
priority.getRange("P5:P8").format.numberFormat = "0.00";
priority.getRange("Q5:Q8").format.numberFormat = "0.0%";
priority.getRange("U5:U8").format.numberFormat = "yyyy-mm-dd";
priority.getRange("A5:V8").format.wrapText = true;
priority.getRange("A5:V8").format.rowHeight = 88;
try {
  priority.getRange("Q5:Q8").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 0.2, format: { fill: C.green } });
  priority.getRange("Q5:Q8").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: C.red } });
} catch {}
setTableStyle(priority, "A4:V8", "PriorityAnalysisTable");
styleSection(priority, "A11:V11", "Cómo leer y actualizar los escenarios");
priority.getRange("A12:A15").values = [["EPS bajo/base/alto"], ["PER objetivo"], ["Precio entrada base"], ["Disciplina Lynch"]];
priority.getRange("B12:B15").values = [["Supuestos editables; el caso base usa consenso solo en Rightmove y referencias FY26/H1 en el resto."], ["Múltiplo de salida elegido por calidad, ciclicidad y riesgo; no es una predicción."], ["Precio razonable base × (1 – margen de seguridad)."], ["Cuando llegue la fecha de revisión, sustituye los escenarios por datos nuevos y cambia la decisión solo si cambia la evidencia."]];
priority.getRange("A12:A15").format = { fill: C.gray, font: { bold: true, color: C.navy } };
for (let row = 12; row <= 15; row += 1) priority.mergeCells(`B${row}:V${row}`);
priority.getRange("B12:V15").format.wrapText = true;
priority.getRange("A12:B15").format.rowHeight = 32;
finishSheet(priority, "A1:V15", 4);
const priorityWidths = { A: 22, B: 9, C: 13, D: 14, E: 11, F: 11, G: 11, H: 11, I: 10, J: 10, K: 10, L: 15, M: 15, N: 15, O: 13, P: 15, Q: 12, R: 42, S: 42, T: 42, U: 14, V: 30 };
for (const [col, width] of Object.entries(priorityWidths)) priority.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Ranking de potencial relativo 10-bagger
// -----------------------------------------------------------------------------
const ranking = workbook.worksheets.add("Ranking_10Bagger");
styleTitle(ranking, "A1:S1", "Ranking Lynch — potencial relativo de 10-bagger");
styleSubtitle(ranking, "A2:S2", "Ranking relativo dentro de esta watchlist, con base de datos al 2026-08-05. No es una probabilidad estadística ni una recomendación: mide cuánto runway, crecimiento, valoración, caja, tamaño y catalizadores reúne cada tesis.");
ranking.getRange("A4:S4").values = [[
  "Orden", "Empresa", "Ticker", "Tipo Lynch", "Capitalización (m)", "PER", "Score Lynch /16", "Crecimiento / runway (0-5)", "Valoración (0-5)", "Balance / caja (0-4)", "Tamaño / escala (0-4)", "Catalizador / palanca (0-4)", "Score 10Bagger /22", "Capitalización x10 (m)", "Rating relativo", "Motivo principal / freno", "Próxima revisión", "Fuentes", "Veredicto actual"
]];
styleHeader(ranking, "A4:S4");
const rankingInputs = [
  { watchRow: 7, growth: 4, valuation: 4, balance: 4, size: 3, catalyst: 4, reason: "Plataforma con crecimiento de net contribution/EBITDA, caja y recompra; freno: sensibilidad cripto/trading, dual class e historial corto." },
  { watchRow: 15, growth: 4, valuation: 3, balance: 4, size: 4, catalyst: 3, reason: "Nicho Workday con ARR +23%, bookings +32%, backlog +18% y caja neta; freno: margen ajustado +2%, NPS/retención y PER exigente." },
  { watchRow: 5, growth: 4, valuation: 3, balance: 4, size: 4, catalyst: 3, reason: "Cobre, Q2 con 13.493kt y caja neta €340.2m, más Masa Valverde/Touro; freno: una mina, commodity, AISC, permisos y capex." },
  { watchRow: 26, growth: 3, valuation: 5, balance: 4, size: 3, catalyst: 2, reason: "PER 7.3x, caja neta £2.0bn y capacidad creciendo; freno: aerolínea/turoperador muy cíclico y margen sensible a combustible/divisa." },
  { watchRow: 8, growth: 4, valuation: 4, balance: 1, size: 4, catalyst: 4, reason: "TTV +17% en moneda constante, recompra y descuento frente a IPO; freno: deuda, guía recortada y transición directiva." },
  { watchRow: 16, growth: 3, valuation: 4, balance: 4, size: 3, catalyst: 2, reason: "Caja >£850m, PER 12.8x y retorno de capital; freno: EBITDA casi plano, clientes a la baja y regulación/ciclicidad." },
  { watchRow: 21, growth: 2, valuation: 4, balance: 2, size: 4, catalyst: 4, reason: "Marca/franquicia comprensible, yield 5.5% y activismo que puede forzar recompras; freno: EBITDA/PBT FY25 descendentes." },
  { watchRow: 17, growth: 3, valuation: 3, balance: 4, size: 3, catalyst: 3, reason: "Marketplace con red, guía de ingresos +8–10% y áreas estratégicas; freno: £3.5bn de capitalización, regulación y margen ya alto." },
  { watchRow: 25, growth: 2, valuation: 3, balance: 4, size: 4, catalyst: 3, reason: "Empresa pequeña, caja y retención de clientes existentes; freno: pedidos nuevos -12% y H1 debe demostrar que el bache es temporal." },
  { watchRow: 22, growth: 3, valuation: 4, balance: 3, size: 3, catalyst: 3, reason: "Orderbook £1.57bn, guía de beneficio +17% y valoración razonable; freno: normalización de vivienda y margen cíclico." },
  { watchRow: 9, growth: 5, valuation: 1, balance: 4, size: 1, catalyst: 4, reason: "Ingresos +41%, NDR alto y FCF; freno decisivo: capitalización $14.3bn, pérdida GAAP, SBC/dilución y ~10x ventas." },
  { watchRow: 10, growth: 3, valuation: 4, balance: 2, size: 3, catalyst: 3, reason: "Ventas +10.5%, FCF +36%, recompra y PER 10x; freno: beneficio operativo -5.4%, inventario, EE. UU. y divisa." },
  { watchRow: 23, growth: 3, valuation: 3, balance: 4, size: 2, catalyst: 3, reason: "Backlog £9.8bn, FCF +£109m y caja neta; freno: ejecución contractual y cargo Type 31 reducen la pureza de la historia." },
  { watchRow: 24, growth: 3, valuation: 1, balance: 4, size: 4, catalyst: 3, reason: "Nicho científico, caja neta y book-to-bill 1.067; freno: ingresos/margen bajan y PER 33.8x espera la recuperación." },
  { watchRow: 13, growth: 3, valuation: 4, balance: 2, size: 3, catalyst: 3, reason: "Marketplace dominante, margen 63% y PER 15.6x; freno: crecimiento solo 4%, Deal Builder y deuda nueva." },
  { watchRow: 12, growth: 4, valuation: 1, balance: 4, size: 2, catalyst: 3, reason: "Volumen/net revenue crecen y el modelo escala; freno: PER 24.4x, take rate/tipos y capitalización £8.9bn." },
  { watchRow: 19, growth: 4, valuation: 1, balance: 4, size: 2, catalyst: 3, reason: "Ingresos FY25 +32% y caja neta; freno: PER 32.9x y margen bruto/Managed Services cuestionan la calidad del crecimiento." },
  { watchRow: 20, growth: 2, valuation: 3, balance: 3, size: 2, catalyst: 3, reason: "Modelo trade-only, margen bruto 62.8% y EBIT +5.5%; freno: vivienda/remodelación, tamaño y crecimiento moderado." },
  { watchRow: 18, growth: 3, valuation: 1, balance: 4, size: 2, catalyst: 3, reason: "IP Warhammer, sin deuda y caja/dividendos; freno: PER 33.5x y capitalización £6.6bn limitan el 10x." },
  { watchRow: 11, growth: 2, valuation: 4, balance: 3, size: 1, catalyst: 2, reason: "PER 11x, FCF y recompras; freno: $51bn de capitalización, cuentas activas planas y branded checkout solo +2%." },
  { watchRow: 14, growth: 2, valuation: 3, balance: 1, size: 3, catalyst: 3, reason: "Turnaround de margen y tiendas con dividendo; freno: beneficio -26%, LFL UK negativo y deuda neta £656m." },
  { watchRow: 6, growth: 1, valuation: 3, balance: 2, size: 0, catalyst: 2, reason: "Cobre/dividendo y escala defensiva; freno decisivo: capitalización ~$119bn hace extremadamente improbable un 10x." },
];
const rankingRows = rankingInputs.map((item) => [
  null, null, null, null, null, null, null,
  item.growth, item.valuation, item.balance, item.size, item.catalyst,
  null, null, null, item.reason, null, null, null,
]);
ranking.getRange("A5:S26").values = rankingRows;
for (let index = 0; index < rankingInputs.length; index += 1) {
  const row = 5 + index;
  const sourceRow = rankingInputs[index].watchRow;
  ranking.getRange(`B${row}:G${row}`).formulas = [[
    `='Watchlist'!A${sourceRow}`,
    `='Watchlist'!B${sourceRow}`,
    `='Watchlist'!D${sourceRow}`,
    `='Watchlist'!H${sourceRow}`,
    `='Watchlist'!I${sourceRow}`,
    `='Checklist_Lynch'!L${sourceRow}`,
  ]];
  ranking.getRange(`A${row}`).formulas = [[`=COUNTIF($M$5:$M$26,">"&M${row})+COUNTIF($M$5:M${row},M${row})`]];
  ranking.getRange(`M${row}:O${row}`).formulas = [[
    `=SUM(H${row}:L${row})`,
    `=E${row}*10`,
    `=IF(M${row}>=18,"Alta",IF(M${row}>=16,"Media-alta",IF(M${row}>=14,"Media","Baja")))`,
  ]];
  ranking.getRange(`Q${row}:S${row}`).formulas = [[
    `='Seguimiento'!D${sourceRow}`,
    `='Watchlist'!Y${sourceRow}&" / "&'Watchlist'!Z${sourceRow}`,
    `='Watchlist'!V${sourceRow}`,
  ]];
}
ranking.getRange("A5:A26").format = { font: { bold: true, color: C.black }, horizontalAlignment: "center" };
ranking.getRange("B5:G26").format.font = { color: C.link };
ranking.getRange("H5:L26").format = { font: { color: C.input }, horizontalAlignment: "center" };
ranking.getRange("M5:O26").format.font = { color: C.black };
ranking.getRange("P5:P26").format.font = { color: C.input };
ranking.getRange("Q5:S26").format.font = { color: C.link };
ranking.getRange("A5:A26").format.numberFormat = "0";
ranking.getRange("E5:E26").format.numberFormat = "#,##0.0";
ranking.getRange("F5:F26").format.numberFormat = "0.00\"x\"";
ranking.getRange("G5:M26").format.numberFormat = "0";
ranking.getRange("N5:N26").format.numberFormat = "#,##0.0";
ranking.getRange("Q5:Q26").format.numberFormat = "yyyy-mm-dd";
ranking.getRange("A5:S26").format.wrapText = true;
ranking.getRange("A5:S26").format.rowHeight = 78;
try {
  ranking.getRange("M5:M26").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 17, format: { fill: C.green } });
  ranking.getRange("M5:M26").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 13, format: { fill: C.red } });
  ranking.getRange("O5:O26").conditionalFormats.add("containsText", { text: "Alta", format: { fill: C.green } });
  ranking.getRange("O5:O26").conditionalFormats.add("containsText", { text: "Baja", format: { fill: C.red } });
} catch {}
setTableStyle(ranking, "A4:S26", "Ranking10BaggerTable");
styleSection(ranking, "A29:S29", "Cómo leer el ranking");
const rankingNotes = [
  ["Qué mide", "El score pondera la posibilidad relativa de que el negocio pueda multiplicar mucho desde su tamaño actual; no intenta convertir una hipótesis en una probabilidad matemática."],
  ["Runway", "Crecimiento visible, mercado direccionable, cuota y capacidad de reinversión. La calidad sin runway no basta para un 10-bagger."],
  ["Tamaño x10", "Capitalización actual ×10 para hacer tangible la barrera. Las divisas de la watchlist son mixtas: úsalo como orden de magnitud, no como comparación exacta."],
  ["Orden", "La columna Orden se recalcula si cambias H:L, pero las filas no se reordenan solas: ordena la tabla por Score 10Bagger descendente después de editar."],
  ["Disciplina Lynch", "Una puntuación alta exige todavía leer resultados, comprobar deuda/dilución y definir un precio de entrada con margen de seguridad."],
];
ranking.getRange("A30:A34").values = rankingNotes.map((note) => [note[0]]);
ranking.getRange("A30:A34").format = { fill: C.gray, font: { bold: true, color: C.navy } };
for (let row = 30; row <= 34; row += 1) {
  ranking.mergeCells(`B${row}:S${row}`);
  ranking.getRange(`B${row}`).values = [[rankingNotes[row - 30][1]]];
}
ranking.getRange("B30:S34").format.wrapText = true;
ranking.getRange("A30:S34").format.rowHeight = 34;
finishSheet(ranking, "A1:S34", 4);
const rankingWidths = { A: 8, B: 22, C: 9, D: 27, E: 15, F: 10, G: 13, H: 15, I: 13, J: 13, K: 13, L: 15, M: 14, N: 15, O: 13, P: 66, Q: 14, R: 24, S: 34 };
for (const [col, width] of Object.entries(rankingWidths)) ranking.getRange(`${col}:${col}`).format.columnWidth = width;
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
  ["Rightmove", "RMV", 2, 2, 2, 1, 2, 1, 1, 1, 1, null, null, "H1: crecimiento de ingresos, ARPA, miembros, áreas nuevas, LLM referrals y litigio.", AS_OF],
  ["Games Workshop", "GAW", 2, 2, 2, 0, 2, 1, 1, 1, 2, null, null, "Normalización del crecimiento, licencias, royalties, margen y retorno de caja al accionista.", AS_OF],
  ["Computacenter", "CCC", 2, 2, 2, 1, 2, 1, 1, 0, 1, null, null, "H1: Technology Sourcing, Managed Services, margen bruto, consenso y caja neta.", AS_OF],
  ["Howdens Joinery", "HWDN", 2, 2, 1, 2, 2, 1, 1, 1, 1, null, null, "Trading update: ventas comparables, margen bruto, aperturas, vivienda y caja.", AS_OF],
  ["Domino's Pizza Group", "DOM", 2, 2, 0, 2, 1, 1, 1, 1, 1, null, null, "H1: system sales, EBITDA, PBT, franquiciados, promociones y efecto del activismo.", AS_OF],
  ["Bellway", "BWY", 2, 2, 1, 2, 1, 1, 1, 1, 1, null, null, "Trading update: reservas, cancelaciones, orderbook, margen, deuda y demanda hipotecaria.", AS_OF],
  ["Babcock International", "BAB", 2, 2, 2, 1, 2, 1, 1, 1, 1, null, null, "H1: FCF, backlog, margen, Type 31, ejecución contractual y recompra.", AS_OF],
  ["Oxford Instruments", "OXIG", 2, 2, 1, 1, 2, 1, 1, 1, 1, null, null, "Interinos: convertir order intake en ventas, margen ajustado, book-to-bill y semiconductores.", AS_OF],
  ["4imprint Group", "FOUR", 2, 2, 1, 2, 2, 1, 1, 1, 1, null, null, "H1: pedidos nuevos/existentes, AOV, margen, aranceles, caja y guía.", AS_OF],
  ["Jet2", "JET2", 2, 2, 2, 2, 2, 1, 1, 1, 1, null, null, "Interinos: ocupación, yield, combustible, capacidad, Gatwick, caja y recompra.", AS_OF],
];
checklist.getRange("A5:O26").values = checkRows;
for (let row = 5; row <= 26; row += 1) {
  checklist.getRange(`L${row}`).formulas = [[`=SUM(C${row}:K${row})`]];
  checklist.getRange(`M${row}`).formulas = [[`=IF(L${row}>=12,"Candidato",IF(L${row}>=9,"Vigilancia","Revisar"))`]];
}
checklist.getRange("A5:K26").format.font = { color: C.input };
checklist.getRange("N5:O26").format.font = { color: C.input };
checklist.getRange("L5:M26").format.font = { color: C.black };
checklist.getRange("O5:O26").format.numberFormat = "yyyy-mm-dd";
checklist.getRange("C5:K26").format.horizontalAlignment = "center";
checklist.getRange("L5:L26").format.numberFormat = "0";
try {
  checklist.getRange("C5:K26").dataValidation = { rule: { type: "wholeNumber", operator: "between", formula1: 0, formula2: 2 } };
} catch {}
try {
  checklist.getRange("H5:I26").dataValidation = { rule: { type: "wholeNumber", operator: "between", formula1: 0, formula2: 1 } };
} catch {}
try {
  checklist.getRange("A5:M26").conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 12, format: { fill: C.green } });
} catch {}
setTableStyle(checklist, "A4:O26", "ChecklistTable");
styleSection(checklist, "A29:O29", "Preguntas de control antes de comprar");
checklist.getRange("A30:O35").values = [
  ["1", "¿Puedo explicar cómo gana dinero en dos frases y qué variable mueve el beneficio?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["2", "¿La tesis depende de un catalizador identificable o solo de que el múltiplo se expanda?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["3", "¿El crecimiento llega a beneficio y caja, o solo a ingresos / métricas ajustadas?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["4", "¿Qué PER pagaría por beneficios normalizados y qué precio ofrece margen de seguridad?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["5", "¿Qué dato invalidaría la tesis? Escríbelo antes de comprar.", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["6", "¿He leído el último informe, las notas de deuda/dilución y la remuneración directiva?", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];
checklist.getRange("A30:A35").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
checklist.mergeCells("B30:O30");
checklist.mergeCells("B31:O31");
checklist.mergeCells("B32:O32");
checklist.mergeCells("B33:O33");
checklist.mergeCells("B34:O34");
checklist.mergeCells("B35:O35");
finishSheet(checklist, "A1:O35", 4);
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
  ["Atalaya Mining", "ATYM", "Q2 2026", "Trimestral", "EUR", null, null, null, null, null, null, null, -340.2, "Producción 13.493 kt; ley 0.39%; recuperación 83.91%; inventario 11.362 kt", "ATYM-Q2-26", "Actualización operativa, no cuenta de resultados completa; caja neta = caja €351.2m menos deuda €10.9m"],
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
  ["Rightmove", "RMV", "FY2025", "Anual", "GBP", 425.1, 0.09, 297.7, 0.09, null, 0.281, null, -29.6, "Membresía ~+1%; ARPA y áreas de crecimiento estratégico", "RMV-FY25", "Beneficio operativo subyacente; revisar caja neta en el informe anual"],
  ["Games Workshop", "GAW", "FY2026", "Anual", "GBP", 659.7, 0.068, 275.0, 0.052, null, 6.240, 210.3, null, "Core revenue 626.8m; licensing 32.9m; balance sin deuda", "GAW-FY26", "Caja aumentó 210.3m antes de dividendos; no sustituye a FCF comparable"],
  ["Computacenter", "CCC", "FY2025", "Anual", "GBP", 9193.9, 0.32, 274.7, 0.113, null, 1.751, null, -606.0, "Technology Sourcing +40.9%; Managed Services -2.4% CC", "CCC-FY25", "Cifras ajustadas; net funds no es FCF"],
  ["Howdens Joinery", "HWDN", "H1 2026", "Semestral", "GBP", 1030.6, 0.033, 128.1, 0.055, null, 0.173, null, -332.8, "Margen bruto 62.8%; ventas ajustadas +3.7%", "HWDN-H1-26", "Cifras subyacentes; caja al cierre de semestre"],
  ["Domino's Pizza Group", "DOM", "FY2025", "Anual", "GBP", 685.4, 0.031, 133.9, -0.066, null, 0.176, null, null, "System sales 1,595.6m +1.5%; primeras 9 semanas de 2026 positivas", "DOM-FY25", "El beneficio operativo usa EBITDA subyacente; H1 se publica el 04-ago-2026"],
  ["Bellway", "BWY", "FY2026 guía", "Guía", "GBP", null, null, 325.0, null, null, 1.328, null, 236.0, "Orderbook 5,345 viviendas / 1,570m; volumen guiado 9,300–9,500", "BWY-TRD", "Guía de beneficio operativo, no resultado cerrado; deuda neta al 29-may-2026"],
  ["Babcock International", "BAB", "FY2026", "Anual", "GBP", 5273.0, 0.091, 433.0, 0.192, null, 0.605, 262.0, -23.0, "Backlog 9.8bn; FCF 262m; recompra FY27 200m", "BAB-FY26", "Métricas subyacentes; Type 31 produjo un cargo extraordinario"],
  ["Oxford Instruments", "OXIG", "FY2026", "Anual", "GBP", 423.2, -0.046, 73.7, -0.073, null, 1.007, null, -94.0, "Order intake 450.4m +6.4%; book-to-bill 1.067", "OXIG-FY26", "Margen y EPS ajustados; el beneficio reportado creció por efecto comparativo"],
  ["4imprint Group", "FOUR", "FY2025", "Anual", "USD", 1346.8, -0.02, 145.2, -0.02, null, 4.044, null, -132.8, "Pedidos 2.06m -3%; pedidos de clientes existentes planos; nuevos -12%", "FOUR-FY25", "Cifras de resultados en USD; cotización/dividendo de la watchlist en GBX"],
  ["Jet2", "JET2", "FY2026", "Anual", "GBP", 7482.1, 0.04, 439.6, -0.02, null, 2.112, null, -2012.9, "Pasajeros 20.83m +5%; capacidad verano 2026 +7.7%", "JET2-FY26", "Caja neta; resultado sensible a combustible, divisa y calendario"],
];
historial.getRange("A5:P35").values = historyRows;
historial.getRange("A5:E35").format.font = { color: C.input };
historial.getRange("F5:N35").format.font = { color: C.input };
historial.getRange("O5:P35").format.font = { color: C.input };
historial.getRange("F5:F35").format.numberFormat = "#,##0.0";
historial.getRange("G5:G35").format.numberFormat = "0.0%";
historial.getRange("H5:H35").format.numberFormat = "#,##0.0";
historial.getRange("I5:I35").format.numberFormat = "0.0%";
historial.getRange("J5:M35").format.numberFormat = "#,##0.0";
historial.getRange("A5:P35").format.rowHeight = 48;
try { historial.getRange("G5:I35").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: C.red } }); } catch {}
setTableStyle(historial, "A4:P35", "HistoryTable");
finishSheet(historial, "A1:P35", 4);
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
  ["ATYM-Q2-26", "Atalaya Mining", date("2026-07-14"), "Operativo", "Producción Q2, ley, recuperación, inventario, guidance de costes y caja neta", "https://www.investegate.co.uk/announcement/rns/atalaya-mining--atym/q2-2026-operations-update-/9666655", "RNS operativo; caja neta €340.2m = caja €351.2m menos deuda €10.9m."],
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
  ["RMV-MKT", "Rightmove", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/ShareFundamentals.html?share=rightmove&shareprice=RMV", "Snapshot actualizado; el PER 16.90x usa EPS FY25 de 28.10p."],
  ["RMV-FY25", "Rightmove", date("2026-02-27"), "Resultados", "FY25 ingresos, beneficio operativo, EPS y guía 2026", "https://plc.rightmove.co.uk/content/uploads/2026/02/Rightmove-RNS-27.02.26.pdf", "Resultados oficiales; H1 2026 publicado el 31-jul-2026."],
  ["RMV-CONS", "Rightmove", date("2026-07-27"), "Consenso", "Consenso H1/FY26-FY28 de ingresos, EBIT y EPS", "https://plc.rightmove.co.uk/content/uploads/2026/07/Rightmove_Modular-Finance-IR-Consensus.pdf", "Estimaciones sell-side; no son guidance de la compañía."],
  ["RMV-CAL", "Rightmove", AS_OF, "Calendario", "IR, resultados y trading updates", "https://plc.rightmove.co.uk/", "Confirmar la siguiente fecha tras H1."],
  ["GAW-MKT", "Games Workshop", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/ShareFundamentals.html?share=Games-Workshop&shareprice=GAW", "Snapshot de mercado; actualizar antes de decidir."],
  ["GAW-FY26", "Games Workshop", date("2026-07-28"), "Resultados", "FY26 ingresos, beneficio, EPS, caja y balance", "https://assets.ctfassets.net/ost7hseic9hc/6nI9MLA7hoRBfs2OA1oE5R/a17f82fdef64028ff1f03f03c4dc4cbf/Press_Statement_2025-26_FINAL_v3.pdf", "Press statement oficial; ejercicio terminado el 31-may-2026."],
  ["GAW-CAL", "Games Workshop", AS_OF, "Calendario", "Fecha de resultados FY26 y calendario de inversores", "https://investor.games-workshop.com/financial-calendar", "Usar noviembre como revisión tentativa de trading."],
  ["CCC-MKT", "Computacenter", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=CCC", "Snapshot de mercado; actualizar antes de decidir."],
  ["CCC-FY25", "Computacenter", date("2026-03-12"), "Resultados", "FY25 ingresos, beneficio operativo, EPS y net funds", "https://investors.computacenter.com/news-releases/news-release-details/computacenter-final-results-2025", "Resultados oficiales; cifras ajustadas."],
  ["CCC-Q1-26", "Computacenter", date("2026-04-24"), "Resultados", "Q1 2026, trading, consenso y próximo H1", "https://investors.computacenter.com/node/15316/pdf", "Actualización oficial; H1 el 08-sep-2026."],
  ["HWDN-MKT", "Howdens Joinery", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/ShareFundamentals.html?share=Howden-Joinery&shareprice=HWDN", "Snapshot actualizado; actualizar antes de decidir."],
  ["HWDN-H1-26", "Howdens Joinery", date("2026-07-23"), "Resultados", "H1 2026 ventas, margen, EBIT, EPS y caja", "https://www.lse.co.uk/rns/half-year-report-71qu4k9hnaywgyi.html", "Comunicado oficial distribuido por RNS."],
  ["HWDN-CAL", "Howdens Joinery", date("2026-02-26"), "Calendario", "Trading update y resultados H1 2026", "https://www.howdenjoinerygroupplc.com/media-centre/archive/2026/260226.asp", "La compañía señaló trading update el 05-nov-2026."],
  ["DOM-MKT", "Domino's Pizza Group", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?share=DOM&shareprice=DOM", "Snapshot de mercado; actualizar antes de decidir."],
  ["DOM-FY25", "Domino's Pizza Group", date("2026-03-03"), "Resultados", "FY25 ventas, EBITDA, PBT, EPS, dividendo y primeras semanas de 2026", "https://investors.dominos.co.uk/media/news/preliminary-results-52-weeks-ended-28-december-2025", "Resultados oficiales; H1 2026 el 04-ago-2026."],
  ["DOM-CAL", "Domino's Pizza Group", AS_OF, "Calendario", "Resultados H1 2026", "https://investors.dominos.co.uk/investors/overview/financial-calendar", "Fecha confirmada; revisar el día siguiente."],
  ["BWY-MKT", "Bellway", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/ShareFundamentals.html?shareprice=BWY", "Snapshot de mercado; actualizar antes de decidir."],
  ["BWY-TRD", "Bellway", date("2026-06-09"), "Trading update", "Guía FY26, orderbook, deuda neta, volúmenes y próximo update", "https://www.lse.co.uk/rns/BWY/trading-update-l3zs9rgixwf4hq0.html", "Comunicado oficial; próximo trading update 11-ago-2026."],
  ["BWY-CAL", "Bellway", AS_OF, "Calendario", "Trading update 11-ago-2026 y resultados FY26 13-oct-2026", "https://www.bellwayplc.co.uk/investor-centre/financial-calendar", "Fechas confirmadas por la compañía."],
  ["BAB-MKT", "Babcock International", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/rns/BAB/", "Snapshot RNS; PER calculado sobre EPS subyacente."],
  ["BAB-FY26", "Babcock International", date("2026-06-22"), "Resultados", "FY26 ingresos, beneficio, EPS, FCF, backlog, deuda y recompra", "https://www.babcockinternational.com/wp-content/uploads/2026/06/Babcock-FY26-results-presentation-22.06.26.pdf", "Presentación oficial; Type 31 genera cargo extraordinario."],
  ["BAB-CAL", "Babcock International", AS_OF, "Calendario", "Resultados y reporting de inversores", "https://www.babcockinternational.com/investors/results-and-reporting/", "Confirmar fecha de H1 FY27."],
  ["OXIG-MKT", "Oxford Instruments", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?share=Oxford-Instruments&shareprice=OXIG", "Snapshot de mercado; actualizar antes de decidir."],
  ["OXIG-FY26", "Oxford Instruments", date("2026-06-09"), "Resultados", "FY26 ingresos, margen, EPS, caja, order intake y book-to-bill", "https://www.oxinst.com/assets/uploads/Oxford_Instruments_plc_preliminary_FY26_results_9_June_2026.pdf", "Resultados preliminares oficiales."],
  ["OXIG-CAL", "Oxford Instruments", AS_OF, "Calendario", "Resultados financieros y presentaciones", "https://www.oxinst.com/investors/financial-reports-and-presentations", "Usar noviembre como revisión tentativa de interinos."],
  ["FOUR-MKT", "4imprint Group", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?share=4imprint-Grp&shareprice=FOUR", "Snapshot actualizado; la cuenta de resultados está en USD y la cotización/EPS LSE en GBX."],
  ["FOUR-FY25", "4imprint Group", date("2026-03-03"), "Resultados", "FY25 ventas, beneficio, EPS, pedidos, caja y dividendos", "https://investors.4imprint.com/investors/latest-news/2026/final-results-for-the-period-ended-27-december-2025/", "Resultados oficiales; primeros dos meses de 2026 débiles."],
  ["FOUR-CAL", "4imprint Group", AS_OF, "Calendario", "Resultados H1 2026", "https://investors.4imprint.com/investors/financial-calendar/", "Fecha confirmada: 05-ago-2026."],
  ["JET2-MKT", "Jet2", AS_OF, "Mercado", "Precio, capitalización, PER, EPS, dividendo y yield", "https://www.lse.co.uk/SharePrice.html?share=Jet2-Plc&shareprice=JET2", "Snapshot actualizado; actualizar antes de decidir."],
  ["JET2-FY26", "Jet2", date("2026-07-30"), "Resultados", "FY26 ingresos, beneficio, EPS, pasajeros, caja y capacidad 2026", "https://www.jet2.com/news/2026/07/-/media/Jet2/Jet2plc/Jet2Plc_Redesign2025/Reports/2026/Preliminary-results-2026/Jet2-plc-Preliminary-Results-2026.pdf", "Resultados preliminares oficiales."],
  ["JET2-CAL", "Jet2", AS_OF, "Calendario", "Resultados preliminares FY26 y noticias de inversores", "https://www.jet2.com/news/2026/07/Jet2_PLC_Publishes_Preliminary_Results_2026", "Usar noviembre como revisión post-temporada; confirmar calendario H1."],
];
sourceRows.push(
  ["ATYM-CAL", "Atalaya Mining", AS_OF, "Calendario", "Resultados H1 2026 el 11-ago-2026 y actualizaciones operativas posteriores", "https://atalayamining.com/investors/financial-calendar/", "Fecha de control inmediata; confirmar publicación y presentación."],
  ["ATYM-RES", "Atalaya Mining", AS_OF, "Reservas / recursos", "Cerro Colorado, San Dionisio, Masa Valverde, Touro y opcionalidad de proyectos", "https://atalayamining.com/operations/reserves-resources/", "Recursos no equivalen a reservas económicas ni a producción aprobada."],
  ["ATYM-ANN", "Atalaya Mining", AS_OF, "Anuncios", "Comunicados operativos y financieros oficiales", "https://atalayamining.com/investors/announcements/", "Usar como índice para futuras revisiones; contrastar cada dato con el RNS."],
  ["KNOS-RESULTS", "Kainos Group", AS_OF, "Resultados", "FY26, presentaciones, informe anual y métricas por división", "https://www.kainos.com/investor-relations/results-and-presentations", "Índice oficial de resultados; priorizar el comunicado y el informe anual."],
  ["KNOS-DEEP-CAL", "Kainos Group", AS_OF, "Calendario", "Trading update FY27 el 07-sep-2026, AGM y resultados interinos", "https://www.kainos.com/investor-relations/regulatory-news-and-events", "Próximo control de ARR, backlog y margen; se conserva KNOS-CAL para el panel principal."],
  ["LYNCH-BOOK-PDF", "Peter Lynch", AS_OF, "Libro / marco", "Categorías, crecimiento, PER, balance, catalizadores y señales de revisión", "C:/Users/Cesar/Desktop/desarrollador/finanzas/src/Un paso por delante de Wall Street.pdf", "Documento local proporcionado por el usuario; marco cualitativo, no datos de mercado."],
);
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
  ["Atalaya Mining", "ATYM", AS_OF, date("2026-08-11"), "Existente / cíclica", "Cobre, producción, ley, recuperación, AISC, inventarios, FCF y caja", "PER 17.29x; FY25 FCF 107.4m; Q2 producción 13.493kt; caja neta 340.2m", "Producción anual ≥50kt, AISC ≤3.40/lb, caja/FCF positivos y proyectos sin dilución", "AISC >3.40/lb, producción por debajo del rango, reversión de caja/inventario o shock de permisos/capex", "Leer H1 el 11-ago; añadir periodo a Historial/Registro y recalcular sensibilidad", "ATYM-FY25 / ATYM-Q2-26 / ATYM-CAL", null],
  ["Rio Tinto", "RIO", AS_OF, date("2026-11-02"), "Existente / cíclica", "Cobre, hierro, aluminio, China, capex, deuda y FCF", "PER 16.05x; FCF 4,025m; deuda neta 14,362m", "Producción y caja deben sostener dividendo/capex sin elevar demasiado deuda", "Caída persistente de precios, capex descontrolado o deuda al alza", "Comparar resultados y actualizar sensibilidad por commodity", "RIO-H1-26", null],
  ["eToro", "ETOR", AS_OF, date("2026-08-11"), "Nueva / alto crecimiento", "Net contribution, EBITDA, activos, cuentas financiadas, cripto y recompras", "PER 15.47x; Q1 net contribution +19%; EBITDA +35%", "Crecimiento de clientes/activos y beneficios por encima de la volatilidad del mercado", "Cuentas/activos se estancan, cripto explica el beneficio o margen se deteriora", "Leer Q2; actualizar ingresos, cash flow, estructura dual y tesis", "ETOR-Q1-26", null],
  ["HBX Group", "HBX", AS_OF, date("2026-11-25"), "Nueva / crecimiento-cíclica", "TTV, margen, FCF, deuda, recompra y guía", "PER 10.21x; deuda neta 741m; TTV H1 +17% CC", "Reducir deuda y mantener crecimiento/FCF pese a guía revisada", "Guía vuelve a recortarse, deuda/FCF empeora o transición directiva falla", "Leer FY26; revisar si el descuento frente a IPO tiene fundamento", "HBX-H1-26", null],
  ["Figma", "FIG", AS_OF, date("2026-08-05"), "Nueva / alto crecimiento", "Ingresos, FCF, NDR, clientes, SBC y guidance", "PER negativo; ingresos FY25 1,056m; FCF 242.7m", "Crecimiento >35%, NDR alto y FCF creciendo más rápido que SBC/dilución", "Crecimiento <25%, NDR cae, SBC sigue absorbiendo caja o guidance baja", "Leer Q2 antes de comprar; actualizar valoración sobre FCF normalizado", "FIG-Q2", null],
  ["JD Sports Fashion", "JD.", AS_OF, date("2026-08-20"), "Madura / crecimiento", "Ventas LFL, margen, inventario, EE. UU., FCF y recompras", "PER 9.99x; ventas +10.5%; FCF 462m; op. profit -5.4%", "Recuperación de margen y crecimiento LFL sin acumular inventario", "Margen sigue bajando, inventario aumenta o EE. UU. no recupera LFL", "Leer trading update; recalcular PER con EPS actualizado", "JD-FY26 / JD-BB", null],
  ["PayPal", "PYPL", AS_OF, date("2026-11-05"), "Madura / recuperable", "TPV, branded checkout, cuentas activas, margen, FCF y recompras", "PER 11.03x; FCF 1,700m en Q1; TPV +11%; checkout +2%", "Branded checkout y cuentas activas deben acelerar sin sacrificar margen", "Checkout sigue plano, cuentas activas caen o FCF no sostiene recompras", "Leer 3T26; actualizar tesis de recuperación y margen de seguridad", "PYPL-Q1-26", null],
  ["Wise", "WISE", AS_OF, date("2026-10-15"), "Alto crecimiento / calidad", "Clientes, volumen, holdings, take rate, margen antes de impuestos y caja utilizable", "PER 24.38x; FY26 net revenue +19%; Q1 FY27 +25%; take rate 50bps", "Mantener crecimiento 15–20% y margen cercano al 20–25% mientras baja el take rate", "Crecimiento cae claramente, take rate baja sin escala o valoración exige más de lo que entrega", "Confirmar calendario; comparar Q2 FY27 contra Q1 y FY26", "WISE-Q1-27 / WISE-CAL", null],
  ["Auto Trader", "AUTO", AS_OF, date("2026-11-05"), "Madura / crecimiento", "Forecourts, stock pagado, ARPR, margen, Deal Builder, FCF y deuda", "PER 15.58x; margen operativo 63%; ARPR +5%; deuda neta 146.8m", "Concesionarios vuelven a aceptar Deal Builder y ARPR/margen siguen creciendo", "Stock pagado cae, concesionarios abandonan la plataforma o deuda sube sin retorno", "Leer interinos; actualizar crecimiento, FCF y valoración", "AUTO-FY26 / AUTO-CAL", null],
  ["B&M European Value Retail", "BME", AS_OF, date("2026-11-12"), "Recuperable / cíclica", "LFL UK, margen EBITDA, Francia, inventarios, FCF, deuda y dividendo", "PER calculado 13.85x; FCF 321m; deuda neta 656m; UK LFL -2.3%", "LFL UK pasa a positivo y el margen se recupera hacia doble dígito a medio plazo", "LFL sigue negativo, margen no recupera o deuda/dividendo dejan de ser sostenibles", "Confirmar fecha; comparar H1 y decidir si el turnaround sigue vivo", "BME-Q1-27 / BME-CAL", null],
  ["Kainos Group", "KNOS", AS_OF, date("2026-09-07"), "Crecimiento / nicho", "ARR, bookings, backlog, margen ajustado, contratistas, conversión de caja, NPS y retención", "PER 23.10x; ventas 431.1m; PBT ajustado 67.1m +2%; ARR 89m +23%; backlog 433.9m +18%; caja 89.1m", "ARR hacia 100m, backlog convierte, margen ≥16% y recuperación de caja/retención", "ARR se frena, margen <16% sin recuperación, backlog no convierte, NPS/retención siguen bajando o caja se consume", "Leer trading update; añadir periodo a Registro y actualizar escenarios de precio", "KNOS-FY26 / KNOS-MKT / KNOS-CAL", null],
  ["Plus500", "PLUS", AS_OF, date("2026-08-10"), "Madura / cíclica", "Customer Income, EBITDA, margen, clientes, new customers, caja y regulación", "PER 12.84x; H1 revenue +12%; EBITDA +1%; caja >850m", "Customer Income y clientes crecen; margen no se comprime al escalar negocios no-OTC", "Resultado débil, caída de clientes, regulación adversa o margen sigue cayendo", "Leer H1; revisar dividendo/recompra y si el precio ya descuenta la mejora", "PLUS-H1-26 / PLUS-CAL", null],
  ["Rightmove", "RMV", AS_OF, date("2026-08-31"), "Calidad / marketplace", "Ingresos, EPS, ARPA, miembros, áreas nuevas, LLM referrals, margen y caja", "PER 16.90x; FY25 EPS 28.10p; consenso FY26 EPS 30.02p", "Guía 2026 de ingresos +8–10% y crecimiento de comercial, hipotecas y alquileres", "Menor crecimiento, membresía negativa, litigio/regulación o gasto que erosione el margen", "Leer H1; actualizar el caso base y el precio de entrada de Analisis_Prioritario", "RMV-FY25 / RMV-CONS", null],
  ["Games Workshop", "GAW", AS_OF, date("2026-11-05"), "Calidad / IP y nicho", "Core revenue, licencias, margen, royalties, caja y dividendos", "PER 33.52x; FY26 ingresos +6.8%; EPS 624p; sin deuda", "Warhammer/IP sigue creciendo y la caja se transforma en dividendos sin deuda", "Crecimiento core se normaliza, licencias caen o el PER exige más de lo que entrega", "Revisar trading; recalcular precio razonable con crecimiento normalizado", "GAW-FY26 / GAW-CAL", null],
  ["Computacenter", "CCC", AS_OF, date("2026-09-08"), "Crecimiento / servicios IT", "Technology Sourcing, Managed Services, margen bruto, consenso y caja", "PER 32.89x; FY25 ingresos +32%; net funds 606m", "Q1 fuerte debe convertirse en beneficio y mantener el consenso FY26", "Margen sigue cayendo, Managed Services no recupera o se paga demasiado por el crecimiento", "Leer H1; comparar adjusted PBT contra consenso y actualizar valoración", "CCC-Q1-26", null],
  ["Howdens Joinery", "HWDN", AS_OF, date("2026-11-05"), "Calidad / cíclica", "Ventas comparables, margen bruto, aperturas, vivienda, DIY Kitchens y caja", "PER 16.70x; H1 ventas +3.3%; EBIT subyacente +5.5%; caja 332.8m", "Mantener margen y convertir recuperación de vivienda en crecimiento rentable", "LFL negativo, margen cae, adquisición sin retorno o caja no cubre capex/inventario", "Leer trading update; actualizar EPS normalizado y precio de entrada", "HWDN-H1-26 / HWDN-CAL", null],
  ["Domino's Pizza Group", "DOM", AS_OF, date("2026-08-05"), "Madura / recuperable", "System sales, EBITDA, PBT, franquiciados, promociones y caja", "PER 13.35x; yield 5.5%; FY25 EBITDA -6.6%; primeras 9 semanas positivas", "H1 debe confirmar momentum, disciplina promocional y estabilización de beneficios", "EBITDA/PBT siguen cayendo, franquiciados pierden atractivo o activismo fuerza mala asignación", "Leer resultados del 04-ago; actualizar tesis al día siguiente", "DOM-FY25 / DOM-CAL", null],
  ["Bellway", "BWY", AS_OF, date("2026-08-11"), "Existente / cíclica", "Reservas, cancelaciones, orderbook, margen, deuda y demanda hipotecaria", "PER 14.73x; beneficio FY26 guiado 320–330m; orderbook 1.57bn", "Demanda y margen deben sostener guía sin aumentar deuda", "Tipos/demanda empeoran, cancelaciones suben o el orderbook no convierte en entregas", "Leer trading update; revisar si el descuento cíclico ofrece margen de seguridad", "BWY-TRD / BWY-CAL", null],
  ["Babcock International", "BAB", AS_OF, date("2026-11-20"), "Defensa / turnaround", "FCF, backlog, margen, Type 31, ejecución contractual y recompra", "PER subyacente 18.53x; FCF 262m; backlog 9.8bn; caja neta 23m", "El backlog debe convertirse en caja y el cargo Type 31 quedar aislado", "Nuevo sobrecoste, FCF débil, deuda sube o se deteriora la calidad contractual", "Confirmar fecha H1; comparar FCF y margen contra FY26", "BAB-FY26 / BAB-CAL", null],
  ["Oxford Instruments", "OXIG", AS_OF, date("2026-11-12"), "Nicho / tecnología", "Order intake, book-to-bill, ventas, margen ajustado, semiconductores y caja", "PER 33.81x; ingresos FY26 -4.6%; order intake +6.4%; caja 94m", "Los pedidos deben convertirse en ingresos y recuperar margen sin nueva dilución", "Book-to-bill cae, ingresos no recuperan o el múltiplo no deja margen", "Leer interinos; actualizar conversión de pedidos y precio razonable", "OXIG-FY26 / OXIG-CAL", null],
  ["4imprint Group", "FOUR", AS_OF, date("2026-08-05"), "Madura / calidad con descuento", "Pedidos nuevos/existentes, AOV, margen, aranceles, caja y guía", "PER 14.62x; yield 4.2%; pedidos FY25 -3%; caja 132.8m USD", "H1 debe distinguir bache temporal de pérdida estructural de clientes nuevos", "Pedidos y margen siguen bajando, aranceles erosionan beneficio o caja se consume", "Leer H1; recalcular beneficio normalizado y sensibilidad a pedidos", "FOUR-FY25 / FOUR-CAL", null],
  ["Jet2", "JET2", AS_OF, date("2026-11-17"), "Cíclica / crecimiento", "Ocupación, yield, combustible, capacidad, Gatwick, caja y recompra", "PER 7.29x; caja neta 2,012.9m; pasajeros +5%; capacidad verano +7.7%", "Crecimiento de capacidad y Gatwick deben mantener ROCE sin destruir caja", "Combustible/geopolítica, demanda débil, margen cae o la caja se usa mal", "Revisar tras verano; actualizar PER con resultados H1 y reservas", "JET2-FY26 / JET2-CAL", null],
];
seguimiento.getRange("A5:L26").values = followRows;
for (let row = 5; row <= 26; row += 1) {
  seguimiento.getRange(`L${row}`).formulas = [[`=IF(D${row}<=DATE(2026,8,5),"REVISAR YA",IF(D${row}<=DATE(2026,9,4),"PRÓXIMA","PROGRAMADA"))`]];
}
seguimiento.getRange("A5:K26").format.font = { color: C.input };
seguimiento.getRange("L5:L26").format.font = { color: C.black, bold: true };
seguimiento.getRange("C5:D26").format.numberFormat = "yyyy-mm-dd";
seguimiento.getRange("A5:L26").format.rowHeight = 72;
try {
  seguimiento.getRange("A5:L26").conditionalFormats.add("containsText", { text: "REVISAR YA", format: { fill: C.red } });
  seguimiento.getRange("A5:L26").conditionalFormats.add("containsText", { text: "PRÓXIMA", format: { fill: C.yellow } });
  seguimiento.getRange("A5:L26").conditionalFormats.add("containsText", { text: "PROGRAMADA", format: { fill: C.green } });
} catch {}
setTableStyle(seguimiento, "A4:L26", "FollowUpTable");
styleSection(seguimiento, "A29:L29", "Protocolo de revisión");
seguimiento.getRange("A30:B34").values = [
  ["1", "Cuando llegue la fecha, consulta primero el comunicado oficial y la presentación de resultados."],
  ["2", "Copia una nueva fila en Historial: no sobreescribas el periodo anterior."],
  ["3", "Actualiza precio, PER, EPS, ventas, crecimiento, FCF, deuda/caja y el dato operativo clave."],
  ["4", "Compara el dato nuevo con Qué debe mejorar y Condición de invalidación."],
  ["5", "Solo después cambia el veredicto/prioridad y deja constancia de la fuente y fecha."],
];
seguimiento.getRange("A30:A34").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
for (let row = 30; row <= 34; row += 1) seguimiento.mergeCells(`B${row}:L${row}`);
seguimiento.getRange("B30:L34").format.wrapText = true;
seguimiento.getRange("A30:B34").format.rowHeight = 34;
finishSheet(seguimiento, "A1:L34", 4);
const followWidths = { A: 24, B: 9, C: 14, D: 14, E: 23, F: 38, G: 36, H: 40, I: 40, J: 38, K: 20, L: 14 };
for (const [col, width] of Object.entries(followWidths)) seguimiento.getRange(`${col}:${col}`).format.columnWidth = width;

// -----------------------------------------------------------------------------
// Dossier profundo Kainos / Atalaya
// -----------------------------------------------------------------------------
const dossier = workbook.worksheets.add("Dossier_KN_ATYM");
styleTitle(dossier, "A1:J1", "Dossier profundo — Kainos y Atalaya Mining");
styleSubtitle(dossier, "A2:J2", "Corte 2026-08-05. Separa datos reportados, hipótesis editables y condiciones que invalidan la tesis. Las cifras de valoración son escenarios de trabajo, no objetivos oficiales.");

styleSection(dossier, "A4:J4", "Resumen comparativo");
dossier.getRange("A5:J5").values = [["Empresa", "Ticker", "Tipo Lynch", "Precio (GBX)", "PER actual", "Convicción (1-10)", "Potencial 10x (1-10)", "Decisión de trabajo", "Próxima revisión", "Fuentes base"]];
styleHeader(dossier, "A5:J5");
dossier.getRange("A6:J7").values = [
  [null, null, null, null, null, 8, 6, "Vigilar / entrada escalonada si mejora margen o baja precio", date("2026-09-07"), "KNOS-MKT / KNOS-FY26 / KNOS-CAL"],
  [null, null, null, null, null, 5, 8, "Esperar H1; potencial alto pero cíclico y dependiente de proyectos", date("2026-08-11"), "ATYM-MKT / ATYM-FY25 / ATYM-Q2-26 / ATYM-CAL"],
];
for (const [row, watchRow] of [[6, 15], [7, 5]]) {
  dossier.getRange(`A${row}:E${row}`).formulas = [[
    `='Watchlist'!A${watchRow}`,
    `='Watchlist'!B${watchRow}`,
    `='Watchlist'!D${watchRow}`,
    `='Watchlist'!G${watchRow}`,
    `='Watchlist'!I${watchRow}`,
  ]];
}
dossier.getRange("A6:E7").format.font = { color: C.link };
dossier.getRange("F6:H7").format.font = { color: C.input };
dossier.getRange("I6:I7").format.font = { color: C.link };
dossier.getRange("J6:J7").format.font = { color: C.input };
dossier.getRange("D6:D7").format.numberFormat = "0.00";
dossier.getRange("E6:E7").format.numberFormat = "0.00\"x\"";
dossier.getRange("F6:G7").format.numberFormat = "0";
dossier.getRange("I6:I7").format.numberFormat = "yyyy-mm-dd";
setTableStyle(dossier, "A5:J7", "DossierSummaryTable");

styleSection(dossier, "A9:J9", "Kainos — datos reportados y operativos");
dossier.getRange("A10:J10").values = [["Métrica", "Valor", "Unidad", "Crecimiento / comparativa", "Periodo", "Lectura Lynch", "Fuente ID", "Tipo", "Siguiente dato", "Estado"]];
styleHeader(dossier, "A10:J10");
dossier.getRange("A11:J29").values = [
  ["Ingresos", 431.1, "£m", 0.17, "FY26", "Crecimiento fuerte y visible", "KNOS-FY26", "Reportado", "Revenue FY27", "OK"],
  ["Beneficio ajustado antes de impuestos", 67.1, "£m", 0.02, "FY26", "El beneficio crece mucho menos que las ventas", "KNOS-FY26", "Reportado", "Adjusted PBT FY27", "VIGILAR"],
  ["Margen PBT ajustado", null, "%", null, "FY26", "Debe recuperarse con menor uso de contratistas", "KNOS-FY26", "Calculado", "Margen FY27", "VIGILAR"],
  ["BPA diluido ajustado", 41.1, "GBX", 0.07, "FY26", "Base para valorar; no confundir con BPA estatutario", "KNOS-FY26", "Reportado", "EPS FY27", "OK"],
  ["BPA diluido estatutario", 35.1, "GBX", 0.24, "FY26", "El PER LSE usa una cifra estatutaria distinta", "KNOS-FY26 / KNOS-MKT", "Reportado", "EPS y PER", "OK"],
  ["Bookings", 505.3, "£m", 0.32, "FY26", "Mejor indicador de demanda futura", "KNOS-FY26", "Reportado", "Bookings FY27", "OK"],
  ["Backlog contratado", 433.9, "£m", 0.18, "FY26", "Visibilidad; comprobar conversión a ventas y caja", "KNOS-FY26", "Reportado", "Backlog FY27", "VIGILAR"],
  ["ARR Workday Products", 89.0, "£m", 0.23, "FY26", "Motor de recurrencia y posible re-rating", "KNOS-FY26", "Reportado", "ARR hacia £100m", "OK"],
  ["Margen bruto Workday Products", 0.778, "%", "Alto", "FY26", "Economía atractiva, pero inversión todavía elevada", "KNOS-FY26", "Reportado", "Margen producto", "OK"],
  ["Clientes Workday Products", 700, "clientes", "41% usa ≥2 productos", "FY26", "Cross-sell apoya el valor por cliente", "KNOS-FY26", "Reportado", "Clientes / multi-producto", "OK"],
  ["Clientes multi-producto", 0.41, "%", "de clientes", "FY26", "Señal de profundidad de relación", "KNOS-FY26", "Reportado", "Penetración multi-producto", "VIGILAR"],
  ["Digital Services", 241.7, "£m", 0.23, "FY26", "Principal motor de crecimiento, pero intensivo en personas", "KNOS-FY26", "Reportado", "Revenue Digital", "OK"],
  ["Backlog Workday Services", 74.9, "£m", 0.26, "FY26", "Mejor visibilidad en servicios Workday", "KNOS-FY26", "Reportado", "Backlog Services", "OK"],
  ["Proyectos AI/data", 45.8, "£m", "19% de Digital Services", "FY26", "Oportunidad, pero mayoritariamente servicios, no SaaS puro", "KNOS-FY26", "Reportado", "Mix y margen AI", "VIGILAR"],
  ["Caja", 89.1, "£m", "vs £133.7m; recompras", "FY26", "Balance fuerte; vigilar uso de caja", "KNOS-FY26", "Reportado", "Caja y recompras", "OK"],
  ["Conversión de caja", 0.99, "%", "vs 112%", "FY26", "Buena, aunque menor que el año anterior", "KNOS-FY26", "Reportado", "Cash conversion", "OK"],
  ["Deuda", 0, "£m", "Sin deuda", "FY26", "Reduce riesgo financiero", "KNOS-FY26", "Reportado", "Deuda / caja", "OK"],
  ["Retención empleados", 0.90, "%", "vs 93%", "FY26", "Señal de calidad operativa a vigilar", "KNOS-FY26", "Reportado", "Retención", "VIGILAR"],
  ["NPS", 61, "puntos", "vs 70", "FY26", "Deterioro de satisfacción; puede anticipar presión en ejecución", "KNOS-FY26", "Reportado", "NPS", "VIGILAR"],
];
dossier.getRange("B13").formulas = [["=B12/B11"]];
dossier.getRange("A11:A29").format.font = { color: C.black };
dossier.getRange("B11:B29").format.font = { color: C.input };
dossier.getRange("C11:J29").format.font = { color: C.input };
dossier.getRange("B13").format.font = { color: C.black };
dossier.getRange("B11:B12").format.numberFormat = "#,##0.0";
dossier.getRange("B13").format.numberFormat = "0.0%";
dossier.getRange("B14:B15").format.numberFormat = "0.0";
dossier.getRange("B16:B18").format.numberFormat = "#,##0.0";
dossier.getRange("B19").format.numberFormat = "0.0%";
dossier.getRange("B20").format.numberFormat = "#,##0";
dossier.getRange("B21").format.numberFormat = "0.0%";
dossier.getRange("B22:B26").format.numberFormat = "#,##0.0";
dossier.getRange("B25").format.numberFormat = "#,##0.0";
dossier.getRange("B26").format.numberFormat = "0.0%";
dossier.getRange("B27").format.numberFormat = "#,##0.0";
dossier.getRange("B28").format.numberFormat = "0.0%";
dossier.getRange("B29").format.numberFormat = "0";
setTableStyle(dossier, "A10:J29", "KainosMetricsTable");

styleSection(dossier, "A31:J31", "Kainos — lectura Lynch y condiciones de tesis");
dossier.getRange("A32:J32").values = [["Criterio", "Evaluación", "Evidencia", "Freno / riesgo", "Catalizador", "Qué invalidaría", "Puntuación", "Convicción", "Fuente ID", "Próxima revisión"]];
styleHeader(dossier, "A32:J32");
dossier.getRange("A33:J39").values = [
  ["Categoría", "Fast grower / nicho", "ARR, bookings y backlog crecen", "Servicios intensivos en personas", "ARR Products ≥£100m", "ARR se frena y no hay conversión", 4, 8, "KNOS-FY26", date("2026-09-07")],
  ["Negocio entendible", "Sí", "Workday + servicios digitales", "Dependencia del ecosistema Workday", "Más productos por cliente", "Pérdida de partnership o concentración excesiva", 4, 8, "KNOS-FY26", date("2026-09-07")],
  ["Crecimiento de beneficios", "Mixto", "Revenue +17%; PBT ajustado +2%", "Márgenes bajan a 16%", "Sustituir contratistas y recuperar margen", "PBT sigue plano con ventas creciendo", 3, 7, "KNOS-FY26", date("2026-09-07")],
  ["Balance", "Fuerte", "Sin deuda; caja £89.1m", "Recompras reducen caja disponible", "Cash conversion ≥99%", "Caja consume sin retorno", 4, 9, "KNOS-FY26", date("2026-09-07")],
  ["Valoración", "Razonable, no ganga", "PER ~23x; PER ajustado ~20x", "Precio exige crecimiento", "Corrección o EPS al alza", "PER se mantiene alto con EPS plano", 3, 7, "KNOS-MKT / KNOS-FY26", date("2026-09-07")],
  ["10-bagger", "Difícil a corto plazo", "£945m de capitalización permite runway", "A 25x necesitaría ~328p BPA para 10x", "Products £200m ARR en 2030", "Crecimiento no escala", 2, 6, "KNOS-FY26", date("2026-09-07")],
  ["Veredicto", "Vigilar / entrada escalonada", "Calidad superior a Atalaya", "No perseguir precio", "Confirmación de margen en septiembre", "Tesis de margen y ARR rota", 4, 8, "KNOS-FY26 / KNOS-CAL", date("2026-09-07")],
];
dossier.getRange("A33:F39").format.font = { color: C.input };
dossier.getRange("G33:H39").format = { font: { color: C.input }, horizontalAlignment: "center" };
dossier.getRange("I33:J39").format.font = { color: C.link };
dossier.getRange("G33:H39").format.numberFormat = "0";
dossier.getRange("J33:J39").format.numberFormat = "yyyy-mm-dd";
setTableStyle(dossier, "A32:J39", "KainosLynchTable");

styleSection(dossier, "A41:J41", "Kainos — escenarios de valoración en GBX; supuestos editables");
dossier.getRange("A42:B42").values = [["Precio actual (GBX)", null]];
dossier.getRange("B42").formulas = [["='Watchlist'!G15"]];
dossier.getRange("D42:E42").values = [["Margen de seguridad", 0.20]];
dossier.getRange("G42:H42").values = [["Capitalización actual (GBP m)", null]];
dossier.getRange("H42").formulas = [["='Watchlist'!H15"]];
dossier.getRange("J42").values = [["BPA ajustado FY26: 41.1p; escenarios del analista"]];
dossier.getRange("A42:A42").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("D42:D42").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("G42:G42").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("B42").format.font = { color: C.link };
dossier.getRange("E42").format = { fill: C.yellow, font: { color: C.input } };
dossier.getRange("H42").format.font = { color: C.link };
dossier.getRange("B42").format.numberFormat = "0.00";
dossier.getRange("E42").format.numberFormat = "0.0%";
dossier.getRange("H42").format.numberFormat = "#,##0.0";
dossier.getRange("A44:J44").values = [["Escenario", "BPA normalizado (GBX)", "PER objetivo", "Precio razonable (GBX)", "Upside vs precio", "Margen seguridad", "Precio entrada (GBX)", "Capitalización x10 (GBP m)", "BPA necesario a PER 25x para 10x", "Nota"]];
styleHeader(dossier, "A44:J44");
dossier.getRange("A45:J47").values = [
  ["Pesimista", 38, 18, null, null, null, null, null, null, "Margen no recupera"],
  ["Base", 44, 22, null, null, null, null, null, null, "Recuperación moderada"],
  ["Optimista", 50, 25, null, null, null, null, null, null, "Products escala y margen mejora"],
];
for (let row = 45; row <= 47; row += 1) {
  dossier.getRange(`D${row}`).formulas = [[`=B${row}*C${row}`]];
  dossier.getRange(`E${row}`).formulas = [[`=D${row}/$B$42-1`]];
  dossier.getRange(`F${row}`).formulas = [["=$E$42"]];
  dossier.getRange(`G${row}`).formulas = [[`=D${row}*(1-F${row})`]];
  dossier.getRange(`H${row}`).formulas = [["=$H$42*10"]];
  dossier.getRange(`I${row}`).formulas = [["=$B$42*10/25"]];
}
dossier.getRange("B45:C47").format = { fill: C.yellow, font: { color: C.input }, horizontalAlignment: "right" };
dossier.getRange("D45:I47").format.font = { color: C.black };
dossier.getRange("J45:J47").format.font = { color: C.input };
dossier.getRange("B45:B47").format.numberFormat = "0.00";
dossier.getRange("C45:C47").format.numberFormat = "0.0\"x\"";
dossier.getRange("D45:D47").format.numberFormat = "0.00";
dossier.getRange("E45:F47").format.numberFormat = "0.0%";
dossier.getRange("G45:G47").format.numberFormat = "0.00";
dossier.getRange("H45:I47").format.numberFormat = "#,##0.0";
setTableStyle(dossier, "A44:J47", "KainosScenarioTable");
dossier.mergeCells("A49:J49");
dossier.getRange("A49").values = [["Nota: los BPA y PER de este bloque son supuestos editables. El precio de entrada no es una recomendación personalizada; cambia los supuestos solo después de documentar la fuente y el motivo."]];
dossier.getRange("A49:J49").format = { fill: C.yellow, font: { italic: true, color: C.darkGray }, wrapText: true };
dossier.getRange("A49:J49").format.rowHeight = 30;

styleSection(dossier, "A51:J51", "Atalaya Mining — datos reportados, operativos y recursos");
dossier.getRange("A52:J52").values = [["Métrica", "Valor", "Unidad", "Crecimiento / comparativa", "Periodo", "Lectura Lynch", "Fuente ID", "Tipo", "Siguiente dato", "Estado"]];
styleHeader(dossier, "A52:J52");
dossier.getRange("A53:J73").values = [
  ["Ingresos", 482.9, "€m", 0.478, "FY25", "Beneficio muy sensible al precio del cobre", "ATYM-FY25", "Reportado", "H1 2026", "OK"],
  ["Producción cobre", 51.139, "kt", "vs 46.227kt", "FY25", "Producción estable en activo existente", "ATYM-FY25", "Reportado", "Guía 50–54kt", "OK"],
  ["EBITDA", 179.8, "€m", 1.708, "FY25", "Crecimiento excepcional; no extrapolar sin cobre", "ATYM-FY25", "Reportado", "EBITDA H1", "VIGILAR"],
  ["Flujo de caja libre", 107.4, "€m", "FY25", "FY25", "Atractivo, pero revisar normalización", "ATYM-FY25", "Reportado", "FCF H1", "VIGILAR"],
  ["Cash costs", 2.40, "$/lb", "vs 2.92", "FY25", "Coste competitivo", "ATYM-FY25", "Reportado", "Cash cost H1", "OK"],
  ["AISC", 2.90, "$/lb", "vs 3.26", "FY25", "Buen margen operativo", "ATYM-FY25", "Reportado", "AISC H1", "OK"],
  ["Caja neta", 122.0, "€m", "Dic-25 / FY25", "FY25", "Balance permite financiar opcionalidad", "ATYM-FY25", "Reportado", "Caja H1", "OK"],
  ["Producción Q2", 13.493, "kt", "vs 9.939kt Q1", "Q2 2026", "Rebote operativo importante", "ATYM-Q2-26", "Reportado", "Q3 production", "OK"],
  ["Ley cobre Q2", 0.0039, "%", "vs 0.30% Q1", "Q2 2026", "Mejor ley; vigilar mezcla", "ATYM-Q2-26", "Reportado", "Ley Q3", "VIGILAR"],
  ["Recuperación Q2", 0.8391, "%", "vs 81.54% Q1", "Q2 2026", "Mejor recuperación", "ATYM-Q2-26", "Reportado", "Recovery Q3", "OK"],
  ["Cobre realizado Q2", 6.14, "$/lb", "vs 5.87 Q1", "Q2 2026", "Precio elevado; riesgo de normalización", "ATYM-Q2-26", "Reportado", "Precio realizado", "VIGILAR"],
  ["Inventario concentrado", 11.362, "kt", "vs 5.083kt Mar-26", "Q2 2026", "Caja y FCF pueden depender del timing de venta", "ATYM-Q2-26", "Reportado", "Inventario H1", "VIGILAR"],
  ["Caja neta Q2", 340.2, "€m", "Caja 351.2m; deuda 10.9m", "30-jun-26", "Muy positiva; confirmar en estados H1", "ATYM-Q2-26", "Reportado", "Net cash H1", "VIGILAR"],
  ["Guía producción FY26", "50–54", "kt", "La compañía espera parte baja", "FY26", "No asumir crecimiento de volumen", "ATYM-Q2-26", "Guidance", "Producción anual", "VIGILAR"],
  ["Guía cash costs FY26", "2.60–2.90", "$/lb", "Diesel/explosivos pueden añadir 0.15–0.20", "FY26", "Coste es el principal controlable", "ATYM-Q2-26", "Guidance", "Costes FY26", "VIGILAR"],
  ["Guía AISC FY26", "3.10–3.40", "$/lb", "Rango de la compañía", "FY26", "Umbral clave para la tesis", "ATYM-Q2-26", "Guidance", "AISC FY26", "VIGILAR"],
  ["Cerro Colorado P&P", 132.0, "Mt", "0.37% Cu; 0.49Mt Cu contenido", "Actual", "Reserva base; no sumar todos los recursos", "ATYM-RES", "Reserva", "Vida de mina / reemplazo", "OK"],
  ["San Dionisio M&I", 56.1, "Mt", "0.91% Cu + Zn/Pb; sin P&P actual", "Actual", "Palanca de ley, pero requiere de-risking", "ATYM-RES", "Recurso", "Estudio / permisos", "VIGILAR"],
  ["Masa Valverde M&I", 16.9, "Mt", "0.66% Cu + Zn/Pb/Au/Ag; permisos AAU/explotación", "Actual", "Opcionalidad más creíble por permisos", "ATYM-RES / ATYM-Q2-26", "Recurso", "Rampa / Board decision", "VIGILAR"],
  ["Touro P&P", 90.9, "Mt", "0.43% Cu; participación hasta 80%; DIA en preparación", "Actual", "Gran opcionalidad, no valor base", "ATYM-RES / ATYM-Q2-26", "Reserva / proyecto", "DIA, PIE y capex", "VIGILAR"],
  ["E-LIX", "Estable Q2", "tecnología", "Impairment €24.1m FY25", "Q2 2026", "Todavía no probado como motor económico", "ATYM-Q2-26 / ATYM-FY25", "Operativo", "Coste y rendimiento", "VIGILAR"],
];
dossier.getRange("A53:A73").format.font = { color: C.black };
dossier.getRange("B53:J73").format.font = { color: C.input };
dossier.getRange("B53:B56").format.numberFormat = "#,##0.0";
dossier.getRange("B57:B58").format.numberFormat = "0.00";
dossier.getRange("B59:B60").format.numberFormat = "#,##0.0";
dossier.getRange("B61:B62").format.numberFormat = "0.00%";
dossier.getRange("B63").format.numberFormat = "0.00";
dossier.getRange("B64:B65").format.numberFormat = "#,##0.0";
dossier.getRange("B66:B67").format.numberFormat = "#,##0.0";
dossier.getRange("B68:B72").format.numberFormat = "#,##0.0";
setTableStyle(dossier, "A52:J73", "AtalayaMetricsTable");

styleSection(dossier, "A75:J75", "Atalaya Mining — lectura Lynch y condiciones de tesis");
dossier.getRange("A76:J76").values = [["Criterio", "Evaluación", "Evidencia", "Freno / riesgo", "Catalizador", "Qué invalidaría", "Puntuación", "Convicción", "Fuente ID", "Próxima revisión"]];
styleHeader(dossier, "A76:J76");
dossier.getRange("A77:J83").values = [
  ["Categoría", "Asset play / cíclica", "Cobre + reservas + proyectos", "Precio del cobre domina el BPA", "H1 confirma caja y costes", "Cobre cae y AISC sube", 3, 5, "ATYM-FY25 / ATYM-Q2-26", date("2026-08-11")],
  ["Negocio entendible", "Sí, pero técnico", "Producción de cobre y concentrado", "Ley, recuperación, permisos", "Más toneladas / mejores leyes", "Producción persistentemente baja", 3, 6, "ATYM-Q2-26", date("2026-08-11")],
  ["Crecimiento", "Irregular", "FY25 EBITDA +171%; Q2 recovery", "Base comparativa y ciclo", "Masa Valverde / Touro", "Proyectos requieren dilución", 3, 5, "ATYM-Q2-26 / ATYM-RES", date("2026-08-11")],
  ["Balance", "Muy fuerte", "Caja neta Q2 €340.2m", "Capex de proyectos y working capital", "Financiar expansión sin deuda", "Caja se revierte o aparece ampliación", 4, 7, "ATYM-Q2-26", date("2026-08-11")],
  ["Valoración", "Aparentemente barata", "PER ~17x; FCF FY25 €107.4m", "BPA de cobre no es normalizado", "Cobre alto / FCF repetible", "PER sube al normalizar beneficios", 3, 5, "ATYM-MKT / ATYM-FY25", date("2026-08-11")],
  ["Runway", "Alto, pero no aprobado", "San Dionisio, PMV y Touro", "Recursos ≠ reservas económicas", "Permisos y decisión de rampa", "Permisos o estudios fallan", 4, 5, "ATYM-RES / ATYM-Q2-26", date("2026-08-11")],
  ["Veredicto", "Esperar H1", "Más asimetría que Kainos", "Menor previsibilidad", "Confirmar FCF/caja/AISC", "AISC >3.40 o cash burn", 3, 5, "ATYM-Q2-26 / ATYM-CAL", date("2026-08-11")],
];
dossier.getRange("A77:F83").format.font = { color: C.input };
dossier.getRange("G77:H83").format = { font: { color: C.input }, horizontalAlignment: "center" };
dossier.getRange("I77:J83").format.font = { color: C.link };
dossier.getRange("G77:H83").format.numberFormat = "0";
dossier.getRange("J77:J83").format.numberFormat = "yyyy-mm-dd";
setTableStyle(dossier, "A76:J83", "AtalayaLynchTable");

styleSection(dossier, "A85:J85", "Atalaya Mining — sensibilidad simplificada al cobre; supuestos editables");
dossier.getRange("A86:B86").values = [["Precio actual (GBX)", null]];
dossier.getRange("B86").formulas = [["='Watchlist'!G5"]];
dossier.getRange("D86:E86").values = [["Capitalización actual (GBP m)", null]];
dossier.getRange("E86").formulas = [["='Watchlist'!H5"]];
dossier.getRange("G86:H86").values = [["Producción base (kt)", 50]];
dossier.getRange("J86").values = [["AISC midpoint trabajo: $3.25/lb"]];
dossier.getRange("A86:A86").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("D86:D86").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("G86:G86").format = { fill: C.gray, font: { bold: true, color: C.navy } };
dossier.getRange("B86:E86").format.font = { color: C.link };
dossier.getRange("H86").format = { fill: C.yellow, font: { color: C.input } };
dossier.getRange("B86").format.numberFormat = "0.00";
dossier.getRange("E86").format.numberFormat = "#,##0.0";
dossier.getRange("H86").format.numberFormat = "#,##0.0";
dossier.getRange("A88:J88").values = [["Escenario", "Precio cobre ($/lb)", "AISC ($/lb)", "Producción (kt)", "Libras pagables (m)", "Spread ($/lb)", "Margen bruto pre-impuestos ($m)", "Cambio por $0.10/lb ($m)", "Caveat", "Fuente"]];
styleHeader(dossier, "A88:J88");
dossier.getRange("A89:J91").values = [
  ["Bajo", 4.50, 3.40, 50, null, null, null, null, "Simplificado; antes de impuestos, capex, tratamiento y FX", "ATYM-Q2-26"],
  ["Base", 5.50, 3.25, 50, null, null, null, null, "No es una previsión de la compañía", "ATYM-Q2-26"],
  ["Alto", 6.50, 3.10, 50, null, null, null, null, "Precio alto sostenido + ejecución", "ATYM-Q2-26"],
];
for (let row = 89; row <= 91; row += 1) {
  dossier.getRange(`E${row}`).formulas = [[`=D${row}*2.20462`]];
  dossier.getRange(`F${row}`).formulas = [[`=B${row}-C${row}`]];
  dossier.getRange(`G${row}`).formulas = [[`=E${row}*F${row}`]];
  dossier.getRange(`H${row}`).formulas = [[`=D${row}*2.20462*0.1`]];
}
dossier.getRange("B89:D91").format = { fill: C.yellow, font: { color: C.input }, horizontalAlignment: "right" };
dossier.getRange("E89:H91").format.font = { color: C.black };
dossier.getRange("I89:I91").format.font = { color: C.input };
dossier.getRange("J89:J91").format.font = { color: C.link };
dossier.getRange("B89:C91").format.numberFormat = "0.00";
dossier.getRange("D89:E91").format.numberFormat = "#,##0.0";
dossier.getRange("F89:F91").format.numberFormat = "0.00";
dossier.getRange("G89:H91").format.numberFormat = "#,##0.0";
setTableStyle(dossier, "A88:J91", "AtalayaCopperTable");
dossier.mergeCells("A93:J93");
dossier.getRange("A93").values = [["Sensibilidad: con 50kt, cada $0.10/lb de variación del cobre cambia el ingreso bruto teórico en unos $11.0m. No equivale a beneficio neto ni a valor por acción."]];
dossier.getRange("A93:J93").format = { fill: C.yellow, font: { italic: true, color: C.darkGray }, wrapText: true };
dossier.getRange("A93:J93").format.rowHeight = 30;

styleSection(dossier, "A95:J95", "Atalaya Mining — proyectos y opcionalidad; no sumar recursos como valor base");
dossier.getRange("A96:I96").values = [["Proyecto", "Estado actual", "Dato de recurso/reserva", "Catalizador", "Riesgo principal", "Impacto potencial", "Tratamiento Lynch", "Fuente ID", "Siguiente comprobación"]];
styleHeader(dossier, "A96:I96");
dossier.getRange("A97:I102").values = [
  ["Cerro Colorado", "En producción", "132Mt P&P; 0.37% Cu; 0.49Mt Cu", "Mantener producción y coste", "Precio/ley/recuperación", "Base de caja", "No poner en valor doble", "ATYM-RES / ATYM-Q2-26", "Producción y AISC H1"],
  ["San Dionisio", "Stripping / preparación", "56.1Mt M&I; 0.91% Cu; sin P&P actual", "Mejor ley y mezcla", "Permisos, capex y geotecnia", "Extiende runway", "Opcionalidad, no reserva base", "ATYM-RES / ATYM-Q2-26", "Estudio y permisos"],
  ["Masa Valverde", "Permisos concedidos; rampa", "16.9Mt M&I; 0.66% Cu + Zn/Pb/Au/Ag", "Board decision sobre acceso", "Capex, acceso y ejecución", "Expansión multiproducto", "Más creíble que Touro hoy", "ATYM-RES / ATYM-Q2-26", "Decisión de rampa"],
  ["Touro", "DIA en preparación; hasta 80%", "90.9Mt P&P; 0.43% Cu", "DIA, PIE, ingeniería y financiación", "Permisos, social, capex y socio", "Gran salto de producción", "Valor opcional, no base", "ATYM-RES / ATYM-Q2-26", "Permisos"],
  ["E-LIX", "Rendimiento estable Q2", "Tecnología de tratamiento", "Demostrar coste y otras concentraciones", "Impairment FY25 €24.1m", "Más recuperación/valor", "Tratar como turnaround técnico", "ATYM-Q2-26 / ATYM-FY25", "Coste y rendimiento"],
  ["Suecia / Lara", "Exploración / participación", "Exploración y stake Lara C$13.5m", "Ensayos y nuevos recursos", "Muy temprano; no base value", "Opcionalidad futura", "No asignar valoración material", "ATYM-Q2-26", "Resultados de exploración"],
];
dossier.getRange("A97:G102").format.font = { color: C.input };
dossier.getRange("H97:H102").format.font = { color: C.link };
dossier.getRange("I97:I102").format.font = { color: C.input };
setTableStyle(dossier, "A96:I102", "AtalayaProjectsTable");

styleSection(dossier, "A104:J104", "Plan de seguimiento común");
dossier.getRange("A105:J105").values = [["Fecha", "Empresa", "Evento", "Métricas", "Señal positiva", "Señal negativa", "Acción", "Estado", "Fuente IDs", "Nota"]];
styleHeader(dossier, "A105:J105");
dossier.getRange("A106:J109").values = [
  [date("2026-08-11"), "Atalaya Mining", "Resultados H1 2026", "Producción, AISC, FCF, caja, inventario", "Caja neta se mantiene y AISC ≤3.40/lb", "Caja se revierte, AISC >3.40 o guía peligra", "Añadir periodo a Registro; recalcular escenario", "PRÓXIMA", "ATYM-CAL / ATYM-Q2-26", "Primera revisión tras Q2"],
  [date("2026-09-07"), "Kainos Group", "Trading update FY27", "ARR, bookings, backlog, margen, cash conversion", "ARR hacia £100m y margen estabiliza/recupera", "ARR/backlog se frena o margen sigue cayendo", "Actualizar escenarios y precio de entrada", "PROGRAMADA", "KNOS-DEEP-CAL / KNOS-FY26", "Principal prueba de tesis"],
  [date("2026-10-15"), "Atalaya Mining", "Q3 operations update", "Producción, ley, recovery, inventario, coste", "Producción en ruta a ≥50kt y coste controlado", "Baja producción o nueva presión de costes", "Actualizar sensibilidad de cobre", "PROGRAMADA", "ATYM-CAL", "Control operativo antes de FY"],
  [date("2026-11-09"), "Kainos Group", "Interim FY27", "Ingresos, PBT, margen, ARR, caja, NPS", "Beneficio convierte crecimiento y retención mejora", "PBT plano, caja baja o NPS sigue deteriorando", "Decidir si subir/bajar prioridad", "PROGRAMADA", "KNOS-DEEP-CAL", "Cierre de la primera revisión"],
];
dossier.getRange("A106:A109").format.numberFormat = "yyyy-mm-dd";
dossier.getRange("A106:J109").format.font = { color: C.input };
dossier.getRange("H106:H109").format = { font: { bold: true, color: C.black } };
setTableStyle(dossier, "A105:J109", "DeepReviewTable");

try {
  workbook.comments.setSelf({ displayName: "Cesar" });
  workbook.comments.addThread({ cell: dossier.getRange("E42") }, "Supuesto editable: margen de seguridad del 20%. Cambiar solo si documentas el motivo.");
  workbook.comments.addThread({ cell: dossier.getRange("B45") }, "Supuesto de BPA normalizado del escenario pesimista; no es guidance de Kainos.");
  workbook.comments.addThread({ cell: dossier.getRange("B89") }, "Escenario de cobre para sensibilidad ilustrativa; no es una previsión de precio.");
  workbook.comments.addThread({ cell: dossier.getRange("C89") }, "AISC escenario editable. Contrastar con guidance y resultados H1.");
} catch {}
dossier.getRange("A1:J109").format.wrapText = true;
dossier.getRange("A1:J109").format.verticalAlignment = "center";
dossier.showGridLines = false;
dossier.freezePanes.freezeRows(5);
for (const [col, width] of Object.entries({ A: 28, B: 17, C: 18, D: 24, E: 18, F: 42, G: 26, H: 19, I: 34, J: 30 })) dossier.getRange(`${col}:${col}`).format.columnWidth = width;
for (const range of ["A5:J7", "A10:J29", "A32:J39", "A44:J47", "A52:J73", "A76:J83", "A88:J91", "A96:I102", "A105:J109"]) dossier.getRange(range).format.rowHeight = 44;
dossier.getRange("A10:J29").format.rowHeight = 40;
dossier.getRange("A52:J73").format.rowHeight = 40;
dossier.getRange("A32:J39").format.rowHeight = 52;
dossier.getRange("A76:J83").format.rowHeight = 52;
dossier.getRange("A96:I102").format.rowHeight = 58;
dossier.getRange("A105:J109").format.rowHeight = 58;

// Registro incremental para no sobrescribir revisiones anteriores
const registro = workbook.worksheets.add("Registro_KN_ATYM");
styleTitle(registro, "A1:M1", "Registro incremental — Kainos y Atalaya");
styleSubtitle(registro, "A2:M2", "Añade una fila en cada revisión. No edites las filas históricas: el objetivo es poder reconstruir qué sabíamos, qué cambió y por qué cambió el veredicto.");
registro.getRange("A4:M4").values = [["Fecha revisión", "Empresa", "Ticker", "Precio GBX", "PER", "BPA / métrica", "KPI operativo 1", "KPI operativo 2", "Caja neta / deuda", "Tesis / cambio", "Señal", "Acción siguiente", "Fuente IDs"]];
styleHeader(registro, "A4:M4");
registro.getRange("A5:M6").values = [
  [AS_OF, "Kainos Group", "KNOS", 820, 23.10, 41.1, "ARR £89m / +23%", "Backlog £433.9m / +18%", -89.1, "FY26: revenue +17%, PBT ajustado +2%; NPS 61 y retención 90%.", "Vigilar", "Revisar margen/ARR el 07-sep; actualizar escenario", "KNOS-MKT / KNOS-FY26 / KNOS-DEEP-CAL"],
  [AS_OF, "Atalaya Mining", "ATYM", 917, 17.29, 53.03, "Q2 13.493kt / recovery 83.91%", "Cobre realizado $6.14/lb; AISC FY26 3.10–3.40", -340.2, "Q2 recupera producción y caja; FY26 apunta a parte baja; Touro/PMV son opcionalidad.", "Esperar H1", "Revisar FCF, AISC, caja e inventario el 11-ago", "ATYM-MKT / ATYM-FY25 / ATYM-Q2-26 / ATYM-CAL"],
];
registro.getRange("A5:A6").format.numberFormat = "yyyy-mm-dd";
registro.getRange("D5:D6").format.numberFormat = "0.00";
registro.getRange("E5:E6").format.numberFormat = "0.00\"x\"";
registro.getRange("F5:F6").format.numberFormat = "0.00";
registro.getRange("I5:I6").format.numberFormat = "#,##0.0";
registro.getRange("A5:M6").format.font = { color: C.input };
registro.getRange("K5:K6").format = { fill: C.yellow, font: { bold: true, color: C.black } };
setTableStyle(registro, "A4:M6", "KNAtymRegisterTable");
styleSection(registro, "A9:M9", "Protocolo de actualización");
registro.getRange("A10:B14").values = [
  ["1", "Consulta primero el comunicado oficial y guarda la fecha del dato."],
  ["2", "Añade una fila nueva con precio, PER, EPS o métrica operativa, caja/deuda y fuente."],
  ["3", "Compara contra el Dossier: identifica qué mejoró, qué empeoró y qué quedó sin confirmar."],
  ["4", "Solo después cambia Ranking_10Bagger, Watchlist o la decisión provisional."],
  ["5", "Si la tesis se invalida, conserva el histórico y explica la salida en una nueva fila."],
];
registro.getRange("A10:A14").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
for (let row = 10; row <= 14; row += 1) registro.mergeCells(`B${row}:M${row}`);
registro.getRange("B10:M14").format.wrapText = true;
registro.getRange("A10:M14").format.rowHeight = 34;
registro.showGridLines = false;
registro.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 14, B: 22, C: 9, D: 12, E: 10, F: 14, G: 27, H: 33, I: 18, J: 54, K: 16, L: 42, M: 42 })) registro.getRange(`${col}:${col}`).format.columnWidth = width;
registro.getRange("A1:M14").format.wrapText = true;
registro.getRange("A1:M14").format.verticalAlignment = "center";

// Fuentes específicas del dossier
const sourcesDeep = workbook.worksheets.add("Fuentes_KN_ATYM");
styleTitle(sourcesDeep, "A1:H1", "Fuentes específicas — Kainos y Atalaya");
styleSubtitle(sourcesDeep, "A2:H2", "URLs en texto plano para poder auditar cada dato. Prioriza RNS, informes y páginas oficiales; las páginas de mercado son snapshots y deben actualizarse antes de decidir.");
sourcesDeep.getRange("A4:H4").values = [["Fuente ID", "Empresa", "Fecha", "Tipo", "Datos respaldados", "URL", "Calidad / limitación", "Uso en el dossier"]];
styleHeader(sourcesDeep, "A4:H4");
sourcesDeep.getRange("A5:H14").values = [
  ["KNOS-MKT", "Kainos Group", AS_OF, "Mercado", "Precio 820p, capitalización £945m, PER 23.1x, EPS y yield", "https://www.lse.co.uk/ShareFundamentals.html?share=Kainos-Group&shareprice=KNOS", "Snapshot LSE; cambia con el mercado", "Resumen y escenarios"],
  ["KNOS-FY26", "Kainos Group", date("2026-05-18"), "Resultados", "Ingresos, PBT ajustado, EPS, bookings, backlog, ARR, margen, caja, NPS y retención", "https://www.investegate.co.uk/announcement/rns/kainos-group--knos/full-year-results/9571881", "RNS de resultados; fuente primaria distribuida por RNS", "Métricas y lectura Lynch"],
  ["KNOS-RESULTS", "Kainos Group", AS_OF, "Resultados", "Índice oficial de informes, presentaciones e informe anual", "https://www.kainos.com/investor-relations/results-and-presentations", "Página oficial; usar para la versión más reciente", "Audit trail"],
  ["KNOS-DEEP-CAL", "Kainos Group", AS_OF, "Calendario", "Trading update 07-sep-2026, AGM y resultados interinos", "https://www.kainos.com/investor-relations/regulatory-news-and-events", "Calendario oficial/provisional", "Plan de revisión"],
  ["ATYM-MKT", "Atalaya Mining", AS_OF, "Mercado", "Precio 917p, capitalización £1.41bn, PER 17.3x, EPS y dividendo", "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&shareprice=ATYM", "Snapshot LSE; cambia con el mercado", "Resumen y registro"],
  ["ATYM-Q2-26", "Atalaya Mining", date("2026-07-14"), "Operativo", "Producción Q2, ley, recovery, cobre realizado, inventario, costes guía y caja neta", "https://www.investegate.co.uk/announcement/rns/atalaya-mining--atym/q2-2026-operations-update-/9666655", "RNS operativo; caja neta calculada como caja menos deuda", "Métricas Q2 y sensibilidad"],
  ["ATYM-FY25", "Atalaya Mining", date("2026-03-19"), "Resultados", "FY25 ingresos, producción, EBITDA, FCF, cash costs, AISC, EPS y caja", "https://www.investegate.co.uk/index.php/announcement/rns/atalaya-mining--atym/2025-annual-results/9481409", "Resultados anuales; cobre es cíclico", "Base histórica"],
  ["ATYM-RES", "Atalaya Mining", AS_OF, "Reservas / recursos", "Reservas y recursos de Cerro Colorado, San Dionisio, Masa Valverde y Touro", "https://atalayamining.com/operations/reserves-resources/", "Recursos no equivalen a reservas económicas ni permisos", "Opcionalidad de proyectos"],
  ["ATYM-CAL", "Atalaya Mining", AS_OF, "Calendario", "Resultados H1 11-ago-2026 y siguientes actualizaciones", "https://atalayamining.com/investors/financial-calendar/", "Fecha de control; confirmar cuando se publique", "Plan de revisión"],
  ["LYNCH-BOOK-PDF", "Peter Lynch", AS_OF, "Libro / marco", "Marco cualitativo de categorías, crecimiento, PER, balance y catalizadores", "C:/Users/Cesar/Desktop/desarrollador/finanzas/src/Un paso por delante de Wall Street.pdf", "Fuente local proporcionada por el usuario; no contiene datos actuales", "Criterios Lynch"],
];
sourcesDeep.getRange("A5:E14").format.font = { color: C.input };
sourcesDeep.getRange("F5:F14").format.font = { color: C.link };
sourcesDeep.getRange("G5:H14").format.font = { color: C.input };
sourcesDeep.getRange("C5:C14").format.numberFormat = "yyyy-mm-dd";
setTableStyle(sourcesDeep, "A4:H14", "DeepSourcesTable");
sourcesDeep.showGridLines = false;
sourcesDeep.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 18, B: 22, C: 14, D: 20, E: 52, F: 84, G: 42, H: 30 })) sourcesDeep.getRange(`${col}:${col}`).format.columnWidth = width;
sourcesDeep.getRange("A1:H14").format.wrapText = true;
sourcesDeep.getRange("A1:H14").format.verticalAlignment = "center";
sourcesDeep.getRange("A5:H14").format.rowHeight = 54;

// -----------------------------------------------------------------------------
// Nuevas candidatas — cribado inicial de 10 ideas
// -----------------------------------------------------------------------------
const newIdeas = workbook.worksheets.add("Nuevas_10");
styleTitle(newIdeas, "A1:AL1", "10 candidatas nuevas — cribado Lynch");
styleSubtitle(newIdeas, "A2:AL2", "Datos de corte 2026-08-05. Son ideas en fase de investigación: el score sirve para ordenar el trabajo, no para comprar automáticamente. Las cuentas pueden estar en GBP, USD o EUR; compara siempre la unidad indicada.");
newIdeas.getRange("A4:AL4").values = [[
  "Orden", "Empresa", "Ticker", "Bolsa", "Tipo Lynch", "Fecha salida", "Moneda / cuentas", "Precio GBX", "Capitalización (m)", "PER", "EPS", "Dividendo", "Yield", "Ventas / ingresos último (m)", "Crec. ventas", "Crec. EBITDA / beneficio", "FCF / CFO último (m)", "Deuda neta (+) / caja neta (-) (m)", "PEG heurístico*", "Catalizador / tesis", "Riesgo principal", "Próximo evento", "Próxima revisión", "Fuente mercado", "Fuente resultados", "Score Lynch prelim /16", "Score 10Bagger prelim /22", "Rating relativo", "Estado", "Comprensible", "Crecimiento", "PER / PEG", "Balance", "Catalizador", "Historial", "Tamaño / runway", "Riesgo / visibilidad", "Nota de datos"
]];
styleHeader(newIdeas, "A4:AL4");
const newIdeaRows = [
  [1, "Baltic Classifieds Group", "BCG", "LSE Main", "Nueva / compounder digital", date("2021-06-22"), "GBX / EUR", 182.90, 774.44, 19.54828, 9.356321, 3.3966, 0.01857, 88.5, 0.07, 0.07, 60.4, 46.2, null, "Marketplaces de anuncios clasificados en los bálticos: margen EBITDA 78%, caja operativa fuerte y recompra; Cenubanka.lv añade escala.", "Concentración geográfica, deuda usada para recompras, crecimiento moderado y sensibilidad a empleo/consumo.", "Resultados FY27: fecha pendiente", date("2026-09-30"), "BCG-MKT", "BCG-FY26 / BCG-RNS", null, null, null, null, 2, 2, 1, 1, 2, 2, 1, 1, "CFO y cash generation; net debt incluye leases y deuda de recompra."],
  [2, "Raspberry Pi Holdings", "RPI", "LSE Main", "Nueva / nicho tecnológico", date("2024-06-14"), "GBX / USD", 620.50, 1200.00, 74.47387, 8.331781, 0, 0, 323.2, 0.25, 0.63, null, -28.1, null, "Ecosistema Raspberry Pi con unidades de microcontroladores +47%, comunidad y expansión industrial; FY26 mantiene buen impulso.", "PER muy exigente, costes DRAM y visibilidad limitada; sin dividendo y riesgo de normalización tras la IPO.", "Próxima actualización: calendario pendiente", date("2026-09-30"), "RPI-MKT", "RPI-FY25", null, null, null, null, 2, 2, 0, 2, 2, 1, 2, 0, "FY25 en USD; no hay FCF comparable en la fuente resumida, sí caja neta de $28.1m."],
  [3, "Boku", "BOKU", "LSE AIM", "Nueva / fintech compounder", date("2017-11-20"), "GBX / USD", 103.50, 297.84, 34.84459, 2.970332, 0, 0, 128.8, 0.30, 0.36, 31.1, -102.9, null, "Pagos móviles y wallets: TPV +12%, Stripe, PIX/UPI y caja neta; mantiene una tesis de crecimiento orgánico >20% a medio plazo.", "La guía FY26 se rebajó por retrasos de onboarding y dual sourcing; margen EBITDA se ha comprimido.", "FY26: fecha pendiente", date("2026-10-15"), "BOKU-MKT", "BOKU-FY25 / BOKU-H1-26", null, null, null, null, 2, 2, 1, 2, 2, 2, 2, 0, "FY25 en USD; usar la guía FY26 $135–142m / EBITDA $38–42m en la siguiente revisión."],
  [4, "Tristel", "TSTL", "LSE AIM", "Nueva / defensiva de nicho", date("2005-06-01"), "GBX / GBP", 405.00, 215.99, 32.32759, 13.92, 13.96, 0.03102, 51.1, 0.10, 0.14, null, -16.0, null, "Desinfección hospitalaria: FY26 revenue +10%, PBT ajustado +14%, deuda cero y lanzamiento comercial de 3T Pro.", "Valoración alta para un nicho pequeño, ejecución comercial del producto nuevo y sucesión del CEO.", "FY26 final: estimación octubre", date("2026-10-19"), "TSTL-MKT", "TSTL-FY26", null, null, null, null, 2, 2, 1, 2, 2, 2, 2, 1, "Precio de mercado con snapshot volátil; validar con resultados finales y fecha oficial."],
  [5, "Bloomsbury Publishing", "BMY", "LSE Main", "Nueva / compounder de IP", null, "GBX / GBP", 630.00, 509.31, 19.02174, 33.12, 16.20, 0.02571, 325.9, -0.097, 0.07, 40.8, -29.2, null, "Academic & Professional crece 29%, caja neta, licencias/IA y catálogo con autores de larga duración.", "Consumer cae 21%, dependencia de lanzamientos y autores clave; ingresos totales retroceden aunque mejora el mix.", "Resultados FY27 / trading: fecha pendiente", date("2026-09-30"), "BMY-MKT", "BMY-FY26 / BMY-RPT", null, null, null, null, 2, 1, 2, 2, 2, 2, 1, 1, "Dividendo 16.20p propuesto en resultados; LSE mostraba 15.62p en el snapshot."],
  [6, "MONY Group", "MONY", "LSE Main", "Nueva / madura con caja", null, "GBX / GBP", 203.20, 1040.00, 13.28105, 15.30, 12.53, 0.06166, 227.1, 0.01, 0.01, 36.2, 31.8, null, "MoneySuperMarket y MoneySavingExpert: 2.5m miembros de SuperSaveClub, 19% de ingresos y fuerte dividendo.", "Crecimiento bajo, deuda neta sube y el negocio es sensible a competencia, regulación y ciclo de seguros/energía.", "FY26: fecha pendiente", date("2026-10-15"), "MONY-MKT", "MONY-H1-26", null, null, null, null, 2, 1, 2, 1, 2, 2, 1, 1, "H1 2026 en GBP; el crecimiento LFL fue 6%, frente a 1% reportado."],
  [7, "Supreme", "SUP", "LSE AIM", "Nueva / crecimiento y turnaround", null, "GBX / GBP", 139.00, 163.07, 9.025974, 15.40, 5.00, 0.03597, 270.2, 0.17, 0.00, 32.4, -7.5, null, "Bebidas y wellness crecen 60%, adquisiciones SlimFast/1001 y generación operativa de caja.", "Margen bruto cae al 29%, PBT ajustado -9% y EPS -23%; integración y apalancamiento pueden crear una trampa de valor.", "H1 FY27: fecha pendiente", date("2026-09-30"), "SUP-MKT", "SUP-FY26", null, null, null, null, 2, 2, 2, 1, 2, 1, 2, 1, "Caja neta ajustada £7.5m; statutory net debt £7.4m. Mantener ambas lecturas."],
  [8, "Craneware", "CRW", "LSE AIM", "Nueva / software sanitario", date("2007-09-13"), "GBX / USD", 1192.00, 408.11, 29.09732, 40.96598, 29.50, 0.02475, 205.0, 0.06, 0.10, null, -17.518, null, "Software de revenue integrity sanitaria: ARR $184.2m, NRR 103%, caja neta y posible recompra de $25m.", "El FY26 quedó por debajo de expectativas: contratos 340B y enterprise se desplazan a FY27; PER aún exigente.", "FY26 final: septiembre 2026", date("2026-09-30"), "CRW-MKT", "CRW-H1-26 / CRW-FY26-TRD", null, null, null, null, 2, 2, 1, 2, 2, 2, 2, 0, "FY26 revenue orientado a $205–208m; net cash usa cash ex-transit $40.947m menos borrowings $23.429m."],
  [9, "Oxford Metrics", "OMG", "LSE Main", "Nueva / nicho tecnológico", null, "GBX / GBP", 38.40, 42.98, -69.81818, -0.55, 3.25, 0.08464, 20.7, 0.03, null, 1.1, -31.7, null, "Motion Capture crece 10%, caja de £31.7m y posible recuperación de Vision Metrology cuando lleguen pedidos retrasados.", "Pérdidas, baja visibilidad y ejercicio extendido de 15 meses; PER no utilizable hasta volver a beneficios.", "Interim de 12 meses: 2026-12-31", date("2026-12-31"), "OMG-MKT", "OMG-H1-26", null, null, null, null, 1, 1, 1, 2, 2, 2, 2, 0, "H1 revenue £20.7m; la mejora del EBIT es pérdida menor, no crecimiento de beneficio comparable."],
  [10, "Nichols", "NICL", "LSE AIM", "Nueva / defensiva de marcas", date("2004-06-11"), "GBX / GBP", 986.00, 360.51, 16.81, 58.67, 33.70, 0.03418, 175.1, 0.013, 0.099, 13.8, -55.7, null, "Marcas Vimto y expansión internacional; FY25 beneficio operativo ajustado +10% y Q1 FY26 revenue +4.3%.", "Crecimiento moderado, consumo/FX y necesidad de comprobar que el crecimiento internacional compensa la madurez doméstica.", "FY26: fecha pendiente", date("2026-09-30"), "NICL-MKT", "NICL-FY25 / NICL-TRD", null, null, null, null, 2, 1, 2, 2, 1, 2, 1, 1, "PER 16.81x derivado de 986p / EPS FY25 58.67p; el snapshot LSE mostraba EPS antiguo."],
];
newIdeas.getRange("A5:AL14").values = newIdeaRows;
for (let row = 5; row <= 14; row += 1) {
  newIdeas.getRange("S" + row).formulas = [["=IF(AND(J" + row + ">0,P" + row + ">0),J" + row + "/(P" + row + "*100),\"\")"]];
  newIdeas.getRange("Z" + row).formulas = [["=SUM(AD" + row + ":AK" + row + ")"]];
  newIdeas.getRange("AA" + row).formulas = [["=Z" + row + "+IF(AND(O" + row + ">0,P" + row + ">0),1,0)+IF(P" + row + ">=0.15,1,0)+IF(R" + row + "<0,1,0)+IF(I" + row + "<=500,1,0)+IF(AND(J" + row + ">0,J" + row + "<=15),1,0)+IF(W" + row + "<=DATE(2026,11,3),1,0)"]];
  newIdeas.getRange("AB" + row).formulas = [["=IF(AA" + row + ">=18,\"A — profundizar\",IF(AA" + row + ">=15,\"B — vigilar con prioridad\",IF(AA" + row + ">=12,\"C — evidencia incompleta\",\"D — alto riesgo\")))"]];
  newIdeas.getRange("AC" + row).formulas = [["=IF(AA" + row + ">=18,\"Subir a análisis prioritario tras confirmar\",\"Mantener en cribado; no comprar por puntuación\")"]];
}
newIdeas.getRange("A5:R14").format.font = { color: C.input };
newIdeas.getRange("T5:Y14").format.font = { color: C.input };
newIdeas.getRange("AL5:AL14").format.font = { color: C.input };
newIdeas.getRange("S5:S14").format.font = { color: C.black };
newIdeas.getRange("Z5:AC14").format.font = { color: C.link };
newIdeas.getRange("F5:F14").format.numberFormat = "yyyy-mm-dd";
newIdeas.getRange("W5:W14").format.numberFormat = "yyyy-mm-dd";
newIdeas.getRange("H5:L14").format.numberFormat = "0.00";
newIdeas.getRange("I5:I14").format.numberFormat = "#,##0.00";
newIdeas.getRange("J5:J14").format.numberFormat = "0.00\"x\"";
newIdeas.getRange("M5:M14").format.numberFormat = "0.0%";
newIdeas.getRange("O5:P14").format.numberFormat = "0.0%";
newIdeas.getRange("R5:R14").format.numberFormat = "#,##0.0";
newIdeas.getRange("S5:S14").format.numberFormat = "0.00\"x\"";
newIdeas.getRange("Z5:AA14").format.numberFormat = "0";
setTableStyle(newIdeas, "A4:AL14", "NewIdeasTable");
newIdeas.showGridLines = false;
newIdeas.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 8, B: 25, C: 9, D: 12, E: 24, F: 13, G: 15, H: 11, I: 15, J: 10, K: 11, L: 11, M: 10, N: 16, O: 12, P: 18, Q: 15, R: 18, S: 13, T: 58, U: 58, V: 31, W: 14, X: 18, Y: 24, Z: 14, AA: 16, AB: 25, AC: 42, AD: 12, AE: 12, AF: 12, AG: 12, AH: 12, AI: 12, AJ: 12, AK: 14, AL: 54 })) newIdeas.getRange(col + ":" + col).format.columnWidth = width;
newIdeas.getRange("A1:AL14").format.wrapText = true;
newIdeas.getRange("A1:AL14").format.verticalAlignment = "center";
newIdeas.getRange("A5:AL14").format.rowHeight = 64;

// Ranking y seguimiento separado para las 10 nuevas
const newRanking = workbook.worksheets.add("Ranking_Nuevas10");
styleTitle(newRanking, "A1:M1", "Ranking preliminar — 10 candidatas nuevas");
styleSubtitle(newRanking, "A2:M2", "Orden relativo generado desde Nuevas_10. No se mezcla con el ranking principal hasta que cada idea tenga una revisión de resultados y valoración.");
newRanking.getRange("A4:M4").values = [[
  "Posición", "Empresa", "Ticker", "Score Lynch /16", "Score 10Bagger /22", "PER", "Crec. ventas", "Crec. EBITDA / beneficio", "Deuda neta (+) / caja neta (-)", "Catalizador", "Qué debe confirmar", "Próxima revisión", "Rating"
]];
styleHeader(newRanking, "A4:M4");
const rankMap = [8, 7, 11, 12, 14, 6, 10, 9, 5, 13];
newRanking.getRange("A5:A14").values = rankMap.map((_, index) => [index + 1]);
newRanking.getRange("B5:M14").formulas = rankMap.map((sourceRow) => [
  "='Nuevas_10'!B" + sourceRow,
  "='Nuevas_10'!C" + sourceRow,
  "='Nuevas_10'!Z" + sourceRow,
  "='Nuevas_10'!AA" + sourceRow,
  "='Nuevas_10'!J" + sourceRow,
  "='Nuevas_10'!O" + sourceRow,
  "='Nuevas_10'!P" + sourceRow,
  "='Nuevas_10'!R" + sourceRow,
  "='Nuevas_10'!T" + sourceRow,
  "='Nuevas_10'!U" + sourceRow,
  "='Nuevas_10'!W" + sourceRow,
  "='Nuevas_10'!AB" + sourceRow,
]);
newRanking.getRange("A5:A14").format = { fill: C.gray, font: { bold: true, color: C.navy }, horizontalAlignment: "center" };
newRanking.getRange("B5:C14").format.font = { color: C.link };
newRanking.getRange("D5:M14").format.font = { color: C.link };
newRanking.getRange("F5:F14").format.numberFormat = "0.00\"x\"";
newRanking.getRange("G5:H14").format.numberFormat = "0.0%";
newRanking.getRange("I5:I14").format.numberFormat = "#,##0.0";
newRanking.getRange("L5:L14").format.numberFormat = "yyyy-mm-dd";
setTableStyle(newRanking, "A4:M14", "NewRankingTable");
newRanking.showGridLines = false;
newRanking.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 10, B: 25, C: 9, D: 14, E: 17, F: 10, G: 13, H: 19, I: 18, J: 58, K: 58, L: 15, M: 28 })) newRanking.getRange(col + ":" + col).format.columnWidth = width;
newRanking.getRange("A1:M14").format.wrapText = true;
newRanking.getRange("A1:M14").format.verticalAlignment = "center";
newRanking.getRange("A5:M14").format.rowHeight = 52;

const newFollow = workbook.worksheets.add("Seguimiento_Nuevas10");
styleTitle(newFollow, "A1:N1", "Seguimiento — 10 candidatas nuevas");
styleSubtitle(newFollow, "A2:N2", "Cada fila es el siguiente control mínimo. Añade nuevas filas en futuras revisiones: conserva la foto histórica y anota qué dato confirmó o invalidó la tesis.");
newFollow.getRange("A4:N4").values = [[
  "Fecha revisión", "Empresa", "Ticker", "Evento / trigger", "Precio corte", "PER corte", "KPI a seguir", "Señal positiva", "Señal negativa", "Acción si positiva", "Acción si negativa", "Estado", "Fuente IDs", "Nota"
]];
styleHeader(newFollow, "A4:N4");
newFollow.getRange("A5:N14").values = [
  [date("2026-09-30"), "Baltic Classifieds Group", "BCG", "FY27 / actualización operativa", 182.90, 19.54828, "Revenue, EBITDA margin, CFO, leverage y buyback", "Crecimiento ≥5% y caja operativa sostiene inversión/recompras", "Margen baja o deuda aumenta sin crecimiento", "Subir a análisis prioritario", "Mantener en cribado y exigir margen", null, "BCG-MKT / BCG-FY26", "Comparar con 78% EBITDA margin FY26."],
  [date("2026-09-30"), "Raspberry Pi Holdings", "RPI", "Próximo trading update / FY26", 620.50, 74.47387, "Unidades, microcontroladores, margen y costes DRAM", "Crecimiento ≥20% y margen aguanta", "Costes DRAM erosionan margen o demanda se normaliza", "Esperar corrección o confirmar crecimiento excepcional", "No comprar por PER sin mejora de visibilidad", null, "RPI-MKT / RPI-FY25", "El PER exige crecimiento prolongado."],
  [date("2026-10-15"), "Boku", "BOKU", "Seguimiento de guía FY26", 103.50, 34.84459, "Revenue, TPV, margen EBITDA y onboarding", "Vuelve a acelerar y cumple $135–142m", "Otra rebaja o retrasos en onboarding", "Profundizar en escenario de crecimiento", "Revisar tesis; no promediar a ciegas", null, "BOKU-MKT / BOKU-H1-26", "Confirmar conversión de Stripe, PIX y UPI."],
  [date("2026-10-19"), "Tristel", "TSTL", "Resultados finales FY26 / 3T Pro", 405.00, 32.32759, "Revenue, PBT, cash, margen y adopción 3T Pro", "PBT ≥£11.5m y cash ≥£16m con buena adopción", "Guía débil o producto no escala", "Subir a análisis prioritario", "Esperar; valorar solo con crecimiento confirmado", null, "TSTL-MKT / TSTL-FY26", "Fecha estimada; verificar calendario oficial."],
  [date("2026-09-30"), "Bloomsbury Publishing", "BMY", "Primer control FY27", 630.00, 19.02174, "Academic & Professional, Consumer, cash y licencias", "AP crece y Consumer estabiliza", "Consumer sigue cayendo y erosiona caja", "Profundizar en valoración por segmentos", "Mantener en vigilancia", null, "BMY-MKT / BMY-FY26", "Separar calidad del catálogo de la caída Consumer."],
  [date("2026-10-15"), "MONY Group", "MONY", "Actualización FY26", 203.20, 13.28105, "Revenue LFL, EBITDA, miembros SuperSaveClub y deuda", "LFL ≥5% y deuda se estabiliza", "Crecimiento plano con deuda al alza", "Analizar como compounder de dividendos", "No perseguir yield si el crecimiento se deteriora", null, "MONY-MKT / MONY-H1-26", "Revisar retención y monetización de miembros."],
  [date("2026-09-30"), "Supreme", "SUP", "H1 FY27 / margen", 139.00, 9.025974, "Margen bruto, PBT, cash conversion y wellness", "Margen recupera >30% y wellness mantiene +20%", "Margen sigue cayendo o deuda aumenta", "Profundizar como turnaround", "Evitar trampa de PER bajo", null, "SUP-MKT / SUP-FY26", "Las adquisiciones deben mejorar mix y no solo ventas."],
  [date("2026-09-30"), "Craneware", "CRW", "FY26 final / 340B", 1192.00, 29.09732, "Revenue, EBITDA, ARR, NRR y contratos diferidos", "FY26 en guía y 340B pasa a FY27 con visibilidad", "Nueva rebaja o NRR <100%", "Actualizar escenario y valoración", "Esperar; no pagar múltiplo por crecimiento aplazado", null, "CRW-MKT / CRW-FY26-TRD", "El retraso puede ser temporal o estructural."],
  [date("2026-12-31"), "Oxford Metrics", "OMG", "Interim 12 meses", 38.40, -69.81818, "Revenue, EBIT, Motion Capture y Vision Metrology", "Vuelve a beneficio y convierte caja en crecimiento", "Pérdidas persistentes o caja cae rápido", "Revisar turnaround de nicho", "Mantener solo como opción especulativa", null, "OMG-MKT / OMG-H1-26", "El PER no sirve mientras el EPS sea negativo."],
  [date("2026-09-30"), "Nichols", "NICL", "FY26 / trading update", 986.00, 16.81, "Revenue, margen, internacional y caja", "Crecimiento >4% y cash sigue alto", "Estancamiento o presión de margen", "Profundizar como defensiva con dividendo", "Mantener en vigilancia", null, "NICL-MKT / NICL-FY25 / NICL-TRD", "PER derivado con EPS FY25; refrescar precio."],
];
for (let row = 5; row <= 14; row += 1) newFollow.getRange("L" + row).formulas = [["=IF(A" + row + "<=DATE(2026,8,5),\"ATENCIÓN\",\"PROGRAMADA\")"]];
newFollow.getRange("A5:A14").format.numberFormat = "yyyy-mm-dd";
newFollow.getRange("E5:E14").format.numberFormat = "0.00";
newFollow.getRange("F5:F14").format.numberFormat = "0.00\"x\"";
newFollow.getRange("A5:K14").format.font = { color: C.input };
newFollow.getRange("M5:N14").format.font = { color: C.input };
newFollow.getRange("L5:L14").format = { fill: C.yellow, font: { bold: true, color: C.black } };
setTableStyle(newFollow, "A4:N14", "NewFollowTable");
newFollow.showGridLines = false;
newFollow.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 15, B: 25, C: 9, D: 29, E: 12, F: 10, G: 39, H: 43, I: 43, J: 35, K: 35, L: 15, M: 28, N: 44 })) newFollow.getRange(col + ":" + col).format.columnWidth = width;
newFollow.getRange("A1:N14").format.wrapText = true;
newFollow.getRange("A1:N14").format.verticalAlignment = "center";
newFollow.getRange("A5:N14").format.rowHeight = 58;

const newHistory = workbook.worksheets.add("Historial_Nuevas10");
styleTitle(newHistory, "A1:Q1", "Historial inicial — 10 candidatas nuevas");
styleSubtitle(newHistory, "A2:Q2", "Snapshot inmutable del 2026-08-05. En cada revisión futura añade filas nuevas; no sustituyas esta fotografía inicial.");
newHistory.getRange("A4:Q4").values = [[
  "Fecha snapshot", "Empresa", "Ticker", "Precio GBX", "PER", "EPS", "Dividendo", "Yield", "Ventas / ingresos (m)", "Crec. ventas", "Crec. EBITDA / beneficio", "FCF / CFO (m)", "Deuda neta (+) / caja neta (-) (m)", "Score Lynch", "Score 10Bagger", "Tesis inicial", "Fuente IDs"
]];
styleHeader(newHistory, "A4:Q4");
newHistory.getRange("A5:Q14").values = [
  [AS_OF, "Baltic Classifieds Group", "BCG", 182.90, 19.54828, 9.356321, 3.3966, 0.01857, 88.5, 0.07, 0.07, 60.4, 46.2, 12, 14, "Marketplaces bálticos con margen excepcional, caja operativa y recompras.", "BCG-MKT / BCG-FY26 / BCG-RNS"],
  [AS_OF, "Raspberry Pi Holdings", "RPI", 620.50, 74.47387, 8.331781, 0, 0, 323.2, 0.25, 0.63, null, -28.1, 11, 15, "Comunidad y microcontroladores crecen, pero el precio exige mucha ejecución.", "RPI-MKT / RPI-FY25 / RPI-CAL"],
  [AS_OF, "Boku", "BOKU", 103.50, 34.84459, 2.970332, 0, 0, 128.8, 0.30, 0.36, 31.1, -102.9, 13, 18, "Pagos móviles y caja neta con crecimiento estructural; guía FY26 rebajada.", "BOKU-MKT / BOKU-FY25 / BOKU-H1-26"],
  [AS_OF, "Tristel", "TSTL", 405.00, 32.32759, 13.92, 13.96, 0.03102, 51.1, 0.10, 0.14, null, -16.0, 14, 18, "Nicho hospitalario rentable, deuda cero y 3T Pro como catalizador.", "TSTL-MKT / TSTL-FY26 / TSTL-CAL"],
  [AS_OF, "Bloomsbury Publishing", "BMY", 630.00, 19.02174, 33.12, 16.20, 0.02571, 325.9, -0.097, 0.07, 40.8, -29.2, 13, 15, "IP y Academic & Professional compensan parcialmente la caída Consumer.", "BMY-MKT / BMY-FY26 / BMY-RPT"],
  [AS_OF, "MONY Group", "MONY", 203.20, 13.28105, 15.30, 12.53, 0.06166, 227.1, 0.01, 0.01, 36.2, 31.8, 12, 15, "Marketplace de comparación con base de miembros y dividendo, pero crecimiento bajo.", "MONY-MKT / MONY-H1-26 / MONY-CAL"],
  [AS_OF, "Supreme", "SUP", 139.00, 9.025974, 15.40, 5.00, 0.03597, 270.2, 0.17, 0.00, 32.4, -7.5, 13, 17, "Bebidas/wellness crecen con PER bajo, aunque el margen y el beneficio se deterioraron.", "SUP-MKT / SUP-FY26 / SUP-IR"],
  [AS_OF, "Craneware", "CRW", 1192.00, 29.09732, 40.96598, 29.50, 0.02475, 205.0, 0.06, 0.10, null, -17.518, 13, 17, "ARR y NRR de software sanitario, con retraso de contratos que hay que separar de un problema estructural.", "CRW-MKT / CRW-H1-26 / CRW-FY26-TRD"],
  [AS_OF, "Oxford Metrics", "OMG", 38.40, -69.81818, -0.55, 3.25, 0.08464, 20.7, 0.03, null, 1.1, -31.7, 11, 13, "Caja y Motion Capture ofrecen opción, pero el negocio aún está en pérdidas.", "OMG-MKT / OMG-H1-26 / OMG-CAL"],
  [AS_OF, "Nichols", "NICL", 986.00, 16.81, 58.67, 33.70, 0.03418, 175.1, 0.013, 0.099, 13.8, -55.7, 12, 16, "Marca defensiva con caja y dividendo; el crecimiento es moderado.", "NICL-MKT / NICL-FY25 / NICL-TRD"],
];
newHistory.getRange("A5:A14").format.numberFormat = "yyyy-mm-dd";
newHistory.getRange("D5:G14").format.numberFormat = "0.00";
newHistory.getRange("E5:E14").format.numberFormat = "0.00\"x\"";
newHistory.getRange("H5:H14").format.numberFormat = "0.0%";
newHistory.getRange("J5:K14").format.numberFormat = "0.0%";
newHistory.getRange("M5:M14").format.numberFormat = "#,##0.0";
newHistory.getRange("A5:Q14").format.font = { color: C.input };
setTableStyle(newHistory, "A4:Q14", "NewHistoryTable");
newHistory.showGridLines = false;
newHistory.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 15, B: 25, C: 9, D: 12, E: 10, F: 11, G: 12, H: 10, I: 16, J: 12, K: 19, L: 14, M: 20, N: 12, O: 16, P: 58, Q: 32 })) newHistory.getRange(col + ":" + col).format.columnWidth = width;
newHistory.getRange("A1:Q14").format.wrapText = true;
newHistory.getRange("A1:Q14").format.verticalAlignment = "center";
newHistory.getRange("A5:Q14").format.rowHeight = 52;

const newSources = workbook.worksheets.add("Fuentes_Nuevas10");
styleTitle(newSources, "A1:H1", "Fuentes — 10 candidatas nuevas");
styleSubtitle(newSources, "A2:H2", "Cada dato clave tiene una fuente identificable. Mercado = snapshot; resultados/RNS = fuente primaria o distribuida del emisor. Las URLs deben volver a comprobarse en cada revisión.");
newSources.getRange("A4:H4").values = [["Fuente ID", "Empresa", "Fecha", "Tipo", "Datos respaldados", "URL", "Calidad / limitación", "Uso en el modelo"]];
styleHeader(newSources, "A4:H4");
newSources.getRange("A5:H34").values = [
  ["BCG-MKT", "Baltic Classifieds Group", AS_OF, "Mercado", "Precio 182.90p, capitalización £774.44m, PER 19.55x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=BCG", "Snapshot LSE; cambia con el mercado", "Precio, PER y tamaño"],
  ["BCG-FY26", "Baltic Classifieds Group", date("2026-07-02"), "Resultados", "Revenue €88.5m, EBITDA €68.6m, margen 78%, CFO €60.4m, net debt €46.2m, recompra", "https://balticclassifieds.com/static/results/bcg-full-year-results-2026.pdf", "PDF oficial FY26; unidades EUR", "Tesis y score"],
  ["BCG-RNS", "Baltic Classifieds Group", date("2026-07-02"), "RNS", "Resultados FY26 y adquisición Cenubanka.lv", "https://www.investegate.co.uk/announcement/rns/baltic-classifieds-group--bcg/final-results/9648416", "RNS distribuido; contrastar con PDF", "Catalizador y próxima revisión"],
  ["RPI-MKT", "Raspberry Pi Holdings", AS_OF, "Mercado", "Precio 620.50p, capitalización £1.20bn, PER 74.47x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=RPI", "Snapshot LSE; múltiplo muy sensible al precio", "Precio y valoración"],
  ["RPI-FY25", "Raspberry Pi Holdings", date("2026-03-26"), "Resultados", "FY25 revenue $323.2m, PBT $26.5m, EBITDA ajustado $46.4m, caja neta $28.1m, microcontroladores +47%", "https://investors.raspberrypi.com/reports/11/document", "Informe oficial; unidades USD", "Crecimiento y balance"],
  ["RPI-CAL", "Raspberry Pi Holdings", AS_OF, "Calendario", "Página para siguiente actualización y fechas de resultados", "https://investors.raspberrypi.com/financial-calendar", "Calendario oficial; verificar fecha nueva", "Plan de revisión"],
  ["BOKU-MKT", "Boku", AS_OF, "Mercado", "Precio 103.50p, capitalización £297.84m, PER 34.84x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=BOKU", "Snapshot LSE; cambia con el mercado", "Precio y valoración"],
  ["BOKU-FY25", "Boku", date("2026-03-04"), "Resultados", "FY25 revenue $128.8m, EBITDA ajustado $41.3m, FCF $31.1m, caja $102.9m", "https://wp-boku-investors-2024.s3.eu-west-2.amazonaws.com/media/2026/03/Boku_FY-2025-Results.pdf", "Presentación oficial; unidades USD", "Tesis de crecimiento"],
  ["BOKU-H1-26", "Boku", date("2026-07-08"), "Trading update", "H1 revenue $66.5m, TPV $8.3bn, guía FY26 $135–142m y EBITDA $38–42m, recompra", "https://www.investegate.co.uk/announcement/rns/boku-inc-di-reg-s-cat-3-144a--boku/trading-update/9657188", "RNS; guía rebajada y riesgo de ejecución", "Riesgo y siguiente revisión"],
  ["TSTL-MKT", "Tristel", AS_OF, "Mercado", "Precio de referencia 405p, capitalización £215.99m, PER 32.33x, EPS/dividendo", "https://www.lse.co.uk/ShareFundamentals.html?share=Tristel&shareprice=TSTL", "Snapshot con volatilidad; validar precio antes de actuar", "Precio y valoración"],
  ["TSTL-FY26", "Tristel", date("2026-07-22"), "Trading update", "FY26 revenue £51.1m, PBT ajustado ≥£11.5m, deuda cero, cash £16.0m, lanzamiento 3T Pro", "https://www.investegate.co.uk/announcement/rns/tristel--tstl/positive-trading-update/9680616", "RNS positivo; resultados finales deben confirmar", "Tesis y catalizador"],
  ["TSTL-CAL", "Tristel", date("2026-07-24"), "Calendario", "Precio 400/410p y fecha estimada de resultados finales octubre 2026", "https://www.fidelity.co.uk/factsheet-data/factsheet/GB00B07RVT99-tristel/news-key-dates-and-documents", "Tercero; fecha estimada, no sustituye RNS", "Próxima revisión"],
  ["BMY-MKT", "Bloomsbury Publishing", AS_OF, "Mercado", "Precio 630p, capitalización £509.31m, PER 19.02x, EPS y dividendo", "https://www.lse.co.uk/SharePrice.html?shareprice=BMY", "Snapshot LSE; dividendo mostrado puede diferir del propuesto", "Precio y valoración"],
  ["BMY-FY26", "Bloomsbury Publishing", date("2026-05-20"), "Resultados", "FY26 revenue £325.9m, PBT ajustado £44.9m, caja neta £29.2m, AP +29%, Consumer -21%", "https://www.bloomsbury-ir.co.uk/financial/f_latest.asp", "Página oficial de resultados", "Tesis y riesgos"],
  ["BMY-RPT", "Bloomsbury Publishing", date("2026-05-20"), "Informe", "Preliminary results FY26 y conciliaciones contables", "https://www.bloomsbury-ir.co.uk/docs/librariesprovider16/archives/annual_reports/prelim26.pdf", "PDF oficial; comprobar versión más reciente", "Audit trail"],
  ["MONY-MKT", "MONY Group", AS_OF, "Mercado", "Precio 203.20p, capitalización £1.04bn, PER 13.28x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=moneysupermarketcom_group&shareprice=MONY", "Snapshot LSE; cambia con el mercado", "Precio y valoración"],
  ["MONY-H1-26", "MONY Group", AS_OF, "Resultados", "H1 revenue £227.1m, EBITDA ajustado £75.5m, miembros 2.5m, deuda neta £31.8m", "https://www.monygroup.com/investors/results-reports-and-presentations/interim-results-2026/", "Página oficial H1; crecimiento reportado y LFL difieren", "Tesis y riesgos"],
  ["MONY-CAL", "MONY Group", AS_OF, "Calendario", "Fechas de próximas publicaciones y eventos", "https://www.monygroup.com/investors/financial-calendar/", "Calendario oficial; verificar actualización", "Plan de revisión"],
  ["SUP-MKT", "Supreme", AS_OF, "Mercado", "Precio 139p, capitalización £163.07m, PER 9.03x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?shareprice=SUP", "Snapshot LSE; PER bajo puede reflejar deterioro", "Precio y valoración"],
  ["SUP-FY26", "Supreme", date("2026-07-01"), "Resultados", "FY26 revenue £270.2m, EBITDA £40.6m, PBT ajustado £27.5m, cash net £7.5m, wellness +60%", "https://www.lse.co.uk/rns/SUP/final-results-x9qlkgt9iwvmpg8.html?mobile_view=desktop", "RNS/resultados; fuente distribuida", "Tesis y riesgos"],
  ["SUP-IR", "Supreme", AS_OF, "IR / seguimiento", "Referencia para nuevos anuncios y documentación del emisor", "https://www.lse.co.uk/rns/SUP/final-results-x9qlkgt9iwvmpg8.html?mobile_view=desktop", "No hay calendario separado en el dossier; misma RNS como punto de entrada", "Próxima revisión"],
  ["CRW-MKT", "Craneware", AS_OF, "Mercado", "Precio 1192p, capitalización £408.11m, PER 29.10x, EPS y yield", "https://www.lse.co.uk/SharePrice.html?share=Craneware&shareprice=CRW", "Snapshot LSE; cambia con el mercado", "Precio y valoración"],
  ["CRW-H1-26", "Craneware", date("2026-02-26"), "Resultados", "H1 revenue $105.7m, EBITDA ajustado $33.4m, ARR $184.2m, NRR 103%, net cash $17.5m", "https://www.investegate.co.uk/announcement/rns/craneware--crw/fy26-interim-results/9452145", "RNS; unidades USD y net cash ex transit", "Base operativa"],
  ["CRW-FY26-TRD", "Craneware", date("2026-07-07"), "Trading update", "FY26 revenue $205–208m, EBITDA $65–67m; contratos 340B/enterprise desplazados a FY27", "https://www.investegate.co.uk/announcement/rns/craneware--crw/fy26-trading-update/9650668", "RNS negativo; fecha exacta de resultados septiembre", "Riesgo y revisión"],
  ["OMG-MKT", "Oxford Metrics", AS_OF, "Mercado", "Precio 38.40p, capitalización £42.98m, PER negativo, EPS -0.55p, yield", "https://www.lse.co.uk/SharePrice.html?share=Oxford-metrics&shareprice=OMG", "Snapshot LSE; PER no comparable con pérdidas", "Precio y valoración"],
  ["OMG-H1-26", "Oxford Metrics", date("2026-05-28"), "Resultados", "H1 revenue £20.7m, EBIT ajustado -£0.2m, cash £31.7m, Motion Capture +10%", "https://oxfordmetrics.com/rnsannoucements/2067153", "RNS oficial; ejercicio extendido 15 meses", "Tesis y riesgo"],
  ["OMG-CAL", "Oxford Metrics", AS_OF, "Resultados / calendario", "Financials y próxima actualización de 12 meses al 31-dic-2026", "https://oxfordmetrics.com/financials", "Página oficial; confirmar fecha cuando se publique", "Plan de revisión"],
  ["NICL-MKT", "Nichols", AS_OF, "Mercado", "Precio 986p, capitalización £360.51m, PER derivado 16.81x con EPS FY25", "https://www.lse.co.uk/ShareFundamentals.html?shareprice=NICL", "Snapshot LSE parece usar EPS antiguo; PER recalculado", "Precio y valoración"],
  ["NICL-FY25", "Nichols", date("2026-03-17"), "Resultados", "FY25 revenue £175.1m, PBT ajustado £33.6m, EPS 58.67p, cash £55.7m, DPS 33.7p", "https://www.lse.co.uk/rns/NICL/2025-preliminary-results-u6b7jwyi70w7o8g.html?mobile_view=desktop", "RNS/resultados; fuente distribuida", "Tesis y balance"],
  ["NICL-TRD", "Nichols", AS_OF, "Trading update", "Q1 FY26 revenue £41m, +4.3%", "https://www.lse.co.uk/rns/agm-trading-update-ahd2ud75sklij6l.html", "Trading update; confirmar próxima fecha", "Catalizador y revisión"],
];
newSources.getRange("C5:C34").format.numberFormat = "yyyy-mm-dd";
newSources.getRange("A5:E34").format.font = { color: C.input };
newSources.getRange("F5:F34").format.font = { color: C.link };
newSources.getRange("G5:H34").format.font = { color: C.input };
setTableStyle(newSources, "A4:H34", "NewSourcesTable");
newSources.showGridLines = false;
newSources.freezePanes.freezeRows(4);
for (const [col, width] of Object.entries({ A: 18, B: 25, C: 14, D: 20, E: 58, F: 86, G: 45, H: 30 })) newSources.getRange(col + ":" + col).format.columnWidth = width;
newSources.getRange("A1:H34").format.wrapText = true;
newSources.getRange("A1:H34").format.verticalAlignment = "center";
newSources.getRange("A5:H34").format.rowHeight = 50;

// -----------------------------------------------------------------------------
// Agenda central del libro maestro
// -----------------------------------------------------------------------------
const agenda = workbook.worksheets.add("Agenda_Revision");
styleTitle(agenda, "A1:S1", "Agenda central — qué revisar para decidir");
styleSubtitle(agenda, "A2:S2", "Esta es la hoja de entrada para futuras revisiones. Reúne las 22 compañías principales y las 10 nuevas con fechas, métricas, señales, fuentes, notas y ranking. Filtra por fecha o estado; después actualiza la hoja de origen y conserva el histórico.");
styleSection(agenda, "A4:B4", "Resumen");
agenda.getRange("A5:B8").values = [
  ["Revisar ya", null],
  ["Próximas 30 días", null],
  ["Total compañías", null],
  ["Fecha de corte", AS_OF],
];
agenda.getRange("B5").formulas = [["=COUNTIF(O11:O42,\"REVISAR YA\")"]];
agenda.getRange("B6").formulas = [["=COUNTIF(O11:O42,\"PRÓXIMA\")"]];
agenda.getRange("B7").formulas = [["=COUNTA(B11:B42)"]];
agenda.getRange("A5:A8").format = { fill: C.gray, font: { bold: true, color: C.navy } };
agenda.getRange("B5:B8").format = { fill: C.paleBlue, font: { bold: true, color: C.black }, horizontalAlignment: "center" };
agenda.getRange("B8").format.numberFormat = "yyyy-mm-dd";
styleSection(agenda, "D4:S4", "Cómo trabajar mañana");
const agendaInstructions = [
  "1. Empieza por las filas con estado REVISAR YA y abre la fuente oficial del evento.",
  "2. Compara precio, PER, crecimiento, FCF/caja, deuda y KPI contra la señal positiva/negativa.",
  "3. Añade la nueva foto en Historial o Registro; no borres el dato anterior.",
  "4. Solo después cambia veredicto, prioridad o rating. La puntuación es una ayuda, no una orden de compra.",
];
for (let row = 5; row <= 8; row += 1) {
  agenda.mergeCells("D" + row + ":S" + row);
  agenda.getRange("D" + row).values = [[agendaInstructions[row - 5]]];
}
agenda.getRange("D5:S8").format = { fill: C.lightBlue, font: { color: C.black }, wrapText: true, verticalAlignment: "center" };
agenda.getRange("D5:S8").format.rowHeight = 24;
agenda.getRange("A10:S10").values = [[
  "Próxima revisión", "Empresa", "Ticker", "Origen", "Tipo / categoría", "Evento / fuente", "Última revisión", "Precio corte", "PER corte", "Métricas a seguir", "Señal positiva", "Señal negativa", "Acción positiva / siguiente", "Condición negativa / acción", "Estado", "Fuente IDs", "Nota / pendiente", "Score 10Bagger", "Rating"
]];
styleHeader(agenda, "A10:S10");
const agendaMap = [
  { origin: "Principal", followRow: 9, watchRow: 9, rankingRow: 15 },
  { origin: "Principal", followRow: 21, watchRow: 21, rankingRow: 11 },
  { origin: "Principal", followRow: 25, watchRow: 25, rankingRow: 13 },
  { origin: "Principal", followRow: 16, watchRow: 16, rankingRow: 10 },
  { origin: "Principal", followRow: 5, watchRow: 5, rankingRow: 7 },
  { origin: "Principal", followRow: 7, watchRow: 7, rankingRow: 5 },
  { origin: "Principal", followRow: 22, watchRow: 22, rankingRow: 14 },
  { origin: "Principal", followRow: 10, watchRow: 10, rankingRow: 16 },
  { origin: "Principal", followRow: 17, watchRow: 17, rankingRow: 12 },
  { origin: "Principal", followRow: 15, watchRow: 15, rankingRow: 6 },
  { origin: "Principal", followRow: 19, watchRow: 19, rankingRow: 21 },
  { origin: "Nuevas_10", followRow: 5, ideaRow: 5 },
  { origin: "Nuevas_10", followRow: 6, ideaRow: 6 },
  { origin: "Nuevas_10", followRow: 9, ideaRow: 9 },
  { origin: "Nuevas_10", followRow: 11, ideaRow: 11 },
  { origin: "Nuevas_10", followRow: 12, ideaRow: 12 },
  { origin: "Nuevas_10", followRow: 14, ideaRow: 14 },
  { origin: "Nuevas_10", followRow: 7, ideaRow: 7 },
  { origin: "Nuevas_10", followRow: 10, ideaRow: 10 },
  { origin: "Nuevas_10", followRow: 8, ideaRow: 8 },
  { origin: "Principal", followRow: 12, watchRow: 12, rankingRow: 20 },
  { origin: "Principal", followRow: 6, watchRow: 6, rankingRow: 26 },
  { origin: "Principal", followRow: 11, watchRow: 11, rankingRow: 24 },
  { origin: "Principal", followRow: 13, watchRow: 13, rankingRow: 19 },
  { origin: "Principal", followRow: 18, watchRow: 18, rankingRow: 23 },
  { origin: "Principal", followRow: 20, watchRow: 20, rankingRow: 22 },
  { origin: "Principal", followRow: 14, watchRow: 14, rankingRow: 25 },
  { origin: "Principal", followRow: 24, watchRow: 24, rankingRow: 18 },
  { origin: "Principal", followRow: 26, watchRow: 26, rankingRow: 8 },
  { origin: "Principal", followRow: 23, watchRow: 23, rankingRow: 17 },
  { origin: "Principal", followRow: 8, watchRow: 8, rankingRow: 9 },
  { origin: "Nuevas_10", followRow: 13, ideaRow: 13 },
];
const agendaStart = 11;
const agendaEnd = agendaStart + agendaMap.length - 1;
agenda.getRange("D" + agendaStart + ":D" + agendaEnd).values = agendaMap.map((item) => [item.origin]);
function writeAgendaColumn(column, formulaList) {
  agenda.getRange(column + agendaStart + ":" + column + agendaEnd).formulas = formulaList.map((formula) => [formula]);
}
writeAgendaColumn("A", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!D" + item.followRow : "='Seguimiento_Nuevas10'!A" + item.followRow));
writeAgendaColumn("B", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!A" + item.followRow : "='Seguimiento_Nuevas10'!B" + item.followRow));
writeAgendaColumn("C", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!B" + item.followRow : "='Seguimiento_Nuevas10'!C" + item.followRow));
writeAgendaColumn("E", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!E" + item.followRow : "='Nuevas_10'!E" + item.ideaRow));
writeAgendaColumn("F", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!K" + item.followRow : "='Seguimiento_Nuevas10'!D" + item.followRow));
writeAgendaColumn("G", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!C" + item.followRow : "='Historial_Nuevas10'!A" + item.ideaRow));
writeAgendaColumn("H", agendaMap.map((item) => item.origin === "Principal" ? "='Watchlist'!G" + item.watchRow : "='Seguimiento_Nuevas10'!E" + item.followRow));
writeAgendaColumn("I", agendaMap.map((item) => item.origin === "Principal" ? "='Watchlist'!I" + item.watchRow : "='Seguimiento_Nuevas10'!F" + item.followRow));
writeAgendaColumn("J", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!F" + item.followRow : "='Seguimiento_Nuevas10'!G" + item.followRow));
writeAgendaColumn("K", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!H" + item.followRow : "='Seguimiento_Nuevas10'!H" + item.followRow));
writeAgendaColumn("L", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!I" + item.followRow : "='Seguimiento_Nuevas10'!I" + item.followRow));
writeAgendaColumn("M", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!J" + item.followRow : "='Seguimiento_Nuevas10'!J" + item.followRow));
writeAgendaColumn("N", agendaMap.map((item) => item.origin === "Principal" ? "=\"Reevaluar / no comprar si: \"&'Seguimiento'!I" + item.followRow : "='Seguimiento_Nuevas10'!K" + item.followRow));
writeAgendaColumn("O", agendaMap.map((item, index) => "=IF(A" + (agendaStart + index) + "<=DATE(2026,8,5),\"REVISAR YA\",IF(A" + (agendaStart + index) + "<=DATE(2026,9,4),\"PRÓXIMA\",\"PROGRAMADA\"))"));
writeAgendaColumn("P", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!K" + item.followRow : "='Seguimiento_Nuevas10'!M" + item.followRow));
writeAgendaColumn("Q", agendaMap.map((item) => item.origin === "Principal" ? "='Seguimiento'!G" + item.followRow : "='Seguimiento_Nuevas10'!N" + item.followRow));
writeAgendaColumn("R", agendaMap.map((item) => item.origin === "Principal" ? "='Ranking_10Bagger'!M" + item.rankingRow : "='Nuevas_10'!AA" + item.ideaRow));
writeAgendaColumn("S", agendaMap.map((item) => item.origin === "Principal" ? "='Ranking_10Bagger'!O" + item.rankingRow : "='Nuevas_10'!AB" + item.ideaRow));
agenda.getRange("A" + agendaStart + ":S" + agendaEnd).format.font = { color: C.link };
agenda.getRange("D" + agendaStart + ":D" + agendaEnd).format.font = { color: C.black, bold: true };
agenda.getRange("O" + agendaStart + ":O" + agendaEnd).format = { fill: C.yellow, font: { color: C.black, bold: true } };
agenda.getRange("A" + agendaStart + ":A" + agendaEnd).format.numberFormat = "yyyy-mm-dd";
agenda.getRange("G" + agendaStart + ":G" + agendaEnd).format.numberFormat = "yyyy-mm-dd";
agenda.getRange("H" + agendaStart + ":I" + agendaEnd).format.numberFormat = "0.00";
agenda.getRange("R" + agendaStart + ":R" + agendaEnd).format.numberFormat = "0";
try {
  agenda.getRange("O" + agendaStart + ":O" + agendaEnd).conditionalFormats.add("containsText", { text: "REVISAR YA", format: { fill: C.red } });
  agenda.getRange("O" + agendaStart + ":O" + agendaEnd).conditionalFormats.add("containsText", { text: "PRÓXIMA", format: { fill: C.yellow } });
  agenda.getRange("O" + agendaStart + ":O" + agendaEnd).conditionalFormats.add("containsText", { text: "PROGRAMADA", format: { fill: C.green } });
} catch {}
setTableStyle(agenda, "A10:S42", "AgendaRevisionTable");
agenda.showGridLines = false;
agenda.freezePanes.freezeRows(10);
for (const [col, width] of Object.entries({ A: 15, B: 24, C: 9, D: 13, E: 24, F: 28, G: 15, H: 12, I: 10, J: 38, K: 38, L: 38, M: 35, N: 35, O: 14, P: 30, Q: 48, R: 15, S: 24 })) agenda.getRange(col + ":" + col).format.columnWidth = width;
agenda.getRange("A1:S42").format.wrapText = true;
agenda.getRange("A1:S42").format.verticalAlignment = "center";
agenda.getRange("A11:S42").format.rowHeight = 58;

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
checks.getRange("A5:D14").values = [
  ["Filas de watchlist", null, null, "Debe haber 22 compañías seleccionadas."],
  ["Totales de checklist", null, null, "Cada empresa debe tener un total calculado."],
  ["Fuentes de mercado y resultados", null, null, "Cada fila principal debe tener ambos IDs."],
  ["Celdas de score vacías", null, null, "No debe faltar el enlace al total de Checklist_Lynch."],
  ["Escala máxima", null, null, "El máximo permitido por fila es 16."],
  ["Modelo", null, null, "Resumen de las comprobaciones anteriores."],
  ["Fecha de corte", AS_OF, null, "Actualiza esta fecha cuando refresques los datos."],
  ["Recordatorio", "No es recomendación", "INFO", "Verifica siempre fuentes, precio, impuestos, divisa y tu perfil de riesgo."],
  ["Filas de seguimiento", null, null, "Cada compañía debe tener una próxima revisión."],
  ["Filas de ranking 10-bagger", null, null, "El ranking debe cubrir las 22 compañías y conservar sus enlaces."],
];
checks.getRange("B5").formulas = [["=COUNTA('Watchlist'!A5:A26)"]];
checks.getRange("C5").formulas = [["=IF(B5=22,\"OK\",\"REVISAR\")"]];
checks.getRange("B6").formulas = [["=COUNT('Checklist_Lynch'!L5:L26)"]];
checks.getRange("C6").formulas = [["=IF(B6=22,\"OK\",\"REVISAR\")"]];
checks.getRange("B7").formulas = [["=COUNTIF('Watchlist'!Y5:Y26,\"<>\")+COUNTIF('Watchlist'!Z5:Z26,\"<>\")"]];
checks.getRange("C7").formulas = [["=IF(B7=44,\"OK\",\"REVISAR\")"]];
checks.getRange("B8").formulas = [["=COUNTBLANK('Watchlist'!AA5:AA26)"]];
checks.getRange("C8").formulas = [["=IF(B8=0,\"OK\",\"REVISAR\")"]];
checks.getRange("B9").formulas = [["=MAX('Checklist_Lynch'!L5:L26)"]];
checks.getRange("C9").formulas = [["=IF(B9<=16,\"OK\",\"REVISAR\")"]];
checks.getRange("B10").formulas = [["=COUNTIF(C5:C9,\"REVISAR\")+COUNTIF(C13:C14,\"REVISAR\")"]];
checks.getRange("C10").formulas = [["=IF(B10=0,\"MODELO OK\",\"HAY QUE REVISAR\")"]];
checks.getRange("C11").formulas = [["=IF(B11=DATE(2026,8,5),\"OK\",\"REVISAR\")"]];
checks.getRange("B13").formulas = [["=COUNTA('Seguimiento'!A5:A26)"]];
checks.getRange("C13").formulas = [["=IF(B13=22,\"OK\",\"REVISAR\")"]];
checks.getRange("B14").formulas = [["=COUNTA('Ranking_10Bagger'!B5:B26)"]];
checks.getRange("C14").formulas = [["=IF(B14=22,\"OK\",\"REVISAR\")"]];
styleSection(checks, "A17:D17", "Checks de las 10 nuevas candidatas");
checks.getRange("A18:D21").values = [
  ["Nuevas candidatas", null, null, "Debe haber 10 filas en Nuevas_10."],
  ["Fuentes nuevas", null, null, "Debe haber 30 fuentes (3 por compañía)."],
  ["Seguimientos nuevas", null, null, "Cada idea debe tener una fecha de revisión."],
  ["Scores nuevos completos", null, null, "Cada fila debe tener score Lynch y score 10Bagger."],
];
checks.getRange("B18").formulas = [["=COUNTA('Nuevas_10'!B5:B14)"]];
checks.getRange("C18").formulas = [["=IF(B18=10,\"OK\",\"REVISAR\")"]];
checks.getRange("B19").formulas = [["=COUNTA('Fuentes_Nuevas10'!A5:A34)"]];
checks.getRange("C19").formulas = [["=IF(B19=30,\"OK\",\"REVISAR\")"]];
checks.getRange("B20").formulas = [["=COUNTA('Seguimiento_Nuevas10'!A5:A14)"]];
checks.getRange("C20").formulas = [["=IF(B20=10,\"OK\",\"REVISAR\")"]];
checks.getRange("B21").formulas = [["=COUNT('Nuevas_10'!Z5:AA14)"]];
checks.getRange("C21").formulas = [["=IF(B21=20,\"OK\",\"REVISAR\")"]];
styleSection(checks, "A23:D23", "Checks del libro maestro");
checks.getRange("A24:D25").values = [
  ["Agenda central", null, null, "Debe reunir las 22 compañías principales y las 10 nuevas."],
  ["Fechas de agenda", null, null, "Cada compañía debe conservar su próxima fecha de revisión."],
];
checks.getRange("B24").formulas = [["=COUNTA('Agenda_Revision'!B11:B42)"]];
checks.getRange("C24").formulas = [["=IF(B24=32,\"OK\",\"REVISAR\")"]];
checks.getRange("B25").formulas = [["=COUNT('Agenda_Revision'!A11:A42)"]];
checks.getRange("C25").formulas = [["=IF(B25=32,\"OK\",\"REVISAR\")"]];
checks.getRange("A5:A14").format = { fill: C.gray, font: { bold: true, color: C.navy } };
checks.getRange("A18:A21").format = { fill: C.gray, font: { bold: true, color: C.navy } };
checks.getRange("A24:A25").format = { fill: C.gray, font: { bold: true, color: C.navy } };
checks.getRange("B5:B14").format.font = { color: C.black };
checks.getRange("B18:B21").format.font = { color: C.black };
checks.getRange("B24:B25").format.font = { color: C.black };
checks.getRange("C5:C14").format.font = { bold: true, color: C.black };
checks.getRange("C18:C21").format = { font: { bold: true, color: C.black } };
checks.getRange("C24:C25").format = { font: { bold: true, color: C.black } };
checks.getRange("D5:D14").format.wrapText = true;
checks.getRange("D18:D21").format.wrapText = true;
checks.getRange("D24:D25").format.wrapText = true;
checks.getRange("B11").format.numberFormat = "yyyy-mm-dd";
try { checks.getRange("C5:C25").conditionalFormats.add("containsText", { text: "OK", format: { fill: C.green } }); } catch {}
try { checks.getRange("C5:C25").conditionalFormats.add("containsText", { text: "REVISAR", format: { fill: C.red } }); } catch {}
setTableStyle(checks, "A4:D14", "ChecksTable");
finishSheet(checks, "A1:D25", 4);
for (const [col, width] of Object.entries({ A: 30, B: 20, C: 18, D: 62 })) checks.getRange(`${col}:${col}`).format.columnWidth = width;

// Basic workbook-wide formatting and active sheet.
try { workbook.worksheets.setActiveWorksheet("Portada"); } catch {}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUT_FILE);

console.log(JSON.stringify({ output: OUT_FILE, sheets: workbook.worksheets.items.map((s) => s.name) }));
