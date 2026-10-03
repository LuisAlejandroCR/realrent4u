// types.ts: data shapes the demo reads from public/data/ (mirror of realrent/contracts.py and the templates).
// Every field from the pipeline is optional-safe: the UI must render with partial or fixture data.

export type Result = "applies" | "unknown" | "superseded" | "not_yet_effective" | "pending";
export type RuleStatus = "in_force" | "not_yet_effective" | "pending" | "failed";

export interface CoverageConditions {
  text?: string | null;
  built_cutoff_date?: string | null;
  built_cutoff_basis?: string | null;
  built_cutoff_direction?: string | null;
  min_units?: number | null;
  exempts_small_owner_occupied?: boolean | null;
  displaces_state_rule?: boolean | null;
}

export interface Rule {
  team_rule_id: string;
  jurisdiction: string;
  level: "state" | "city";
  category: string;
  status: RuleStatus;
  title: string;
  requirement: string;
  key_value?: string | null;
  coverage_conditions?: CoverageConditions | string | null;
  exemptions?: string | null;
  penalty?: string | null;
  overrides?: string[];
  interaction?: string | null;
  effective_date?: string | null;
  citation: string;
  source_doc_id?: string | null;
  source_url: string;
  quoted_span: string;
  confidence?: number | null;
  conflict_flag?: boolean;
  conflict_note?: string | null;
  retrieved_at?: string | null;
}

export interface LookupItem {
  team_rule_id: string;
  result: Result;
  explanation: string;
  explanation_es?: string;
  conflict_flag: boolean;
  reason?: string | null;
}

export interface LookupFile {
  as_of: string;
  lookups: Record<string, LookupItem[]>;
}

export interface Jurisdiction {
  state: string;
  county: string | null;
  place: string | null;
  jurisdiction: string | null;
  match: "exact" | "fallback" | "none";
  source: string;
}

export interface Address {
  address_id: string;
  street_address: string;
  postal_city: string;
  state: string;
  zip: string;
  year_built: string;
  units: string;
  use_code: string;
  use_description: string;
  source_dataset: string;
  retrieved_at: string;
}

export interface ChangeResult {
  affected_address_ids?: string[];
  conflict_flag_address_ids?: string[];
  notes?: string;
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
  expected_behavior: string;
}

export interface CorpusDoc {
  url: string;
  retrieved_at: string | null;
  capture: string;
  source_type: string;
  jurisdictions: string;
}

export interface SourceInfo {
  kind: string;
  path?: string;
  count?: number;
  files?: { as_of: string; path: string; items: number }[];
}

export interface Manifest {
  generated_at: string;
  uses_fixtures: boolean;
  sources: Record<string, SourceInfo>;
  lookup_dates: string[];
  demo_dates: string[];
  default_as_of: string;
  warnings: string[];
}
