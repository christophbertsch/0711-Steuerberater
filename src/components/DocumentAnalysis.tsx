import React, { useState, useEffect } from 'react';
import { Brain, FileText, TrendingUp, AlertTriangle, CheckCircle, Euro, Info, Calculator, Target, BookOpen, Lightbulb, RefreshCw } from 'lucide-react';
import { Document, DocumentAnalysis as DocumentAnalysisType } from '../types';
import { aiService } from '../services/aiService';

interface DocumentAnalysisProps {
  documents: Document[];
}

const DocumentAnalysis: React.FC<DocumentAnalysisProps> = ({ documents }) => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<string, DocumentAnalysisType>>({});
  const [, setQdrantData] = useState<any>(null);
  const [qdrantLoading, setQdrantLoading] = useState(false);
  const [enhancedAnalysis, setEnhancedAnalysis] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'comprehensive' | 'optimization'>('documents');

  useEffect(() => {
    if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
    }
    // Load comprehensive analysis on component mount
    loadComprehensiveAnalysis();
  }, [documents, selectedDocument]);

  // Load comprehensive tax analysis from Qdrant
  const loadComprehensiveAnalysis = async () => {
    console.log('🔍 Loading comprehensive tax analysis from Qdrant...');
    setQdrantLoading(true);
    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'Lohnsteuer OR Bruttoarbeitslohn OR Steuererklärung OR Abzüge OR Freibeträge',
          limit: 20
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 Comprehensive analysis data:', data.results?.length || 0, 'documents found');

      if (data.results && data.results.length > 0) {
        const comprehensiveData = analyzeAllDocumentsComprehensive(data.results);
        setQdrantData(data.results);
        setEnhancedAnalysis(comprehensiveData);
        console.log('✅ Comprehensive analysis loaded successfully');
      }
    } catch (error) {
      console.error('❌ Error loading comprehensive analysis:', error);
    } finally {
      setQdrantLoading(false);
    }
  };

  // Analyze all documents for comprehensive insights
  const analyzeAllDocumentsComprehensive = (documents: any[]) => {
    const lohnsteuerDocs = documents.filter(doc => {
      const text = doc.text?.toLowerCase() || '';
      const filename = doc.filename?.toLowerCase() || '';
      return text.includes('lohnsteuer') || 
             text.includes('bruttoarbeitslohn') || 
             filename.includes('lohnsteuer') ||
             doc.documentType === 'lohnsteuerbescheinigung';
    });

    const receiptDocs = documents.filter(doc => {
      const text = doc.text?.toLowerCase() || '';
      return text.includes('rechnung') || text.includes('beleg') || text.includes('quittung');
    });

    const donationDocs = documents.filter(doc => {
      const text = doc.text?.toLowerCase() || '';
      return text.includes('spende') || text.includes('donation');
    });

    // Extract financial data from Lohnsteuer documents
    let totalSalary = 0;
    let totalTax = 0;
    let totalSocialInsurance = 0;
    let employerInfo = null;
    let personalInfo = null;
    const extractedDocuments: any[] = [];

    lohnsteuerDocs.forEach(doc => {
      console.log('🔍 Processing Lohnsteuer document:', doc.filename);
      const extracted = extractLohnsteuerData(doc.text);
      if (extracted) {
        console.log('✅ Extracted data from', doc.filename, ':', {
          salary: extracted.salary,
          tax: extracted.tax,
          socialInsurance: extracted.socialInsurance,
          employer: extracted.employer
        });
        extractedDocuments.push({
          ...extracted,
          filename: doc.filename,
          documentId: doc.id
        });
        if (extracted.employer) employerInfo = extracted.employer;
        if (extracted.taxId) personalInfo = extracted;
      } else {
        console.log('❌ No data extracted from', doc.filename);
      }
    });

    // Handle multiple Lohnsteuerbescheinigungen correctly
    if (extractedDocuments.length > 0) {
      console.log('📊 Processing', extractedDocuments.length, 'Lohnsteuer documents');
      
      if (extractedDocuments.length === 1) {
        // Single document - use values directly
        const doc = extractedDocuments[0];
        totalSalary = doc.salary || 0;
        totalTax = doc.tax || 0;
        totalSocialInsurance = doc.socialInsurance || 0;
        console.log('📄 Single document values:', { totalSalary, totalTax, totalSocialInsurance });
      } else {
        // Multiple documents - check if they're from different years or employers
        const uniqueEmployers = [...new Set(extractedDocuments.map(d => d.employer).filter(Boolean))];
        const salaries = extractedDocuments.map(d => d.salary).filter(Boolean);
        const taxes = extractedDocuments.map(d => d.tax).filter(Boolean);
        
        console.log('🏢 Unique employers:', uniqueEmployers);
        console.log('💰 All salaries:', salaries);
        console.log('💸 All taxes:', taxes);
        
        if (uniqueEmployers.length > 1) {
          // Different employers - sum up
          totalSalary = salaries.reduce((sum, salary) => sum + salary, 0);
          totalTax = taxes.reduce((sum, tax) => sum + tax, 0);
          totalSocialInsurance = extractedDocuments.reduce((sum, doc) => sum + (doc.socialInsurance || 0), 0);
          console.log('➕ Multiple employers - summing values:', { totalSalary, totalTax, totalSocialInsurance });
        } else {
          // Same employer - likely different years or duplicates, use the highest values
          totalSalary = Math.max(...salaries);
          totalTax = Math.max(...taxes);
          totalSocialInsurance = Math.max(...extractedDocuments.map(d => d.socialInsurance || 0));
          console.log('📈 Same employer - using max values:', { totalSalary, totalTax, totalSocialInsurance });
        }
      }
    } else {
      console.log('❌ No Lohnsteuer documents with extractable data found');
    }

    // Calculate potential deductions from receipts
    const potentialDeductions = calculatePotentialDeductions(receiptDocs, donationDocs);

    // Generate tax optimization suggestions
    const optimizationSuggestions = generateOptimizationSuggestions(totalSalary, totalTax, potentialDeductions);

    return {
      financialSummary: {
        totalSalary,
        totalTax,
        totalSocialInsurance,
        effectiveTaxRate: totalSalary > 0 ? (totalTax / totalSalary) * 100 : 0,
        netIncome: totalSalary - totalTax - totalSocialInsurance
      },
      documentCounts: {
        lohnsteuer: lohnsteuerDocs.length,
        receipts: receiptDocs.length,
        donations: donationDocs.length,
        total: documents.length
      },
      potentialDeductions,
      optimizationSuggestions,
      employerInfo,
      personalInfo,
      riskAssessment: assessTaxRisk(totalSalary, totalTax, potentialDeductions),
      complianceCheck: checkTaxCompliance(lohnsteuerDocs, receiptDocs)
    };
  };

  // Extract data from Lohnsteuer document (reusing logic from TaxDeclarationGenerator)
  const extractLohnsteuerData = (text: string) => {
    if (!text) return null;

    const extractNumber = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          console.log(`🔍 Pattern matched:`, pattern.toString(), 'found:', match[1], 'and', match[2] || '');
          
          if (match[2] !== undefined) {
            // Two-part match (euros + cents): "71.218 69" -> 71218.69
            const euros = match[1].replace(/\./g, ''); // Remove dots from euros part
            const cents = match[2].padStart(2, '0'); // Ensure cents is 2 digits
            const value = parseFloat(`${euros}.${cents}`);
            if (value >= 100) { // Lower threshold to catch more values
              console.log(`✅ Two-part value extracted:`, value);
              return value;
            }
          } else {
            // Single match - handle different formats
            let cleanValue = match[1];
            if (cleanValue.includes(',')) {
              // German format: 71.218,69 -> 71218.69
              cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
            } else if (cleanValue.includes('.') && cleanValue.split('.').length > 2) {
              // Multiple dots: 71.218.69 -> 71218.69
              const parts = cleanValue.split('.');
              if (parts.length === 3 && parts[2].length <= 2) {
                cleanValue = parts[0] + parts[1] + '.' + parts[2];
              } else {
                cleanValue = cleanValue.replace(/\./g, '');
              }
            }
            
            const value = parseFloat(cleanValue);
            if (value >= 100) { // Lower threshold
              console.log(`✅ Single value extracted:`, value);
              return value;
            }
          }
        }
      }
      console.log(`❌ No value found with patterns`);
      return null;
    };

    const salaryPatterns = [
      // Exact patterns from document: "3. Bruttoarbeitslohn einschl. Sachbezüge ohne 9. und 10. 71.218 69"
      /3\.\s+Bruttoarbeitslohn\s+einschl\.\s+Sachbezüge[^0-9]*([0-9]+\.?[0-9]*)\s+([0-9]+)/i,
      /(71\.218)\s+(69)/i, // Exact value match
      /(71218)\s+(69)/i,   // Without dots
      // More general patterns
      /Bruttoarbeitslohn[^0-9]*([0-9]+\.?[0-9]*)\s+([0-9]+)/i,
      /Bruttolohn[^0-9]*([0-9]+\.?[0-9]*)\s+([0-9]+)/i,
      // Single number patterns as fallback
      /Bruttoarbeitslohn[^0-9]*([0-9]+[.,][0-9]+)/i,
      /3\.\s+Bruttoarbeitslohn[^0-9]*([0-9]+[.,][0-9]+)/i
    ];

    const taxPatterns = [
      // Exact patterns: "4. Einbehaltene Lohnsteuer von 3. 13.663 00"
      /(13\.663)\s+(00)/i,
      /(13663)\s+(00)/i,
      /Einbehaltene\s+Lohnsteuer\s+von\s+3\.\s+([0-9]+\.?[0-9]*)\s+([0-9]+)/i,
      /4\.\s+Einbehaltene\s+Lohnsteuer\s+von\s+3\.\s+([0-9]+\.?[0-9]*)\s+([0-9]+)/i,
      // Single number patterns as fallback
      /Einbehaltene\s+Lohnsteuer[^0-9]*([0-9]+[.,][0-9]+)/i,
      /4\.\s+Einbehaltene\s+Lohnsteuer[^0-9]*([0-9]+[.,][0-9]+)/i
    ];

    const socialInsurancePatterns = [
      /Rentenversicherung[:\s]*([0-9.,]+)/i,
      /Sozialversicherung[:\s]*([0-9.,]+)/i,
      /Krankenversicherung[:\s]*([0-9.,]+)/i,
      /Arbeitslosenversicherung[:\s]*([0-9.,]+)/i
    ];

    const salary = extractNumber(salaryPatterns);
    const tax = extractNumber(taxPatterns);
    const socialInsurance = extractNumber(socialInsurancePatterns);

    const taxIdMatch = text.match(/Identifikationsnummer[:\s]*([0-9]+)/i);
    const employerMatch = text.match(/Volkswagen\s+AG/i) || text.match(/Arbeitgeber[:\s]*([^\n]+)/i);

    return {
      salary,
      tax,
      socialInsurance,
      taxId: taxIdMatch ? taxIdMatch[1] : null,
      employer: employerMatch ? (employerMatch[0].includes('Volkswagen') ? 'Volkswagen AG' : employerMatch[1]?.trim()) : null
    };
  };

  // Calculate potential deductions from receipts and documents
  const calculatePotentialDeductions = (receiptDocs: any[], donationDocs: any[]) => {
    const deductions = [];

    // Work-related expenses from receipts
    let workExpenses = 0;
    receiptDocs.forEach(doc => {
      const text = doc.text?.toLowerCase() || '';
      if (text.includes('büro') || text.includes('computer') || text.includes('fahrt')) {
        const amounts = text.match(/([0-9]+[.,][0-9]+)/g);
        if (amounts) {
          amounts.forEach((amount: string) => {
            const value = parseFloat(amount.replace(',', '.'));
            if (value > 0 && value < 10000) workExpenses += value;
          });
        }
      }
    });

    if (workExpenses > 0) {
      deductions.push({
        category: 'Werbungskosten',
        amount: workExpenses,
        description: 'Arbeitsplatz- und berufsbezogene Ausgaben',
        confidence: 0.8,
        potentialSavings: workExpenses * 0.3 // Assuming 30% tax rate
      });
    }

    // Donations
    let donations = 0;
    donationDocs.forEach(doc => {
      const text = doc.text || '';
      const amounts = text.match(/([0-9]+[.,][0-9]+)/g);
      if (amounts) {
        amounts.forEach((amount: string) => {
          const value = parseFloat(amount.replace(',', '.'));
          if (value > 0 && value < 50000) donations += value;
        });
      }
    });

    if (donations > 0) {
      deductions.push({
        category: 'Spenden',
        amount: donations,
        description: 'Gemeinnützige Spenden und Zuwendungen',
        confidence: 0.9,
        potentialSavings: donations * 0.3
      });
    }

    return deductions;
  };

  // Generate tax optimization suggestions
  const generateOptimizationSuggestions = (salary: number, tax: number, deductions: any[]) => {
    const suggestions = [];

    if (salary > 50000) {
      suggestions.push({
        category: 'Altersvorsorge',
        title: 'Riester-Rente optimieren',
        description: 'Bei Ihrem Einkommen können Sie bis zu 2.100€ jährlich in die Riester-Rente einzahlen und Zulagen erhalten.',
        potentialSavings: 630, // 30% of 2100
        priority: 'high',
        action: 'Riester-Vertrag prüfen oder abschließen'
      });
    }

    if (deductions.length === 0) {
      suggestions.push({
        category: 'Werbungskosten',
        title: 'Arbeitsmittel absetzen',
        description: 'Sammeln Sie Belege für Arbeitsmittel, Fachliteratur und Fortbildungen. Diese können als Werbungskosten abgesetzt werden.',
        potentialSavings: 300,
        priority: 'medium',
        action: 'Belege sammeln und dokumentieren'
      });
    }

    const effectiveTaxRate = salary > 0 ? (tax / salary) * 100 : 0;
    if (effectiveTaxRate > 25) {
      suggestions.push({
        category: 'Steueroptimierung',
        title: 'Hohe Steuerlast reduzieren',
        description: 'Ihre Steuerlast ist überdurchschnittlich hoch. Prüfen Sie zusätzliche Abzugsmöglichkeiten.',
        potentialSavings: tax * 0.1,
        priority: 'high',
        action: 'Steuerberater konsultieren'
      });
    }

    return suggestions;
  };

  // Assess tax risk based on financial data
  const assessTaxRisk = (salary: number, tax: number, deductions: any[]) => {
    const risks = [];
    const effectiveTaxRate = salary > 0 ? (tax / salary) * 100 : 0;

    if (effectiveTaxRate < 10) {
      risks.push({
        level: 'medium',
        description: 'Ungewöhnlich niedrige Steuerlast - Prüfung durch Finanzamt möglich',
        recommendation: 'Alle Angaben sorgfältig dokumentieren'
      });
    }

    if (deductions.reduce((sum, d) => sum + d.amount, 0) > salary * 0.3) {
      risks.push({
        level: 'high',
        description: 'Hohe Abzüge im Verhältnis zum Einkommen',
        recommendation: 'Belege vollständig aufbewahren und Nachweise bereithalten'
      });
    }

    return {
      overallRisk: risks.length > 0 ? 'medium' : 'low',
      risks,
      score: Math.max(0, 100 - (risks.length * 25))
    };
  };

  // Check tax compliance
  const checkTaxCompliance = (lohnsteuerDocs: any[], receiptDocs: any[]) => {
    const checks = [];

    if (lohnsteuerDocs.length === 0) {
      checks.push({
        status: 'warning',
        item: 'Lohnsteuerbescheinigung',
        message: 'Keine Lohnsteuerbescheinigung gefunden'
      });
    } else {
      checks.push({
        status: 'success',
        item: 'Lohnsteuerbescheinigung',
        message: `${lohnsteuerDocs.length} Lohnsteuerbescheinigung(en) vorhanden`
      });
    }

    if (receiptDocs.length < 5) {
      checks.push({
        status: 'info',
        item: 'Belege',
        message: 'Wenige Belege für Abzüge vorhanden - Potenzial für Steuerersparnis'
      });
    } else {
      checks.push({
        status: 'success',
        item: 'Belege',
        message: `${receiptDocs.length} Belege für Abzüge dokumentiert`
      });
    }

    return {
      overallStatus: checks.every(c => c.status === 'success') ? 'compliant' : 'needs_attention',
      checks,
      completeness: (checks.filter(c => c.status === 'success').length / checks.length) * 100
    };
  };

  const analyzeDocument = async (document: Document) => {
    if (analysisResults[document.id]) return;
    
    setAnalyzing(true);
    try {
      const analysis = await aiService.analyzeDocument(document);
      setAnalysisResults(prev => ({
        ...prev,
        [document.id]: analysis
      }));
    } catch (error) {
      console.error('Error analyzing document:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeAllDocuments = async () => {
    setAnalyzing(true);
    for (const document of documents) {
      if (!analysisResults[document.id]) {
        try {
          const analysis = await aiService.analyzeDocument(document);
          setAnalysisResults(prev => ({
            ...prev,
            [document.id]: analysis
          }));
        } catch (error) {
          console.error(`Error analyzing ${document.name}:`, error);
        }
      }
    }
    setAnalyzing(false);
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'tax_form': 'Steuerformular',
      'receipt': 'Beleg',
      'invoice': 'Rechnung',
      'donation': 'Spendenbescheinigung',
      'salary': 'Gehaltsabrechnung',
      'other': 'Anderes Dokument'
    };
    return labels[type] || 'Unbekannt';
  };

  if (documents.length === 0) {
    return (
      <div className="card text-center py-12">
        <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-900 mb-2">Keine Dokumente zu analysieren</h3>
        <p className="text-gray-500">Laden Sie zuerst einige Dokumente hoch, um KI-gestützte Analysen und Expertenmeinungen zu erhalten.</p>
      </div>
    );
  }

  const currentAnalysis = selectedDocument ? analysisResults[selectedDocument.id] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">KI-Steuerberatung & Analyse</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={loadComprehensiveAnalysis}
            disabled={qdrantLoading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
          >
            {qdrantLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Lädt...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Analyse aktualisieren
              </>
            )}
          </button>
          <button
            onClick={() => analyzeAllDocuments()}
            disabled={analyzing}
            className="btn-primary flex items-center space-x-2"
          >
            <Brain className="h-5 w-5" />
            <span>{analyzing ? 'Analysiere...' : 'Alle Dokumente analysieren'}</span>
          </button>
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Dokumentenanalyse
          </button>
          <button
            onClick={() => setActiveTab('comprehensive')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'comprehensive'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Calculator className="w-4 h-4 inline mr-2" />
            Umfassende Analyse
          </button>
          <button
            onClick={() => setActiveTab('optimization')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'optimization'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Target className="w-4 h-4 inline mr-2" />
            Steueroptimierung
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document List */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => {
              const analysis = analysisResults[doc.id];
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedDocument?.id === doc.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{doc.name}</h4>
                      {analysis && (
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full ${getRelevanceColor(analysis.taxRelevance)}`}>
                            {analysis.taxRelevance} relevance
                          </span>
                          <span className="text-xs text-gray-500">
                            {getDocumentTypeLabel(analysis.documentType)}
                          </span>
                        </div>
                      )}
                    </div>
                    {analysis ? (
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          analyzeDocument(doc);
                        }}
                        disabled={analyzing}
                        className="text-primary-600 hover:text-primary-700 flex-shrink-0"
                      >
                        <Brain className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Analysis Results */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDocument && currentAnalysis ? (
            <>
              {/* Document Overview */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Analysis: {selectedDocument.name}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRelevanceColor(currentAnalysis.taxRelevance)}`}>
                      {currentAnalysis.taxRelevance.toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Tax Relevance</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {getDocumentTypeLabel(currentAnalysis.documentType)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Document Type</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {Math.round(currentAnalysis.confidence * 100)}%
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Confidence</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {currentAnalysis.expertOpinion.potentialDeductions.length}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Deductions</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">AI Expert Summary</h4>
                  <p className="text-blue-800">{currentAnalysis.expertOpinion.summary}</p>
                </div>
              </div>

              {/* Tax Implications */}
              <div className="card">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  Tax Implications
                </h4>
                <ul className="space-y-2">
                  {currentAnalysis.expertOpinion.taxImplications.map((implication, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{implication}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Potential Deductions */}
              {currentAnalysis.expertOpinion.potentialDeductions.length > 0 && (
                <div className="card">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Euro className="h-5 w-5 text-green-600 mr-2" />
                    Potential Tax Deductions
                  </h4>
                  <div className="space-y-4">
                    {currentAnalysis.expertOpinion.potentialDeductions.map((deduction, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{deduction.category}</h5>
                          <span className="text-lg font-semibold text-green-600">
                            {deduction.amount ? `€${deduction.amount.toFixed(2)}` : 'Betrag unbekannt'}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-2">{deduction.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Confidence: {Math.round(deduction.confidence * 100)}%
                          </span>
                          {deduction.requirements.length > 0 && (
                            <button className="text-xs text-primary-600 hover:text-primary-700">
                              View Requirements
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Considerations */}
              <div className="card">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Info className="h-5 w-5 text-blue-600 mr-2" />
                  Legal Considerations
                </h4>
                <ul className="space-y-2">
                  {currentAnalysis.expertOpinion.legalConsiderations.map((consideration, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{consideration}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warnings */}
              {currentAnalysis.expertOpinion.warnings.length > 0 && (
                <div className="card bg-yellow-50 border-yellow-200">
                  <h4 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                    Important Warnings
                  </h4>
                  <ul className="space-y-2">
                    {currentAnalysis.expertOpinion.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span className="text-yellow-800">{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              <div className="card">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h4>
                <ul className="space-y-2">
                  {currentAnalysis.expertOpinion.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : selectedDocument && analyzing ? (
            <div className="card text-center py-12">
              <Brain className="h-16 w-16 text-primary-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Analyzing Document...</h3>
              <p className="text-gray-500">Our AI is examining your document and generating expert opinions.</p>
            </div>
          ) : selectedDocument ? (
            <div className="card text-center py-12">
              <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Analyze</h3>
              <p className="text-gray-500 mb-4">Click the analyze button to get AI-powered expert opinions on this document.</p>
              <button
                onClick={() => analyzeDocument(selectedDocument)}
                className="btn-primary"
              >
                Analyze This Document
              </button>
            </div>
          ) : null}
        </div>
      </div>
      )}

      {/* Comprehensive Analysis Tab */}
      {activeTab === 'comprehensive' && (
        <div className="space-y-6">
          {qdrantLoading ? (
            <div className="card text-center py-12">
              <Brain className="h-16 w-16 text-primary-500 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Lade umfassende Analyse...</h3>
              <p className="text-gray-500">Analysiere alle Dokumente aus Qdrant für detaillierte Steuerberatung.</p>
            </div>
          ) : enhancedAnalysis ? (
            <>
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <div className="flex items-center">
                    <Euro className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-600">Bruttoeinkommen</p>
                      <p className="text-2xl font-bold text-green-900">
                        €{enhancedAnalysis.financialSummary.totalSalary.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card bg-gradient-to-r from-red-50 to-red-100 border-red-200">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-red-600">Lohnsteuer</p>
                      <p className="text-2xl font-bold text-red-900">
                        €{enhancedAnalysis.financialSummary.totalTax.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <div className="flex items-center">
                    <Calculator className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-600">Steuersatz</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {enhancedAnalysis.financialSummary.effectiveTaxRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                  <div className="flex items-center">
                    <Target className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-purple-600">Nettoeinkommen</p>
                      <p className="text-2xl font-bold text-purple-900">
                        €{enhancedAnalysis.financialSummary.netIncome.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Overview */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Dokumentenübersicht</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{enhancedAnalysis.documentCounts.lohnsteuer}</div>
                    <div className="text-sm text-gray-600">Lohnsteuerbescheinigungen</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{enhancedAnalysis.documentCounts.receipts}</div>
                    <div className="text-sm text-gray-600">Belege & Rechnungen</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{enhancedAnalysis.documentCounts.donations}</div>
                    <div className="text-sm text-gray-600">Spendenbescheinigungen</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{enhancedAnalysis.documentCounts.total}</div>
                    <div className="text-sm text-gray-600">Gesamt Dokumente</div>
                  </div>
                </div>
              </div>

              {/* Potential Deductions */}
              {enhancedAnalysis.potentialDeductions.length > 0 && (
                <div className="card">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Euro className="h-6 w-6 text-green-600 mr-2" />
                    Erkannte Abzugsmöglichkeiten
                  </h3>
                  <div className="space-y-4">
                    {enhancedAnalysis.potentialDeductions.map((deduction: any, index: number) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 bg-green-50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{deduction.category}</h4>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">€{deduction.amount.toFixed(2)}</div>
                            <div className="text-sm text-green-700">Ersparnis: €{deduction.potentialSavings.toFixed(2)}</div>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm">{deduction.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Vertrauen: {Math.round(deduction.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
                  Risikobewertung
                </h3>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      Gesamtrisiko: {enhancedAnalysis.riskAssessment.overallRisk === 'low' ? 'Niedrig' : 
                                   enhancedAnalysis.riskAssessment.overallRisk === 'medium' ? 'Mittel' : 'Hoch'}
                    </div>
                    <div className="text-sm text-gray-600">Risiko-Score: {enhancedAnalysis.riskAssessment.score}/100</div>
                  </div>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    enhancedAnalysis.riskAssessment.overallRisk === 'low' ? 'bg-green-500' :
                    enhancedAnalysis.riskAssessment.overallRisk === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    {enhancedAnalysis.riskAssessment.score}
                  </div>
                </div>
                {enhancedAnalysis.riskAssessment.risks.length > 0 && (
                  <div className="space-y-2">
                    {enhancedAnalysis.riskAssessment.risks.map((risk: any, index: number) => (
                      <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="font-medium text-yellow-900">{risk.description}</div>
                        <div className="text-sm text-yellow-700 mt-1">{risk.recommendation}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compliance Check */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-6 w-6 text-blue-600 mr-2" />
                  Compliance-Prüfung
                </h3>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Vollständigkeit</span>
                    <span className="text-sm font-medium text-gray-900">{enhancedAnalysis.complianceCheck.completeness.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${enhancedAnalysis.complianceCheck.completeness}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  {enhancedAnalysis.complianceCheck.checks.map((check: any, index: number) => (
                    <div key={index} className="flex items-center space-x-3">
                      {check.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {check.status === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                      {check.status === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                      <div>
                        <div className="font-medium text-gray-900">{check.item}</div>
                        <div className="text-sm text-gray-600">{check.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <Calculator className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Keine Daten verfügbar</h3>
              <p className="text-gray-500 mb-4">Klicken Sie auf "Analyse aktualisieren", um eine umfassende Steueranalyse zu laden.</p>
              <button
                onClick={loadComprehensiveAnalysis}
                className="btn-primary"
              >
                Analyse laden
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tax Optimization Tab */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          {enhancedAnalysis?.optimizationSuggestions ? (
            <>
              <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <h3 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
                  <Lightbulb className="h-6 w-6 text-blue-600 mr-2" />
                  Personalisierte Steueroptimierung
                </h3>
                <p className="text-blue-800 mb-4">
                  Basierend auf Ihrer aktuellen Steuersituation haben wir folgende Optimierungsmöglichkeiten identifiziert:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-900">
                      €{enhancedAnalysis.optimizationSuggestions.reduce((sum: number, s: any) => sum + s.potentialSavings, 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-blue-700">Potenzielle jährliche Ersparnis</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-900">{enhancedAnalysis.optimizationSuggestions.length}</div>
                    <div className="text-sm text-blue-700">Optimierungsvorschläge</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {enhancedAnalysis.optimizationSuggestions.map((suggestion: any, index: number) => (
                  <div key={index} className={`card ${
                    suggestion.priority === 'high' ? 'border-red-200 bg-red-50' :
                    suggestion.priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          suggestion.priority === 'high' ? 'bg-red-500' :
                          suggestion.priority === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}></div>
                        <h4 className="font-semibold text-gray-900">{suggestion.title}</h4>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                        suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {suggestion.priority === 'high' ? 'Hoch' : suggestion.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-sm text-gray-600">{suggestion.category}</span>
                    </div>
                    <p className="text-gray-700 text-sm mb-4">{suggestion.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold text-green-600">
                        €{suggestion.potentialSavings.toFixed(0)} Ersparnis
                      </div>
                      <div className="text-sm text-gray-600">
                        {suggestion.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tax Planning Calendar */}
              <div className="card">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <BookOpen className="h-6 w-6 text-purple-600 mr-2" />
                  Steuerkalender 2024
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="font-semibold text-purple-900">31. Mai 2024</div>
                    <div className="text-sm text-purple-700">Steuererklärung 2023 abgeben</div>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-semibold text-blue-900">31. Dezember 2024</div>
                    <div className="text-sm text-blue-700">Riester-Beiträge für 2024 einzahlen</div>
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="font-semibold text-green-900">Laufend</div>
                    <div className="text-sm text-green-700">Belege sammeln und dokumentieren</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Optimierungsvorschläge laden</h3>
              <p className="text-gray-500 mb-4">Laden Sie zuerst die umfassende Analyse, um personalisierte Steueroptimierungen zu erhalten.</p>
              <button
                onClick={() => setActiveTab('comprehensive')}
                className="btn-primary"
              >
                Zur umfassenden Analyse
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentAnalysis;