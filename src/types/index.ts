export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: Date;
  content?: string;
  analysis?: DocumentAnalysis;
}

export interface DocumentAnalysis {
  documentType: 'tax_form' | 'receipt' | 'invoice' | 'donation' | 'salary' | 'other';
  taxRelevance: 'high' | 'medium' | 'low' | 'none';
  extractedData: Record<string, any>;
  expertOpinion: ExpertOpinion;
  suggestedActions: string[];
  confidence: number;
}

export interface ExpertOpinion {
  summary: string;
  taxImplications: string[];
  legalConsiderations: string[];
  recommendations: string[];
  potentialDeductions: DeductionSuggestion[];
  warnings: string[];
}

export interface DeductionSuggestion {
  category: string;
  amount: number;
  description: string;
  confidence: number;
  requirements: string[];
}

export interface TaxDeclaration {
  personalInfo: PersonalInfo;
  income: IncomeData;
  deductions: DeductionData;
  documents: Document[];
  calculatedTax: number;
  refundAmount: number;
}

export interface PersonalInfo {
  firstName: string;
  lastName: string;
  address: string;
  taxId: string;
  maritalStatus: string;
  children: number;
}

export interface IncomeData {
  salary: number;
  freelance: number;
  investments: number;
  other: number;
  total: number;
}

export interface DeductionData {
  workExpenses: number;
  donations: number;
  healthInsurance: number;
  education: number;
  other: number;
  total: number;
}

export interface TaxResearchResult {
  query: string;
  results: TaxLawUpdate[];
  summary: string;
  relevantChanges: string[];
}

export interface TaxLawUpdate {
  title: string;
  description: string;
  effectiveDate: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  source: string;
}