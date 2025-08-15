import React, { useState, useEffect } from 'react';

// Tax Knowledge Types
interface TaxKnowledge {
  id: string;
  topic: string;
  rule: string;
  legal_basis: string[];
  examples: string[];
  confidence: number;
  learned_from_cases: number;
  last_updated: string;
  success_rate: number;
  category: 'income' | 'deductions' | 'calculations' | 'validations' | 'optimizations';
}

interface LegalReference {
  norm: string;
  paragraph: string;
  title: string;
  url?: string;
  last_checked: string;
}

interface TaxCase {
  id: string;
  case_type: string;
  input_data: any;
  applied_rules: string[];
  outcome: any;
  success: boolean;
  feedback_score: number;
  timestamp: string;
}

interface LearningMetrics {
  total_cases: number;
  successful_cases: number;
  rules_learned: number;
  accuracy_rate: number;
  improvement_rate: number;
}

const TaxKnowledgeBase: React.FC = () => {
  const [knowledgeBase, setKnowledgeBase] = useState<TaxKnowledge[]>([]);
  const [legalReferences, setLegalReferences] = useState<LegalReference[]>([]);
  const [recentCases, setRecentCases] = useState<TaxCase[]>([]);
  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics>({
    total_cases: 0,
    successful_cases: 0,
    rules_learned: 0,
    accuracy_rate: 0,
    improvement_rate: 0
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize Knowledge Base
  useEffect(() => {
    initializeKnowledgeBase();
    loadLearningMetrics();
  }, []);

  const initializeKnowledgeBase = async () => {
    setLoading(true);
    try {
      // Load existing knowledge base
      await loadKnowledgeBase();
      await loadLegalReferences();
      await loadRecentCases();
      
      // Initialize with core tax knowledge if empty
      if (knowledgeBase.length === 0) {
        await initializeCoreKnowledge();
      }
    } catch (error) {
      console.error('❌ Error initializing knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/tax/knowledge');
      if (response.ok) {
        const knowledge = await response.json();
        setKnowledgeBase(knowledge);
        console.log(`📚 Loaded ${knowledge.length} tax knowledge entries`);
      }
    } catch (error) {
      console.error('❌ Error loading knowledge base:', error);
    }
  };

  const loadLegalReferences = async () => {
    try {
      const response = await fetch('/api/tax/legal-references');
      if (response.ok) {
        const references = await response.json();
        setLegalReferences(references);
      }
    } catch (error) {
      console.error('❌ Error loading legal references:', error);
      // Initialize with basic references
      setLegalReferences(getBasicLegalReferences());
    }
  };

  const loadRecentCases = async () => {
    try {
      const response = await fetch('/api/tax/cases?limit=20');
      if (response.ok) {
        const cases = await response.json();
        setRecentCases(cases);
      }
    } catch (error) {
      console.error('❌ Error loading recent cases:', error);
    }
  };

  const loadLearningMetrics = async () => {
    try {
      const response = await fetch('/api/tax/metrics');
      if (response.ok) {
        const metrics = await response.json();
        setLearningMetrics(metrics);
      }
    } catch (error) {
      console.error('❌ Error loading learning metrics:', error);
    }
  };

  const initializeCoreKnowledge = async () => {
    const coreKnowledge: TaxKnowledge[] = [
      {
        id: 'wk_pauschbetrag_2024',
        topic: 'Werbungskosten-Pauschbetrag',
        rule: 'IF werbungskosten_einzelnachweis <= 1230 THEN use_pauschbetrag(1230)',
        legal_basis: ['EStG §9a Nr.1'],
        examples: [
          'Angestellter mit €800 Werbungskosten → Pauschbetrag €1.230',
          'Angestellter mit €1.500 Werbungskosten → Einzelnachweis €1.500'
        ],
        confidence: 0.98,
        learned_from_cases: 0,
        last_updated: new Date().toISOString(),
        success_rate: 1.0,
        category: 'deductions'
      },
      {
        id: 'computer_werbungskosten',
        topic: 'Computer als Werbungskosten',
        rule: 'IF document_type=invoice AND contains(computer|laptop|software) AND employment_status=employee AND business_use>=50% THEN classify_as_werbungskosten',
        legal_basis: ['EStG §9 Abs.1 S.1', 'BFH VI R 36/17'],
        examples: [
          'Laptop für €1.200 bei 100% beruflicher Nutzung → €1.200 Werbungskosten',
          'Computer für €800 bei 50% beruflicher Nutzung → €400 Werbungskosten'
        ],
        confidence: 0.85,
        learned_from_cases: 0,
        last_updated: new Date().toISOString(),
        success_rate: 0.9,
        category: 'deductions'
      },
      {
        id: 'telco_werbungskosten',
        topic: 'Telekommunikationskosten',
        rule: 'IF document_type=telco_bill AND employment_status=employee THEN apply_business_share(20%)',
        legal_basis: ['EStG §9 Abs.1 S.1', 'BMF IV C 4 - S 2353/19/10002'],
        examples: [
          'Handy-Rechnung €60/Monat → €12/Monat als Werbungskosten (20%)',
          'Internet €40/Monat → €8/Monat als Werbungskosten (20%)'
        ],
        confidence: 0.80,
        learned_from_cases: 0,
        last_updated: new Date().toISOString(),
        success_rate: 0.85,
        category: 'deductions'
      },
      {
        id: 'home_office_pauschale',
        topic: 'Homeoffice-Pauschale',
        rule: 'IF home_office_days > 0 AND year >= 2020 THEN apply_home_office_pauschale(min(home_office_days * 5, 600))',
        legal_basis: ['EStG §9 Abs.1 S.3 Nr.5a'],
        examples: [
          '120 Homeoffice-Tage → €600 Pauschale',
          '50 Homeoffice-Tage → €250 Pauschale'
        ],
        confidence: 0.95,
        learned_from_cases: 0,
        last_updated: new Date().toISOString(),
        success_rate: 0.95,
        category: 'deductions'
      },
      {
        id: 'income_tax_2024',
        topic: 'Einkommensteuer-Tarif 2024',
        rule: 'CALCULATE income_tax USING tariff_2024(zu_versteuerndes_einkommen)',
        legal_basis: ['EStG §32a'],
        examples: [
          'zvE €30.000 → Einkommensteuer €3.314',
          'zvE €50.000 → Einkommensteuer €8.952'
        ],
        confidence: 0.99,
        learned_from_cases: 0,
        last_updated: new Date().toISOString(),
        success_rate: 1.0,
        category: 'calculations'
      }
    ];

    setKnowledgeBase(coreKnowledge);
    
    // Store in backend
    try {
      await fetch('/api/tax/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge: coreKnowledge })
      });
    } catch (error) {
      console.error('❌ Error storing core knowledge:', error);
    }
  };

  // Learn from new case (placeholder for future implementation)
  // const learnFromCase = async (caseData: TaxCase) => { ... };

  // Analyze case for learning opportunities (placeholder for future implementation)
  // const analyzeCase = async (caseData: TaxCase): Promise<TaxKnowledge | null> => { ... };

  // Extract learning pattern from case (placeholder for future implementation)
  // const extractPattern = (caseData: TaxCase): any => { ... };

  // Search knowledge base
  const searchKnowledge = (query: string, category: string) => {
    let filtered = knowledgeBase;
    
    if (category !== 'all') {
      filtered = filtered.filter(k => k.category === category);
    }
    
    if (query) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(k => 
        k.topic.toLowerCase().includes(searchLower) ||
        k.rule.toLowerCase().includes(searchLower) ||
        k.legal_basis.some(basis => basis.toLowerCase().includes(searchLower))
      );
    }
    
    return filtered.sort((a, b) => b.confidence - a.confidence);
  };

  // Update rule confidence based on feedback (placeholder for future implementation)
  // const updateRuleConfidence = async (ruleId: string, success: boolean) => { ... };

  const getBasicLegalReferences = (): LegalReference[] => [
    {
      norm: 'EStG',
      paragraph: '§9',
      title: 'Werbungskosten',
      url: 'https://www.gesetze-im-internet.de/estg/__9.html',
      last_checked: new Date().toISOString()
    },
    {
      norm: 'EStG',
      paragraph: '§32a',
      title: 'Einkommensteuertarif',
      url: 'https://www.gesetze-im-internet.de/estg/__32a.html',
      last_checked: new Date().toISOString()
    },
    {
      norm: 'EStG',
      paragraph: '§10',
      title: 'Sonderausgaben',
      url: 'https://www.gesetze-im-internet.de/estg/__10.html',
      last_checked: new Date().toISOString()
    }
  ];

  const filteredKnowledge = searchKnowledge(searchQuery, selectedCategory);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              📚 Tax Knowledge Base
            </h2>
            <p className="text-gray-600 mt-1">
              Self-Learning Tax Rules & Legal References
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Accuracy Rate</div>
              <div className="text-2xl font-bold text-green-600">
                {Math.round(learningMetrics.accuracy_rate * 100)}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Rules Learned</div>
              <div className="text-2xl font-bold text-blue-600">
                {learningMetrics.rules_learned}
              </div>
            </div>
          </div>
        </div>

        {/* Learning Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600 font-medium">Total Cases</div>
            <div className="text-2xl font-bold text-blue-800">
              {learningMetrics.total_cases}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600 font-medium">Successful</div>
            <div className="text-2xl font-bold text-green-800">
              {learningMetrics.successful_cases}
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-purple-600 font-medium">Knowledge Items</div>
            <div className="text-2xl font-bold text-purple-800">
              {knowledgeBase.length}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-yellow-600 font-medium">Legal References</div>
            <div className="text-2xl font-bold text-yellow-800">
              {legalReferences.length}
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="income">Income</option>
            <option value="deductions">Deductions</option>
            <option value="calculations">Calculations</option>
            <option value="validations">Validations</option>
            <option value="optimizations">Optimizations</option>
          </select>
        </div>

        {/* Knowledge Base */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            🧠 Knowledge Rules ({filteredKnowledge.length})
          </h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading knowledge base...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredKnowledge.map((knowledge) => (
                <div key={knowledge.id} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900">{knowledge.topic}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          knowledge.category === 'income' ? 'bg-blue-100 text-blue-800' :
                          knowledge.category === 'deductions' ? 'bg-green-100 text-green-800' :
                          knowledge.category === 'calculations' ? 'bg-purple-100 text-purple-800' :
                          knowledge.category === 'validations' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-pink-100 text-pink-800'
                        }`}>
                          {knowledge.category}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2 font-mono bg-white p-2 rounded border">
                        {knowledge.rule}
                      </p>
                      
                      <div className="text-xs text-gray-500 mb-2">
                        <strong>Legal Basis:</strong> {knowledge.legal_basis.join(', ')}
                      </div>
                      
                      {knowledge.examples.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <strong>Examples:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {knowledge.examples.map((example, idx) => (
                              <li key={idx}>{example}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="text-sm font-bold text-gray-900">
                        {Math.round(knowledge.confidence * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {knowledge.learned_from_cases} cases
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(knowledge.success_rate * 100)}% success
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Cases */}
        {recentCases.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">📋 Recent Learning Cases</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {recentCases.slice(0, 5).map((case_) => (
                <div key={case_.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-blue-900">{case_.case_type}</span>
                      <p className="text-sm text-blue-700 mt-1">
                        Applied {case_.applied_rules.length} rules
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        case_.success ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {case_.success ? '✅ Success' : '❌ Failed'}
                      </div>
                      <div className="text-xs text-blue-600">
                        Score: {Math.round(case_.feedback_score * 100)}%
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

export default TaxKnowledgeBase;