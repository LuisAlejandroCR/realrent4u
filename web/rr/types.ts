// Data contract — mirrors the JSON files in /public/data. Do not change shapes here
// without changing the pipeline that generates them.

export type Lang = "en" | "es";

export interface Address {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string | null;
  units: string | null;
  use_code: string | null;
  use_description: string | null;
  source_dataset?: string;
  retrieved_at: string | null;
}

export type RuleStatus = "in_force" | "not_yet_effective" | "pending" | "failed";
export type LookupResult = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending";

export interface Rule {
  team_rule_id: string;
  jurisdiction: string;
  level: string;
  category: string;
  status: RuleStatus;
  title: string;
  requirement: string;
  citation: string | null;
  source_url: string | null;
  quoted_span: string | null;
  coverage_conditions?: { text?: string | null; [k: string]: unknown } | null;
  overrides?: string[] | null;
  penalty?: string | null;
  retrieved_at?: string | null;
  effective_date?: string | null;
  conflict_flag?: boolean;
  conflict_note?: string | null;
  key_value?: string | null;
}

export interface LookupItem {
  team_rule_id: string;
  result: LookupResult;
  explanation: string;
  explanation_es?: string;
  conflict_flag: boolean;
  reason?: string;
}

export interface Jurisdiction {
  jurisdiction: string | null;
  place?: string | null;
  county?: string | null;
  state?: string | null;
  match?: string;
  source?: string;
}

export interface ChangeTest {
  test_id: string;
  title: string;
  type: string;
  rule_ids: string[];
  as_of?: string;
  as_of_before?: string;
  as_of_after?: string;
  states?: string[];
  conflict_with?: string[];
  expected_behavior?: string;
}

export interface ChangeResult {
  test_id: string;
  affected_address_ids?: string[];
  conflict_address_ids?: string[];
  notes?: string;
  /** Organizer rule id → extracted team_rule_id (null when no rule was extracted). */
  matched?: Record<string, string | null>;
}

export interface Manifest {
  generated_at: string;
  uses_fixtures: boolean;
  sources: Record<string, { kind: string; path?: string; count?: number; files?: string[] }>;
  lookup_dates: string[];
  warnings: string[];
  demo_dates: string[];
  default_as_of: string;
}
