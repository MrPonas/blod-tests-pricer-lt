export interface Lab {
  id: number;
  name: string;
  slug: string;
  website_url: string;
  booking_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: number;
  name_lt: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
  sort_order: number;
}

export interface Test {
  id: number;
  canonical_name_lt: string;
  canonical_name_en: string | null;
  category_id: number | null;
  aliases: string[];
  match_key: string | null;
  created_at: string;
  category?: Category;
}

export interface Price {
  id: number;
  test_id: number;
  lab_id: number;
  price_eur: number;
  lab_test_name: string | null;
  lab_test_url: string | null;
  scraped_at: string;
  is_stale: boolean;
  lab?: Lab;
}

export interface ScrapeRun {
  id: number;
  lab_id: number;
  started_at: string;
  finished_at: string | null;
  status: 'success' | 'partial' | 'failed' | null;
  tests_updated: number;
  error_message: string | null;
  lab?: Lab;
}

export interface PendingReview {
  id: number;
  lab_id: number;
  raw_name: string;
  price_eur: number | null;
  scraped_at: string;
  is_resolved: boolean;
  resolved_test_id: number | null;
  lab?: Lab;
}

export interface TestWithPrices extends Test {
  prices: (Price & { lab: Lab })[];
}

export interface ExtractedTest {
  name: string;
  price_eur: number;
  url: string | null;
}
