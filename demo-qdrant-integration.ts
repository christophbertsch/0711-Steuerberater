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
        title: 'Grundfreibetrag 2024',
        description: 'Der Grundfreibetrag beträgt für das Jahr 2024 11.604 Euro für Ledige und 23.208 Euro für Verheiratete.',
        conditions: ['Steuerpflichtige Person', 'Veranlagungsjahr 2024'],
        formula: 'Grundfreibetrag = 11.604 EUR (Ledige) / 23.208 EUR (Verheiratete)',
        references: ['§ 32a EStG', 'BMF-Schreiben vom 15.12.2023'],
        priority: 'high' as const,
        effective_date: '2024-01-01',
        expiry_date: '2024-12-31'
      },
      {
        rule_id: 'ESt_Werbungskosten_Pauschbetrag_2024',
        title: 'Werbungskosten-Pauschbetrag 2024',
        description: 'Der Arbeitnehmer-Pauschbetrag für Werbungskosten beträgt 1.230 Euro.',
        conditions: ['Nichtselbständige Arbeit', 'Keine höheren Werbungskosten nachgewiesen'],
        formula: 'Pauschbetrag = 1.230 EUR',
        references: ['§ 9a EStG'],
        priority: 'high' as const,
        effective_date: '2024-01-01',
        expiry_date: null
      }
    ],
    editorial_notes: [
      {
        note_id: 'note_grundfreibetrag_2024',
        title: 'Grundfreibetrag Erhöhung 2024',
        content: 'Der Grundfreibetrag wurde für 2024 um 696 Euro auf 11.604 Euro erhöht. Dies entspricht einer Steigerung von 6,4% gegenüber dem Vorjahr.',
        note_type: 'explanation' as const,
        target_audience: 'taxpayer' as const,
        tags: ['Grundfreibetrag', 'Erhöhung', '2024', 'Inflation'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        note_id: 'note_werbungskosten_2024',
        title: 'Werbungskosten-Pauschbetrag Anwendung',
        content: 'Der Pauschbetrag wird automatisch berücksichtigt, wenn keine höheren Werbungskosten nachgewiesen werden. Einzelnachweise sind nur bei Überschreitung erforderlich.',
        note_type: 'guidance' as const,
        target_audience: 'taxpayer' as const,
        tags: ['Werbungskosten', 'Pauschbetrag', 'Nachweis'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    user_steps: [
      {
        step_id: 'step_grundfreibetrag_check',
        title: 'Grundfreibetrag prüfen',
        description: 'Überprüfung des Grundfreibetrags in der Steuererklärung',
        instructions: 'Der Grundfreibetrag wird automatisch berücksichtigt. Keine Eingabe erforderlich.',
        step_type: 'verification' as const,
        form_target: 'ESt1A',
        validation_rules: ['Grundfreibetrag > 0', 'Grundfreibetrag <= 11.604 EUR (Ledige)'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        step_id: 'step_werbungskosten_entry',
        title: 'Werbungskosten eintragen',
        description: 'Eingabe der Werbungskosten in Anlage N',
        instructions: 'Tragen Sie Ihre Werbungskosten in Anlage N ein. Bei Beträgen unter 1.230 Euro wird automatisch der Pauschbetrag angesetzt.',
        step_type: 'input' as const,
        form_target: 'Anlage N',
        validation_rules: ['Werbungskosten >= 0', 'Belege bei Überschreitung Pauschbetrag'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
    const conditions = Array.isArray(rule.conditions) ? rule.conditions.join(', ') : (rule.conditions || 'N/A');
    const references = Array.isArray(rule.references) ? rule.references.join(', ') : (rule.references || 'N/A');
    
    const doc = {
      filename: `rule_${rule.rule_id}.txt`,
      text: `${rule.title || 'Untitled Rule'}\n\n${rule.description || 'No description'}\n\nConditions: ${conditions}\n\nFormula: ${rule.formula || 'N/A'}\n\nReferences: ${references}`,
      documentType: 'editorial_rule',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        rule_id: rule.rule_id,
        content_type: 'rule_specification',
        priority: rule.priority || 'medium',
        effective_date: rule.effective_date || new Date().toISOString().split('T')[0],
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
    const tags = Array.isArray(note.tags) ? note.tags.join(', ') : (note.tags || 'N/A');
    
    const doc = {
      filename: `note_${note.note_id}.txt`,
      text: `${note.title || 'Untitled Note'}\n\n${note.content || 'No content'}\n\nTags: ${tags}`,
      documentType: 'editorial_note',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        note_id: note.note_id,
        content_type: 'editorial_note',
        note_type: note.note_type || 'general',
        target_audience: note.target_audience || 'general',
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
    const validationRules = Array.isArray(step.validation_rules) ? step.validation_rules.join(', ') : (step.validation_rules || 'N/A');
    
    const doc = {
      filename: `step_${step.step_id}.txt`,
      text: `${step.title || 'Untitled Step'}\n\n${step.description || 'No description'}\n\nInstructions: ${step.instructions || 'No instructions'}\n\nValidation: ${validationRules}`,
      documentType: 'editorial_step',
      metadata: {
        package_id: samplePackage.package_id,
        topic: samplePackage.topic,
        step_id: step.step_id,
        content_type: 'user_step',
        step_type: step.step_type || 'general',
        form_target: step.form_target || 'general',
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