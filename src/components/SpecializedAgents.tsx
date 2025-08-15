import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, PiggyBank, Calculator, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';


interface AgentRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  potentialSavings?: number;
  timeframe: string;
  requirements: string[];
  risks?: string[];
}

interface AgentAnalysis {
  agentType: string;
  recommendations: AgentRecommendation[];
  totalPotentialSavings: number;
  analysisDate: string;
  regulatoryBasis: string[];
}

const SpecializedAgents: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState<string>('optimization');
  const [userProfile, setUserProfile] = useState({
    age: 35,
    income: 75000,
    maritalStatus: 'single',
    hasChildren: false,
    employmentType: 'employee',
    investmentPortfolio: 50000,
    retirementSavings: 25000
  });
  const [analysis, setAnalysis] = useState<AgentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [qdrantLoading, setQdrantLoading] = useState(false);
  const [lohnsteuerData, setLohnsteuerData] = useState<any>(null);
  const [dataSource, setDataSource] = useState<'manual' | 'document'>('manual');

  // Query Qdrant for Lohnsteuer documents and extract data
  const fetchLohnsteuerFromQdrant = async () => {
    console.log('🔍 Fetching Lohnsteuer data from Qdrant...');
    setQdrantLoading(true);
    try {
      console.log('📡 Making request to /api/documents/search');
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'Lohnsteuerbescheinigung Bruttoarbeitslohn Gehaltsabrechnung',
          limit: 5
        }),
      });
      
      console.log('📥 Response status:', response.status, response.statusText);

      if (response.ok) {
        const responseData = await response.json();
        const results = responseData.results || responseData; // Handle both old and new API response formats
        
        // Ensure results is an array
        if (!Array.isArray(results)) {
          console.error('❌ API response is not an array:', results);
          return null;
        }
        
        console.log('📊 Search results:', results.length, 'documents found');
        
        // Find the most relevant Lohnsteuer document
        const lohnsteuerDoc = results.find((doc: any) => 
          doc.text?.toLowerCase().includes('lohnsteuer') ||
          doc.text?.toLowerCase().includes('bruttoarbeitslohn') ||
          doc.filename?.toLowerCase().includes('lohnsteuer') ||
          doc.documentType === 'lohnsteuerbescheinigung'
        );

        console.log('📄 Found Lohnsteuer document:', lohnsteuerDoc ? lohnsteuerDoc.filename : 'None');

        if (lohnsteuerDoc) {
          console.log('📄 Document text preview:', lohnsteuerDoc.text?.substring(0, 500) + '...');
          const extractedData = extractDataFromLohnsteuerText(lohnsteuerDoc.text);
          console.log('💰 Extracted data:', extractedData);
          
          // Check if we have any useful data (not just salary)
          const hasUsefulData = extractedData.salary > 0 || 
                               extractedData.age || 
                               (extractedData.socialInsurance && extractedData.socialInsurance > 0) || 
                               (extractedData.tax && extractedData.tax > 0) ||
                               extractedData.maritalStatus ||
                               extractedData.hasChildren !== undefined;
          
          if (hasUsefulData) {
            setLohnsteuerData({
              ...extractedData,
              documentName: lohnsteuerDoc.filename,
              qdrantId: lohnsteuerDoc.id
            });
            
            setUserProfile(prev => ({
              ...prev,
              income: extractedData.salary > 0 ? extractedData.salary : prev.income,
              age: extractedData.age || prev.age,
              maritalStatus: extractedData.maritalStatus || prev.maritalStatus,
              hasChildren: extractedData.hasChildren !== undefined ? extractedData.hasChildren : prev.hasChildren
            }));
            
            setDataSource('document');
            console.log('✅ Successfully updated user profile with Qdrant data');
            console.log('📋 Updated profile data:', {
              income: extractedData.salary > 0 ? extractedData.salary : 'unchanged',
              age: extractedData.age || 'unchanged',
              maritalStatus: extractedData.maritalStatus || 'unchanged',
              hasChildren: extractedData.hasChildren !== undefined ? extractedData.hasChildren : 'unchanged'
            });
            return extractedData;
          } else {
            console.log('⚠️ No useful data found in document');
          }
        }
      } else {
        console.error('❌ API request failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching Lohnsteuer data from Qdrant:', error);
    } finally {
      setQdrantLoading(false);
    }
    return null;
  };

  // Extract financial data from Lohnsteuer text
  const extractDataFromLohnsteuerText = (text: string) => {
    if (!text) return { salary: 0 };

    const extractNumber = (patterns: RegExp[], label: string = ''): number => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          console.log(`🔍 ${label} pattern matched:`, pattern.toString(), 'found:', match[1]);
          // Handle German number format (1.234,56 or 1234,56)
          const numStr = match[1].replace(/\./g, '').replace(',', '.');
          const num = parseFloat(numStr);
          if (!isNaN(num) && num > 0) {
            // Filter out obviously wrong values (like single digits for salary)
            if (label === 'Salary' && num < 1000) {
              console.log(`⚠️ ${label} value too small (${Math.round(num)}), continuing search...`);
              continue;
            }
            console.log(`✅ ${label} extracted:`, Math.round(num));
            return Math.round(num);
          }
        }
      }
      console.log(`❌ No ${label} found`);
      return 0;
    };

    // German Lohnsteuer patterns - ordered by specificity (most specific first)
    const salaryPatterns = [
      // Most specific patterns first (from document analysis)
      /Bruttoarbeitslohn\s+von\s+[A-Za-z\s]+\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      /Der\s+Bruttoarbeitslohn\s+von\s+[A-Za-z\s]+\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      /von\s+[A-Za-z\s]+\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      // Standard specific patterns
      /Bruttoarbeitslohn[:\s]*([0-9.,]+)/i,
      /Bruttolohn[:\s]*([0-9.,]+)/i,
      /Jahresbrutto[:\s]*([0-9.,]+)/i,
      /Gesamtbrutto[:\s]*([0-9.,]+)/i,
      /Bruttoverdienst[:\s]*([0-9.,]+)/i,
      /Arbeitslohn[:\s]*([0-9.,]+)/i,
      /Lohn[:\s]*([0-9.,]+)/i,
      /Gehalt[:\s]*([0-9.,]+)/i,
      /Einkommen[:\s]*([0-9.,]+)/i,
      // Generic patterns with Euro
      /([0-9.,]+)\s*EUR?\s*Brutto/i,
      // Generic "beträgt" pattern (less specific, so later)
      /beträgt\s+([0-9.,]+)\s*Euro/i,
      // Most generic patterns last (these were causing the "3" match)
      /Brutto[:\s]*([0-9.,]+)/i,
      /([0-9.,]+)\s*€?\s*Brutto/i
    ];

    const taxPatterns = [
      // Most specific patterns first (from document analysis)
      /Die\s+einbehaltene\s+Lohnsteuer\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      /einbehaltene\s+Lohnsteuer\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      /Lohnsteuer\s+beträgt\s+([0-9.,]+)\s*Euro/i,
      // Standard patterns
      /Lohnsteuer[:\s]*([0-9.,]+)/i,
      /Einkommensteuer[:\s]*([0-9.,]+)/i
    ];

    const socialInsurancePatterns = [
      /Sozialversicherung[:\s]*([0-9.,]+)/i,
      /Rentenversicherung[:\s]*([0-9.,]+)/i,
      /Krankenversicherung[:\s]*([0-9.,]+)/i,
      // Patterns for social insurance contributions
      /Sozialversicherungsbeiträge[:\s]*€?([0-9.,]+)/i,
      /Beiträge\s+zur\s+gesetzlichen\s+Rentenversicherung[:\s]*([0-9.,]+)/i,
      /€([0-9.,]+)\s*Sozialversicherungsbeiträge/i
    ];

    const salary = extractNumber(salaryPatterns, 'Salary');
    const tax = extractNumber(taxPatterns, 'Tax');
    const socialInsurance = extractNumber(socialInsurancePatterns, 'Social Insurance');

    // Extract age from birth date
    const birthMatch = text.match(/geboren[:\s]*(\d{1,2})\.(\d{1,2})\.(\d{4})/i) ||
                      text.match(/Geburtsdatum[:\s]*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
    let age = null;
    if (birthMatch) {
      const birthYear = parseInt(birthMatch[3]);
      age = new Date().getFullYear() - birthYear;
    }

    // Extract marital status
    let maritalStatus = null;
    if (text.match(/(verheiratet|married)/i)) maritalStatus = 'married';
    else if (text.match(/(ledig|single)/i)) maritalStatus = 'single';
    else if (text.match(/(geschieden|divorced)/i)) maritalStatus = 'divorced';

    // Check for children
    const hasChildren = text.match(/(kinderfreibetrag|kindergeld|kinder[:\s]*[1-9])/i) !== null;

    return {
      salary,
      tax,
      socialInsurance,
      age,
      maritalStatus,
      hasChildren,
      extractedAt: new Date().toISOString()
    };
  };

  // Load Lohnsteuer data from Qdrant on component mount
  useEffect(() => {
    fetchLohnsteuerFromQdrant();
  }, []);

  const agents = [
    {
      id: 'optimization',
      name: 'Steueroptimierungs-Agent',
      icon: Calculator,
      description: 'Identifiziert legale Strategien zur Minimierung der Steuerlast',
      color: 'bg-blue-500'
    },
    {
      id: 'investment',
      name: 'Investitions-Steuer-Agent',
      icon: TrendingUp,
      description: 'Berät zu steuerlich effizienten Anlagestrategien',
      color: 'bg-green-500'
    },
    {
      id: 'retirement',
      name: 'Altersvorsorge-Steuer-Agent',
      icon: PiggyBank,
      description: 'Optimiert Rentenbeiträge und Auszahlungsstrategien',
      color: 'bg-purple-500'
    }
  ];

  const runAgentAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/agents/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentType: activeAgent,
          userProfile
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysis(result);
      } else {
        console.error('Failed to run agent analysis');
      }
    } catch (error) {
      console.error('Error running agent analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Spezialisierte Steuer-Agenten</h1>
        <p className="text-gray-600">
          KI-gestützte Agenten spezialisiert auf deutsche Steuerrecht-Optimierung und -Planung
        </p>
      </div>

      {/* Agent Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {agents.map((agent) => {
          const IconComponent = agent.icon;
          return (
            <button
              key={agent.id}
              onClick={() => setActiveAgent(agent.id)}
              className={`p-6 rounded-lg border-2 transition-all ${
                activeAgent === agent.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-12 h-12 ${agent.color} rounded-lg flex items-center justify-center mb-4`}>
                <IconComponent className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{agent.name}</h3>
              <p className="text-sm text-gray-600">{agent.description}</p>
            </button>
          );
        })}
      </div>

      {/* User Profile Configuration */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Benutzerprofil</h2>
          {lohnsteuerData && dataSource === 'document' && (
            <div className="flex items-center space-x-2 text-sm">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-medium">
                Daten aus Qdrant: {lohnsteuerData.documentName}
              </span>
              <span className="text-gray-500">
                (€{lohnsteuerData.salary?.toLocaleString()})
              </span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alter</label>
            <input
              type="number"
              value={userProfile.age}
              onChange={(e) => setUserProfile({...userProfile, age: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jahreseinkommen (€)</label>
            <input
              type="number"
              value={userProfile.income}
              onChange={(e) => setUserProfile({...userProfile, income: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Familienstand</label>
            <select
              value={userProfile.maritalStatus}
              onChange={(e) => setUserProfile({...userProfile, maritalStatus: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="single">Ledig</option>
              <option value="married">Verheiratet</option>
              <option value="divorced">Geschieden</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschäftigung</label>
            <select
              value={userProfile.employmentType}
              onChange={(e) => setUserProfile({...userProfile, employmentType: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="employee">Angestellt</option>
              <option value="freelancer">Freiberufler</option>
              <option value="business_owner">Unternehmer</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={userProfile.hasChildren}
                onChange={(e) => setUserProfile({...userProfile, hasChildren: e.target.checked})}
                className="mr-2"
              />
              Hat Kinder
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anlageportfolio (€)</label>
            <input
              type="number"
              value={userProfile.investmentPortfolio}
              onChange={(e) => setUserProfile({...userProfile, investmentPortfolio: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Altersvorsorge (€)</label>
            <input
              type="number"
              value={userProfile.retirementSavings}
              onChange={(e) => setUserProfile({...userProfile, retirementSavings: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Refresh Qdrant Data Button */}
      <div className="text-center mb-4">
        <button
          onClick={fetchLohnsteuerFromQdrant}
          disabled={qdrantLoading}
          className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto text-sm"
        >
          {qdrantLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Lade Daten...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Lohnsteuer-Daten aus Qdrant aktualisieren
            </>
          )}
        </button>
      </div>

      {/* Run Analysis Button */}
      <div className="text-center mb-8">
        <button
          onClick={runAgentAnalysis}
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Analysiere...
            </>
          ) : (
            <>
              <Search className="w-5 h-5 mr-2" />
              {agents.find(a => a.id === activeAgent)?.name} Analyse starten
            </>
          )}
        </button>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Analyseergebnisse</h2>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                €{analysis.totalPotentialSavings.toLocaleString()} mögliche Einsparungen
              </div>
              <div className="text-sm text-gray-500">
                Analysedatum: {new Date(analysis.analysisDate).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Regulatory Basis */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Rechtliche Grundlage</h3>
            <ul className="text-sm text-blue-800">
              {analysis.regulatoryBasis.map((basis, index) => (
                <li key={index} className="mb-1">• {basis}</li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className="space-y-6">
            {analysis.recommendations.map((rec) => (
              <div key={rec.id} className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{rec.title}</h3>
                    <p className="text-gray-600 mb-3">{rec.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getImpactColor(rec.impact)}`}>
                      {rec.impact.toUpperCase()} IMPACT
                    </div>
                    <div className={`text-sm font-medium mt-1 ${getConfidenceColor(rec.confidence)}`}>
                      {rec.confidence}% confidence
                    </div>
                  </div>
                </div>

                {rec.potentialSavings && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="font-semibold text-green-800">
                        Mögliche Einsparungen: €{rec.potentialSavings.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      Zeitrahmen
                    </h4>
                    <p className="text-sm text-gray-600">{rec.timeframe}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Anforderungen</h4>
                    <ul className="text-sm text-gray-600">
                      {rec.requirements.map((req, index) => (
                        <li key={index} className="mb-1">• {req}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {rec.risks && rec.risks.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Überlegungen & Risiken
                    </h4>
                    <ul className="text-sm text-yellow-700">
                      {rec.risks.map((risk, index) => (
                        <li key={index} className="mb-1">• {risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecializedAgents;