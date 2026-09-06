export type Source = { label: string; url: string; period?: string }
export type Candidate = {
  symbol: string; marketSymbol: string | null; name: string; held: boolean;
  rank: number | null; rating: number | null; thesis: string; risks: string;
  nextReview: string | null; targetEur: number | null; source: string;
}
export type FollowupItem = {
  symbol: string; name: string; held: boolean; decision: string; reason: string;
  price: number | null; currency: string | null; priceEur: number | null;
  quoteAt: string | null; change: string | null; nextReview: string | null;
  sources: Source[]; rank: number | null; rating: number | null;
  thesis: string; risks: string; news: { title: string; url: string; date: string }[];
  metrics: { label: string; value: string; period?: string; sources: Source[] }[];
}
export type FollowupReport = {
  asOf: string; market: { status: string; nextOpen: string | null };
  summary: string; items: FollowupItem[]; warnings: string[];
  newsletter: { name: string; subject: string | null; date: string | null; status: string; pageUrl: string; feedUrl: string };
  lynchContext: { mode: 'indexed' | 'fallback'; pages: number[]; source: string };
  whatsapp?: { enabled: boolean; status: 'sent' | 'skipped' | 'failed'; messageId?: string | null; warning?: string };
  analysis: string | null;
}

export type FollowupScheduleConfig = {
  enabled: boolean
  timezone: string
  weekdays: number[]
  slots: string[]
  maxNotificationsPerDay: number
  canalWhatsapp: boolean
  canalTelegram: boolean
}
