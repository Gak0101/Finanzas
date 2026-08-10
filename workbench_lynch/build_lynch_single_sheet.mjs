import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const INPUT_FILE = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_10mas/watchlist_lynch_2026-08-05_10mas.xlsx";
const OUT_DIR = "C:/Users/Cesar/Desktop/desarrollador/finanzas/outputs/lynch_watchlist_20260805_20mas_single_sheet";
const OUT_FILE = `${OUT_DIR}/watchlist_lynch_2026-08-05_maestro_20mas.xlsx`;
const PREVIEW_TOP = `${OUT_DIR}/preview_maestro_20mas_top.png`;
const PREVIEW_MIDDLE = `${OUT_DIR}/preview_maestro_20mas_middle.png`;
const PREVIEW_BOTTOM = `${OUT_DIR}/preview_maestro_20mas_bottom.png`;
const AS_OF = new Date("2026-08-05T00:00:00Z");

await fs.mkdir(OUT_DIR, { recursive: true });

const COLORS = {
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
  grid: "#D9E2F3",
};

const sourceBlob = await FileBlob.load(INPUT_FILE);
const sourceWorkbook = await SpreadsheetFile.importXlsx(sourceBlob);

function norm(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s/()+*—–-]+/g, " ")
    .trim();
}

function asText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function asValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isNaN(value)) return null;
  return value;
}

function excelSerialToDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && value > 30000 && value < 60000) {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(`${value.slice(0, 10)}T00:00:00Z`);
  }
  return value;
}

function numericDateKey(value) {
  const date = excelSerialToDate(value);
  return date instanceof Date ? date.getTime() : Number.POSITIVE_INFINITY;
}

function sourceValues(sheetName) {
  const sheet = sourceWorkbook.worksheets.getItem(sheetName);
  const used = sheet?.getUsedRange(true);
  return used?.values ?? [];
}

function findHeaderIndex(rows, requiredLabels) {
  const wanted = requiredLabels.map(norm);
  return rows.findIndex((row) => {
    const labels = row.map(norm);
    return wanted.every((label) => labels.includes(label));
  });
}

function objectRows(sheetName, requiredLabels) {
  const rows = sourceValues(sheetName);
  const headerIndex = findHeaderIndex(rows, requiredLabels);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((header, index) => asText(header) || `Columna ${index + 1}`);
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => asText(value) !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, asValue(row[index])])))
    .filter((row) => {
      const ticker = getField(row, ["Ticker"]);
      const company = getField(row, ["Empresa"]);
      if (asText(company) === "") return false;
      // Notes below some original tables repeat the same text in every column.
      // Real tickers are short identifiers without spaces; source tables do not have Ticker.
      if (ticker === null || ticker === undefined || asText(ticker) === "") return true;
      const tickerText = asText(ticker);
      return norm(tickerText) !== "ticker" && tickerText.length <= 8 && !/\s/.test(tickerText);
    });
}

function rawTable(sheetName, requiredLabels) {
  const rows = sourceValues(sheetName);
  const headerIndex = findHeaderIndex(rows, requiredLabels);
  if (headerIndex < 0) return { headers: [], rows: [] };
  const headers = rows[headerIndex].map((header, index) => asText(header) || `Columna ${index + 1}`);
  const data = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((value) => asText(value) !== ""))
    .map((row) => headers.map((_, index) => asValue(row[index])));
  return { headers, rows: data };
}

function getField(row, aliases) {
  for (const alias of aliases) {
    const exact = Object.keys(row).find((key) => key === alias);
    if (exact && asText(row[exact]) !== "") return row[exact];
    const equivalent = Object.keys(row).find((key) => norm(key) === norm(alias));
    if (equivalent && asText(row[equivalent]) !== "") return row[equivalent];
  }
  return null;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && asText(value) !== "") return value;
  }
  return null;
}

function compactText(value, maxLength = 160) {
  const text = asText(value);
  if (text.length <= maxLength) return value;
  return `${text.slice(0, maxLength - 1)}…`;
}

function byTicker(rows) {
  return new Map(rows.map((row) => [asText(getField(row, ["Ticker"])).toUpperCase(), row]));
}

function pickNumber(...values) {
  const value = firstValue(...values);
  return value === null ? null : value;
}

// -----------------------------------------------------------------------------
// Twenty additional candidates researched for the 2026-08-05 cut-off.
// These are deliberately kept as explicit snapshots: every row carries its
// market source, results source, evidence date and the next item to verify.
// ----------------------------------------------------------------------------
function makeExtraCandidate(raw) {
  const checks = raw.checks;
  const parts = raw.parts;
  const checklist = {
    "Negocio comprensible (0-2)": checks.business,
    "Historia / catalizador (0-2)": checks.history,
    "Crecimiento (0-2)": checks.growth,
    "Valoración (0-2)": checks.value,
    "Balance / caja (0-2)": checks.balance,
    "Dividendo / recompra (0-1)": checks.dividend,
    "Insiders / ownership (0-1)": checks.insiders,
    "Riesgos manejables (0-2)": checks.risks,
    "Evidencia / disciplina (0-2)": checks.evidence,
    "Total": raw.scoreLynch,
    "Qué falta comprobar": raw.pending,
  };
  const ranking = {
    "Orden": raw.batchOrder,
    "Capitalización (m)": raw.marketCap,
    "PER": raw.per,
    "Score Lynch /16": raw.scoreLynch,
    "Crecimiento / runway (0-5)": parts.growth,
    "Valoración (0-5)": parts.valuation,
    "Balance / caja (0-4)": parts.balance,
    "Tamaño / escala (0-4)": parts.size,
    "Catalizador / palanca (0-4)": parts.catalyst,
    "Score 10Bagger /22": raw.score10,
    "Capitalización x10 (m)": raw.marketCap === null ? null : raw.marketCap * 10,
    "Rating": raw.rating,
    "Motivo principal / freno": raw.pending,
    "Fuentes": raw.sourceIds,
    "Veredicto actual": raw.verdict,
  };
  const fresh = {
    "Empresa": raw.company,
    "Ticker": raw.ticker,
    "Comprensible": checks.business,
    "Catalizador": checks.history,
    "Crecimiento": checks.growth,
    "PER / PEG": checks.value,
    "Balance": checks.balance,
    "Riesgo / visibilidad": checks.risks,
    "Historial": checks.evidence,
    "Tamaño / runway": parts.size,
  };
  const follow = {
    "Empresa": raw.company,
    "Ticker": raw.ticker,
    "Tipo": raw.type,
    "Métricas a comparar": raw.metrics,
    "Dato base": raw.pending,
    "Qué debe mejorar / mantenerse": raw.positive,
    "Condición de invalidación": raw.negativeAction,
    "Acción siguiente": raw.nextAction,
    "Fuente / evento": raw.nextEvent,
    "Estado": "Pendiente",
    "Última revisión": AS_OF,
  };
  return {
    origin: "Nuevas 20",
    company: raw.company,
    ticker: raw.ticker,
    exchange: raw.exchange,
    type: raw.type,
    currency: raw.currency,
    price: raw.price,
    marketCap: raw.marketCap,
    per: raw.per,
    eps: raw.eps,
    dividend: raw.dividend,
    yield: raw.yield,
    sales: raw.sales,
    salesGrowth: raw.salesGrowth,
    profitGrowth: raw.profitGrowth,
    fcf: raw.fcf,
    netDebt: raw.netDebt,
    peg: raw.peg,
    catalyst: raw.catalyst,
    risk: raw.risk,
    nextEvent: raw.nextEvent,
    nextReview: new Date(`${raw.nextReview}T00:00:00Z`),
    lastReview: AS_OF,
    asOf: AS_OF,
    marketSource: raw.marketSource,
    resultSource: raw.resultSource,
    sourceIds: raw.sourceIds,
    metrics: raw.metrics,
    positive: raw.positive,
    negative: raw.negative,
    nextAction: raw.nextAction,
    negativeAction: raw.negativeAction,
    pending: raw.pending,
    dataNote: raw.dataNote,
    verdict: raw.verdict,
    rating: raw.rating,
    scoreLynch: raw.scoreLynch,
    score10: raw.score10,
    checklist,
    ranking: {},
    rankingNew: ranking,
    newRow: fresh,
    follow,
    sources: raw.sources,
  };
}

const extraCandidates = [
  {
    batchOrder: 1, company: "Diploma", ticker: "DPLM", exchange: "LSE", currency: "GBP", type: "Compounder",
    price: 7575, marketCap: 10160, per: 54.93, eps: 137.90, dividend: 60.20, yield: 0.00795,
    sales: 851.1, salesGrowth: 0.17, profitGrowth: 0.33, fcf: null, netDebt: null, peg: null,
    scoreLynch: 13, score10: 12, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 1, balance: 3, size: 1, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "H1 FY26: ingresos +17%, beneficio operativo ajustado +33% y EPS ajustado +36%; más bolt-ons en controles/defensa.",
    risk: "PER de mercado cercano a 55x: cualquier desaceleración orgánica o error de asignación de capital comprime el múltiplo.",
    nextEvent: "Resultados FY26 y comprobar deuda neta/FCF tras el cierre de CDM.", nextReview: "2026-12-09",
    metrics: "Crecimiento orgánico, margen operativo, FCF, deuda neta, ROATCE y retorno de adquisiciones.",
    positive: "Crecimiento orgánico de doble dígito y margen estable mientras el balance financia adquisiciones.",
    negative: "Crecimiento orgánico <8% o PER sin apoyo de EPS; revisar si el crecimiento viene solo de compras.",
    nextAction: "Leer FY26: separar crecimiento orgánico de adquisiciones y calcular PER normalizado.",
    negativeAction: "No perseguir precio si EPS no crece al menos al ritmo del múltiplo.",
    pending: "Confirmar FCF, deuda neta y crecimiento orgánico FY26; el PER 54,9x exige mucha visibilidad.",
    dataNote: "Precio/PER/mcap LSE; H1 FY26: revenue £851,1m, operating profit ajustado +33%, EPS ajustado +36%. PER de mercado no es un PER de entrada.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=diploma&shareprice=DPLM",
    resultSource: "https://www.lse.co.uk/rns/half-year-results-kt7laaglb12lsiz.html?mobile_view=desktop",
    sourceIds: "M20-DPLM-01 / M20-DPLM-02",
    sources: [
      { id: "M20-DPLM-01", date: "2026-08-05", type: "Mercado", supports: "Precio 7.575p, mcap £10.160m, PER 54,93x, EPS 137,90p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=diploma&shareprice=DPLM", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-DPLM-02", date: "2026-05-19", type: "Resultados", supports: "H1 FY26: revenue £851,1m +17%, beneficio operativo ajustado +33%, EPS ajustado +36%.", url: "https://www.lse.co.uk/rns/half-year-results-kt7laaglb12lsiz.html?mobile_view=desktop", note: "RNS/resultados oficiales." },
    ],
  },
  {
    batchOrder: 2, company: "Softcat", ticker: "SCT", exchange: "LSE", currency: "GBP", type: "Stalwart / compounder",
    price: 1653, marketCap: 3240, per: 24.82, eps: 66.60, dividend: 27.00, yield: 0.01633,
    sales: 837.5, salesGrowth: 0.535, profitGrowth: 0.273, fcf: null, netDebt: null, peg: null,
    scoreLynch: 14, score10: 13, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 2, balance: 3, size: 1, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "H1 FY26: gross invoiced income +33%, gross profit +23%, operating profit ajustado +27% y guidance FY26 elevada.",
    risk: "Empresa ya grande y PER 24,8x; margen de hardware, concentración de proveedores y normalización del gasto IT.",
    nextEvent: "Q3/FY26 trading update y comprobación de conversión de caja.", nextReview: "2026-11-26",
    metrics: "Gross profit, margen, cash conversion, clientes recurrentes, win rate y crecimiento orgánico.",
    positive: "Crecimiento de gross profit superior a ventas y cash conversion >100% sin deterioro de margen.",
    negative: "Desaceleración de gross profit, menor conversión de caja o caída de margen por competencia.",
    nextAction: "Actualizar PER sobre EPS FY26 y separar proyectos puntuales de recurrencia.",
    negativeAction: "Bajar rating si el crecimiento se acerca a dígito bajo con PER >20x.",
    pending: "Confirmar caja neta/FCF FY26 y cuánto del salto de ingresos es proyecto puntual.",
    dataNote: "Precio/PER/mcap LSE; H1 FY26 revenue estatutario £837,5m, gross profit +22,6%, cash conversion ajustada 147,6%.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=SCT&shareprice=SCT",
    resultSource: "https://www.softcat.com/6417/7381/5383/Softcat_Plc_Interim_Report_H1_FY26.pdf",
    sourceIds: "M20-SCT-01 / M20-SCT-02",
    sources: [
      { id: "M20-SCT-01", date: "2026-08-05", type: "Mercado", supports: "Precio 1.653p, mcap £3.240m, PER 24,82x, EPS 66,60p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=SCT&shareprice=SCT", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-SCT-02", date: "2026-03-24", type: "Resultados", supports: "H1 FY26: gross profit +22,6%, operating profit ajustado +27,3%, EPS ajustado +25,8%, cash conversion 147,6%.", url: "https://www.softcat.com/6417/7381/5383/Softcat_Plc_Interim_Report_H1_FY26.pdf", note: "Informe semestral oficial." },
    ],
  },
  {
    batchOrder: 3, company: "Gamma Communications", ticker: "GAMA", exchange: "LSE", currency: "GBP", type: "Stalwart / compounder",
    price: 970, marketCap: 867.04, per: 13.96, eps: 69.50, dividend: 20.40, yield: 0.02103,
    sales: 645.8, salesGrowth: 0.11, profitGrowth: 0.07, fcf: 131.8, netDebt: 9.3, peg: null,
    scoreLynch: 14, score10: 15, rating: "A", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 3, balance: 3, size: 2, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 2, balance: 2, dividend: 1, insiders: 0, risks: 2, evidence: 1 },
    catalyst: "Ingresos 2025 +11%, cash generado por operaciones +9%; Starface/Placetel y Webex for Gamma amplían Europa.",
    risk: "Integración de Starface y presión en SME UK antes del apagado PSTN; el net debt subió tras adquisiciones.",
    nextEvent: "Half-year results FY26, fecha estimada septiembre 2026.", nextReview: "2026-09-09",
    metrics: "Ingresos recurrentes, gross profit, cash conversion, net debt, Alemania y crecimiento de Webex seats.",
    positive: "Alemania mantiene doble dígito, Enterprise pipeline mejora y cash conversion permanece >90%.",
    negative: "Más caída de UK SME, integración de Starface consume caja o cash conversion <85%.",
    nextAction: "Comparar H1 FY26 con PER 14x: crecimiento, deuda post-adquisición y retorno de capital.",
    negativeAction: "Reducir rating si el EBITDA ajustado no crece y la deuda neta sigue subiendo.",
    pending: "Confirmar deuda neta/caja y EBITDA H1 FY26; vigilar impacto real del apagado PSTN.",
    dataNote: "Precio/PER/mcap LSE; FY25 revenue £645,8m +11%, adjusted PBT £119,4m +7%, cash generado por operaciones £131,8m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?mobile_view=mobile&shareprice=GAMA",
    resultSource: "https://www.lse.co.uk/rns/GAMA/final-results-j2s0v7qhdfcpm1d.html",
    sourceIds: "M20-GAMA-01 / M20-GAMA-02",
    sources: [
      { id: "M20-GAMA-01", date: "2026-08-05", type: "Mercado", supports: "Precio 970p, mcap £867,0m, PER 13,96x, EPS 69,50p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?mobile_view=mobile&shareprice=GAMA", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-GAMA-02", date: "2026-03-24", type: "Resultados", supports: "FY25 revenue +11%, adjusted PBT +7%, cash generado por operaciones £131,8m y net debt £9,3m.", url: "https://www.lse.co.uk/rns/GAMA/final-results-j2s0v7qhdfcpm1d.html", note: "RNS/resultados oficiales." },
    ],
  },
  {
    batchOrder: 4, company: "Restore", ticker: "RST", exchange: "AIM", currency: "GBP", type: "Turnaround / stalwart",
    price: 305, marketCap: 404.55, per: 13.56, eps: 22.50, dividend: 6.90, yield: 0.01967,
    sales: 304.7, salesGrowth: 0.27, profitGrowth: 0.23, fcf: 42.9, netDebt: 123.8, peg: null,
    scoreLynch: 13, score10: 16, rating: "A", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 4, balance: 2, size: 3, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 2, balance: 1, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "FY25 revenue +27%, adjusted EPS +23%, margen ajustado 20,8% y buyback £20m; H1 FY26 volvió a batir expectativas.",
    risk: "PER estatutario no significativo por costes de adquisiciones y deuda neta £123,8m; ejecución e integración.",
    nextEvent: "Resultados H1 FY26 / presentación de inversores y sucesión del CEO en enero 2027.", nextReview: "2027-01-28",
    metrics: "Crecimiento orgánico, margen >20%, FCF, leverage 1,5-2,0x, buyback y Synertec.",
    positive: "EPS ajustado, margen y FCF crecen sin que leverage salga del rango objetivo.",
    negative: "Deterioro del margen, leverage >2x o adquisiciones que no convierten en FCF.",
    nextAction: "Actualizar PER con EPS ajustado H1/FY26 y leer el plan de integración de Synertec.",
    negativeAction: "No aumentar exposición hasta ver deuda y FCF después de adquisiciones.",
    pending: "El PER 13,6x es sobre EPS ajustado; confirmar EPS estatutario, FCF H1 y deuda post-buyback.",
    dataNote: "Precio/mcap LSE; PER calculado como 305p / EPS ajustado FY25 22,5p. FY25 revenue £304,7m, FCF £42,9m, net debt £123,8m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=RST",
    resultSource: "https://www.lse.co.uk/rns/RST/full-year-2025-results-g8mftxieqxqf7j0.html",
    sourceIds: "M20-RST-01 / M20-RST-02",
    sources: [
      { id: "M20-RST-01", date: "2026-08-05", type: "Mercado", supports: "Precio 305p, mcap £404,6m, EPS estatutario negativo y precio usado para PER ajustado.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=RST", note: "Cotización retrasada; el PER LSE estatutario no es representativo." },
      { id: "M20-RST-02", date: "2026-03-12", type: "Resultados", supports: "FY25 revenue +27%, adjusted EPS +23%, FCF £42,9m, net debt £123,8m, buyback £20m.", url: "https://www.lse.co.uk/rns/RST/full-year-2025-results-g8mftxieqxqf7j0.html", note: "RNS/resultados oficiales." },
    ],
  },
  {
    batchOrder: 5, company: "Franchise Brands", ticker: "FRAN", exchange: "AIM", currency: "GBP", type: "Fast grower / compounder",
    price: 137, marketCap: 262.60, per: 15.22, eps: 9.00, dividend: 2.45, yield: 0.01788,
    sales: 142.2, salesGrowth: 0.02, profitGrowth: 0.12, fcf: null, netDebt: 55.6, peg: null,
    scoreLynch: 12, score10: 15, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 3, balance: 2, size: 3, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 1, value: 1, balance: 1, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "Franquicias multi-marca, beneficio ajustado +12%, deuda neta baja a 1,6x y buyback potencial £10m.",
    risk: "Crecimiento de ventas solo +2%, deuda y franquiciados sensibles a consumo; integración de Pirtek/Motorclean.",
    nextEvent: "Trading update H1 FY26 y avance del buyback; revisar deuda y ventas de sistema.", nextReview: "2026-09-24",
    metrics: "System sales, ingresos recurrentes, adjusted PBT/EPS, cash conversion y leverage.",
    positive: "System sales acelera y la deuda sigue bajando mientras crece el beneficio por franquiciado.",
    negative: "System sales plana/negativa, caja inferior al beneficio o leverage vuelve a >2x.",
    nextAction: "Comparar PER ajustado 15,2x con crecimiento real de system sales.",
    negativeAction: "Mantener solo en seguimiento si el buyback tapa falta de crecimiento.",
    pending: "PER estatutario LSE 29,3x; el 15,2x es ajustado. Confirmar FCF y progreso del buyback.",
    dataNote: "Precio/mcap LSE; FY25 revenue £142,2m +2%, adjusted PBT £23,9m +12%, EPS ajustado 9,0p, net debt £55,6m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=Franchise-Brand&shareprice=FRAN",
    resultSource: "https://www.investegate.co.uk/announcement/rns/franchise-brands--fran/final-results/9490309",
    sourceIds: "M20-FRAN-01 / M20-FRAN-02",
    sources: [
      { id: "M20-FRAN-01", date: "2026-08-05", type: "Mercado", supports: "Precio 137p, mcap £262,6m, PER estatutario 29,34x, EPS 4,67p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=Franchise-Brand&shareprice=FRAN", note: "Cotización retrasada; se usa PER ajustado en la tesis." },
      { id: "M20-FRAN-02", date: "2026-03-25", type: "Resultados", supports: "FY25 system sales +2%, adjusted PBT +12%, EPS ajustado +5%, cash conversion 98%, net debt £55,6m.", url: "https://www.investegate.co.uk/announcement/rns/franchise-brands--fran/final-results/9490309", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 6, company: "Next 15 Group", ticker: "NFG", exchange: "AIM", currency: "GBP", type: "Turnaround",
    price: 300, marketCap: 305.58, per: 6.76, eps: 44.40, dividend: 15.35, yield: 0.05117,
    sales: 448.8, salesGrowth: -0.063, profitGrowth: -0.068, fcf: null, netDebt: 35.6, peg: null,
    scoreLynch: 11, score10: 16, rating: "B", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 5, balance: 2, size: 3, catalyst: 2 },
    checks: { business: 2, history: 2, growth: 1, value: 2, balance: 1, dividend: 1, insiders: 0, risks: 1, evidence: 1 },
    catalyst: "Reestructura portfolio tras Mach49: negocios Tier 1 fuertes, deuda neta baja a £35,6m y PER ajustado ~6,8x.",
    risk: "Ventas y EPS ajustado caen; pérdida estatutaria por discontinuadas y litigio Mach49 pueden alargar el turnaround.",
    nextEvent: "H1 FY27 results y actualización sobre Mach49 / cartera simplificada.", nextReview: "2026-09-17",
    metrics: "Net revenue orgánico, margen, deuda neta, clientes Tier 1, litigio y FCF.",
    positive: "Vuelta a crecimiento orgánico y mejora del margen sin aumentar deuda.",
    negative: "Más caída de ingresos, litigio material o consumo de caja por encima de la tesis.",
    nextAction: "Revisar la cuenta continuada y calcular PER solo con EPS ajustado normalizado.",
    negativeAction: "No confundir PER bajo con value trap mientras persista la pérdida estatutaria.",
    pending: "PER 6,8x es ajustado; confirmar FCF, coste del litigio Mach49 y crecimiento H1 FY27.",
    dataNote: "Precio/mcap LSE; FY26 net revenue £448,8m -6,3%, adjusted diluted EPS 44,4p -6,5%, net debt £35,6m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=NFG",
    resultSource: "https://www.investegate.co.uk/announcement/bzw/next-15-group--nfg/final-results/9555794",
    sourceIds: "M20-NFG-01 / M20-NFG-02",
    sources: [
      { id: "M20-NFG-01", date: "2026-08-05", type: "Mercado", supports: "Precio 300p, mcap £305,6m, PER estatutario negativo, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=NFG", note: "Cotización retrasada; se usa PER ajustado." },
      { id: "M20-NFG-02", date: "2026-05-07", type: "Resultados", supports: "FY26 net revenue -6,3%, adjusted diluted EPS 44,4p, net debt £35,6m y reestructuración.", url: "https://www.investegate.co.uk/announcement/bzw/next-15-group--nfg/final-results/9555794", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 7, company: "Sanderson Design Group", ticker: "SDG", exchange: "AIM", currency: "GBP", type: "Asset-backed / turnaround",
    price: 77, marketCap: 55.64, per: 14.29, eps: 5.39, dividend: 1.50, yield: 0.01948,
    sales: 99.5, salesGrowth: -0.009, profitGrowth: 0.22, fcf: null, netDebt: null, peg: null,
    scoreLynch: 12, score10: 17, rating: "B", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 5, balance: 2, size: 4, catalyst: 2 },
    checks: { business: 2, history: 2, growth: 1, value: 2, balance: 1, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "Marcas Morris & Co./Sanderson; licencia subyacente +36%, PBT ajustado £5,3m y book value por acción superior al precio.",
    risk: "Microcap, liquidez baja, ventas planas y exposición a interiorismo UK; falta confirmar deuda y FCF.",
    nextEvent: "Trading update FY27 y evolución de DTC/licencias en Norteamérica.", nextReview: "2026-10-06",
    metrics: "Licensing revenue, DTC gross margin, North America, inventario, FCF y deuda/pensiones.",
    positive: "DTC mejora margen, licencias crecen y el beneficio ajustado se mantiene positivo.",
    negative: "Más caída de UK, inventario aumenta o la caja no refleja el PBT ajustado.",
    nextAction: "Comprobar net debt, NAV tangible y si el descuento a book value es realizable.",
    negativeAction: "Tratar como asset play, no como compounder, hasta ver dos periodos de crecimiento.",
    pending: "Confirmar FCF, deuda/pensión y calidad del book value; la liquidez puede ampliar el spread.",
    dataNote: "Precio/mcap LSE; FY26 revenue £99,5m -1%, adjusted underlying PBT £5,3m, adjusted EPS 5,39p, licensing subyacente +36%.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=Sndrsn-Dsn&shareprice=SDG",
    resultSource: "https://sandersondesign.group/media/2165/annual-report-2026.pdf",
    sourceIds: "M20-SDG-01 / M20-SDG-02",
    sources: [
      { id: "M20-SDG-01", date: "2026-08-05", type: "Mercado", supports: "Precio 77p, mcap £55,6m, PER LSE 25,84x, EPS 2,98p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=Sndrsn-Dsn&shareprice=SDG", note: "Cotización retrasada; se usa EPS ajustado para PER ~14,3x." },
      { id: "M20-SDG-02", date: "2026-04-23", type: "Resultados", supports: "FY26 revenue £99,5m, adjusted underlying PBT £5,3m, EPS ajustado 5,39p, licencias subyacentes +36%.", url: "https://sandersondesign.group/media/2165/annual-report-2026.pdf", note: "Informe anual oficial." },
    ],
  },
  {
    batchOrder: 8, company: "AJ Bell", ticker: "AJB", exchange: "LSE", currency: "GBP", type: "Fast grower / compounder",
    price: 615, marketCap: 2430, per: 23.95, eps: 25.68, dividend: 12.75, yield: 0.02073,
    sales: 183.0, salesGrowth: 0.19, profitGrowth: 0.15, fcf: null, netDebt: null, peg: null,
    scoreLynch: 14, score10: 12, rating: "B", verdict: "VIGILAR",
    parts: { growth: 3, valuation: 2, balance: 3, size: 1, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "H1 FY26: ingresos +19%, PBT subyacente +15%, AUA y entradas netas récord; plataforma con crecimiento estructural.",
    risk: "PER ~24x y dependencia de mercados/AUA; competencia de plataformas y presión regulatoria sobre tarifas.",
    nextEvent: "Resultados FY26 y actualización de AUA, entradas netas y margen por libra administrada.", nextReview: "2026-11-26",
    metrics: "AUA, net inflows, revenue margin/bps, customer growth, PBT, FCF y buyback.",
    positive: "AUA crece doble dígito, net inflows sólidos y margen operativo no se diluye.",
    negative: "Outflows, caída de márgenes o múltiplo >25x sin crecimiento de EPS.",
    nextAction: "Actualizar PER/PFG con FY26 EPS y separar beta de mercado de captación neta.",
    negativeAction: "Esperar corrección si la cotización descuenta más de dos años de crecimiento.",
    pending: "Confirmar FCF y caja neta en FY26; vigilar valoración frente a crecimiento de AUA.",
    dataNote: "Precio/mcap LSE; PER 23,95x, EPS 25,68p. H1 FY26 revenue £183,0m +19%, underlying PBT £79,0m +15%.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=AJB",
    resultSource: "https://www.investegate.co.uk/announcement/rns/aj-bell--ajb/interim-results/9578766%3Cbr%3E",
    sourceIds: "M20-AJB-01 / M20-AJB-02",
    sources: [
      { id: "M20-AJB-01", date: "2026-08-05", type: "Mercado", supports: "Precio 615p, mcap £2.430m, PER 23,95x, EPS 25,68p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=AJB", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-AJB-02", date: "2026-05-21", type: "Resultados", supports: "H1 FY26 revenue +19% a £183m, underlying PBT +15% a £79m y net inflows £4,2bn.", url: "https://www.investegate.co.uk/announcement/rns/aj-bell--ajb/interim-results/9578766%3Cbr%3E", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 9, company: "Impax Asset Management", ticker: "IPX", exchange: "AIM", currency: "GBP", type: "Turnaround / asset play",
    price: 111.2, marketCap: 133.65, per: 6.92, eps: 15.90, dividend: 26.90, yield: 0.24191,
    sales: 58.8, salesGrowth: -0.231, profitGrowth: -0.435, fcf: null, netDebt: -65.0, peg: null,
    scoreLynch: 11, score10: 17, rating: "B", verdict: "CANDIDATA",
    parts: { growth: 3, valuation: 5, balance: 3, size: 4, catalyst: 2 },
    checks: { business: 2, history: 1, growth: 1, value: 2, balance: 2, dividend: 1, insiders: 0, risks: 1, evidence: 1 },
    catalyst: "AUM Q3 sube 4,4% a £23,3bn y la valoración refleja mucha salida previa; caja/inversiones son una parte material del mcap.",
    risk: "H1 FY26 ingresos y beneficios caen por salidas; dividendo aparente muy alto puede no ser sostenible.",
    nextEvent: "Q4 AUM update y resultados FY26 al cierre de septiembre.", nextReview: "2026-10-09",
    metrics: "AUM, net flows, margen operativo, cash/investments, dividend cover y evolución de fondos.",
    positive: "AUM y flujos netos se estabilizan dos trimestres y el beneficio deja de caer.",
    negative: "Más outflows, reducción de dividendo o consumo de caja por debajo de la tesis de net cash.",
    nextAction: "Leer FY26: valorar el negocio fee-earning por separado del cash y de inversiones semillas.",
    negativeAction: "No tratar yield >20% como retorno base hasta verificar payout y cobertura.",
    pending: "Confirmar net cash real, dividend cover y flujos netos FY26; separar caja de inversiones de AUM.",
    dataNote: "Precio/mcap LSE; PER 6,92x, EPS 15,90p, dividend yield calculado ~24,2%. H1 FY26 revenue £58,8m, AUM £22,3bn; Q3 AUM £23,3bn.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=impax_group&shareprice=IPX",
    resultSource: "https://www.investegate.co.uk/announcement/rns/impax-asset-management-group--ipx/interim-results-to-31-march-2026/9576505",
    sourceIds: "M20-IPX-01 / M20-IPX-02",
    sources: [
      { id: "M20-IPX-01", date: "2026-08-05", type: "Mercado", supports: "Precio 111,2p, mcap £133,7m, PER 6,92x, EPS 15,90p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=impax_group&shareprice=IPX", note: "Cotización retrasada; yield requiere comprobar cobertura." },
      { id: "M20-IPX-02", date: "2026-05-20", type: "Resultados", supports: "H1 FY26 revenue £58,8m, adjusted PBT £12,1m, EPS ajustado 7,4p, AUM £22,3bn.", url: "https://www.investegate.co.uk/announcement/rns/impax-asset-management-group--ipx/interim-results-to-31-march-2026/9576505", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 10, company: "Avingtrans", ticker: "AVG", exchange: "AIM", currency: "GBP", type: "Fast grower / compounder",
    price: 720, marketCap: 265.90, per: 38.10, eps: 18.90, dividend: 4.70, yield: 0.00653,
    sales: 78.1, salesGrowth: 0.0, profitGrowth: 0.22, fcf: 11.5, netDebt: 12.3, peg: null,
    scoreLynch: 14, score10: 14, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 2, balance: 2, size: 3, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "Estrategia Pinpoint-Invest-Exit; contratos nucleares y EPS H1 FY26 +22% pese a ingresos planos.",
    risk: "PER 38x, iliquidez y ejecución de adquisiciones/exit; deuda neta crece con inversión en nuclear y medical imaging.",
    nextEvent: "FY26 final results y detalle de contratos nucleares; beneficio esperado en línea.", nextReview: "2026-09-24",
    metrics: "Order book, EPS, operating cash, net debt, retornos de adquisiciones y hitos de nuclear.",
    positive: "Nuevos contratos convierten en margen/FCF y el balance mantiene deuda controlada.",
    negative: "Retrasos de contratos o adquisiciones elevan deuda sin crecimiento de EPS.",
    nextAction: "Actualizar PER con FY26 EPS y revisar si el mercado ya descuenta el siguiente exit.",
    negativeAction: "No pagar PER alto si el crecimiento viene solo de un contrato puntual.",
    pending: "Confirmar FCF FY26 y deuda neta después de inversión; el PER 38x reduce margen de seguridad.",
    dataNote: "Precio/mcap LSE; H1 FY26 revenue £78,1m plano, EPS ajustado 14,6p +22%, net debt £12,3m, operating cash FY25 £11,5m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=avingtrans&shareprice=AVG",
    resultSource: "https://www.investegate.co.uk/announcement/rns/avingtrans--avg/trading-update-and-notice-of-results/9633036",
    sourceIds: "M20-AVG-01 / M20-AVG-02",
    sources: [
      { id: "M20-AVG-01", date: "2026-08-05", type: "Mercado", supports: "Precio 720p, mcap £265,9m, PER 38,10x, EPS 18,90p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=avingtrans&shareprice=AVG", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-AVG-02", date: "2026-06-25", type: "Resultados", supports: "FY26 trading update: beneficio en línea y contratos significativos; H1 EPS +22% y net debt £12,3m.", url: "https://www.investegate.co.uk/announcement/rns/avingtrans--avg/trading-update-and-notice-of-results/9633036", note: "Trading update oficial." },
    ],
  },
  {
    batchOrder: 11, company: "Volex", ticker: "VLX", exchange: "AIM", currency: "GBP cotiza / USD cuentas", type: "Fast grower / compounder",
    price: 516, marketCap: 950.85, per: 19.31, eps: 26.72, dividend: 4.60, yield: 0.00891,
    sales: 1242.6, salesGrowth: 0.144, profitGrowth: 0.216, fcf: 42.3, netDebt: 121.5, peg: null,
    scoreLynch: 13, score10: 13, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 2, balance: 2, size: 2, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 1, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "FY26 revenue USD +14,4%, EBITDA sube a USD163,8m, FCF USD42,3m y leverage baja a 0,8x.",
    risk: "Exposición a ciclos de electrónica/EV, concentración de clientes y deuda USD; caída de Consumer Electricals.",
    nextEvent: "H1 FY27 results: comprobar datos orgánicos y cash conversion.", nextReview: "2026-11-26",
    metrics: "Organic growth, operating margin, FCF, cash conversion, leverage y mezcla EV/data/medical.",
    positive: "Crecimiento de data/electrificación compensa consumo y FCF mantiene deleveraging.",
    negative: "Deuda/EBITDA sube, FCF cae o el crecimiento depende solo de adquisiciones.",
    nextAction: "Normalizar USD/GBP y calcular PER sobre EPS FY27, no solo sobre FY26.",
    negativeAction: "Bajar rating si el margen industrial no sostiene el múltiplo 19x.",
    pending: "Confirmar FCF libre después de capital circulante y evolución de deuda en H1 FY27.",
    dataNote: "Precio/mcap/PER LSE en GBP; FY26 cuentas en USD: revenue $1.242,6m +14,4%, FCF $42,3m, net debt $121,5m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=Volex&shareprice=VLX",
    resultSource: "https://www.investegate.co.uk/announcement/rns/volex--vlx/preliminary-group-results-fy2026/9635420",
    sourceIds: "M20-VLX-01 / M20-VLX-02",
    sources: [
      { id: "M20-VLX-01", date: "2026-08-05", type: "Mercado", supports: "Precio 516p, mcap £950,9m, PER 19,31x, EPS 26,72p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=Volex&shareprice=VLX", note: "Cotización retrasada; cuentas en USD." },
      { id: "M20-VLX-02", date: "2026-06-25", type: "Resultados", supports: "FY26 revenue $1.242,6m +14,4%, EBITDA $163,8m, FCF $42,3m, leverage 0,8x.", url: "https://www.investegate.co.uk/announcement/rns/volex--vlx/preliminary-group-results-fy2026/9635420", note: "Resultados preliminares oficiales." },
    ],
  },
  {
    batchOrder: 12, company: "Cohort", ticker: "CHRT", exchange: "AIM", currency: "GBP", type: "Fast grower / specialist",
    price: 1228, marketCap: 562.80, per: 23.51, eps: 52.23, dividend: 16.85, yield: 0.01372,
    sales: 306.4, salesGrowth: 0.13, profitGrowth: 0.32, fcf: null, netDebt: -26.1, peg: null,
    scoreLynch: 14, score10: 14, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 2, balance: 3, size: 1, catalyst: 4 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "FY26 revenue +13%, EBIT ajustado +32% y order book £618,8m que llega hasta 2037; defensa/satélite especializada.",
    risk: "PER >23x y dependencia de contratos públicos; retrasos o sobrecostes pueden afectar la conversión de caja.",
    nextEvent: "H1 FY27 results y actualización de order intake/order book.", nextReview: "2026-12-10",
    metrics: "Order intake, backlog, margen EBIT, FCF, net funds y mix de contratos.",
    positive: "Order book sigue creciendo por encima de ventas y el cash conversion mejora.",
    negative: "Backlog se convierte tarde, margen cae o net funds se convierte en deuda.",
    nextAction: "Comparar EPS FY27 con PER y comprobar qué parte del backlog está firmada/fondeada.",
    negativeAction: "No extrapolar el backlog hasta ver entregas y caja.",
    pending: "Confirmar FCF y net funds reportados FY26; el order book no equivale a beneficio.",
    dataNote: "Precio/mcap/PER LSE; FY26 revenue £306,4m +13%, adjusted EBIT £36,3m +32%, order book £618,8m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=CHRT",
    resultSource: "https://www.lse.co.uk/rns/CHRT/full-year-trading-update-lwt4j03a99xp7uf.html",
    sourceIds: "M20-CHRT-01 / M20-CHRT-02",
    sources: [
      { id: "M20-CHRT-01", date: "2026-08-05", type: "Mercado", supports: "Precio 1.228p, mcap £562,8m, PER 23,51x, EPS 52,23p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=CHRT", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-CHRT-02", date: "2026-07-16", type: "Resultados", supports: "FY26 revenue £306,4m +13%, adjusted EBIT £36,3m +32%, order book £618,8m.", url: "https://www.lse.co.uk/rns/CHRT/full-year-trading-update-lwt4j03a99xp7uf.html", note: "Trading update/resultados oficiales." },
    ],
  },
  {
    batchOrder: 13, company: "CT Automotive", ticker: "CTA", exchange: "AIM", currency: "GBP cotiza / USD cuentas", type: "Fast grower / turnaround",
    price: 51, marketCap: 37.53, per: 6.02, eps: 8.47, dividend: 0, yield: 0,
    sales: 114.8, salesGrowth: -0.041, profitGrowth: 0.20, fcf: null, netDebt: 7.7, peg: null,
    scoreLynch: 11, score10: 17, rating: "B", verdict: "CANDIDATA CON RIESGO",
    parts: { growth: 4, valuation: 5, balance: 1, size: 4, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 1, value: 2, balance: 1, dividend: 0, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "Microcap de interiores de automóvil: $47m de nuevos negocios, near-shoring en México y margen bruto +295pb.",
    risk: "Ventas FY25 -4,1%, deuda USD, concentración OEM y spread/iliquidez extrema; sin dividendo.",
    nextEvent: "H1 FY26 results y actualización de nuevos programas/OEM.", nextReview: "2026-09-30",
    metrics: "New business wins, revenue launch, gross margin, net debt, customer concentration y FCF.",
    positive: "Nuevos programas se convierten en ingresos y deuda cae mientras margen sigue >30%.",
    negative: "Retrasos de lanzamientos, deuda sube o pérdida de un OEM clave.",
    nextAction: "Comprobar calidad del beneficio y cash conversion; no usar solo el PER 6x.",
    negativeAction: "Mantener tamaño pequeño hasta ver un H1 con caja positiva.",
    pending: "Confirmar FCF, covenant/deuda y conversión de los $47m de nuevos negocios.",
    dataNote: "Precio/mcap/PER LSE; FY25 cuentas USD: revenue $114,8m -4,1%, adjusted EBITDA $14,8m, PBT reportado $9,1m, net debt $7,7m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=CTA",
    resultSource: "https://www.investegate.co.uk/announcement/rns/ct-automotive-group--cta/final-results/9576514",
    sourceIds: "M20-CTA-01 / M20-CTA-02",
    sources: [
      { id: "M20-CTA-01", date: "2026-08-05", type: "Mercado", supports: "Precio 51p, mcap £37,5m, PER 6,02x, EPS 8,47p, sin dividendo.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=CTA", note: "Cotización retrasada; microcap con spread amplio." },
      { id: "M20-CTA-02", date: "2026-05-20", type: "Resultados", supports: "FY25 revenue $114,8m -4,1%, margen bruto +295pb, nuevos negocios $47m, net debt $7,7m.", url: "https://www.investegate.co.uk/announcement/rns/ct-automotive-group--cta/final-results/9576514", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 14, company: "Warpaint London", ticker: "W7L", exchange: "AIM", currency: "GBP", type: "Fast grower",
    price: 210, marketCap: 169.65, per: 11.82, eps: 17.77, dividend: 11.50, yield: 0.05476,
    sales: 105.1, salesGrowth: 0.03, profitGrowth: -0.25, fcf: null, netDebt: -16.0, peg: null,
    scoreLynch: 13, score10: 16, rating: "A", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 3, balance: 4, size: 4, catalyst: 1 },
    checks: { business: 2, history: 2, growth: 1, value: 2, balance: 2, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "Marcas de cosmética asequible, distribución global, caja £16m sin deuda y nuevas implantaciones en Boots/CVS/Europa.",
    risk: "FY25 EBITDA -15% y EPS ajustado -25%; EEUU cayó 21% por tarifas y el crecimiento aún no ha vuelto.",
    nextEvent: "H1 FY26 results: comprobar retorno a crecimiento y margen tras nuevas distribuciones.", nextReview: "2026-09-17",
    metrics: "Revenue por región, gross margin, EBITDA, sell-in/sell-out, caja y nuevas tiendas.",
    positive: "Rebote de EEUU, expansión de W7 y margen bruto se mantienen >42%.",
    negative: "US/UK no recuperan, promociones erosionan margen o caja cae pese a crecimiento.",
    nextAction: "Actualizar PER con EPS FY26 y separar crecimiento de marca de adquisiciones.",
    negativeAction: "Mantener seguimiento si el rebote de beneficios se retrasa otro semestre.",
    pending: "Confirmar H1 FY26, caja después de buyback y retorno a crecimiento de EPS.",
    dataNote: "Precio/mcap/PER LSE; FY25 revenue £105,1m +3%, adjusted EPS 16,7p -25%, caja £16m y sin deuda.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=Warpaint-london&shareprice=W7L",
    resultSource: "https://www.investegate.co.uk/announcement/rns/warpaint-london--w7l/results-for-the-year-ended-31-december-2025/9542864",
    sourceIds: "M20-W7L-01 / M20-W7L-02",
    sources: [
      { id: "M20-W7L-01", date: "2026-08-05", type: "Mercado", supports: "Precio 210p, mcap £169,7m, PER 11,82x, EPS 17,77p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=Warpaint-london&shareprice=W7L", note: "Cotización retrasada; spread amplio." },
      { id: "M20-W7L-02", date: "2026-04-29", type: "Resultados", supports: "FY25 revenue +3%, adjusted EBITDA -15%, adjusted EPS 16,7p -25%, caja £16m sin deuda.", url: "https://www.investegate.co.uk/announcement/rns/warpaint-london--w7l/results-for-the-year-ended-31-december-2025/9542864", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 15, company: "RWS Holdings", ticker: "RWS", exchange: "LSE", currency: "GBP", type: "Turnaround / fast grower",
    price: 116.7, marketCap: 433.15, per: 23.82, eps: 4.90, dividend: 12.45, yield: 0.10668,
    sales: 360.3, salesGrowth: 0.05, profitGrowth: 0.33, fcf: null, netDebt: 32.5, peg: null,
    scoreLynch: 12, score10: 17, rating: "A", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 4, balance: 2, size: 4, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 2, balance: 1, dividend: 1, insiders: 0, risks: 1, evidence: 1 },
    catalyst: "H1 FY26 revenue +5% (+7% orgánico), PBT ajustado +33%, servicios AI 32% de ventas y adquisición de Obviously.",
    risk: "EPS estatutario negativo por intangibles/ajustes, deuda y competencia de IA; dividendo alto exige caja real.",
    nextEvent: "FY26 results y progreso de AI/Obviously; comprobar FCF y margen del segmento Transform.", nextReview: "2026-12-10",
    metrics: "Organic growth, adjusted EPS, FCF conversion, net debt, AI revenue, gross margin y dividend cover.",
    positive: "AI/tech-first crece con margen y FCF, mientras net debt/EBITDA permanece bajo control.",
    negative: "La IA canibaliza traducción sin margen, PBT ajustado no escala o FCF conversion <60%.",
    nextAction: "Usar PER ajustado ~23,8x; reconciliar EPS estatutario, amortización y FCF.",
    negativeAction: "No valorar por yield sin revisar cash conversion y covenants.",
    pending: "Confirmar FCF FY26, dividend cover y beneficio ajustado tras Obviously.",
    dataNote: "Precio/mcap/PER LSE estatutario negativo; PER aquí = 116,7p / H1 adjusted EPS 4,9p. H1 revenue £360,3m +5%, PBT ajustado +33%, net debt £32,5m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=RWS-Holdings&shareprice=RWS",
    resultSource: "https://www.rws.com/media/images/RWS-HY26-Results-Statement-Final-260610_tcm228-298858.pdf",
    sourceIds: "M20-RWS-01 / M20-RWS-02",
    sources: [
      { id: "M20-RWS-01", date: "2026-08-05", type: "Mercado", supports: "Precio 116,7p, mcap £433,2m, EPS estatutario negativo, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=RWS-Holdings&shareprice=RWS", note: "Cotización retrasada; PER usado es ajustado." },
      { id: "M20-RWS-02", date: "2026-06-11", type: "Resultados", supports: "H1 FY26 revenue £360,3m +5%, adjusted EBITDA +20%, adjusted PBT +33%, adjusted EPS 4,9p, net debt £32,5m.", url: "https://www.rws.com/media/images/RWS-HY26-Results-Statement-Final-260610_tcm228-298858.pdf", note: "Informe semestral oficial." },
    ],
  },
  {
    batchOrder: 16, company: "Mears Group", ticker: "MER", exchange: "LSE", currency: "GBP", type: "Stalwart / recovery",
    price: 438.5, marketCap: 347.57, per: 7.87, eps: 55.70, dividend: 16.85, yield: 0.03843,
    sales: 1135.5, salesGrowth: 0.0, profitGrowth: 0.11, fcf: null, netDebt: -51.8, peg: null,
    scoreLynch: 13, score10: 13, rating: "A", verdict: "VIGILAR",
    parts: { growth: 3, valuation: 3, balance: 4, size: 3, catalyst: 0 },
    checks: { business: 2, history: 2, growth: 1, value: 2, balance: 2, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "FY25 EPS +11%, caja neta ajustada £51,8m, order book récord £4bn y buyback £20m.",
    risk: "Negocio de servicios públicos de bajo margen y crecimiento total plano; dependencia de contratos/gasto público.",
    nextEvent: "H1 FY26 results y conversión de order book en margen/caja.", nextReview: "2026-09-02",
    metrics: "Maintenance-led growth, margin, order book, average net cash, buybacks y dividend cover.",
    positive: "Maintenance-led mantiene doble dígito y el order book se convierte con margen creciente.",
    negative: "Caída de contratos de management no se compensa, caja se reduce o margen se estanca.",
    nextAction: "Comparar PER <8x con crecimiento de EPS y calidad de caja, no solo con order book.",
    negativeAction: "Mantener como value compounder, no 10-bagger, si la escala no acelera.",
    pending: "Confirmar FCF FY26 y si la caja neta soporta buyback sin elevar working capital.",
    dataNote: "Precio/mcap/PER LSE; FY25 revenue £1.135,5m plano, EPS 55,7p +11%, adjusted net cash £51,8m, order book £4bn.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=Mears&shareprice=MER",
    resultSource: "https://www.investegate.co.uk/announcement/rns/mears-group--mer/preliminary-results/9492569",
    sourceIds: "M20-MER-01 / M20-MER-02",
    sources: [
      { id: "M20-MER-01", date: "2026-08-05", type: "Mercado", supports: "Precio 438,5p, mcap £347,6m, PER 7,87x, EPS 55,70p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?share=Mears&shareprice=MER", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-MER-02", date: "2026-03-26", type: "Resultados", supports: "FY25 revenue £1.135,5m, EPS +11%, adjusted net cash £51,8m, order book £4bn y buyback £20m.", url: "https://www.investegate.co.uk/announcement/rns/mears-group--mer/preliminary-results/9492569", note: "Resultados preliminares oficiales." },
    ],
  },
  {
    batchOrder: 17, company: "Concurrent Technologies", ticker: "CNC", exchange: "AIM", currency: "GBP", type: "Fast grower / specialist",
    price: 260, marketCap: 236.19, per: 44.37, eps: 5.86, dividend: 1.10, yield: 0.00423,
    sales: 23.1, salesGrowth: 0.095, profitGrowth: 0.22, fcf: null, netDebt: null, peg: null,
    scoreLynch: 13, score10: 16, rating: "B", verdict: "VIGILAR",
    parts: { growth: 4, valuation: 2, balance: 3, size: 4, catalyst: 3 },
    checks: { business: 2, history: 2, growth: 2, value: 1, balance: 2, dividend: 0, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "Boards informáticas de misión crítica para defensa: order intake H1 +110% a £46,9m y contratos multianuales.",
    risk: "PER 44x y microcap; la conversión del order book y el gasto de capacidad aún deben probarse.",
    nextEvent: "H1 FY26 results/presentación de septiembre y actualización de order book.", nextReview: "2026-09-14",
    metrics: "Order intake, revenue, PBT, gross margin, design wins, capacity capex y caja.",
    positive: "Los design wins se convierten en revenue/FCF y el margen no se diluye por expansión.",
    negative: "Atrasos de programas o capex alto con crecimiento de beneficio inferior a la cotización.",
    nextAction: "No extrapolar 110% de order intake; comprobar backlog entregable y PER FY27.",
    negativeAction: "Esperar mejor punto de entrada si el crecimiento no cubre PER >40x.",
    pending: "Confirmar FCF y caja neta; el order intake récord aún no es ingreso reconocido.",
    dataNote: "Precio/mcap/PER LSE; FY25 EPS 5,86p +7%, H1 FY26 revenue aprox. £23,1m y PBT £3,3m; order intake £46,9m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=CNC",
    resultSource: "https://www.lse.co.uk/rns/CNC/final-results-for-the-year-ended-31-december-2025-3l8zjucrukhydtx.html",
    sourceIds: "M20-CNC-01 / M20-CNC-02",
    sources: [
      { id: "M20-CNC-01", date: "2026-08-05", type: "Mercado", supports: "Precio 260p, mcap £236,2m, PER 44,37x, EPS 5,86p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=CNC", note: "Cotización retrasada; microcap." },
      { id: "M20-CNC-02", date: "2026-04-13", type: "Resultados", supports: "FY25 EPS 5,86p +7%, order intake récord £47m y capacidad para contratos de defensa.", url: "https://www.lse.co.uk/rns/CNC/final-results-for-the-year-ended-31-december-2025-3l8zjucrukhydtx.html", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 18, company: "ME Group International", ticker: "MEGP", exchange: "LSE", currency: "GBP", type: "Stalwart / recovery",
    price: 113.2, marketCap: 424.10, per: 7.55, eps: 15.00, dividend: 7.90, yield: 0.06979,
    sales: 154.3, salesGrowth: 0.003, profitGrowth: -0.038, fcf: null, netDebt: -7.5, peg: null,
    scoreLynch: 14, score10: 17, rating: "A", verdict: "CANDIDATA",
    parts: { growth: 4, valuation: 4, balance: 3, size: 4, catalyst: 2 },
    checks: { business: 2, history: 2, growth: 2, value: 2, balance: 2, dividend: 1, insiders: 0, risks: 1, evidence: 2 },
    catalyst: "Lavanderías Wash.ME y vending generan caja recurrente; H1 FY26 EBITDA +7%, net cash £7,5m y buyback/dividend.",
    risk: "Ventas H1 casi planas y PBT -3,8%; dependencia de capex, FX y comportamiento del consumidor.",
    nextEvent: "Trading update FY26 y resultados al 31 de octubre; comprobar guía PBT £69-74m.", nextReview: "2026-10-13",
    metrics: "Wash.ME growth, vending revenue, EBITDA, operating cash, capex, net cash y buybacks.",
    positive: "Wash.ME mantiene doble dígito, PBT vuelve a crecer y caja cubre capex/dividendo.",
    negative: "Caída de vending, capex intensivo consume caja o guía PBT se recorta.",
    nextAction: "Reconciliar PER 7,55x con PBT FY26 y comprobar si la caída del precio es temporal.",
    negativeAction: "No extrapolar la yield si capex y buyback reducen net cash.",
    pending: "Confirmar FCF FY26 y desglose de Wash.ME vs Photo.Me; vigilar guía PBT.",
    dataNote: "Precio/mcap/PER LSE; H1 FY26 revenue £154,3m +0,3%, EBITDA £57,0m +7,1%, PBT £32,7m -3,8%, net cash £7,5m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?shareprice=MEGP",
    resultSource: "https://www.investegate.co.uk/announcement/rns/me-group-international--megp/2026-interim-results/9664180",
    sourceIds: "M20-MEGP-01 / M20-MEGP-02",
    sources: [
      { id: "M20-MEGP-01", date: "2026-08-05", type: "Mercado", supports: "Precio 113,2p, mcap £424,1m, PER 7,55x, EPS 15,00p, dividendo/yield.", url: "https://www.lse.co.uk/SharePrice.html?shareprice=MEGP", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-MEGP-02", date: "2026-07-10", type: "Resultados", supports: "H1 FY26 revenue £154,3m +0,3%, EBITDA +7,1%, PBT -3,8%, net cash £7,5m y guía PBT £69-74m.", url: "https://www.investegate.co.uk/announcement/rns/me-group-international--megp/2026-interim-results/9664180", note: "Resultados intermedios oficiales." },
    ],
  },
  {
    batchOrder: 19, company: "McBride", ticker: "MCB", exchange: "LSE", currency: "GBP", type: "Turnaround / cyclical",
    price: 155.6, marketCap: 264.51, per: 7.98, eps: 19.50, dividend: 0, yield: 0,
    sales: 475.2, salesGrowth: 0.008, profitGrowth: -0.005, fcf: null, netDebt: 120.6, peg: null,
    scoreLynch: 13, score10: 15, rating: "B", verdict: "CANDIDATA",
    parts: { growth: 3, valuation: 4, balance: 2, size: 3, catalyst: 3 },
    checks: { business: 2, history: 1, growth: 2, value: 2, balance: 1, dividend: 1, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "Private label de limpieza esencial; H1 FY26 ventas +0,8%, pipeline de contratos y posible adquisición accretiva.",
    risk: "Deuda neta £120,6m, márgenes ajustados y bajo crecimiento; materias primas y clientes grandes presionan.",
    nextEvent: "FY26 preliminar, fecha prevista 15 septiembre 2026; revisar adquisición y deleveraging.", nextReview: "2026-09-15",
    metrics: "Volume/mix, margin, adjusted EBITDA, net debt/EBITDA, cash conversion y contratos nuevos.",
    positive: "Volumen y margen mejoran sin deuda adicional y el nuevo contrato aumenta EPS/caja.",
    negative: "Se pierde margen por precio/promoción o net debt/EBITDA supera guía.",
    nextAction: "Calcular PER normalizado y EV/EBITDA; seguir deuda más que dividendo.",
    negativeAction: "No comprar solo por PER <8x hasta ver reducción de deuda.",
    pending: "Confirmar FCF FY26, net debt/EBITDA y retorno de la adquisición anunciada.",
    dataNote: "Precio/mcap/PER LSE; H1 FY26 revenue £475,2m +0,8%, adjusted EBITDA £41,8m, EPS ajustado 10,8p, net debt £120,6m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?share=mcbride&shareprice=MCB",
    resultSource: "https://www.investegate.co.uk/announcement/rns/mcbride--mcb/interim-results-for-6m-ended-31-december-2025/9443608",
    sourceIds: "M20-MCB-01 / M20-MCB-02",
    sources: [
      { id: "M20-MCB-01", date: "2026-08-05", type: "Mercado", supports: "Precio 155,6p, mcap £264,5m, PER 7,98x, EPS 19,50p y sin dividendo.", url: "https://www.lse.co.uk/SharePrice.html?share=mcbride&shareprice=MCB", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-MCB-02", date: "2026-02-24", type: "Resultados", supports: "H1 FY26 revenue £475,2m +0,8%, EBITDA ajustado £41,8m, EPS ajustado 10,8p y net debt £120,6m.", url: "https://www.investegate.co.uk/announcement/rns/mcbride--mcb/interim-results-for-6m-ended-31-december-2025/9443608", note: "Resultados oficiales vía RNS." },
    ],
  },
  {
    batchOrder: 20, company: "Marston's", ticker: "MARS", exchange: "LSE", currency: "GBP", type: "Turnaround / cyclical",
    price: 50.9, marketCap: 322.17, per: 4.50, eps: 11.30, dividend: 0, yield: 0,
    sales: 422.7, salesGrowth: -0.011, profitGrowth: 0.079, fcf: -15.6, netDebt: 857.7, peg: null,
    scoreLynch: 10, score10: 13, rating: "C", verdict: "VIGILAR / TURNAROUND",
    parts: { growth: 3, valuation: 5, balance: 1, size: 4, catalyst: 0 },
    checks: { business: 2, history: 1, growth: 1, value: 2, balance: 0, dividend: 0, insiders: 0, risks: 2, evidence: 2 },
    catalyst: "Pubs de marca con EBITDA H1 estable, margen mejorando y desapalancamiento como principal palanca de re-rating.",
    risk: "Deuda ex-IFRS16 £857,7m / 4,7x EBITDA; FCF H1 negativo y sensibilidad a consumo, alquileres y tipos.",
    nextEvent: "FY26 trading update y resultado anual; revisar deuda, cash flow y ventas like-for-like.", nextReview: "2026-11-12",
    metrics: "LFL sales, EBITDA/pub, recurring FCF, net debt/EBITDA, interest cover y cierres/reformas.",
    positive: "Deuda baja y FCF anual vuelve positivo mientras EBITDA por pub mejora.",
    negative: "Deuda no baja, FCF sigue negativo o LFL cae más del 2%.",
    nextAction: "Analizar como turnaround de balance, no como compounder pese a PER 4,5x.",
    negativeAction: "No aumentar hasta ver deuda/EBITDA <4x y FCF anual positivo.",
    pending: "Confirmar FCF anual y trayectoria de deuda; el PER bajo no compensa por sí solo 4,7x leverage.",
    dataNote: "Precio/mcap/PER LSE; H1 FY26 revenue £422,7m -1,1%, EBITDA £85,9m estable, recurring FCF -£15,6m, net debt ex IFRS16 £857,7m.",
    marketSource: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=Marstons&shareprice=MARS",
    resultSource: "https://www.investegate.co.uk/announcement/rns/marston-s--mars/results-for-the-26-weeks-ended-28-march-2026-/9562889",
    sourceIds: "M20-MARS-01 / M20-MARS-02",
    sources: [
      { id: "M20-MARS-01", date: "2026-08-05", type: "Mercado", supports: "Precio 50,9p, mcap £322,2m, PER 4,50x, EPS 11,30p y sin dividendo.", url: "https://www.lse.co.uk/SharePrice.html?mobile_view=desktop&share=Marstons&shareprice=MARS", note: "Cotización retrasada; snapshot para cribado." },
      { id: "M20-MARS-02", date: "2026-05-28", type: "Resultados", supports: "H1 FY26 revenue £422,7m -1,1%, EBITDA £85,9m, PBT subyacente +7,9%, recurring FCF -£15,6m y deuda 4,7x.", url: "https://www.investegate.co.uk/announcement/rns/marston-s--mars/results-for-the-26-weeks-ended-28-march-2026-/9562889", note: "Resultados intermedios oficiales." },
    ],
  },
].map(makeExtraCandidate);

const watchlistRows = objectRows("Watchlist", ["Empresa", "Ticker"]);
const newRows = objectRows("Nuevas_10", ["Empresa", "Ticker"]);
const agendaRows = objectRows("Agenda_Revision", ["Empresa", "Ticker"]);
const checklistRows = objectRows("Checklist_Lynch", ["Empresa", "Ticker"]);
const rankingRows = objectRows("Ranking_10Bagger", ["Empresa", "Ticker"]);
const rankingNewRows = objectRows("Ranking_Nuevas10", ["Empresa", "Ticker"]);
const followRows = objectRows("Seguimiento", ["Empresa", "Ticker"]);
const followNewRows = objectRows("Seguimiento_Nuevas10", ["Empresa", "Ticker"]);

const agendaByTicker = byTicker(agendaRows);
const checklistByTicker = byTicker(checklistRows);
const rankingByTicker = byTicker(rankingRows);
const rankingNewByTicker = byTicker(rankingNewRows);
const followByTicker = byTicker(followRows);
const followNewByTicker = byTicker(followNewRows);

function makeRecord(row, origin) {
  const ticker = asText(getField(row, ["Ticker"])).toUpperCase();
  const agenda = agendaByTicker.get(ticker) ?? {};
  const checklist = checklistByTicker.get(ticker) ?? {};
  const ranking = rankingByTicker.get(ticker) ?? {};
  const rankingNew = rankingNewByTicker.get(ticker) ?? {};
  const follow = origin === "Principal" ? (followByTicker.get(ticker) ?? {}) : (followNewByTicker.get(ticker) ?? {});
  const isNew = origin === "Nuevas 10";
  const scoreLynch = pickNumber(
    getField(checklist, ["Total"]),
    getField(row, ["Score Lynch", "Score Lynch prelim /16"]),
    getField(ranking, ["Score Lynch /16"]),
    getField(rankingNew, ["Score Lynch /16"]),
  );
  const score10 = pickNumber(
    getField(agenda, ["Score 10Bagger"]),
    getField(ranking, ["Score 10Bagger /22"]),
    getField(rankingNew, ["Score 10Bagger /22"]),
    getField(row, ["Score 10Bagger prelim /22"]),
  );

  return {
    origin,
    company: getField(row, ["Empresa"]),
    ticker,
    exchange: getField(row, ["Bolsa"]),
    type: getField(row, ["Tipo / categoría Lynch", "Tipo Lynch"]),
    currency: getField(row, ["Moneda / cuentas"]),
    price: pickNumber(getField(row, ["Precio", "Precio GBX"]), getField(agenda, ["Precio corte"])),
    marketCap: getField(row, ["Capitalización (m)"]),
    per: pickNumber(getField(row, ["PER informado", "PER"]), getField(agenda, ["PER corte"])),
    eps: getField(row, ["EPS"]),
    dividend: getField(row, ["Dividendo anual", "Dividendo"]),
    yield: getField(row, ["Yield"]),
    sales: getField(row, ["Ventas / net contribution último (m)", "Ventas / ingresos último (m)"]),
    salesGrowth: getField(row, ["Crec. ventas"]),
    profitGrowth: getField(row, ["Crec. EBITDA / beneficio"]),
    fcf: getField(row, ["FCF último (m)", "FCF / CFO último (m)"]),
    netDebt: getField(row, ["Deuda neta (+) / caja neta (-) (m)"]),
    peg: getField(row, ["PEG heurístico*"]),
    catalyst: getField(row, ["Catalizador", "Catalizador / tesis"]),
    risk: getField(row, ["Riesgo principal"]),
    nextEvent: firstValue(getField(agenda, ["Evento / fuente"]), getField(row, ["Próximo evento"])),
    nextReview: excelSerialToDate(firstValue(getField(agenda, ["Próxima revisión"]), getField(row, ["Próxima revisión"]))),
    lastReview: excelSerialToDate(firstValue(getField(agenda, ["Última revisión"]), getField(follow, ["Última revisión"]))),
    asOf: excelSerialToDate(firstValue(getField(row, ["As of"]), isNew ? AS_OF : null)),
    marketSource: getField(row, ["Fuente mercado"]),
    resultSource: getField(row, ["Fuente resultados"]),
    sourceIds: firstValue(getField(agenda, ["Fuente IDs"]), `${asText(getField(row, ["Fuente mercado"]))} / ${asText(getField(row, ["Fuente resultados"]))}`),
    metrics: getField(agenda, ["Métricas a seguir"]),
    positive: getField(agenda, ["Señal positiva"]),
    negative: getField(agenda, ["Señal negativa"]),
    nextAction: firstValue(getField(agenda, ["Acción positiva / siguiente"]), getField(follow, ["Acción siguiente"])),
    negativeAction: firstValue(getField(agenda, ["Condición negativa / acción"]), getField(follow, ["Condición de invalidación"])),
    pending: firstValue(getField(agenda, ["Nota / pendiente"]), getField(row, ["Nota de datos"])),
    dataNote: getField(row, ["Nota de datos"]),
    verdict: getField(row, ["Veredicto Lynch", "Estado"]),
    rating: firstValue(getField(agenda, ["Rating"]), getField(ranking, ["Rating relativo"]), getField(rankingNew, ["Rating"]), getField(row, ["Rating relativo"])),
    scoreLynch,
    score10,
    checklist,
    ranking,
    rankingNew,
    newRow: isNew ? row : null,
    follow,
  };
}

const records = [
  ...watchlistRows.map((row) => makeRecord(row, "Principal")),
  ...newRows.map((row) => makeRecord(row, "Nuevas 10")),
  ...extraCandidates,
].sort((a, b) => {
  const scoreA = Number(a.score10 ?? -Infinity);
  const scoreB = Number(b.score10 ?? -Infinity);
  if (scoreA !== scoreB) return scoreB - scoreA;
  const dateA = numericDateKey(a.nextReview);
  const dateB = numericDateKey(b.nextReview);
  if (dateA !== dateB) return dateA - dateB;
  return asText(a.company).localeCompare(asText(b.company));
});

function formatDateInMatrix(matrix, headerIndex) {
  return matrix.map((row) => row.map((value, index) => (index === headerIndex ? excelSerialToDate(value) : asValue(value))));
}

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Maestro_Lynch");
sheet.showGridLines = false;

function mergeWrite(range, value, format) {
  sheet.mergeCells(range);
  const target = sheet.getRange(range);
  target.values = [[value]];
  target.format = format;
  return target;
}

function styleSection(row, title, note, endColumn = "Q") {
  mergeWrite(`A${row}:${endColumn}${row}`, title, {
    fill: COLORS.paleBlue,
    font: { bold: true, color: COLORS.navy, size: 11 },
    verticalAlignment: "center",
  }).format.rowHeight = 23;
  if (note) {
    mergeWrite(`A${row + 1}:${endColumn}${row + 1}`, note, {
      fill: COLORS.lightBlue,
      font: { italic: true, color: COLORS.darkGray, size: 9 },
      wrapText: true,
      verticalAlignment: "center",
    }).format.rowHeight = 26;
  }
  return row + 2;
}

function styleHeader(row, endColumn) {
  const range = sheet.getRange(`A${row}:${endColumn}${row}`);
  range.format = {
    fill: COLORS.blue,
    font: { bold: true, color: COLORS.white, size: 9 },
    wrapText: true,
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  range.format.rowHeight = 34;
}

function addTable(name, headerRow, endColumn, dataRowCount, opts = {}) {
  const dataEnd = headerRow + dataRowCount;
  const table = sheet.tables.add(`A${headerRow}:${endColumn}${dataEnd}`, true, name);
  try { table.style = opts.style ?? "TableStyleMedium2"; } catch {}
  return { table, dataStart: headerRow + 1, dataEnd };
}

function writeBlock({ title, note, headers, rows, tableName, endColumn, headerRow, dateColumns = [], numberFormats = [], rowHeight = 34 }) {
  const dataHeaderRow = styleSection(headerRow, title, note, endColumn);
  sheet.getRange(`A${dataHeaderRow}:${endColumn}${dataHeaderRow}`).values = [headers];
  styleHeader(dataHeaderRow, endColumn);
  if (rows.length > 0) {
    const convertedRows = rows.map((row) => row.map(asValue));
    sheet.getRange(`A${dataHeaderRow + 1}:${endColumn}${dataHeaderRow + rows.length}`).values = convertedRows;
    sheet.getRange(`A${dataHeaderRow + 1}:${endColumn}${dataHeaderRow + rows.length}`).format = {
      wrapText: true,
      verticalAlignment: "center",
    };
    sheet.getRange(`A${dataHeaderRow + 1}:${endColumn}${dataHeaderRow + rows.length}`).format.rowHeight = rowHeight;
    for (const col of dateColumns) {
      sheet.getRange(`${col}${dataHeaderRow + 1}:${col}${dataHeaderRow + rows.length}`).setNumberFormat("yyyy-mm-dd");
    }
    for (const format of numberFormats) {
      sheet.getRange(`${format.column}${dataHeaderRow + 1}:${format.column}${dataHeaderRow + rows.length}`).setNumberFormat(format.format);
    }
  }
  const table = addTable(tableName, dataHeaderRow, endColumn, rows.length);
  return { headerRow: dataHeaderRow, dataStart: dataHeaderRow + 1, dataEnd: dataHeaderRow + rows.length, nextRow: dataHeaderRow + rows.length + 2, table };
}

// -----------------------------------------------------------------------------
// Header and summary
// -----------------------------------------------------------------------------
mergeWrite("A1:Q1", "Maestro Lynch — una sola hoja para investigar, revisar y decidir", {
  fill: COLORS.navy,
  font: { bold: true, color: COLORS.white, size: 16 },
  horizontalAlignment: "left",
  verticalAlignment: "center",
}).format.rowHeight = 32;

mergeWrite("A2:Q2", `${records.length} compañías · corte 2026-08-05 · ranking relativo, datos de mercado, notas pendientes, fuentes e histórico en el mismo libro.`, {
  fill: COLORS.lightBlue,
  font: { italic: true, color: COLORS.darkGray, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
}).format.rowHeight = 28;

sheet.getRange("A4:L4").values = [["Fecha de corte", AS_OF, "Empresas", null, "Revisar ya", null, "Próximas 30 días", null, "Score 10Bagger medio", null, "Control", null]];
sheet.getRange("A4:L4").format = { fill: COLORS.gray, font: { bold: true, color: COLORS.navy }, verticalAlignment: "center" };
sheet.getRange("B4").setNumberFormat("yyyy-mm-dd");
sheet.getRange("D4").formulas = [["=COUNTA($D$9:$D$40)"]];
sheet.getRange("F4").formulas = [["=COUNTIF($C$9:$C$40,\"REVISAR YA\")"]];
sheet.getRange("H4").formulas = [["=COUNTIF($C$9:$C$40,\"PRÓXIMA\")"]];
sheet.getRange("J4").formulas = [["=AVERAGE($O$9:$O$40)"]];
sheet.getRange("L4").formulas = [[`=IF(D4=${records.length},"OK","REVISAR")`]];
sheet.getRange("B4:B4").format = { fill: COLORS.yellow, font: { color: COLORS.input }, horizontalAlignment: "center" };
sheet.getRange("D4:L4").format.horizontalAlignment = "center";
sheet.getRange("J4").setNumberFormat("0.0");
sheet.getRange("L4").conditionalFormats.add("containsText", { text: "OK", format: { fill: COLORS.green, font: { bold: true, color: "#006100" } } });

mergeWrite("A6:Q6", "Mañana: filtra Estado = REVISAR YA → abre la fuente oficial → compara KPI, PER, FCF/caja y deuda → añade una nueva fila en Historial → cambia Veredicto/Rating solo si la evidencia cambia.", {
  fill: COLORS.yellow,
  font: { bold: true, color: COLORS.black, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
}).format.rowHeight = 32;
mergeWrite("A7:Q7", "Leyenda: azul = campo que puedes actualizar; verde = fuente/ID enlazable en el bloque Fuentes; negro = dato de corte o fórmula. La puntuación es una ayuda de proceso, no una recomendación personalizada.", {
  fill: COLORS.white,
  font: { italic: true, color: COLORS.darkGray, size: 9 },
  wrapText: true,
  verticalAlignment: "center",
}).format.rowHeight = 25;

// -----------------------------------------------------------------------------
// Main decision table (sorted by 10-bagger score)
// -----------------------------------------------------------------------------
const summaryHeaders = [
  "Rank 10Bagger",
  "Próxima revisión",
  "Estado",
  "Empresa",
  "Ticker",
  "Origen",
  "Tipo Lynch",
  "Precio corte",
  "PER",
  "Crec. ventas",
  "Crec. beneficio",
  "FCF / CFO",
  "Caja / deuda neta",
  "Score Lynch",
  "Score 10Bagger",
  "Rating",
  "Veredicto",
];
const summaryRows = records.map((record) => [
  null,
  record.nextReview,
  null,
  record.company,
  record.ticker,
  record.origin,
  record.type,
  record.price,
  record.per,
  record.salesGrowth,
  record.profitGrowth,
  record.fcf,
  record.netDebt,
  record.scoreLynch,
  record.score10,
  record.rating,
  record.verdict,
]);
sheet.getRange("A8:Q8").values = [summaryHeaders];
styleHeader(8, "Q");
sheet.getRange(`A9:Q${8 + summaryRows.length}`).values = summaryRows;
sheet.getRange(`A9:Q${8 + summaryRows.length}`).format = { wrapText: true, verticalAlignment: "center" };
sheet.getRange(`A9:Q${8 + summaryRows.length}`).format.rowHeight = 32;

const summaryEnd = 8 + summaryRows.length;
sheet.getRange("D4").formulas = [[`=COUNTA($D$9:$D$${summaryEnd})`]];
sheet.getRange("F4").formulas = [[`=COUNTIF($C$9:$C$${summaryEnd},"REVISAR YA")`]];
sheet.getRange("H4").formulas = [[`=COUNTIF($C$9:$C$${summaryEnd},"PRÓXIMA")`]];
sheet.getRange("J4").formulas = [[`=AVERAGE($O$9:$O$${summaryEnd})`]];
sheet.getRange("L4").formulas = [[`=IF(D4=${records.length},"OK","REVISAR")`]];
sheet.getRange(`A9:A${summaryEnd}`).formulas = records.map((_, index) => [`=RANK(O${9 + index},$O$9:$O$${summaryEnd},0)`]);
sheet.getRange(`C9:C${summaryEnd}`).formulas = records.map((_, index) => [`=IF(B${9 + index}=\"\",\"SIN FECHA\",IF(B${9 + index}<=$B$4,\"REVISAR YA\",IF(B${9 + index}<=$B$4+30,\"PRÓXIMA\",\"PROGRAMADA\")))`]);
sheet.getRange(`B9:B${summaryEnd}`).setNumberFormat("yyyy-mm-dd");
sheet.getRange(`H9:H${summaryEnd}`).setNumberFormat("0.00");
sheet.getRange(`I9:I${summaryEnd}`).setNumberFormat("0.00x");
sheet.getRange(`J9:K${summaryEnd}`).setNumberFormat("0.0%;[Red](0.0%);-");
sheet.getRange(`L9:M${summaryEnd}`).setNumberFormat("#,##0.0;[Red](#,##0.0);-");
sheet.getRange(`N9:O${summaryEnd}`).setNumberFormat("0");
sheet.getRange(`A9:A${summaryEnd}`).format = { font: { bold: true, color: COLORS.black }, horizontalAlignment: "center" };
sheet.getRange(`C9:C${summaryEnd}`).format = { horizontalAlignment: "center", font: { bold: true, color: COLORS.black } };
sheet.getRange(`N9:O${summaryEnd}`).format = { horizontalAlignment: "center", font: { bold: true, color: COLORS.black } };
sheet.getRange(`P9:P${summaryEnd}`).format = { horizontalAlignment: "center", wrapText: true };
sheet.getRange(`B9:B${summaryEnd}`).format = { font: { color: COLORS.input }, horizontalAlignment: "center" };
sheet.getRange(`Q9:Q${summaryEnd}`).format = { font: { color: COLORS.input }, wrapText: true };
try {
  sheet.getRange(`C9:C${summaryEnd}`).conditionalFormats.add("containsText", { text: "REVISAR YA", format: { fill: COLORS.red, font: { bold: true, color: "#9C0006" } } });
  sheet.getRange(`C9:C${summaryEnd}`).conditionalFormats.add("containsText", { text: "PRÓXIMA", format: { fill: COLORS.yellow, font: { bold: true, color: "#9C6500" } } });
  sheet.getRange(`C9:C${summaryEnd}`).conditionalFormats.add("containsText", { text: "PROGRAMADA", format: { fill: COLORS.green, font: { bold: true, color: "#006100" } } });
  sheet.getRange(`O9:O${summaryEnd}`).conditionalFormats.add("cellIs", { operator: "greaterThanOrEqual", formula: 17, format: { fill: COLORS.green } });
  sheet.getRange(`O9:O${summaryEnd}`).conditionalFormats.add("cellIs", { operator: "lessThan", formula: 13, format: { fill: COLORS.red } });
} catch {}
addTable("ResumenDecision", 8, "Q", summaryRows.length);

let nextRow = summaryEnd + 3;

// -----------------------------------------------------------------------------
// Agenda and thesis block
// -----------------------------------------------------------------------------
const agendaBlockRows = records.map((record) => [
  record.nextReview,
  record.company,
  record.ticker,
  record.nextEvent,
  record.metrics,
  record.positive,
  record.negative,
  record.nextAction,
  record.negativeAction,
  record.sourceIds,
  record.pending,
  record.lastReview,
]);
const agendaBlock = writeBlock({
  title: "Agenda y tesis — qué comprobar antes de tomar una decisión",
  note: "Aquí están las preguntas que invalidan o refuerzan la tesis. No borres las notas anteriores: actualiza la fecha, conserva la fuente y añade el cambio en Historial.",
  headers: ["Próxima revisión", "Empresa", "Ticker", "Evento / fuente", "Métricas a seguir", "Señal positiva", "Señal negativa", "Acción siguiente", "Condición negativa / acción", "Fuente IDs", "Nota / pendiente", "Última revisión"],
  rows: agendaBlockRows,
  tableName: "AgendaTesis",
  endColumn: "L",
  headerRow: nextRow,
  dateColumns: ["A", "L"],
  rowHeight: 56,
});
nextRow = agendaBlock.nextRow;

// -----------------------------------------------------------------------------
// Complete market/result snapshot block
// -----------------------------------------------------------------------------
const dataRows = records.map((record) => [
  record.company,
  record.ticker,
  record.exchange,
  record.currency,
  record.marketCap,
  record.eps,
  record.dividend,
  record.yield,
  record.peg,
  record.sales,
  record.catalyst,
  record.risk,
  record.nextEvent,
  record.asOf,
  record.marketSource,
  record.resultSource,
  record.dataNote,
]);
const dataBlock = writeBlock({
  title: "Datos de mercado y tesis — snapshot completo",
  note: "Los números son instantáneas con fecha y moneda local; antes de comparar empresas, comprueba la unidad en Moneda/cuentas y vuelve a abrir las fuentes del bloque de auditoría.",
  headers: ["Empresa", "Ticker", "Bolsa", "Moneda / cuentas", "Capitalización (m)", "EPS", "Dividendo", "Yield", "PEG", "Ventas / ingresos (m)", "Catalizador / tesis", "Riesgo principal", "Próximo evento", "As of", "Fuente mercado", "Fuente resultados", "Nota de datos"],
  rows: dataRows,
  tableName: "DatosCompletos",
  endColumn: "Q",
  headerRow: nextRow,
  dateColumns: ["N"],
  numberFormats: [
    { column: "E", format: "#,##0.0;[Red](#,##0.0);-" },
    { column: "F", format: "0.00;[Red](0.00);-" },
    { column: "G", format: "0.00;[Red](0.00);-" },
    { column: "H", format: "0.0%;[Red](0.0%);-" },
    { column: "I", format: "0.00x;[Red](0.00x);-" },
    { column: "J", format: "#,##0.0;[Red](#,##0.0);-" },
  ],
  rowHeight: 43,
});
sheet.getRange(`O${dataBlock.dataStart}:P${dataBlock.dataEnd}`).format = { font: { color: COLORS.link }, wrapText: true };
nextRow = dataBlock.nextRow;

// -----------------------------------------------------------------------------
// Lynch checklist and scores
// -----------------------------------------------------------------------------
const checklistOutputRows = records.map((record) => {
  const checklist = record.checklist ?? {};
  const fresh = record.newRow ?? {};
  return [
    record.company,
    record.ticker,
    firstValue(getField(checklist, ["Negocio comprensible (0-2)" ]), getField(fresh, ["Comprensible"])),
    firstValue(getField(checklist, ["Historia / catalizador (0-2)" ]), getField(fresh, ["Catalizador"])),
    firstValue(getField(checklist, ["Crecimiento (0-2)" ]), getField(fresh, ["Crecimiento"])),
    firstValue(getField(checklist, ["Valoración (0-2)" ]), getField(fresh, ["PER / PEG"])),
    firstValue(getField(checklist, ["Balance / caja (0-2)" ]), getField(fresh, ["Balance"])),
    getField(checklist, ["Dividendo / recompra (0-1)" ]),
    getField(checklist, ["Insiders / ownership (0-1)" ]),
    firstValue(getField(checklist, ["Riesgos manejables (0-2)" ]), getField(fresh, ["Riesgo / visibilidad"])),
    getField(checklist, ["Evidencia / disciplina (0-2)" ]),
    getField(fresh, ["Historial"]),
    getField(fresh, ["Tamaño / runway"]),
    record.scoreLynch,
    record.score10,
    firstValue(getField(checklist, ["Qué falta comprobar"]), record.pending, record.dataNote),
    record.lastReview ?? record.asOf,
  ];
});
const checklistBlock = writeBlock({
  title: "Checklist Lynch y scoring — herramienta propia para ordenar la investigación",
  note: "La escala obliga a explicar la tesis; no es una escala oficial de Peter Lynch. En las nuevas candidatas se conservan también los sub-scores de tamaño/runway e historial.",
  headers: ["Empresa", "Ticker", "Comprensible", "Historia / catalizador", "Crecimiento", "Valoración / PER-PEG", "Balance / caja", "Dividendo / recompra", "Insiders / ownership", "Riesgos", "Evidencia / disciplina", "Historial", "Tamaño / runway", "Score Lynch", "Score 10Bagger", "Qué falta comprobar", "Última revisión"],
  rows: checklistOutputRows,
  tableName: "ChecklistScores",
  endColumn: "Q",
  headerRow: nextRow,
  dateColumns: ["Q"],
  numberFormats: [
    { column: "C", format: "0" }, { column: "D", format: "0" }, { column: "E", format: "0" }, { column: "F", format: "0" },
    { column: "G", format: "0" }, { column: "H", format: "0" }, { column: "I", format: "0" }, { column: "J", format: "0" },
    { column: "K", format: "0" }, { column: "L", format: "0" }, { column: "M", format: "0" }, { column: "N", format: "0" }, { column: "O", format: "0" },
  ],
  rowHeight: 38,
});
nextRow = checklistBlock.nextRow;

// -----------------------------------------------------------------------------
// Ranking details (keeps the component scores and the reason behind the rank)
// -----------------------------------------------------------------------------
const rankingDetailRows = records.map((record) => {
  const ranking = record.origin === "Principal" ? (record.ranking ?? {}) : (record.rankingNew ?? {});
  return [
    firstValue(getField(ranking, ["Orden", "Posición"])),
    record.company,
    record.ticker,
    record.type,
    firstValue(getField(ranking, ["Capitalización (m)"]), record.marketCap),
    firstValue(getField(ranking, ["PER"]), record.per),
    firstValue(getField(ranking, ["Score Lynch /16"]), record.scoreLynch),
    getField(ranking, ["Crecimiento / runway (0-5)"]),
    firstValue(getField(ranking, ["Valoración (0-5)"]), getField(ranking, ["PER / PEG"])),
    getField(ranking, ["Balance / caja (0-4)"]),
    getField(ranking, ["Tamaño / escala (0-4)"]),
    compactText(firstValue(getField(ranking, ["Catalizador / palanca (0-4)"]), getField(ranking, ["Catalizador"])), 70),
    firstValue(getField(ranking, ["Score 10Bagger /22"]), record.score10),
    getField(ranking, ["Capitalización x10 (m)"]),
    firstValue(getField(ranking, ["Rating relativo", "Rating"]), record.rating),
    compactText(firstValue(getField(ranking, ["Motivo principal / freno", "Qué debe confirmar"]), record.pending), 70),
    record.nextReview,
    firstValue(getField(ranking, ["Fuentes"]), record.sourceIds),
    firstValue(getField(ranking, ["Veredicto actual"]), record.verdict),
  ];
});
const rankingBlock = writeBlock({
  title: "Detalle del ranking — por qué una empresa sube o baja",
  note: "El ranking relativo no es una probabilidad estadística. Conserva los componentes de runway, valoración, balance, escala y catalizador para poder cambiar el orden con una razón explícita.",
  headers: ["Orden origen", "Empresa", "Ticker", "Tipo Lynch", "Capitalización (m)", "PER", "Score Lynch", "Crecimiento / runway", "Valoración", "Balance / caja", "Tamaño / escala", "Catalizador / palanca", "Score 10Bagger", "Capitalización x10 (m)", "Rating", "Motivo / freno", "Próxima revisión", "Fuentes", "Veredicto"],
  rows: rankingDetailRows,
  tableName: "RankingDetalle",
  endColumn: "S",
  headerRow: nextRow,
  dateColumns: ["Q"],
  numberFormats: [
    { column: "E", format: "#,##0.0;[Red](#,##0.0);-" }, { column: "F", format: "0.00x" }, { column: "G", format: "0" },
    { column: "H", format: "0" }, { column: "I", format: "0" }, { column: "J", format: "0" }, { column: "K", format: "0" },
    { column: "L", format: "0" }, { column: "M", format: "0" }, { column: "N", format: "#,##0.0;[Red](#,##0.0);-" },
  ],
  rowHeight: 42,
});
nextRow = rankingBlock.nextRow;

// -----------------------------------------------------------------------------
// Detailed follow-up block
// -----------------------------------------------------------------------------
const followOutputRows = records.map((record) => {
  const follow = record.follow ?? {};
  return [
    record.nextReview,
    record.company,
    record.ticker,
    getField(follow, ["Tipo", "Tipo Lynch"]),
    firstValue(getField(follow, ["Métricas a comparar", "KPI a seguir"]), record.metrics),
    firstValue(getField(follow, ["Dato base", "Dato base"]), record.pending),
    firstValue(getField(follow, ["Qué debe mejorar / mantenerse", "Señal positiva", "Acción si positiva"]), record.positive),
    firstValue(getField(follow, ["Condición de invalidación", "Señal negativa", "Acción si negativa"]), record.negativeAction, record.negative),
    firstValue(getField(follow, ["Acción siguiente", "Acción si positiva"]), record.nextAction),
    firstValue(getField(follow, ["Fuente / evento", "Evento / trigger"]), record.nextEvent),
    firstValue(getField(follow, ["Estado"]), "Pendiente"),
    record.lastReview,
    record.price,
    record.per,
  ];
});
const followBlock = writeBlock({
  title: "Seguimiento detallado — la próxima revisión ya está preparada",
  note: "Cuando llegue una fecha: comprueba el evento, compara contra el dato base, conserva el histórico y actualiza la decisión. La columna Estado de arriba se calcula automáticamente con la fecha de corte.",
  headers: ["Próxima revisión", "Empresa", "Ticker", "Tipo", "Métricas", "Dato base", "Qué mejorar / mantener", "Invalidación / señal negativa", "Acción siguiente", "Fuente / evento", "Estado", "Última revisión", "Precio corte", "PER corte"],
  rows: followOutputRows,
  tableName: "SeguimientoDetallado",
  endColumn: "N",
  headerRow: nextRow,
  dateColumns: ["A", "L"],
  numberFormats: [{ column: "M", format: "0.00" }, { column: "N", format: "0.00x" }],
  rowHeight: 52,
});
nextRow = followBlock.nextRow;

// -----------------------------------------------------------------------------
// Historical snapshots
// -----------------------------------------------------------------------------
const historyMain = objectRows("Historial", ["Empresa", "Ticker"]);
const historyNew = objectRows("Historial_Nuevas10", ["Empresa", "Ticker"]);
const historyOutputRows = [
  ...historyMain.map((row) => [
    null,
    getField(row, ["Empresa"]),
    getField(row, ["Ticker"]),
    getField(row, ["Periodo"]),
    getField(row, ["Tipo"]),
    getField(row, ["Moneda"]),
    null,
    null,
    getField(row, ["EPS"]),
    getField(row, ["Ventas / net contribution (m)"]),
    getField(row, ["Crec. ventas"]),
    getField(row, ["EBITDA / op. profit (m)"]),
    getField(row, ["Crec. EBITDA"]),
    getField(row, ["Beneficio / PAT (m)"]),
    getField(row, ["FCF (m)"]),
    getField(row, ["Caja neta (-) / deuda neta (+) (m)"]),
    getField(row, ["KPI operativo"]),
    null,
    null,
    getField(row, ["Fuente ID"]),
    getField(row, ["Nota"]),
  ]),
  ...historyNew.map((row) => [
    excelSerialToDate(getField(row, ["Fecha snapshot"])),
    getField(row, ["Empresa"]),
    getField(row, ["Ticker"]),
    "Snapshot inicial",
    null,
    getField(row, ["Moneda"]),
    getField(row, ["Precio GBX"]),
    getField(row, ["PER"]),
    getField(row, ["EPS"]),
    getField(row, ["Ventas / ingresos (m)"]),
    getField(row, ["Crec. ventas"]),
    null,
    getField(row, ["Crec. EBITDA / beneficio"]),
    null,
    getField(row, ["FCF / CFO (m)"]),
    getField(row, ["Deuda neta (+) / caja neta (-) (m)"]),
    getField(row, ["Tesis inicial"]),
    getField(row, ["Score Lynch"]),
    getField(row, ["Score 10Bagger"]),
    getField(row, ["Fuente IDs"]),
    "Snapshot inicial conservado para comparar la siguiente revisión.",
  ]),
  ...extraCandidates.map((record) => [
    record.asOf,
    record.company,
    record.ticker,
    "Snapshot inicial",
    record.type,
    record.currency,
    record.price,
    record.per,
    record.eps,
    record.sales,
    record.salesGrowth,
    null,
    record.profitGrowth,
    null,
    record.fcf,
    record.netDebt,
    record.catalyst,
    record.scoreLynch,
    record.score10,
    record.sourceIds,
    "Snapshot inicial de la búsqueda Nuevas 20; añadir una fila nueva en cada revisión.",
  ]),
];
const historyBlock = writeBlock({
  title: "Historial — snapshots que no se deben sobrescribir",
  note: "Añade filas nuevas en la próxima revisión. La foto inicial de las 20 candidatas nuevas y los periodos financieros de la lista principal quedan en el mismo lugar.",
  headers: ["Fecha snapshot", "Empresa", "Ticker", "Periodo / evento", "Tipo", "Moneda", "Precio", "PER", "EPS", "Ventas / ingresos", "Crec. ventas", "EBITDA / op. profit", "Crec. EBITDA", "Beneficio / PAT", "FCF / CFO", "Caja / deuda neta", "KPI / tesis", "Score Lynch", "Score 10Bagger", "Fuente IDs", "Nota"],
  rows: historyOutputRows,
  tableName: "HistorialSnapshots",
  endColumn: "U",
  headerRow: nextRow,
  dateColumns: ["A"],
  numberFormats: [
    { column: "G", format: "0.00" }, { column: "H", format: "0.00x" }, { column: "I", format: "0.00" },
    { column: "J", format: "#,##0.0;[Red](#,##0.0);-" }, { column: "K", format: "0.0%;[Red](0.0%);-" },
    { column: "L", format: "#,##0.0;[Red](#,##0.0);-" }, { column: "M", format: "0.0%;[Red](0.0%);-" },
    { column: "N", format: "#,##0.0;[Red](#,##0.0);-" }, { column: "O", format: "#,##0.0;[Red](#,##0.0);-" },
    { column: "P", format: "#,##0.0;[Red](#,##0.0);-" }, { column: "R", format: "0" }, { column: "S", format: "0" },
  ],
  rowHeight: 36,
});
nextRow = historyBlock.nextRow;

// -----------------------------------------------------------------------------
// Sources / audit block
// -----------------------------------------------------------------------------
const sourceTables = [
  ["Fuentes_Audit", "Fuentes_Audit"],
  ["Fuentes_KN_ATYM", "KN_ATYM"],
  ["Fuentes_Nuevas10", "Nuevas 10"],
];
const sourceOutputRows = [];
for (const [sheetName, group] of sourceTables) {
  const rows = objectRows(sheetName, ["Fuente ID", "Empresa"]);
  for (const row of rows) {
    sourceOutputRows.push([
      group,
      getField(row, ["Fuente ID"]),
      getField(row, ["Empresa"]),
      excelSerialToDate(getField(row, ["Fecha"])),
      getField(row, ["Tipo"]),
      getField(row, ["Qué respalda", "Datos respaldados"]),
      getField(row, ["URL"]),
      getField(row, ["Nota de calidad / uso", "Calidad / limitación", "Uso en el modelo"]),
    ]);
  }
}
for (const record of extraCandidates) {
  for (const source of record.sources ?? []) {
    sourceOutputRows.push([
      "Nuevas 20",
      source.id,
      record.company,
      excelSerialToDate(source.date),
      source.type,
      source.supports,
      source.url,
      source.note,
    ]);
  }
}
const sourceBlock = writeBlock({
  title: "Fuentes y auditoría — URLs para volver a comprobar los datos",
  note: "Mercado = snapshot de precio/ratios; resultados = comunicado, informe anual, SEC o RNS. Actualiza fecha y URL cuando vuelva a revisarse una empresa.",
  headers: ["Grupo", "Fuente ID", "Empresa", "Fecha", "Tipo", "Qué respalda", "URL", "Calidad / uso"],
  rows: sourceOutputRows,
  tableName: "FuentesAudit",
  endColumn: "H",
  headerRow: nextRow,
  dateColumns: ["D"],
  rowHeight: 34,
});
sheet.getRange(`G${sourceBlock.dataStart}:G${sourceBlock.dataEnd}`).format = { font: { color: COLORS.link }, wrapText: true };
nextRow = sourceBlock.nextRow;

// -----------------------------------------------------------------------------
// Priority valuation scenarios
// -----------------------------------------------------------------------------
const valuationRaw = rawTable("Analisis_Prioritario", ["Empresa", "Ticker", "Precio actual (GBX)"]);
const valuationRows = valuationRaw.rows.filter((row) => {
  const company = asText(row[0]);
  const ticker = asText(row[1]);
  return company !== "" && ticker !== "" && ticker.length <= 8 && !/\s/.test(ticker) && norm(ticker) !== "ticker";
}).map((row) => row.map((value, index) => {
  const header = valuationRaw.headers[index] ?? "";
  return norm(header).includes("revision") ? excelSerialToDate(value) : asValue(value);
}));
const valuationEndColumn = String.fromCharCode(64 + valuationRaw.headers.length);
const valuationBlock = writeBlock({
  title: "Valoración por escenarios — hipótesis que deben actualizarse con la evidencia",
  note: "Incluye los escenarios de Rightmove, Jet2, Howdens y 4imprint. Precio de entrada, PER objetivo y margen de seguridad son hipótesis de trabajo, no objetivos oficiales.",
  headers: valuationRaw.headers,
  rows: valuationRows,
  tableName: "ValoracionEscenarios",
  endColumn: valuationEndColumn,
  headerRow: nextRow,
  dateColumns: ["U"],
  rowHeight: 52,
});
nextRow = valuationBlock.nextRow;

// -----------------------------------------------------------------------------
// Deep dossier, kept compact as a single four-column log
// -----------------------------------------------------------------------------
const dossierRaw = sourceValues("Dossier_KN_ATYM");
const dossierOutputRows = [];
let dossierSection = "";
let dossierCompany = "";
for (const row of dossierRaw.slice(3)) {
  const cells = row.map(asText).filter((value) => value !== "");
  if (cells.length === 0) continue;
  if (cells.length === 1) {
    dossierSection = cells[0];
    if (/kainos/i.test(dossierSection)) dossierCompany = "Kainos Group";
    if (/atalaya/i.test(dossierSection)) dossierCompany = "Atalaya Mining";
    continue;
  }
  const joined = cells.join(" | ");
  if (/^Kainos Group$/i.test(cells[0])) dossierCompany = "Kainos Group";
  if (/^Atalaya Mining$/i.test(cells[0])) dossierCompany = "Atalaya Mining";
  dossierOutputRows.push([dossierSection, dossierCompany, cells[0], cells.slice(1).join(" | ")]);
}
const dossierBlock = writeBlock({
  title: "Dossier profundo — Kainos y Atalaya Mining",
  note: "Resumen de datos reportados, lectura Lynch, escenarios, sensibilidad al cobre, opcionalidad y plan de seguimiento. Se conserva aquí para que no haya que saltar a otra pestaña.",
  headers: ["Bloque", "Empresa", "Campo", "Detalle"],
  rows: dossierOutputRows,
  tableName: "DossierCompacto",
  endColumn: "D",
  headerRow: nextRow,
  rowHeight: 30,
});
nextRow = dossierBlock.nextRow;

const registerRaw = rawTable("Registro_KN_ATYM", ["Fecha revisión", "Empresa", "Ticker"]);
const registerRows = registerRaw.rows.filter((row) => {
  const company = asText(row[1]);
  const ticker = asText(row[2]);
  return (company === "Kainos Group" || company === "Atalaya Mining") && ticker !== "";
});
const registerBlock = writeBlock({
  title: "Registro incremental — Kainos y Atalaya",
  note: "Añade una fila por revisión y no edites las anteriores: aquí se conserva qué sabíamos, qué cambió y cuál era la acción siguiente.",
  headers: registerRaw.headers,
  rows: registerRows.map((row) => row.map((value, index) => index === 0 ? excelSerialToDate(value) : value)),
  tableName: "RegistroKNATYM",
  endColumn: String.fromCharCode(64 + registerRaw.headers.length),
  headerRow: nextRow,
  dateColumns: ["A"],
  rowHeight: 42,
});
nextRow = registerBlock.nextRow;

// -----------------------------------------------------------------------------
// Discarded ideas and quality control
// -----------------------------------------------------------------------------
const discardedRaw = rawTable("Descartadas", ["Empresa", "Ticker"]);
const discardedBlock = writeBlock({
  title: "Ideas descartadas — pendientes de volver a cribar si cambia el precio o la evidencia",
  note: "No significa que sean malas empresas; hoy no superan el filtro de precio, riesgo o evidencia.",
  headers: discardedRaw.headers,
  rows: discardedRaw.rows,
  tableName: "IdeasDescartadas",
  endColumn: String.fromCharCode(64 + discardedRaw.headers.length),
  headerRow: nextRow,
  dateColumns: ["C"],
  rowHeight: 42,
});
nextRow = discardedBlock.nextRow;

const checksRow = nextRow;
const checksEnd = checksRow + 4;
styleSection(checksRow, "Control del libro", `Comprobaciones rápidas: la tabla superior debe contener las ${records.length} empresas, una fecha de revisión y un score para cada una.`, "D");
sheet.getRange(`A${checksRow + 2}:D${checksRow + 2}`).values = [["Comprobación", "Valor", "Estado", "Qué significa"]];
styleHeader(checksRow + 2, "D");
sheet.getRange(`A${checksRow + 3}:D${checksRow + 5}`).values = [
  ["Empresas en resumen", null, null, `Debe haber ${records.length} compañías.`],
  ["Fechas de revisión", null, null, "Cada compañía debe tener un siguiente punto de control."],
  ["Scores 10Bagger", null, null, "Cada compañía debe tener score para ordenar la investigación."],
];
sheet.getRange(`B${checksRow + 3}`).formulas = [[`=COUNTA($D$9:$D$${summaryEnd})`]];
sheet.getRange(`C${checksRow + 3}`).formulas = [[`=IF(B${checksRow + 3}=${records.length},"OK","REVISAR")`]];
sheet.getRange(`B${checksRow + 4}`).formulas = [[`=COUNT($B$9:$B$${summaryEnd})`]];
sheet.getRange(`C${checksRow + 4}`).formulas = [[`=IF(B${checksRow + 4}=${records.length},"OK","REVISAR")`]];
sheet.getRange(`B${checksRow + 5}`).formulas = [[`=COUNT($O$9:$O$${summaryEnd})`]];
sheet.getRange(`C${checksRow + 5}`).formulas = [[`=IF(B${checksRow + 5}=${records.length},"OK","REVISAR")`]];
sheet.getRange(`A${checksRow + 3}:D${checksRow + 5}`).format = { wrapText: true, verticalAlignment: "center" };
sheet.getRange(`A${checksRow + 3}:D${checksRow + 5}`).format.rowHeight = 28;
try { sheet.getRange(`C${checksRow + 3}:C${checksRow + 5}`).conditionalFormats.add("containsText", { text: "OK", format: { fill: COLORS.green, font: { bold: true, color: "#006100" } } }); } catch {}

// -----------------------------------------------------------------------------
// Global usability styling
// -----------------------------------------------------------------------------
const usedEndRow = checksRow + 5;
sheet.getRange(`A1:V${usedEndRow}`).format.verticalAlignment = "center";
sheet.getRange(`A1:V${usedEndRow}`).format.font = { name: "Aptos", size: 9, color: COLORS.black };
// Reapply title/headers after the compact global font reset.
sheet.getRange("A1:Q1").format.font = { name: "Aptos Display", bold: true, color: COLORS.white, size: 16 };
sheet.getRange("A2:Q2").format.font = { name: "Aptos", italic: true, color: COLORS.darkGray, size: 10 };
sheet.getRange("A6:Q6").format.font = { name: "Aptos", bold: true, color: COLORS.black, size: 10 };
sheet.getRange("A7:Q7").format.font = { name: "Aptos", italic: true, color: COLORS.darkGray, size: 9 };
for (const headerRow of [8, agendaBlock.headerRow, dataBlock.headerRow, checklistBlock.headerRow, rankingBlock.headerRow, followBlock.headerRow, historyBlock.headerRow, sourceBlock.headerRow, valuationBlock.headerRow, dossierBlock.headerRow, registerBlock.headerRow, discardedBlock.headerRow, checksRow + 2]) {
  const endColumn = headerRow === 8 ? "Q" : headerRow === agendaBlock.headerRow ? "L" : headerRow === dataBlock.headerRow ? "Q" : headerRow === checklistBlock.headerRow ? "Q" : headerRow === rankingBlock.headerRow ? "S" : headerRow === followBlock.headerRow ? "N" : headerRow === historyBlock.headerRow ? "U" : headerRow === sourceBlock.headerRow ? "H" : headerRow === valuationBlock.headerRow ? valuationEndColumn : headerRow === dossierBlock.headerRow ? "D" : headerRow === registerBlock.headerRow ? String.fromCharCode(64 + registerRaw.headers.length) : headerRow === discardedBlock.headerRow ? String.fromCharCode(64 + discardedRaw.headers.length) : "D";
  styleHeader(headerRow, endColumn);
}

// Widths are intentionally capped: long text wraps, while the top decision table stays scannable.
const widths = {
  A: 11, B: 14, C: 14, D: 25, E: 11, F: 18, G: 23, H: 12, I: 10, J: 13, K: 14, L: 14, M: 15, N: 11, O: 13, P: 17, Q: 30,
  R: 34, S: 24, T: 34, U: 34, V: 18,
};
for (const [column, width] of Object.entries(widths)) sheet.getRange(`${column}:${column}`).format.columnWidth = width;
sheet.getRange(`A1:V${usedEndRow}`).format.wrapText = true;
sheet.getRange("A1:V1").format.rowHeight = 32;
sheet.getRange("A2:V2").format.rowHeight = 28;
sheet.getRange("A4:L4").format.rowHeight = 24;
sheet.getRange("A6:Q7").format.rowHeight = 30;
sheet.getRange("A8:Q8").format.rowHeight = 40;
sheet.freezePanes.freezeRows(8);
sheet.freezePanes.freezeColumns(4);

// Inputs / source identifiers are visually distinct but remain editable.
sheet.getRange(`B9:B${summaryEnd}`).format.font = { color: COLORS.input };
sheet.getRange(`Q9:Q${summaryEnd}`).format.font = { color: COLORS.input };
sheet.getRange(`J${agendaBlock.dataStart}:L${agendaBlock.dataEnd}`).format.font = { color: COLORS.link };
sheet.getRange(`O${dataBlock.dataStart}:P${dataBlock.dataEnd}`).format.font = { color: COLORS.link };
sheet.getRange(`T${historyBlock.dataStart}:T${historyBlock.dataEnd}`).format.font = { color: COLORS.link };

// Final inspections and renders.
const inspect = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 4,
  tableMaxCols: 8,
  tableMaxCellChars: 100,
});
await fs.writeFile(`${OUT_DIR}/maestro.inspect.ndjson`, inspect.ndjson ?? String(inspect));
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "single-sheet formula error scan",
});
await fs.writeFile(`${OUT_DIR}/maestro.formula-errors.ndjson`, formulaErrors.ndjson ?? String(formulaErrors));

for (const [range, path] of [["A1:Q42", PREVIEW_TOP], ["A43:Q145", PREVIEW_MIDDLE], [`A${sourceBlock.headerRow}:U${usedEndRow}`, PREVIEW_BOTTOM]]) {
  const preview = await workbook.render({ sheetName: "Maestro_Lynch", range, scale: 1, format: "png" });
  await fs.writeFile(path, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUT_FILE);

console.log(JSON.stringify({
  output: OUT_FILE,
  records: records.length,
  sections: { summaryEnd, agenda: agendaBlock, data: dataBlock, checklist: checklistBlock, follow: followBlock, history: historyBlock, sources: sourceBlock, valuation: valuationBlock, dossier: dossierBlock, discarded: discardedBlock },
  formulaErrors: formulaErrors.ndjson,
}, null, 2));
