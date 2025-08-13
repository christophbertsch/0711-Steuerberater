import React, { useState, useEffect } from 'react';
import { Brain, FileText, TrendingUp, AlertTriangle, CheckCircle, Euro, Info } from 'lucide-react';
import { Document, DocumentAnalysis as DocumentAnalysisType } from '../types';
import { aiService } from '../services/aiService';

interface DocumentAnalysisProps {
  documents: Document[];
}

const DocumentAnalysis: React.FC<DocumentAnalysisProps> = ({ documents }) => {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Record<string, DocumentAnalysisType>>({});

  useEffect(() => {
    if (documents.length > 0 && !selectedDocument) {
      setSelectedDocument(documents[0]);
    }
  }, [documents, selectedDocument]);

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
        <h2 className="text-2xl font-bold text-gray-900">KI-Dokumentenanalyse</h2>
        <button
          onClick={analyzeAllDocuments}
          disabled={analyzing}
          className="btn-primary flex items-center space-x-2"
        >
          <Brain className="h-5 w-5" />
          <span>{analyzing ? 'Analysiere...' : 'Alle Dokumente analysieren'}</span>
        </button>
      </div>

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
    </div>
  );
};

export default DocumentAnalysis;