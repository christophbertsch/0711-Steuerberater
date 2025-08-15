import React, { useState, useEffect } from 'react';

// Core Types for Tax System
interface TaxPosition {
  formular: string;
  kennziffer: string;
  value: number;
  year: number;
  evidence: string[];
  explanation: string;
  confidence: number;
  agent: string;
}

interface TaxRule {
  id: string;
  rule_type: 'calculation' | 'validation' | 'classification' | 'optimization';
  condition: string;
  action: string;
  confidence: number;
  learned_from: string[];
  last_updated: string;
  success_rate: number;
}

interface AgentResult {
  agent: string;
  positions: TaxPosition[];
  needs: string[];
  confidence: number;
  evidence_refs: string[];
}

interface OrchestrationPlan {
  plan_id: string;
  steps: Array<{
    id: string;
    agent: string;
    args: any;
    needs: string[];
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  routing: {
    on_error: string;
    concurrency: string;
  };
  success_criteria: string[];
}

const TaxOrchestrator: React.FC = () => {
  const [orchestrationPlan, setOrchestrationPlan] = useState<OrchestrationPlan | null>(null);
  const [agentResults, setAgentResults] = useState<AgentResult[]>([]);
  const [taxPositions, setTaxPositions] = useState<TaxPosition[]>([]);
  const [learnedRules, setLearnedRules] = useState<TaxRule[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

  // Initialize Tax Orchestrator
  const initializeOrchestrator = async () => {
    console.log('🧠 Initializing Tax AI Orchestrator...');
    
    // Load existing learned rules
    await loadLearnedRules();
    
    // Create orchestration plan
    const plan = await createOrchestrationPlan();
    setOrchestrationPlan(plan);
  };

  // Load learned tax rules from knowledge base
  const loadLearnedRules = async () => {
    try {
      const response = await fetch('/api/tax/rules');
      if (response.ok) {
        const rules = await response.json();
        setLearnedRules(rules);
        console.log(`📚 Loaded ${rules.length} learned tax rules`);
      }
    } catch (error) {
      console.error('❌ Error loading tax rules:', error);
      // Initialize with basic rules
      setLearnedRules(getBasicTaxRules());
    }
  };

  // Create orchestration plan based on available documents
  const createOrchestrationPlan = async (): Promise<OrchestrationPlan> => {
    const plan: OrchestrationPlan = {
      plan_id: `plan_${Date.now()}`,
      steps: [
        {
          id: 'doc_classification',
          agent: 'DOC_TYPE_CLASSIFIER',
          args: { limit: 50 },
          needs: [],
          status: 'pending'
        },
        {
          id: 'lstb_analysis',
          agent: 'LSTB_PARSER',
          args: { doc_type: 'lohnsteuerbescheinigung' },
          needs: ['doc_classification'],
          status: 'pending'
        },
        {
          id: 'invoice_analysis',
          agent: 'INVOICE_PARSER',
          args: { doc_type: 'rechnung' },
          needs: ['doc_classification'],
          status: 'pending'
        },
        {
          id: 'werbungskosten_council',
          agent: 'N_WK_BASE',
          args: {},
          needs: ['lstb_analysis', 'invoice_analysis'],
          status: 'pending'
        },
        {
          id: 'tax_calculation',
          agent: 'TARIFF_ENGINE',
          args: { year: 2024 },
          needs: ['werbungskosten_council'],
          status: 'pending'
        },
        {
          id: 'optimization',
          agent: 'WHAT_IF',
          args: {},
          needs: ['tax_calculation'],
          status: 'pending'
        }
      ],
      routing: {
        on_error: 'HUMAN_REVIEW',
        concurrency: 'bounded'
      },
      success_criteria: [
        'no_validation_errors',
        'all_required_forms_mapped',
        'confidence_above_threshold'
      ]
    };

    return plan;
  };

  // Execute orchestration plan
  const executeOrchestration = async () => {
    if (!orchestrationPlan) return;

    setProcessing(true);
    const results: AgentResult[] = [];

    try {
      for (const step of orchestrationPlan.steps) {
        setCurrentStep(step.agent);
        step.status = 'running';
        
        console.log(`🤖 Executing agent: ${step.agent}`);
        
        const result = await executeAgent(step.agent, step.args);
        results.push(result);
        
        // Learn from agent results
        await learnFromAgentResult(result);
        
        step.status = 'completed';
        
        // Update UI
        setAgentResults([...results]);
      }

      // Consolidate all positions
      const allPositions = results.flatMap(r => r.positions);
      setTaxPositions(allPositions);

      console.log('✅ Orchestration completed successfully');
      
    } catch (error) {
      console.error('❌ Orchestration failed:', error);
    } finally {
      setProcessing(false);
      setCurrentStep('');
    }
  };

  // Execute individual agent
  const executeAgent = async (agentName: string, args: any): Promise<AgentResult> => {
    switch (agentName) {
      case 'DOC_TYPE_CLASSIFIER':
        return await executeDocTypeClassifier(args);
      case 'LSTB_PARSER':
        return await executeLstbParser(args);
      case 'INVOICE_PARSER':
        return await executeInvoiceParser(args);
      case 'N_WK_BASE':
        return await executeWerbungskostenAgent(args);
      case 'TARIFF_ENGINE':
        return await executeTariffEngine(args);
      case 'WHAT_IF':
        return await executeOptimizer(args);
      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  };

  // Document Type Classifier Agent
  const executeDocTypeClassifier = async (args: any): Promise<AgentResult> => {
    const response = await fetch('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', limit: args.limit || 50 })
    });

    const data = await response.json();
    const documents = data.results || [];

    const positions: TaxPosition[] = [];
    const classifications = new Map<string, number>();

    for (const doc of documents) {
      const docType = classifyDocument(doc.text, doc.filename);
      classifications.set(docType, (classifications.get(docType) || 0) + 1);
    }

    // Create classification summary positions
    for (const [docType, count] of classifications) {
      positions.push({
        formular: 'CLASSIFICATION',
        kennziffer: docType,
        value: count,
        year: 2024,
        evidence: [`${count} documents classified as ${docType}`],
        explanation: `Automatisch klassifiziert: ${count} Dokumente als ${docType}`,
        confidence: 0.85,
        agent: 'DOC_TYPE_CLASSIFIER'
      });
    }

    return {
      agent: 'DOC_TYPE_CLASSIFIER',
      positions,
      needs: [],
      confidence: 0.85,
      evidence_refs: documents.map((d: any) => d.id)
    };
  };

  // Lohnsteuerbescheinigung Parser Agent
  const executeLstbParser = async (_args: any): Promise<AgentResult> => {
    const response = await fetch('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Lohnsteuerbescheinigung Bruttoarbeitslohn', limit: 10 })
    });

    const data = await response.json();
    const documents = data.results || [];

    const positions: TaxPosition[] = [];

    for (const doc of documents) {
      if (doc.text?.toLowerCase().includes('lohnsteuerbescheinigung')) {
        // Extract tax positions from Lohnsteuerbescheinigung
        const extractedData = extractLstbData(doc.text);
        
        if (extractedData.bruttoarbeitslohn > 0) {
          positions.push({
            formular: 'Anlage N',
            kennziffer: '001',
            value: extractedData.bruttoarbeitslohn,
            year: 2024,
            evidence: [doc.id],
            explanation: 'Bruttoarbeitslohn aus Lohnsteuerbescheinigung',
            confidence: 0.95,
            agent: 'LSTB_PARSER'
          });
        }

        if (extractedData.lohnsteuer > 0) {
          positions.push({
            formular: 'Anlage N',
            kennziffer: '002',
            value: extractedData.lohnsteuer,
            year: 2024,
            evidence: [doc.id],
            explanation: 'Einbehaltene Lohnsteuer',
            confidence: 0.95,
            agent: 'LSTB_PARSER'
          });
        }
      }
    }

    return {
      agent: 'LSTB_PARSER',
      positions,
      needs: positions.length === 0 ? ['lohnsteuerbescheinigung_required'] : [],
      confidence: 0.95,
      evidence_refs: documents.map((d: any) => d.id)
    };
  };

  // Invoice Parser Agent
  const executeInvoiceParser = async (_args: any): Promise<AgentResult> => {
    const response = await fetch('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Rechnung Invoice', limit: 20 })
    });

    const data = await response.json();
    const documents = data.results || [];

    const positions: TaxPosition[] = [];

    for (const doc of documents) {
      const invoiceData = parseInvoice(doc.text, doc.filename);
      
      if (invoiceData.amount > 0 && invoiceData.category === 'werbungskosten') {
        positions.push({
          formular: 'Anlage N',
          kennziffer: 'WK001',
          value: invoiceData.amount,
          year: 2024,
          evidence: [doc.id],
          explanation: `Werbungskosten: ${invoiceData.description}`,
          confidence: invoiceData.confidence,
          agent: 'INVOICE_PARSER'
        });
      }
    }

    return {
      agent: 'INVOICE_PARSER',
      positions,
      needs: [],
      confidence: 0.80,
      evidence_refs: documents.map((d: any) => d.id)
    };
  };

  // Werbungskosten Base Agent (Council)
  const executeWerbungskostenAgent = async (_args: any): Promise<AgentResult> => {
    // Get all Werbungskosten positions from previous agents
    const wkPositions = agentResults
      .flatMap(r => r.positions)
      .filter(p => p.formular === 'Anlage N' && p.kennziffer.startsWith('WK'));

    const totalWerbungskosten = wkPositions.reduce((sum, p) => sum + p.value, 0);
    const pauschbetrag = 1230; // 2024 Werbungskosten-Pauschbetrag

    const positions: TaxPosition[] = [];

    if (totalWerbungskosten > pauschbetrag) {
      // Use individual Werbungskosten
      positions.push(...wkPositions);
      positions.push({
        formular: 'Anlage N',
        kennziffer: 'WK_DECISION',
        value: totalWerbungskosten,
        year: 2024,
        evidence: wkPositions.flatMap(p => p.evidence),
        explanation: `Einzelnachweis gewählt: €${totalWerbungskosten} > Pauschbetrag €${pauschbetrag}`,
        confidence: 0.90,
        agent: 'N_WK_BASE'
      });
    } else {
      // Use Pauschbetrag
      positions.push({
        formular: 'Anlage N',
        kennziffer: 'WK_PAUSCH',
        value: pauschbetrag,
        year: 2024,
        evidence: ['Werbungskosten-Pauschbetrag 2024'],
        explanation: `Pauschbetrag gewählt: €${pauschbetrag} > Einzelnachweis €${totalWerbungskosten}`,
        confidence: 0.95,
        agent: 'N_WK_BASE'
      });
    }

    return {
      agent: 'N_WK_BASE',
      positions,
      needs: [],
      confidence: 0.90,
      evidence_refs: wkPositions.flatMap(p => p.evidence)
    };
  };

  // Tariff Engine Agent
  const executeTariffEngine = async (_args: any): Promise<AgentResult> => {
    const allPositions = agentResults.flatMap(r => r.positions);
    
    // Calculate zu versteuerndes Einkommen
    const bruttoarbeitslohn = allPositions.find(p => p.kennziffer === '001')?.value || 0;
    const werbungskosten = allPositions.find(p => p.kennziffer.startsWith('WK'))?.value || 1230;
    
    const zvE = Math.max(0, bruttoarbeitslohn - werbungskosten);
    
    // Simple tax calculation (2024 tariff)
    const einkommensteuer = calculateIncomeTax2024(zvE);
    const solidaritaetszuschlag = einkommensteuer * 0.055;

    const positions: TaxPosition[] = [
      {
        formular: 'ESt',
        kennziffer: 'ZVE',
        value: zvE,
        year: 2024,
        evidence: ['Calculated from income and deductions'],
        explanation: `Zu versteuerndes Einkommen: €${bruttoarbeitslohn} - €${werbungskosten}`,
        confidence: 0.95,
        agent: 'TARIFF_ENGINE'
      },
      {
        formular: 'ESt',
        kennziffer: 'EST',
        value: einkommensteuer,
        year: 2024,
        evidence: ['2024 tax tariff calculation'],
        explanation: `Einkommensteuer nach Tarif 2024`,
        confidence: 0.95,
        agent: 'TARIFF_ENGINE'
      },
      {
        formular: 'ESt',
        kennziffer: 'SOLI',
        value: solidaritaetszuschlag,
        year: 2024,
        evidence: ['5.5% of income tax'],
        explanation: `Solidaritätszuschlag: 5,5% von €${einkommensteuer}`,
        confidence: 0.95,
        agent: 'TARIFF_ENGINE'
      }
    ];

    return {
      agent: 'TARIFF_ENGINE',
      positions,
      needs: [],
      confidence: 0.95,
      evidence_refs: []
    };
  };

  // What-If Optimizer Agent
  const executeOptimizer = async (_args: any): Promise<AgentResult> => {
    const positions: TaxPosition[] = [];
    
    // Analyze optimization opportunities
    const currentTax = agentResults
      .flatMap(r => r.positions)
      .find(p => p.kennziffer === 'EST')?.value || 0;

    positions.push({
      formular: 'OPTIMIZATION',
      kennziffer: 'CURRENT_TAX',
      value: currentTax,
      year: 2024,
      evidence: ['Current tax calculation'],
      explanation: `Aktuelle Steuerlast: €${currentTax}`,
      confidence: 0.90,
      agent: 'WHAT_IF'
    });

    return {
      agent: 'WHAT_IF',
      positions,
      needs: [],
      confidence: 0.90,
      evidence_refs: []
    };
  };

  // Learn from agent results
  const learnFromAgentResult = async (result: AgentResult) => {
    // Create new learned rules based on successful patterns
    const newRules: TaxRule[] = [];

    for (const position of result.positions) {
      if (position.confidence > 0.8) {
        const rule: TaxRule = {
          id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          rule_type: 'calculation',
          condition: `agent=${result.agent} AND confidence>${position.confidence}`,
          action: `apply_position(${position.formular}, ${position.kennziffer}, ${position.value})`,
          confidence: position.confidence,
          learned_from: position.evidence,
          last_updated: new Date().toISOString(),
          success_rate: 1.0
        };
        newRules.push(rule);
      }
    }

    // Add to learned rules
    setLearnedRules(prev => [...prev, ...newRules]);

    // Store in knowledge base
    try {
      await fetch('/api/tax/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: newRules })
      });
    } catch (error) {
      console.error('❌ Error storing learned rules:', error);
    }
  };

  // Helper functions
  const classifyDocument = (text: string, filename: string): string => {
    const content = (text + ' ' + filename).toLowerCase();
    
    if (content.includes('lohnsteuerbescheinigung')) return 'LSTB';
    if (content.includes('rechnung') || content.includes('invoice')) return 'RECHNUNG';
    if (content.includes('spende')) return 'SPENDENQUITTUNG';
    if (content.includes('bescheid')) return 'BESCHEID';
    if (content.includes('versicherung')) return 'VERSICHERUNG';
    
    return 'UNKNOWN';
  };

  const extractLstbData = (text: string) => {
    // Extract key values from Lohnsteuerbescheinigung
    const bruttoMatch = text.match(/bruttoarbeitslohn[:\s]*([0-9.,]+)/i);
    const steuerMatch = text.match(/lohnsteuer[:\s]*([0-9.,]+)/i);
    
    return {
      bruttoarbeitslohn: bruttoMatch ? parseFloat(bruttoMatch[1].replace(/[.,]/g, '')) / 100 : 0,
      lohnsteuer: steuerMatch ? parseFloat(steuerMatch[1].replace(/[.,]/g, '')) / 100 : 0
    };
  };

  const parseInvoice = (text: string, filename: string) => {
    // Parse invoice data
    const amountMatch = text.match(/([0-9]+[.,][0-9]{2})\s*€/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : 0;
    
    const content = (text + ' ' + filename).toLowerCase();
    const category = content.match(/(computer|laptop|software|telefon|datentechnik)/) ? 'werbungskosten' : 'other';
    
    return {
      amount,
      category,
      description: filename,
      confidence: amount > 0 ? 0.8 : 0.3
    };
  };

  const calculateIncomeTax2024 = (zvE: number): number => {
    // Simplified 2024 German income tax calculation
    if (zvE <= 11604) return 0;
    if (zvE <= 17005) return Math.round((zvE - 11604) * 0.14);
    if (zvE <= 66760) return Math.round(1190.04 + (zvE - 17005) * 0.24);
    if (zvE <= 277825) return Math.round(13141.24 + (zvE - 66760) * 0.42);
    return Math.round(101462.77 + (zvE - 277825) * 0.45);
  };

  const getBasicTaxRules = (): TaxRule[] => [
    {
      id: 'rule_wk_pauschbetrag',
      rule_type: 'calculation',
      condition: 'werbungskosten < 1230',
      action: 'use_pauschbetrag(1230)',
      confidence: 0.95,
      learned_from: ['EStG §9a'],
      last_updated: new Date().toISOString(),
      success_rate: 1.0
    },
    {
      id: 'rule_computer_werbungskosten',
      rule_type: 'classification',
      condition: 'document_contains(computer|laptop|software) AND employment_status=employee',
      action: 'classify_as_werbungskosten',
      confidence: 0.85,
      learned_from: ['BFH VI R 36/17'],
      last_updated: new Date().toISOString(),
      success_rate: 0.9
    }
  ];

  useEffect(() => {
    initializeOrchestrator();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              🧠 Tax AI Orchestrator
            </h2>
            <p className="text-gray-600 mt-1">
              Self-Learning Tax Content & Logic System
            </p>
          </div>
          <button
            onClick={executeOrchestration}
            disabled={processing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {processing ? '🔄 Processing...' : '🚀 Execute Tax Analysis'}
          </button>
        </div>

        {/* Orchestration Plan */}
        {orchestrationPlan && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">📋 Orchestration Plan</h3>
            <div className="space-y-2">
              {orchestrationPlan.steps.map((step) => (
                <div
                  key={step.id}
                  className={`p-3 rounded-lg border ${
                    step.status === 'completed' ? 'bg-green-50 border-green-200' :
                    step.status === 'running' ? 'bg-blue-50 border-blue-200' :
                    step.status === 'failed' ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{step.agent}</span>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      step.status === 'completed' ? 'bg-green-100 text-green-800' :
                      step.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      step.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {step.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Processing */}
        {processing && currentStep && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-blue-800 font-medium">
                Currently executing: {currentStep}
              </span>
            </div>
          </div>
        )}

        {/* Tax Positions */}
        {taxPositions.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">📊 Tax Positions</h3>
            <div className="space-y-2">
              {taxPositions.map((position, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{position.formular} - {position.kennziffer}</span>
                      <p className="text-sm text-gray-600 mt-1">{position.explanation}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        €{position.value.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(position.confidence * 100)}% confidence
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learned Rules */}
        {learnedRules.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">🧠 Learned Tax Rules ({learnedRules.length})</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {learnedRules.slice(-10).map((rule) => (
                <div key={rule.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-purple-800">{rule.rule_type}</span>
                      <p className="text-xs text-purple-600 mt-1">{rule.condition}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-purple-800">
                        {Math.round(rule.confidence * 100)}%
                      </div>
                      <div className="text-xs text-purple-600">
                        Success: {Math.round(rule.success_rate * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxOrchestrator;