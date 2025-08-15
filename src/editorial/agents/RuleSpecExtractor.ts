/**
 * RULESPEC_EXTRACTOR Agent
 * From normalized legal chunks and citations, emit executable RuleSpecs 
 * for a single topic with minimal parameters, explicit logic, KZ mapping hints, and test vectors
 */

import { EditorialAgentContext, EditorialAgentResult, RuleSpec, LegalDocument, DocumentChunk, CitationLink } from '../types';

export class RuleSpecExtractor {
  // System prompt for rule extraction
  // private readonly SYSTEM_PROMPT = `
  // Role: RULESPEC_EXTRACTOR
  // Goal: From normalized legal chunks and citations, emit executable RuleSpecs for a single topic with minimal parameters, explicit logic, KZ mapping hints, and test vectors. Never invent numbers; every parameter must cite a paragraph.
  // Inputs: {doc, chunks[], links[]}
  // Output JSON: { "rulespecs":[ RuleSpec, ... ] }
  // Rules: One rule_id per granular calculable rule. Provide at least one test per rule. Put caps/ceilings into parameters. Rounding policy must be explicit.
  // `;

  async execute(
    _context: EditorialAgentContext, 
    doc: LegalDocument, 
    chunks: DocumentChunk[], 
    _links: CitationLink[]
  ): Promise<EditorialAgentResult> {
    const startTime = Date.now();
    console.log(`⚙️ RULESPEC_EXTRACTOR: Processing ${doc.title} with ${chunks.length} chunks`);

    try {
      const rulespecs: RuleSpec[] = [];

      // Process chunks by topic/paragraph to extract rules
      const rulesByTopic = this.groupChunksByTopic(chunks);
      
      for (const [topic, topicChunks] of Object.entries(rulesByTopic)) {
        console.log(`📋 Processing topic: ${topic} (${topicChunks.length} chunks)`);
        
        const topicRules = await this.extractRulesFromTopic(doc, topic, topicChunks, _links);
        rulespecs.push(...topicRules);
      }

      console.log(`✅ RULESPEC_EXTRACTOR: Extracted ${rulespecs.length} rules from ${doc.title}`);

      // Validate all rules have proper citations and tests
      const validationResult = this.validateRuleSpecs(rulespecs);

      return {
        agent: 'RULESPEC_EXTRACTOR',
        status: validationResult.passed ? 'success' : 'partial',
        execution_time: Date.now() - startTime,
        artifacts: [
          {
            type: 'RuleSpecs',
            id: `rules_${doc.doc_id}_${Date.now()}`,
            data: { rulespecs, doc_id: doc.doc_id }
          }
        ],
        quality_results: [validationResult],
        warnings: validationResult.violations.map(v => v.message),
        next_agents: ['KZ_MAPPER_EDITOR', 'IMPLEMENTATION_BRIDGE']
      };

    } catch (error) {
      console.error('❌ RULESPEC_EXTRACTOR failed:', error);
      return {
        agent: 'RULESPEC_EXTRACTOR',
        status: 'error',
        execution_time: Date.now() - startTime,
        artifacts: [],
        quality_results: [],
        warnings: [`Execution failed: ${(error as Error).message}`]
      };
    }
  }

  private groupChunksByTopic(chunks: DocumentChunk[]): Record<string, DocumentChunk[]> {
    const groups: Record<string, DocumentChunk[]> = {};

    for (const chunk of chunks) {
      // Extract topic from paragraph reference (e.g., "§9" -> "Werbungskosten")
      const topic = this.inferTopicFromParagraph(chunk.paragraph_ref, chunk.text);
      
      if (!groups[topic]) {
        groups[topic] = [];
      }
      groups[topic].push(chunk);
    }

    return groups;
  }

  private inferTopicFromParagraph(paragraphRef: string, text: string): string {
    // Map common German tax law paragraphs to topics
    const topicMap: Record<string, string> = {
      '§9': 'Werbungskosten',
      '§10': 'Sonderausgaben', 
      '§33': 'Außergewöhnliche Belastungen',
      '§34': 'Außergewöhnliche Belastungen',
      '§20': 'Einkünfte aus Kapitalvermögen',
      '§21': 'Einkünfte aus Vermietung und Verpachtung',
      '§15': 'Einkünfte aus Gewerbebetrieb',
      '§18': 'Einkünfte aus selbständiger Arbeit',
      '§19': 'Einkünfte aus nichtselbständiger Arbeit'
    };

    // Extract paragraph number
    const match = paragraphRef.match(/§(\d+)/);
    if (match) {
      const paragraph = `§${match[1]}`;
      if (topicMap[paragraph]) {
        return topicMap[paragraph];
      }
    }

    // Fallback: infer from text content
    if (text.toLowerCase().includes('werbungskosten')) return 'Werbungskosten';
    if (text.toLowerCase().includes('sonderausgaben')) return 'Sonderausgaben';
    if (text.toLowerCase().includes('außergewöhnliche')) return 'Außergewöhnliche Belastungen';
    if (text.toLowerCase().includes('kapitalvermögen')) return 'Einkünfte aus Kapitalvermögen';
    if (text.toLowerCase().includes('vermietung')) return 'Einkünfte aus Vermietung und Verpachtung';

    return 'Allgemein';
  }

  private async extractRulesFromTopic(
    doc: LegalDocument, 
    topic: string, 
    chunks: DocumentChunk[], 
    _links: CitationLink[]
  ): Promise<RuleSpec[]> {
    const rules: RuleSpec[] = [];

    // Look for calculable rules in the chunks
    for (const chunk of chunks) {
      const extractedRules = this.extractCalculableRules(doc, topic, chunk);
      rules.push(...extractedRules);
    }

    return rules;
  }

  private extractCalculableRules(doc: LegalDocument, topic: string, chunk: DocumentChunk): RuleSpec[] {
    const rules: RuleSpec[] = [];
    const text = chunk.text.toLowerCase();

    // Pattern matching for common German tax calculation rules
    
    // 1. Pauschbeträge (standard deductions)
    if (text.includes('pauschbetrag') || text.includes('pauschale')) {
      const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:euro|€)/i);
      if (amountMatch) {
        const amount = amountMatch[1];
        rules.push({
          rule_id: `${topic.replace(/\s+/g, '_')}_Pauschbetrag_${new Date().getFullYear()}`,
          topic,
          effective: {
            from: `${new Date().getFullYear()}-01-01`,
            to: null
          },
          form_map: this.inferFormMapping(topic, 'pauschbetrag'),
          definition: `Pauschbetrag für ${topic}`,
          parameters: {
            amount: amount,
            currency: 'EUR'
          },
          logic: `value = max(actual_expenses, ${amount})`,
          computation_notes: ['BigDecimal only', 'HALF_UP rounding final'],
          citations: [{
            doc_id: doc.doc_id,
            paragraph: chunk.paragraph_ref,
            page: chunk.page
          }],
          tests: [{
            input: { actual_expenses: (parseFloat(amount) * 0.8).toString() },
            expect: { value: amount }
          }]
        });
      }
    }

    // 2. Höchstbeträge (maximum amounts)
    if (text.includes('höchstbetrag') || text.includes('höchstens')) {
      const amountMatch = text.match(/höchstens\s+(\d+(?:\.\d+)?)\s*(?:euro|€)/i);
      if (amountMatch) {
        const maxAmount = amountMatch[1];
        rules.push({
          rule_id: `${topic.replace(/\s+/g, '_')}_Hoechstbetrag_${new Date().getFullYear()}`,
          topic,
          effective: {
            from: `${new Date().getFullYear()}-01-01`,
            to: null
          },
          form_map: this.inferFormMapping(topic, 'hoechstbetrag'),
          definition: `Höchstbetrag für ${topic}`,
          parameters: {
            max_amount: maxAmount,
            currency: 'EUR'
          },
          logic: `value = min(actual_amount, ${maxAmount})`,
          computation_notes: ['BigDecimal only', 'HALF_UP rounding final'],
          citations: [{
            doc_id: doc.doc_id,
            paragraph: chunk.paragraph_ref,
            page: chunk.page
          }],
          tests: [{
            input: { actual_amount: (parseFloat(maxAmount) * 1.2).toString() },
            expect: { value: maxAmount }
          }]
        });
      }
    }

    // 3. Prozentsätze (percentage rates)
    if (text.includes('prozent') || text.includes('%')) {
      const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:prozent|%)/i);
      if (percentMatch) {
        const percentage = percentMatch[1];
        rules.push({
          rule_id: `${topic.replace(/\s+/g, '_')}_Prozentsatz_${new Date().getFullYear()}`,
          topic,
          effective: {
            from: `${new Date().getFullYear()}-01-01`,
            to: null
          },
          form_map: this.inferFormMapping(topic, 'prozentsatz'),
          definition: `Prozentsatz für ${topic}`,
          parameters: {
            rate: parseFloat(percentage) / 100,
            percentage: percentage
          },
          logic: `value = base_amount * ${parseFloat(percentage) / 100}`,
          computation_notes: ['BigDecimal only', 'HALF_UP rounding final'],
          citations: [{
            doc_id: doc.doc_id,
            paragraph: chunk.paragraph_ref,
            page: chunk.page
          }],
          tests: [{
            input: { base_amount: '1000.00' },
            expect: { value: (1000 * parseFloat(percentage) / 100).toString() }
          }]
        });
      }
    }

    return rules;
  }

  private inferFormMapping(topic: string, _ruleType: string): Array<{ form: string; kz: string; type: 'amount' | 'bool' | 'string' | 'enum' }> {
    // Map topics to likely form fields (Kennziffern)
    const mappings: Record<string, Array<{ form: string; kz: string; type: 'amount' | 'bool' | 'string' | 'enum' }>> = {
      'Werbungskosten': [
        { form: 'Anlage N', kz: '31', type: 'amount' }
      ],
      'Sonderausgaben': [
        { form: 'Mantelbogen', kz: '36', type: 'amount' }
      ],
      'Außergewöhnliche Belastungen': [
        { form: 'Mantelbogen', kz: '67', type: 'amount' }
      ],
      'Einkünfte aus Kapitalvermögen': [
        { form: 'Anlage KAP', kz: '7', type: 'amount' }
      ],
      'Einkünfte aus Vermietung und Verpachtung': [
        { form: 'Anlage V', kz: '21', type: 'amount' }
      ]
    };

    return mappings[topic] || [{ form: 'Mantelbogen', kz: '999', type: 'amount' }];
  }

  private validateRuleSpecs(rulespecs: RuleSpec[]) {
    const violations = [];
    let passedCount = 0;

    for (const rule of rulespecs) {
      // Check citations
      if (!rule.citations || rule.citations.length === 0) {
        violations.push({
          type: 'missing_citation',
          message: `Rule ${rule.rule_id} has no citations`,
          severity: 'error' as const
        });
      }

      // Check tests
      if (!rule.tests || rule.tests.length === 0) {
        violations.push({
          type: 'missing_tests',
          message: `Rule ${rule.rule_id} has no test cases`,
          severity: 'error' as const
        });
      }

      // Check parameters have values
      if (!rule.parameters || Object.keys(rule.parameters).length === 0) {
        violations.push({
          type: 'missing_parameters',
          message: `Rule ${rule.rule_id} has no parameters`,
          severity: 'warning' as const
        });
      }

      if (violations.length === 0) passedCount++;
    }

    return {
      gate_name: 'rulespec_validation',
      passed: violations.filter(v => v.severity === 'error').length === 0,
      score: passedCount / rulespecs.length,
      threshold: 0.8,
      violations
    };
  }
}