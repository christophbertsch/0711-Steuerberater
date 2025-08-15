/**
 * Demo: Qdrant Integration with Editorial Content
 * Shows how editorial content gets stored in Qdrant for semantic search
 */

import { EditorialManager } from './src/editorial/EditorialManager';

async function demoQdrantIntegration() {
  console.log('🔍 Qdrant Integration Demo');
  console.log('==========================');
  
  console.log('📋 This demo shows how editorial content is prepared for Qdrant storage:');
  console.log('');
  
  // Create a sample editorial package
  const samplePackage = {
    package_id: 'demo_package_123',
    topic: 'Einkommensteuer Grundlagen',
    version: '1.0.0',
    status: 'active' as const,
    jurisdiction: 'DE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    rulespecs: [
      {
        rule_id: 'ESt_Grundfreibetrag_2024',
        topic: 'Einkommensteuer Grundlagen',
        effective: {
          from: '2024-01-01',
          to: '2024-12-31'
        },
        form_map: [
          { form: 'ESt1A', kz: 'KZ_101', type: 'amount' as const }
        ],
        definition: 'Der Grundfreibetrag beträgt für das Jahr 2024 11.604 Euro für Ledige und 23.208 Euro für Verheiratete.',
        parameters: {
          amount_single: 11604,
          amount_married: 23208,
          currency: 'EUR'
        },
        logic: 'Grundfreibetrag = 11.604 EUR (Ledige) / 23.208 EUR (Verheiratete)',
        computation_notes: ['BigDecimal only', 'HALF_UP rounding final'],
        citations: [
          { doc_id: 'EStG_2024', paragraph: '§ 32a EStG', page: 1 }
        ],
        tests: [
          { input: { filing_status: 'single' }, expect: { grundfreibetrag: 11604 } },
          { input: { filing_status: 'married' }, expect: { grundfreibetrag: 23208 } }
        ]
      },
      {
        rule_id: 'ESt_Werbungskosten_Pauschbetrag_2024',
        topic: 'Werbungskosten',
        effective: {
          from: '2024-01-01',
          to: null
        },
        form_map: [
          { form: 'Anlage N', kz: 'KZ_N_40', type: 'amount' as const }
        ],
        definition: 'Der Arbeitnehmer-Pauschbetrag für Werbungskosten beträgt 1.230 Euro.',
        parameters: {
          pauschbetrag: 1230,
          currency: 'EUR'
        },
        logic: 'value = max(actual_expenses, 1230)',
        computation_notes: ['BigDecimal only', 'HALF_UP rounding final'],
        citations: [
          { doc_id: 'EStG_2024', paragraph: '§ 9a EStG', page: 2 }
        ],
        tests: [
          { input: { actual_expenses: 1000 }, expect: { werbungskosten: 1230 } },
          { input: { actual_expenses: 1500 }, expect: { werbungskosten: 1500 } }
        ]
      }
    ],
    editorial_notes: [
      {
        id: 'note_grundfreibetrag_2024',
        audience: 'user' as const,
        text: 'Der Grundfreibetrag wurde für 2024 um 696 Euro auf 11.604 Euro erhöht. Dies entspricht einer Steigerung von 6,4% gegenüber dem Vorjahr.',
        citations: [
          { doc_id: 'BMF_2023', paragraph: 'BMF-Schreiben vom 15.12.2023', page: 1 }
        ]
      },
      {
        id: 'note_werbungskosten_2024',
        audience: 'user' as const,
        text: 'Der Pauschbetrag wird automatisch berücksichtigt, wenn keine höheren Werbungskosten nachgewiesen werden. Einzelnachweise sind nur bei Überschreitung erforderlich.',
        citations: [
          { doc_id: 'EStG_2024', paragraph: '§ 9a EStG', page: 2 }
        ]
      }
    ],
    user_steps: [
      {
        step: 'Grundfreibetrag prüfen',
        why: 'Der Grundfreibetrag wird automatisch berücksichtigt und muss überprüft werden.',
        how: 'Der Grundfreibetrag wird automatisch berücksichtigt. Keine Eingabe erforderlich.',
        citations: [
          { doc_id: 'EStG_2024', paragraph: '§ 32a EStG', page: 1 }
        ]
      },
      {
        step: 'Werbungskosten eintragen',
        why: 'Werbungskosten müssen in Anlage N eingetragen werden, um steuerlich berücksichtigt zu werden.',
        how: 'Tragen Sie Ihre Werbungskosten in Anlage N ein. Bei Beträgen unter 1.230 Euro wird automatisch der Pauschbetrag angesetzt.',
        citations: [
          { doc_id: 'EStG_2024', paragraph: '§ 9a EStG', page: 2 }
        ]
      }
    ],
    kz_mappings: [
      {
        kz_id: 'KZ_101',
        form_name: 'ESt1A',
        field_name: 'Grundfreibetrag',
        rule_id: 'ESt_Grundfreibetrag_2024'
      },
      {
        kz_id: 'KZ_N_40',
        form_name: 'Anlage N',
        field_name: 'Werbungskosten',
        rule_id: 'ESt_Werbungskosten_Pauschbetrag_2024'
      }
    ],
    quality_summary: {
      coverage_score: 0.95,
      consistency_score: 0.98,
      authority_score: 1.0,
      total_violations: 0
    }
  };

  console.log('📦 Sample Editorial Package:');
  console.log(`   Topic: ${samplePackage.topic}`);
  console.log(`   Rules: ${samplePackage.rulespecs.length}`);
  console.log(`   Notes: ${samplePackage.editorial_notes.length}`);
  console.log(`   Steps: ${samplePackage.user_steps.length}`);
  console.log('');

  // Show how content would be prepared for Qdrant
  console.log('🔍 Qdrant Document Preparation:');
  console.log('================================');
  
  const documents = [];
  
  // Prepare rule specifications
  for (const rule of samplePackage.rulespecs) {
    const citations = rule.citations.map(c => `${c.paragraph} (${c.doc_id})`).join(', ');
    const formMappings = rule.form_map.map(f => `${f.form}:${f.kz}`).join(', ');
    
    const doc = {
      filename: `rule_${rule.rule_id}.txt`,
      text: `${rule.rule_id}\n\n${rule.definition}\n\nTopic: ${rule.topic}\n\nLogic: ${rule.logic}\n\nForm Mappings: ${formMappings}\n\nCitations: ${citations}\n\nEffective: ${rule.effective.from} - ${rule.effective.to || 'ongoing'}`,
      documentType: 'editorial_rule',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        rule_id: rule.rule_id,
        content_type: 'rule_specification',
        priority: 'medium',
        effective_date: rule.effective.from,
        version: samplePackage.version
      }
    };
    
    documents.push(doc);
    console.log(`📄 Rule Document: ${doc.filename}`);
    console.log(`   Type: ${doc.documentType}`);
    console.log(`   Text Length: ${doc.text.length} chars`);
    console.log(`   Priority: ${doc.metadata.priority}`);
    console.log('');
  }
  
  // Prepare editorial notes
  for (const note of samplePackage.editorial_notes) {
    const citations = note.citations.map(c => `${c.paragraph} (${c.doc_id})`).join(', ');
    
    const doc = {
      filename: `note_${note.id}.txt`,
      text: `Editorial Note\n\n${note.text}\n\nAudience: ${note.audience}\n\nCitations: ${citations}`,
      documentType: 'editorial_note',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        note_id: note.id,
        content_type: 'editorial_note',
        note_type: 'general',
        target_audience: note.audience,
        version: samplePackage.version
      }
    };
    
    documents.push(doc);
    console.log(`📝 Note Document: ${doc.filename}`);
    console.log(`   Type: ${doc.documentType}`);
    console.log(`   Text Length: ${doc.text.length} chars`);
    console.log(`   Note Type: ${doc.metadata.note_type}`);
    console.log('');
  }
  
  // Prepare user steps
  for (const step of samplePackage.user_steps) {
    const citations = step.citations.map(c => `${c.paragraph} (${c.doc_id})`).join(', ');
    
    const doc = {
      filename: `step_${step.step}.txt`,
      text: `User Step: ${step.step}\n\nWhy: ${step.why}\n\nHow: ${step.how}\n\nCitations: ${citations}`,
      documentType: 'editorial_step',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        step_id: step.step,
        content_type: 'user_step',
        step_type: 'general',
        form_target: 'general',
        version: samplePackage.version
      }
    };
    
    documents.push(doc);
    console.log(`📋 Step Document: ${doc.filename}`);
    console.log(`   Type: ${doc.documentType}`);
    console.log(`   Text Length: ${doc.text.length} chars`);
    console.log(`   Form Target: ${doc.metadata.form_target}`);
    console.log('');
  }
  
  console.log('📊 Summary:');
  console.log(`   Total documents prepared: ${documents.length}`);
  console.log(`   Rule specifications: ${documents.filter(d => d.documentType === 'editorial_rule').length}`);
  console.log(`   Editorial notes: ${documents.filter(d => d.documentType === 'editorial_note').length}`);
  console.log(`   User steps: ${documents.filter(d => d.documentType === 'editorial_step').length}`);
  console.log('');
  
  console.log('🔍 Search Capabilities:');
  console.log('=======================');
  console.log('Once stored in Qdrant, you can search for:');
  console.log('• "Grundfreibetrag 2024" → Find rule specifications and notes about basic allowance');
  console.log('• "Werbungskosten Pauschbetrag" → Find rules and guidance about deduction allowances');
  console.log('• "Anlage N" → Find user steps for completing tax form N');
  console.log('• "high priority" → Filter by priority level');
  console.log('• "taxpayer guidance" → Find content targeted at taxpayers');
  console.log('');
  
  console.log('🎯 Integration Points:');
  console.log('=====================');
  console.log('• Declaration Agents can query Qdrant for relevant rules');
  console.log('• UI components can search editorial content semantically');
  console.log('• Form helpers can find step-by-step guidance');
  console.log('• Quality gates can verify content completeness');
  console.log('');
  
  console.log('✅ Qdrant integration is ready for browser-based usage!');
  console.log('   Use the Editorial Search component to test semantic search.');
}

// Run the demo
demoQdrantIntegration().catch(console.error);