/**
 * Core data contracts for Tax Editorial Agents system
 * Production-ready schemas for German tax law ingestion and processing
 */

// Core RuleSpec for engines & mapping
export interface RuleSpec {
  rule_id: string;
  topic: string;
  effective: {
    from: string; // ISO date
    to: string | null; // ISO date or null for open-ended
  };
  form_map: Array<{
    form: string; // e.g., "Anlage N"
    kz: string; // Kennziffer
    type: 'amount' | 'bool' | 'string' | 'enum';
  }>;
  definition: string;
  parameters: Record<string, any>;
  logic: string; // DSL or prose + examples
  computation_notes?: string[];
  citations: Array<{
    doc_id: string;
    paragraph: string;
    page?: number;
  }>;
  tests: Array<{
    input: Record<string, any>;
    expect: Record<string, any>;
  }>;
}

// Developer-ready CalcSpec
export interface CalcSpec {
  fn: string;
  inputs: Array<{
    name: string;
    type: 'decimal' | 'integer' | 'boolean' | 'string';
  }>;
  returns: {
    type: 'decimal' | 'integer' | 'boolean' | 'string';
  };
  pre: string[]; // preconditions
  post: string[]; // postconditions
  rounding?: string; // e.g., "HALF_UP@2"
  example: Array<{
    in: Record<string, any>;
    out: any;
  }>;
}

// Editorial content for users
export interface EditorialNote {
  id: string;
  audience: 'user' | 'reviewer' | 'dev';
  text: string;
  citations: Array<{
    doc_id: string;
    paragraph: string;
    page?: number;
  }>;
}

export interface UserStep {
  step: string;
  why: string;
  how: string;
  citations: Array<{
    doc_id: string;
    paragraph: string;
    page?: number;
  }>;
}

// Document and source management
export interface LegalDocument {
  doc_id: string;
  title: string;
  doc_type: 'LAW' | 'BMF' | 'RULING' | 'FORM' | 'GUIDANCE';
  citation_id: string; // BGBl, BStBl, ECLI, Az
  date_published: string;
  date_effective: [string, string | null]; // [from, to)
  version_hash: string;
  url: string;
  mime_type: string;
  sha256: string;
}

export interface DocumentChunk {
  chunk_id: string;
  doc_id: string;
  paragraph_ref: string; // e.g., "§9 Abs.1"
  page?: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text: string;
  embedding?: number[];
}

export interface CitationLink {
  src_paragraph: string;
  dst: {
    type: 'NORM' | 'RULING' | 'BMF' | 'FORM';
    id: string;
  };
  relation: 'cites' | 'interprets' | 'applies' | 'supersedes';
}

// Source management
export interface AuthorizedSource {
  domain: string;
  sitemap?: string;
  priority: number;
  last_crawled?: string;
  etag?: string;
}

export interface FetchResult {
  url: string;
  status: number;
  mime: string;
  sha256: string;
  published?: string;
  last_modified?: string;
  etag?: string;
}

// Change tracking
export interface DocumentDiff {
  doc_id: string;
  old_version_hash: string;
  new_version_hash: string;
  changed: boolean;
  diff: Array<{
    paragraph: string;
    before: string;
    after: string;
    change_type: 'added' | 'modified' | 'deleted';
  }>;
  impact_hints: string[];
}

// Quality gates
export interface QualityGateResult {
  gate_name: string;
  passed: boolean;
  score?: number;
  threshold?: number;
  violations: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
}

// Agent execution context
export interface EditorialAgentContext {
  topic?: string;
  jurisdiction: string; // 'DE'
  sources: AuthorizedSource[];
  since?: string; // ISO date for incremental updates
  quality_gates: string[]; // which gates to enforce
}

// Agent results
export interface EditorialAgentResult {
  agent: string;
  status: 'success' | 'error' | 'partial';
  execution_time: number;
  artifacts: Array<{
    type: string;
    id: string;
    data: any;
  }>;
  quality_results: QualityGateResult[];
  warnings: string[];
  next_agents?: string[];
}

// Complete editorial package
export interface EditorialPackage {
  package_id: string;
  topic: string;
  version: string;
  created_at: string;
  rulespecs: RuleSpec[];
  calcspecs: CalcSpec[];
  editorial_notes: EditorialNote[];
  user_steps: UserStep[];
  kz_mappings: Array<{
    rule_id: string;
    form: string;
    kz: string;
    type: string;
  }>;
  examples: Array<{
    title: string;
    scenario: Record<string, any>;
    calc_trace: Array<{
      step: string;
      rule_id: string;
      input: Record<string, any>;
      output: any;
    }>;
  }>;
  faq: Array<{
    q: string;
    a: string;
    citations: Array<{
      doc_id: string;
      paragraph: string;
    }>;
  }>;
  citations_used: Array<{
    doc_id: string;
    paragraph: string;
    page?: number;
  }>;
  quality_summary: {
    coverage_score: number;
    consistency_score: number;
    authority_score: number;
    total_violations: number;
  };
}