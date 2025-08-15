/**
 * EDITORIAL_SYNTH Agent
 * Generate plain-German EditorialNotes and UserSteps that explain each rule 
 * and how users proceed, with inline citations for every normative statement
 */

import { EditorialAgentContext, EditorialAgentResult, RuleSpec, EditorialNote, UserStep, DocumentChunk } from '../types';

export class EditorialSynthesizer {
  // System prompt for editorial synthesis
  // private readonly SYSTEM_PROMPT = `
  // Role: EDITORIAL_SYNTH
  // Goal: Generate plain-German EditorialNotes and UserSteps that explain each rule and how users proceed, with inline citations for every normative statement.
  // Inputs: {rulespec, chunks[]}
  // Output JSON: { "editorial_notes":[...], "user_steps":[...] }
  // Rules: ≤ 3 sentences per note; no legalese unless quoted; must include citations or be marked as 'operational guidance' with no normative claim.
  // `;

  async execute(
    _context: EditorialAgentContext,
    rulespecs: RuleSpec[],
    chunks: DocumentChunk[]
  ): Promise<EditorialAgentResult> {
    const startTime = Date.now();
    console.log(`✍️ EDITORIAL_SYNTH: Processing ${rulespecs.length} rules for editorial content`);

    try {
      const editorialNotes: EditorialNote[] = [];
      const userSteps: UserStep[] = [];

      // Create chunk lookup for citations
      const chunkLookup = new Map<string, DocumentChunk>();
      chunks.forEach(chunk => {
        chunkLookup.set(`${chunk.doc_id}_${chunk.paragraph_ref}`, chunk);
      });

      for (const rulespec of rulespecs) {
        console.log(`📝 Creating editorial content for rule: ${rulespec.rule_id}`);

        // Generate editorial notes for this rule
        const ruleNotes = this.generateEditorialNotes(rulespec, chunkLookup);
        editorialNotes.push(...ruleNotes);

        // Generate user steps for this rule
        const ruleSteps = this.generateUserSteps(rulespec, chunkLookup);
        userSteps.push(...ruleSteps);
      }

      console.log(`✅ EDITORIAL_SYNTH: Generated ${editorialNotes.length} notes and ${userSteps.length} steps`);

      // Validate editorial content
      const validationResult = this.validateEditorialContent(editorialNotes, userSteps);

      return {
        agent: 'EDITORIAL_SYNTH',
        status: validationResult.passed ? 'success' : 'partial',
        execution_time: Date.now() - startTime,
        artifacts: [
          {
            type: 'EditorialContent',
            id: `editorial_${Date.now()}`,
            data: { editorial_notes: editorialNotes, user_steps: userSteps }
          }
        ],
        quality_results: [validationResult],
        warnings: validationResult.violations.map(v => v.message),
        next_agents: ['LEGAL_FACTCHECK', 'STYLE_QA']
      };

    } catch (error) {
      console.error('❌ EDITORIAL_SYNTH failed:', error);
      return {
        agent: 'EDITORIAL_SYNTH',
        status: 'error',
        execution_time: Date.now() - startTime,
        artifacts: [],
        quality_results: [],
        warnings: [`Execution failed: ${(error as Error).message}`]
      };
    }
  }

  private generateEditorialNotes(rulespec: RuleSpec, _chunkLookup: Map<string, DocumentChunk>): EditorialNote[] {
    const notes: EditorialNote[] = [];

    // Overview note for users
    const overviewNote = this.createOverviewNote(rulespec);
    if (overviewNote) notes.push(overviewNote);

    // Technical note for reviewers
    const technicalNote = this.createTechnicalNote(rulespec);
    if (technicalNote) notes.push(technicalNote);

    // Implementation note for developers
    const implementationNote = this.createImplementationNote(rulespec);
    if (implementationNote) notes.push(implementationNote);

    return notes;
  }

  private createOverviewNote(rulespec: RuleSpec): EditorialNote {
    const plainGermanExplanation = this.translateToPlainGerman(rulespec);
    
    return {
      id: `${rulespec.rule_id}_overview`,
      audience: 'user',
      text: plainGermanExplanation,
      citations: rulespec.citations
    };
  }

  private createTechnicalNote(rulespec: RuleSpec): EditorialNote {
    const technicalDetails = this.createTechnicalExplanation(rulespec);
    
    return {
      id: `${rulespec.rule_id}_technical`,
      audience: 'reviewer',
      text: technicalDetails,
      citations: rulespec.citations
    };
  }

  private createImplementationNote(rulespec: RuleSpec): EditorialNote {
    const implementationDetails = this.createImplementationExplanation(rulespec);
    
    return {
      id: `${rulespec.rule_id}_implementation`,
      audience: 'dev',
      text: implementationDetails,
      citations: rulespec.citations
    };
  }

  private translateToPlainGerman(rulespec: RuleSpec): string {
    const topic = rulespec.topic;
    const definition = rulespec.definition;
    
    // Create user-friendly explanations based on rule type
    if (rulespec.rule_id.includes('Pauschbetrag')) {
      const amount = rulespec.parameters.amount;
      return `${topic} mindern Ihr zu versteuerndes Einkommen. Der Pauschbetrag beträgt ${amount} € (${new Date().getFullYear()}). Sie können entweder den Pauschbetrag nutzen oder Ihre tatsächlichen Kosten angeben - es wird automatisch der höhere Betrag verwendet.`;
    }
    
    if (rulespec.rule_id.includes('Hoechstbetrag')) {
      const maxAmount = rulespec.parameters.max_amount;
      return `Bei ${topic} können Sie maximal ${maxAmount} € pro Jahr geltend machen. Höhere Beträge werden auf diesen Höchstbetrag begrenzt.`;
    }
    
    if (rulespec.rule_id.includes('Prozentsatz')) {
      const percentage = rulespec.parameters.percentage;
      return `Für ${topic} wird ein Prozentsatz von ${percentage}% angewendet. Der Betrag wird automatisch basierend auf Ihren Angaben berechnet.`;
    }

    // Fallback: generic explanation
    return `${definition}. Diese Regelung gilt für das Steuerjahr ${new Date().getFullYear()} und wird automatisch in Ihrer Steuererklärung berücksichtigt.`;
  }

  private createTechnicalExplanation(rulespec: RuleSpec): string {
    const logic = rulespec.logic;
    const parameters = Object.entries(rulespec.parameters)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return `Technische Umsetzung: ${logic}. Parameter: ${parameters}. Rundung nach ${rulespec.computation_notes?.join(', ') || 'Standard-Rundungsregeln'}.`;
  }

  private createImplementationExplanation(rulespec: RuleSpec): string {
    const formMappings = rulespec.form_map
      .map(fm => `${fm.form} KZ ${fm.kz} (${fm.type})`)
      .join(', ');
    
    return `Implementation: Rule ${rulespec.rule_id} maps to ${formMappings}. Logic: ${rulespec.logic}. Tests: ${rulespec.tests.length} test cases defined.`;
  }

  private generateUserSteps(rulespec: RuleSpec, _chunkLookup: Map<string, DocumentChunk>): UserStep[] {
    const steps: UserStep[] = [];

    // Generate steps based on rule type and topic
    if (rulespec.topic === 'Werbungskosten') {
      steps.push({
        step: 'Belege sammeln',
        why: 'Sie überschreiten den Pauschbetrag nur mit belegten Kosten.',
        how: 'Laden Sie Rechnungen für Telefon, Fahrtkosten, Arbeitsmittel hoch.',
        citations: rulespec.citations
      });

      steps.push({
        step: 'Pauschbetrag prüfen',
        why: `Der Pauschbetrag von ${rulespec.parameters.amount || '1.230'} € wird automatisch berücksichtigt.`,
        how: 'Geben Sie Ihre tatsächlichen Kosten ein - wir wählen automatisch den höheren Betrag.',
        citations: rulespec.citations
      });
    }

    if (rulespec.topic === 'Sonderausgaben') {
      steps.push({
        step: 'Versicherungen erfassen',
        why: 'Beiträge zu Kranken-, Pflege- und Rentenversicherung sind absetzbar.',
        how: 'Tragen Sie die Beiträge aus Ihren Versicherungsbescheinigungen ein.',
        citations: rulespec.citations
      });
    }

    if (rulespec.topic === 'Außergewöhnliche Belastungen') {
      steps.push({
        step: 'Zumutbare Belastung berechnen',
        why: 'Nur Kosten über der zumutbaren Belastung sind absetzbar.',
        how: 'Geben Sie Ihre außergewöhnlichen Kosten ein - wir berechnen die zumutbare Belastung automatisch.',
        citations: rulespec.citations
      });
    }

    // Generic step if no specific steps were generated
    if (steps.length === 0) {
      steps.push({
        step: `${rulespec.topic} erfassen`,
        why: rulespec.definition,
        how: 'Geben Sie die entsprechenden Beträge in das Formular ein.',
        citations: rulespec.citations
      });
    }

    return steps;
  }

  private validateEditorialContent(notes: EditorialNote[], steps: UserStep[]) {
    const violations = [];
    let validNotes = 0;
    let validSteps = 0;

    // Validate editorial notes
    for (const note of notes) {
      // Check sentence count (≤ 3 sentences)
      const sentenceCount = note.text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      if (sentenceCount > 3) {
        violations.push({
          type: 'sentence_count',
          message: `Note ${note.id} has ${sentenceCount} sentences (max 3)`,
          severity: 'warning' as const
        });
      }

      // Check citations for normative statements
      if (this.containsNormativeStatement(note.text) && note.citations.length === 0) {
        violations.push({
          type: 'missing_citation',
          message: `Note ${note.id} contains normative statements without citations`,
          severity: 'error' as const
        });
      } else {
        validNotes++;
      }

      // Check for legalese
      if (this.containsLegalese(note.text) && note.audience === 'user') {
        violations.push({
          type: 'legalese_in_user_content',
          message: `Note ${note.id} contains legalese in user-facing content`,
          severity: 'warning' as const
        });
      }
    }

    // Validate user steps
    for (const step of steps) {
      if (!step.step || !step.why || !step.how) {
        violations.push({
          type: 'incomplete_step',
          message: `Step is missing required fields (step/why/how)`,
          severity: 'error' as const
        });
      } else {
        validSteps++;
      }
    }

    const totalValid = validNotes + validSteps;
    const totalItems = notes.length + steps.length;

    return {
      gate_name: 'editorial_validation',
      passed: violations.filter(v => v.severity === 'error').length === 0,
      score: totalItems > 0 ? totalValid / totalItems : 1,
      threshold: 0.9,
      violations
    };
  }

  private containsNormativeStatement(text: string): boolean {
    const normativeIndicators = [
      'beträgt', 'müssen', 'können', 'dürfen', 'sind', 'werden',
      'höchstens', 'mindestens', 'prozent', '€', 'euro'
    ];
    
    return normativeIndicators.some(indicator => 
      text.toLowerCase().includes(indicator)
    );
  }

  private containsLegalese(text: string): boolean {
    const legaleseTerms = [
      'gemäß', 'entsprechend', 'hinsichtlich', 'bezüglich',
      'insoweit', 'insofern', 'soweit', 'sofern',
      'aufwendungen', 'einkünfte', 'veranlagung'
    ];
    
    return legaleseTerms.some(term => 
      text.toLowerCase().includes(term)
    );
  }
}