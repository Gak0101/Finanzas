export const MADRID_TIME_ZONE = 'Europe/Madrid'

export type MarketSegment = Readonly<{
  open: string
  close: string
}>

export type HolidayCalendar =
  | 'none'
  | 'spain'
  | 'germany'
  | 'euronext'
  | 'uk'
  | 'switzerland'
  | 'us'
  | 'canada'
  | 'brazil'
  | 'mexico'
  | 'japan'
  | 'china'
  | 'hong-kong'
  | 'south-korea'
  | 'india'
  | 'singapore'
  | 'australia'
  | 'south-africa'

export type MarketDefinition = Readonly<{
  id: string
  name: string
  shortName: string
  region: string
  timeZone: string
  sessions: readonly MarketSegment[]
  holidayCalendar: HolidayCalendar
  weekendDays?: readonly number[]
  alwaysOpen?: boolean
}>

export type MarketStatus = 'open' | 'break' | 'closed' | 'weekend' | 'holiday'

export type MarketSnapshot = Readonly<{
  status: MarketStatus
  statusLabel: string
  localTime: string
  nextEventLabel: string | null
  nextEventAt: Date | null
  countdownSeconds: number | null
}>

type LocalParts = {
  year: number
  month: number
  day: number
  weekday: number
  hour: number
  minute: number
  second: number
}

type CalendarDate = Pick<LocalParts, 'year' | 'month' | 'day' | 'weekday'>

const MADRID_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const MADRID_TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const MADRID_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})
const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const LOCAL_PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

export const MARKET_DEFINITIONS: readonly MarketDefinition[] = [
  {
    id: 'crypto',
    name: 'Criptoactivos',
    shortName: 'Crypto',
    region: 'Global',
    timeZone: MADRID_TIME_ZONE,
    sessions: [],
    holidayCalendar: 'none',
    alwaysOpen: true,
  },
  {
    id: 'xetra',
    name: 'Xetra / Frankfurt',
    shortName: 'Xetra',
    region: 'Europa',
    timeZone: 'Europe/Berlin',
    sessions: [{ open: '09:00', close: '17:30' }],
    holidayCalendar: 'germany',
  },
  {
    id: 'bme',
    name: 'Bolsa de Madrid (BME)',
    shortName: 'BME Madrid',
    region: 'Europa',
    timeZone: MADRID_TIME_ZONE,
    sessions: [{ open: '09:00', close: '17:30' }],
    holidayCalendar: 'spain',
  },
  {
    id: 'euronext',
    name: 'Euronext',
    shortName: 'Euronext',
    region: 'Europa',
    timeZone: 'Europe/Paris',
    sessions: [{ open: '09:00', close: '17:30' }],
    holidayCalendar: 'euronext',
  },
  {
    id: 'lse',
    name: 'London Stock Exchange',
    shortName: 'LSE',
    region: 'Europa',
    timeZone: 'Europe/London',
    sessions: [{ open: '08:00', close: '16:30' }],
    holidayCalendar: 'uk',
  },
  {
    id: 'six',
    name: 'SIX Swiss Exchange',
    shortName: 'SIX',
    region: 'Europa',
    timeZone: 'Europe/Zurich',
    sessions: [{ open: '09:00', close: '17:30' }],
    holidayCalendar: 'switzerland',
  },
  {
    id: 'nasdaq-nyse',
    name: 'NYSE / Nasdaq',
    shortName: 'Wall Street',
    region: 'Estados Unidos',
    timeZone: 'America/New_York',
    sessions: [{ open: '09:30', close: '16:00' }],
    holidayCalendar: 'us',
  },
  {
    id: 'tsx',
    name: 'Toronto Stock Exchange',
    shortName: 'TSX',
    region: 'Canadá',
    timeZone: 'America/Toronto',
    sessions: [{ open: '09:30', close: '16:00' }],
    holidayCalendar: 'canada',
  },
  {
    id: 'b3',
    name: 'B3 São Paulo',
    shortName: 'B3',
    region: 'Brasil',
    timeZone: 'America/Sao_Paulo',
    sessions: [{ open: '10:00', close: '17:00' }],
    holidayCalendar: 'brazil',
  },
  {
    id: 'bmv',
    name: 'Bolsa Mexicana de Valores',
    shortName: 'BMV',
    region: 'México',
    timeZone: 'America/Mexico_City',
    sessions: [{ open: '08:30', close: '15:00' }],
    holidayCalendar: 'mexico',
  },
  {
    id: 'jse',
    name: 'Johannesburg Stock Exchange',
    shortName: 'JSE',
    region: 'Sudáfrica',
    timeZone: 'Africa/Johannesburg',
    sessions: [{ open: '09:00', close: '17:00' }],
    holidayCalendar: 'south-africa',
  },
  {
    id: 'nse-india',
    name: 'National Stock Exchange India',
    shortName: 'NSE India',
    region: 'India',
    timeZone: 'Asia/Kolkata',
    sessions: [{ open: '09:15', close: '15:30' }],
    holidayCalendar: 'india',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Stock Exchange',
    shortName: 'TSE',
    region: 'Japón',
    timeZone: 'Asia/Tokyo',
    sessions: [
      { open: '09:00', close: '11:30' },
      { open: '12:30', close: '15:30' },
    ],
    holidayCalendar: 'japan',
  },
  {
    id: 'shanghai-shenzhen',
    name: 'Shanghai / Shenzhen',
    shortName: 'China A-shares',
    region: 'China',
    timeZone: 'Asia/Shanghai',
    sessions: [
      { open: '09:30', close: '11:30' },
      { open: '13:00', close: '15:00' },
    ],
    holidayCalendar: 'china',
  },
  {
    id: 'hong-kong',
    name: 'Hong Kong Stock Exchange',
    shortName: 'HKEX',
    region: 'Hong Kong',
    timeZone: 'Asia/Hong_Kong',
    sessions: [
      { open: '09:30', close: '12:00' },
      { open: '13:00', close: '16:00' },
    ],
    holidayCalendar: 'hong-kong',
  },
  {
    id: 'south-korea',
    name: 'Korea Exchange',
    shortName: 'KRX',
    region: 'Corea del Sur',
    timeZone: 'Asia/Seoul',
    sessions: [{ open: '09:00', close: '15:30' }],
    holidayCalendar: 'south-korea',
  },
  {
    id: 'taiwan',
    name: 'Taiwan Stock Exchange',
    shortName: 'TWSE',
    region: 'Taiwán',
    timeZone: 'Asia/Taipei',
    sessions: [{ open: '09:00', close: '13:30' }],
    holidayCalendar: 'china',
  },
  {
    id: 'singapore',
    name: 'Singapore Exchange',
    shortName: 'SGX',
    region: 'Singapur',
    timeZone: 'Asia/Singapore',
    sessions: [
      { open: '09:00', close: '12:00' },
      { open: '13:00', close: '17:00' },
    ],
    holidayCalendar: 'singapore',
  },
  {
    id: 'sydney',
    name: 'Australian Securities Exchange',
    shortName: 'ASX',
    region: 'Australia',
    timeZone: 'Australia/Sydney',
    sessions: [{ open: '10:00', close: '16:00' }],
    holidayCalendar: 'australia',
  },
]

const MARKET_BY_ID = new Map(MARKET_DEFINITIONS.map((market) => [market.id, market]))

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dateKey(value: Pick<LocalParts, 'year' | 'month' | 'day'>) {
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`
}

function parseTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return { hour, minute }
}

function formatCalendarDate(parts: Pick<LocalParts, 'year' | 'month' | 'day'>) {
  return CALENDAR_DATE_FORMATTER.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)))
}

function getLocalParts(value: Date, timeZone: string): LocalParts {
  let formatter = LOCAL_PARTS_FORMATTERS.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    LOCAL_PARTS_FORMATTERS.set(timeZone, formatter)
  }
  const values = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]))
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday)
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: weekday === -1 ? 0 : weekday,
    hour: Math.min(23, Number(values.hour)),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function addCalendarDays(value: CalendarDate, offset: number): CalendarDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day + offset, 12))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  }
}

function localDateTimeToDate(date: CalendarDate, time: string, timeZone: string) {
  const { hour, minute } = parseTime(time)
  const targetAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0)
  let candidate = targetAsUtc

  // Solve the timezone offset iteratively. This keeps the calculation correct
  // in the weeks where Europe and the US change daylight-saving time on dates
  // that do not coincide.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getLocalParts(new Date(candidate), timeZone)
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
    const correction = targetAsUtc - actualAsUtc
    candidate += correction
    if (correction === 0) break
  }

  return new Date(candidate)
}

function easterSunday(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function moveCalendarDate(month: number, day: number, offset: number, year: number) {
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12))
  return dateKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

function fixedHoliday(year: number, month: number, day: number, observed = false) {
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (observed) {
    const weekday = date.getUTCDay()
    if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1)
    if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1)
  }
  return dateKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

function nthWeekday(year: number, month: number, weekday: number, occurrence: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const offset = (weekday - first.getUTCDay() + 7) % 7
  return dateKey({ year, month, day: 1 + offset + (occurrence - 1) * 7 })
}

function lastWeekday(year: number, month: number, weekday: number) {
  const last = new Date(Date.UTC(year, month, 0, 12))
  const offset = (last.getUTCDay() - weekday + 7) % 7
  return dateKey({ year, month, day: last.getUTCDate() - offset })
}

function holidayKeys(year: number, calendar: HolidayCalendar) {
  const easter = easterSunday(year)
  const goodFriday = moveCalendarDate(easter.month, easter.day, -2, year)
  const easterMonday = moveCalendarDate(easter.month, easter.day, 1, year)
  const keys = new Set<string>()
  const add = (...values: string[]) => values.forEach((value) => keys.add(value))

  if (calendar === 'none') return keys

  if (calendar === 'spain') {
    add(fixedHoliday(year, 1, 1), fixedHoliday(year, 1, 6), goodFriday, easterMonday)
    add(fixedHoliday(year, 5, 1), fixedHoliday(year, 8, 15), fixedHoliday(year, 10, 12))
    add(fixedHoliday(year, 11, 1), fixedHoliday(year, 12, 6), fixedHoliday(year, 12, 8), fixedHoliday(year, 12, 25))
  }

  if (calendar === 'germany') {
    add(fixedHoliday(year, 1, 1), goodFriday, easterMonday, fixedHoliday(year, 5, 1))
    add(moveCalendarDate(easter.month, easter.day, 50, year), fixedHoliday(year, 10, 3), fixedHoliday(year, 12, 25), fixedHoliday(year, 12, 26))
    add(fixedHoliday(year, 12, 24), fixedHoliday(year, 12, 31))
  }

  if (calendar === 'euronext') {
    add(fixedHoliday(year, 1, 1), goodFriday, easterMonday, fixedHoliday(year, 5, 1), fixedHoliday(year, 12, 25), fixedHoliday(year, 12, 26))
  }

  if (calendar === 'uk') {
    add(fixedHoliday(year, 1, 1, true), goodFriday, easterMonday)
    add(nthWeekday(year, 5, 1, 1), lastWeekday(year, 5, 1), lastWeekday(year, 8, 1))
    add(fixedHoliday(year, 12, 25, true), fixedHoliday(year, 12, 26, true))
  }

  if (calendar === 'switzerland') {
    add(fixedHoliday(year, 1, 1), goodFriday, easterMonday, moveCalendarDate(easter.month, easter.day, 39, year))
    add(fixedHoliday(year, 8, 1), fixedHoliday(year, 12, 25))
  }

  if (calendar === 'us') {
    add(fixedHoliday(year, 1, 1, true), nthWeekday(year, 1, 1, 3), nthWeekday(year, 2, 1, 3))
    add(lastWeekday(year, 5, 1), goodFriday, fixedHoliday(year, 6, 19, true), fixedHoliday(year, 7, 4, true))
    add(nthWeekday(year, 9, 1, 1), nthWeekday(year, 11, 4, 4), fixedHoliday(year, 12, 25, true))
  }

  if (calendar === 'canada') {
    add(fixedHoliday(year, 1, 1, true), nthWeekday(year, 2, 1, 3), goodFriday)
    add(lastWeekday(year, 5, 1), fixedHoliday(year, 7, 1, true), nthWeekday(year, 8, 1, 1))
    add(nthWeekday(year, 9, 1, 1), nthWeekday(year, 10, 1, 2), fixedHoliday(year, 12, 25, true), fixedHoliday(year, 12, 26, true))
  }

  if (calendar === 'brazil') {
    add(fixedHoliday(year, 1, 1), moveCalendarDate(easter.month, easter.day, -48, year), goodFriday, fixedHoliday(year, 4, 21))
    add(fixedHoliday(year, 5, 1), fixedHoliday(year, 9, 7), fixedHoliday(year, 10, 12), fixedHoliday(year, 11, 2), fixedHoliday(year, 11, 15), fixedHoliday(year, 12, 25))
  }

  if (calendar === 'mexico') {
    add(fixedHoliday(year, 1, 1), nthWeekday(year, 2, 1, 1), nthWeekday(year, 3, 1, 3), fixedHoliday(year, 5, 1))
    add(fixedHoliday(year, 9, 16), nthWeekday(year, 11, 1, 3), fixedHoliday(year, 12, 25))
  }

  if (calendar === 'japan') {
    add(fixedHoliday(year, 1, 1), fixedHoliday(year, 1, 2), fixedHoliday(year, 1, 3), nthWeekday(year, 1, 1, 2))
    add(fixedHoliday(year, 2, 11), fixedHoliday(year, 2, 23), fixedHoliday(year, 4, 29), fixedHoliday(year, 5, 3), fixedHoliday(year, 5, 4), fixedHoliday(year, 5, 5))
    add(nthWeekday(year, 7, 1, 3), fixedHoliday(year, 8, 11), nthWeekday(year, 9, 1, 3), nthWeekday(year, 10, 1, 2), fixedHoliday(year, 11, 3), fixedHoliday(year, 11, 23), fixedHoliday(year, 12, 31))
  }

  if (calendar === 'china' || calendar === 'hong-kong' || calendar === 'south-korea' || calendar === 'singapore' || calendar === 'india' || calendar === 'australia' || calendar === 'south-africa') {
    add(fixedHoliday(year, 1, 1), fixedHoliday(year, 12, 25))
  }

  return keys
}

function isHoliday(date: CalendarDate, calendar: HolidayCalendar) {
  return holidayKeys(date.year, calendar).has(dateKey(date))
}

function isWeekend(date: CalendarDate, market: MarketDefinition) {
  return (market.weekendDays ?? [0, 6]).includes(date.weekday)
}

function nextSessionStart(market: MarketDefinition, now: Date, current: LocalParts, fromOffset = 0) {
  for (let offset = fromOffset; offset <= 370; offset += 1) {
    const date = addCalendarDays(current, offset)
    if (isWeekend(date, market) || isHoliday(date, market.holidayCalendar)) continue
    for (const segment of market.sessions) {
      const at = localDateTimeToDate(date, segment.open, market.timeZone)
      if (at.getTime() > now.getTime()) return at
    }
  }
  return null
}

function statusLabel(status: MarketStatus) {
  if (status === 'open') return 'Abierto'
  if (status === 'break') return 'Pausa intradía'
  if (status === 'holiday') return 'Festivo'
  if (status === 'weekend') return 'Fin de semana'
  return 'Cerrado'
}

export function getMarketById(id: string) {
  return MARKET_BY_ID.get(id) ?? null
}

export function getMarketIdForPosition(position: {
  tipo: string
  ticker: string
  price_ticker?: string | null
  market_symbol?: string | null
}) {
  if (position.tipo.toLocaleLowerCase('es').includes('crypto')) return 'crypto'

  const symbol = (position.market_symbol || position.price_ticker || position.ticker).trim().toUpperCase()
  if (/\.(DE|F)$/.test(symbol)) return 'xetra'
  if (/\.(PA|AS|BR|LS|MI)$/.test(symbol)) return 'euronext'
  if (/\.(L|IL)$/.test(symbol)) return 'lse'
  if (/\.(SW|VX)$/.test(symbol)) return 'six'
  if (/\.(TO|V)$/.test(symbol)) return 'tsx'
  if (/\.(SA)$/.test(symbol)) return 'b3'
  if (/\.(MX)$/.test(symbol)) return 'bmv'
  if (/\.(JO)$/.test(symbol)) return 'jse'
  if (/\.(NS|BO)$/.test(symbol)) return 'nse-india'
  if (/\.(T)$/.test(symbol)) return 'tokyo'
  if (/\.(SS|SZ)$/.test(symbol)) return 'shanghai-shenzhen'
  if (/\.(HK)$/.test(symbol)) return 'hong-kong'
  if (/\.(KS)$/.test(symbol)) return 'south-korea'
  if (/\.(TW)$/.test(symbol)) return 'taiwan'
  if (/\.(SG)$/.test(symbol)) return 'singapore'
  if (/\.(AX)$/.test(symbol)) return 'sydney'
  return 'nasdaq-nyse'
}

export function formatMadridDateTime(value: Date, withDate = false) {
  return (withDate ? MADRID_DATE_FORMATTER : MADRID_TIME_FORMATTER).format(value)
}

export function formatMadridDate(value: Date) {
  return MADRID_DATE_ONLY_FORMATTER.format(value)
}

export function getMarketSnapshot(market: MarketDefinition, now: Date): MarketSnapshot {
  if (market.alwaysOpen) {
    return {
      status: 'open',
      statusLabel: 'Abierto 24/7',
      localTime: formatMadridDateTime(now),
      nextEventLabel: null,
      nextEventAt: null,
      countdownSeconds: null,
    }
  }

  const current = getLocalParts(now, market.timeZone)
  const calendarDate: CalendarDate = current
  const weekend = isWeekend(calendarDate, market)
  const holiday = !weekend && isHoliday(calendarDate, market.holidayCalendar)
  const closedStatus: MarketStatus = weekend ? 'weekend' : holiday ? 'holiday' : 'closed'

  if (weekend || holiday) {
    const nextOpen = nextSessionStart(market, now, current, 1)
    return {
      status: closedStatus,
      statusLabel: statusLabel(closedStatus),
      localTime: formatMadridDateTime(now),
      nextEventLabel: nextOpen ? 'Abre' : null,
      nextEventAt: nextOpen,
      countdownSeconds: nextOpen ? Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 1000)) : null,
    }
  }

  for (let index = 0; index < market.sessions.length; index += 1) {
    const segment = market.sessions[index]
    const openAt = localDateTimeToDate(calendarDate, segment.open, market.timeZone)
    const closeAt = localDateTimeToDate(calendarDate, segment.close, market.timeZone)

    if (now.getTime() < openAt.getTime()) {
      return {
        status: 'closed',
        statusLabel: statusLabel('closed'),
        localTime: formatMadridDateTime(now),
        nextEventLabel: 'Abre',
        nextEventAt: openAt,
        countdownSeconds: Math.max(0, Math.floor((openAt.getTime() - now.getTime()) / 1000)),
      }
    }

    if (now.getTime() < closeAt.getTime()) {
      return {
        status: 'open',
        statusLabel: statusLabel('open'),
        localTime: formatMadridDateTime(now),
        nextEventLabel: 'Cierra',
        nextEventAt: closeAt,
        countdownSeconds: Math.max(0, Math.floor((closeAt.getTime() - now.getTime()) / 1000)),
      }
    }

    const nextSegment = market.sessions[index + 1]
    if (nextSegment) {
      const nextOpenAt = localDateTimeToDate(calendarDate, nextSegment.open, market.timeZone)
      if (now.getTime() < nextOpenAt.getTime()) {
        return {
          status: 'break',
          statusLabel: statusLabel('break'),
          localTime: formatMadridDateTime(now),
          nextEventLabel: 'Reanuda',
          nextEventAt: nextOpenAt,
          countdownSeconds: Math.max(0, Math.floor((nextOpenAt.getTime() - now.getTime()) / 1000)),
        }
      }
    }
  }

  const nextOpen = nextSessionStart(market, now, current, 1)
  return {
    status: 'closed',
    statusLabel: statusLabel('closed'),
    localTime: formatMadridDateTime(now),
    nextEventLabel: nextOpen ? 'Abre' : null,
    nextEventAt: nextOpen,
    countdownSeconds: nextOpen ? Math.max(0, Math.floor((nextOpen.getTime() - now.getTime()) / 1000)) : null,
  }
}

export function formatCountdown(seconds: number | null) {
  if (seconds === null) return 'Sin cuenta atrás'
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const remainingSeconds = total % 60
  if (days > 0) return `${days} d ${pad(hours)} h`
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`
}

export function formatNextEvent(value: Date | null, now: Date) {
  if (!value) return null
  const nowParts = getLocalParts(now, MADRID_TIME_ZONE)
  const eventParts = getLocalParts(value, MADRID_TIME_ZONE)
  const sameDay = dateKey(nowParts) === dateKey(eventParts)
  return sameDay ? formatMadridDateTime(value) : `${formatCalendarDate(eventParts)} · ${formatMadridDateTime(value)}`
}
