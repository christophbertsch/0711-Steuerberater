/**
 * Editorial Manager - Orchestrates the complete Tax Editorial Agents pipeline
 * Manages the DAG execution from Tavily ingestion to publication
 */

import { 
  EditorialAgentContext, 
  EditorialPackage, 
  AuthorizedSource,
  RuleSpec,
  EditorialNote,
  UserStep,
  QualityGateResult
} from './types';

import { TavilyFetcher } from './agents/TavilyFetcher';
import { RuleSpecExtractor } from './agents/RuleSpecExtractor';
import { EditorialSynthesizer } from './agents/EditorialSynthesizer';

export interface EditorialIngestRequest {
  topic: string;
  queries: string[];
  jurisdiction?: string;
  sources?: AuthorizedSource[];
  quality_gates?: string[];
  incremental_since?: string;
}

export interface EditorialIngestResult {
  success: boolean;
  package_id: string;
  execution_time: number;
  agents_executed: string[];
  quality_summary: {
    coverage_score: number;
    consistency_score: number;
    authority_score: number;
    total_violations: number;
  };
  artifacts: {
    rulespecs: RuleSpec[];
    editorial_notes: EditorialNote[];
    user_steps: UserStep[];
  };
  warnings: string[];
  errors: string[];
}

export class EditorialManager {
  private tavilyFetcher: TavilyFetcher;
  private ruleSpecExtractor: RuleSpecExtractor;
  private editorialSynthesizer: EditorialSynthesizer;

  constructor() {
    this.tavilyFetcher = new TavilyFetcher();
    this.ruleSpecExtractor = new RuleSpecExtractor();
    this.editorialSynthesizer = new EditorialSynthesizer();
  }

  /**
   * Run complete editorial ingestion pipeline
   */
  async runEditorialIngest(request: EditorialIngestRequest): Promise<EditorialIngestResult> {
    const startTime = Date.now();
    const packageId = `editorial_${request.topic.replace(/\s+/g, '_')}_${Date.now()}`;
    
    console.log(`🚀 Starting editorial ingestion for topic: ${request.topic}`);
    console.log(`📦 Package ID: ${packageId}`);

    const context: EditorialAgentContext = {
      topic: request.topic,
      jurisdiction: request.jurisdiction || 'DE',
      sources: request.sources || TavilyFetcher.getDefaultSources(),
      since: request.incremental_since,
      quality_gates: request.quality_gates || ['authority_gate', 'coverage_gate', 'consistency_gate']
    };

    const agentsExecuted: string[] = [];
    const allWarnings: string[] = [];
    const allErrors: string[] = [];
    const qualityResults: QualityGateResult[] = [];

    try {
      // Step 1: TAVILY_FETCHER - Fetch authoritative sources
      console.log(`\n🔍 Step 1: Fetching sources with Tavily...`);
      const fetchResult = await this.tavilyFetcher.execute(context, request.queries);
      agentsExecuted.push(fetchResult.agent);
      allWarnings.push(...fetchResult.warnings);
      qualityResults.push(...fetchResult.quality_results);

      if (fetchResult.status === 'error') {
        throw new Error(`Tavily fetch failed: ${fetchResult.warnings.join(', ')}`);
      }

      const fetchManifest = fetchResult.artifacts.find(a => a.type === 'FetchManifest')?.data;
      if (!fetchManifest || fetchManifest.fetched.length === 0) {
        throw new Error('No sources were successfully fetched');
      }

      console.log(`✅ Fetched ${fetchManifest.fetched.length} sources`);

      // Step 2: LEGAL_NORMALIZER - Parse and normalize (simulated)
      console.log(`\n📄 Step 2: Normalizing legal documents...`);
      const { documents, chunks } = await this.simulateNormalization(fetchManifest.fetched);
      console.log(`✅ Normalized ${documents.length} documents into ${chunks.length} chunks`);

      // Step 3: RULESPEC_EXTRACTOR - Extract executable rules
      console.log(`\n⚙️ Step 3: Extracting rule specifications...`);
      const allRuleSpecs: RuleSpec[] = [];
      
      for (const doc of documents) {
        const docChunks = chunks.filter(c => c.doc_id === doc.doc_id);
        const extractResult = await this.ruleSpecExtractor.execute(context, doc, docChunks, []);
        
        agentsExecuted.push(extractResult.agent);
        allWarnings.push(...extractResult.warnings);
        qualityResults.push(...extractResult.quality_results);

        if (extractResult.status !== 'error') {
          const ruleSpecs = extractResult.artifacts.find(a => a.type === 'RuleSpecs')?.data?.rulespecs || [];
          allRuleSpecs.push(...ruleSpecs);
        }
      }

      console.log(`✅ Extracted ${allRuleSpecs.length} rule specifications`);

      // Step 4: EDITORIAL_SYNTH - Generate user-facing content
      console.log(`\n✍️ Step 4: Synthesizing editorial content...`);
      const editorialResult = await this.editorialSynthesizer.execute(context, allRuleSpecs, chunks);
      
      agentsExecuted.push(editorialResult.agent);
      allWarnings.push(...editorialResult.warnings);
      qualityResults.push(...editorialResult.quality_results);

      if (editorialResult.status === 'error') {
        throw new Error(`Editorial synthesis failed: ${editorialResult.warnings.join(', ')}`);
      }

      const editorialContent = editorialResult.artifacts.find(a => a.type === 'EditorialContent')?.data;
      const editorialNotes = editorialContent?.editorial_notes || [];
      const userSteps = editorialContent?.user_steps || [];

      console.log(`✅ Generated ${editorialNotes.length} editorial notes and ${userSteps.length} user steps`);

      // Step 5: Quality Gates Validation
      console.log(`\n🛡️ Step 5: Running quality gates...`);
      const qualitySummary = this.computeQualitySummary(qualityResults);
      
      // Check if critical quality gates passed
      const criticalFailures = qualityResults.filter(qr => 
        !qr.passed && context.quality_gates.includes(qr.gate_name)
      );

      if (criticalFailures.length > 0) {
        allErrors.push(`Critical quality gates failed: ${criticalFailures.map(cf => cf.gate_name).join(', ')}`);
      }

      // Step 6: Package and Store Results
      console.log(`\n📦 Step 6: Packaging results...`);
      const editorialPackage: EditorialPackage = {
        package_id: packageId,
        topic: request.topic,
        version: '1.0.0',
        created_at: new Date().toISOString(),
        rulespecs: allRuleSpecs,
        calcspecs: [], // Would be generated by IMPLEMENTATION_BRIDGE
        editorial_notes: editorialNotes,
        user_steps: userSteps,
        kz_mappings: allRuleSpecs.flatMap(rs => rs.form_map.map(fm => ({
          rule_id: rs.rule_id,
          form: fm.form,
          kz: fm.kz,
          type: fm.type
        }))),
        examples: [], // Would be generated by EXAMPLE_MAKER
        faq: [], // Would be generated by EXAMPLE_MAKER
        citations_used: allRuleSpecs.flatMap(rs => rs.citations),
        quality_summary: qualitySummary
      };

      // Store package (in production, save to database/storage)
      await this.storeEditorialPackage(editorialPackage);

      const executionTime = Date.now() - startTime;
      console.log(`\n🎉 Editorial ingestion completed in ${executionTime}ms`);
      console.log(`📊 Quality Summary: Coverage ${qualitySummary.coverage_score.toFixed(2)}, Consistency ${qualitySummary.consistency_score.toFixed(2)}, Authority ${qualitySummary.authority_score.toFixed(2)}`);

      return {
        success: criticalFailures.length === 0,
        package_id: packageId,
        execution_time: executionTime,
        agents_executed: agentsExecuted,
        quality_summary: qualitySummary,
        artifacts: {
          rulespecs: allRuleSpecs,
          editorial_notes: editorialNotes,
          user_steps: userSteps
        },
        warnings: allWarnings,
        errors: allErrors
      };

    } catch (error) {
      console.error('❌ Editorial ingestion failed:', error);
      allErrors.push(`Pipeline failed: ${(error as Error).message}`);

      return {
        success: false,
        package_id: packageId,
        execution_time: Date.now() - startTime,
        agents_executed: agentsExecuted,
        quality_summary: {
          coverage_score: 0,
          consistency_score: 0,
          authority_score: 0,
          total_violations: allErrors.length
        },
        artifacts: {
          rulespecs: [],
          editorial_notes: [],
          user_steps: []
        },
        warnings: allWarnings,
        errors: allErrors
      };
    }
  }

  private async simulateNormalization(fetchResults: any[]) {
    // In production, this would be LEGAL_NORMALIZER agent
    // For now, simulate document parsing and chunking
    
    const documents = fetchResults.map((result, index) => ({
      doc_id: `doc_${index + 1}`,
      title: `Document ${index + 1}`,
      doc_type: 'LAW' as const,
      citation_id: `Mock Citation ${index + 1}`,
      date_published: '2024-01-01',
      date_effective: ['2024-01-01', null] as [string, string | null],
      version_hash: result.sha256,
      url: result.url,
      mime_type: result.mime,
      sha256: result.sha256
    }));

    const chunks = documents.flatMap(doc => [
      {
        chunk_id: `${doc.doc_id}_chunk_1`,
        doc_id: doc.doc_id,
        paragraph_ref: '§9 Abs.1',
        page: 1,
        text: 'Werbungskosten sind Aufwendungen zur Erwerbung, Sicherung und Erhaltung der Einnahmen. Der Pauschbetrag beträgt 1.230 Euro.',
        embedding: undefined
      },
      {
        chunk_id: `${doc.doc_id}_chunk_2`,
        doc_id: doc.doc_id,
        paragraph_ref: '§10 Abs.1',
        page: 2,
        text: 'Sonderausgaben sind die in den §§ 10 bis 10c bezeichneten Ausgaben. Der Höchstbetrag beträgt 36.000 Euro.',
        embedding: undefined
      }
    ]);

    return { documents, chunks };
  }

  private computeQualitySummary(qualityResults: QualityGateResult[]) {
    if (qualityResults.length === 0) {
      return {
        coverage_score: 0,
        consistency_score: 0,
        authority_score: 0,
        total_violations: 0
      };
    }

    const coverageResults = qualityResults.filter(qr => qr.gate_name.includes('coverage'));
    const consistencyResults = qualityResults.filter(qr => qr.gate_name.includes('consistency'));
    const authorityResults = qualityResults.filter(qr => qr.gate_name.includes('authority'));

    const avgScore = (results: QualityGateResult[]) => 
      results.length > 0 ? results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length : 0;

    const totalViolations = qualityResults.reduce((sum, qr) => sum + qr.violations.length, 0);

    return {
      coverage_score: avgScore(coverageResults),
      consistency_score: avgScore(consistencyResults),
      authority_score: avgScore(authorityResults),
      total_violations: totalViolations
    };
  }

  private async storeEditorialPackage(editorialPackage: EditorialPackage): Promise<void> {
    // In production, store to:
    // - PostgreSQL (truth): rulespecs, editorial_notes, etc.
    // - Vector store (pgvector/Qdrant): chunk embeddings for RAG
    // - Graph DB (Neo4j): citation relationships
    // - S3/MinIO: complete package JSON, generated artifacts
    
    console.log(`💾 Storing editorial package: ${editorialPackage.package_id}`);
    console.log(`📊 Package contains: ${editorialPackage.rulespecs.length} rules, ${editorialPackage.editorial_notes.length} notes, ${editorialPackage.user_steps.length} steps`);
    
    // For now, just log the package structure
    console.log(`📋 Package structure:`, {
      package_id: editorialPackage.package_id,
      topic: editorialPackage.topic,
      version: editorialPackage.version,
      rulespecs_count: editorialPackage.rulespecs.length,
      editorial_notes_count: editorialPackage.editorial_notes.length,
      user_steps_count: editorialPackage.user_steps.length,
      kz_mappings_count: editorialPackage.kz_mappings.length,
      quality_summary: editorialPackage.quality_summary
    });
  }

  /**
   * Get available topics for editorial ingestion
   */
  static getAvailableTopics(): string[] {
    return [
      'Werbungskosten',
      'Sonderausgaben',
      'Außergewöhnliche Belastungen',
      'Einkünfte aus Kapitalvermögen',
      'Einkünfte aus Vermietung und Verpachtung',
      'Einkünfte aus Gewerbebetrieb',
      'Einkünfte aus selbständiger Arbeit',
      'Einkünfte aus nichtselbständiger Arbeit',
      'Kinderbetreuungskosten',
      'Haushaltsnahe Dienstleistungen'
    ];
  }

  /**
   * Get default queries for a topic
   */
  static getDefaultQueries(topic: string): string[] {
    const queryMap: Record<string, string[]> = {
      'Werbungskosten': [
        'Werbungskosten Pauschbetrag 2024',
        'EStG § 9 Werbungskosten',
        'Arbeitsmittel steuerlich absetzbar',
        'Fahrtkosten Entfernungspauschale'
      ],
      'Sonderausgaben': [
        'Sonderausgaben EStG § 10',
        'Versicherungsbeiträge steuerlich absetzbar',
        'Altersvorsorge Riester Rürup',
        'Kirchensteuer Sonderausgaben'
      ],
      'Außergewöhnliche Belastungen': [
        'Außergewöhnliche Belastungen § 33 EStG',
        'Krankheitskosten steuerlich absetzbar',
        'Zumutbare Belastung Berechnung',
        'Behinderung Pauschbetrag'
      ]
    };

    return queryMap[topic] || [`${topic} Steuerrecht Deutschland`];
  }
}