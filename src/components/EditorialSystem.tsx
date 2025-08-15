/**
 * Editorial System Component
 * UI for managing Tax Editorial Agents pipeline - ingestion, processing, and publication
 */

import React, { useState } from 'react';
import { Search, BookOpen, Zap, CheckCircle, AlertCircle, Clock, Download, Database, FileText, Users } from 'lucide-react';
import { EditorialManager, EditorialIngestRequest, EditorialIngestResult } from '../editorial/EditorialManager';
import { RuleSpec, EditorialNote, UserStep } from '../editorial/types';
import { BulkEditorialIngestion } from './BulkEditorialIngestion';
import EditorialSearch from './EditorialSearch';

interface EditorialSystemProps {
  onRuleSpecsGenerated?: (rulespecs: RuleSpec[]) => void;
  onEditorialContentGenerated?: (notes: EditorialNote[], steps: UserStep[]) => void;
}

export const EditorialSystem: React.FC<EditorialSystemProps> = ({
  onRuleSpecsGenerated,
  onEditorialContentGenerated
}) => {
  const [editorialManager] = useState(() => new EditorialManager());
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'search'>('single');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [customQueries, setCustomQueries] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [ingestResult, setIngestResult] = useState<EditorialIngestResult | null>(null);
  const [availableTopics] = useState(() => EditorialManager.getAvailableTopics());

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    const defaultQueries = EditorialManager.getDefaultQueries(topic);
    setCustomQueries(defaultQueries.join('\n'));
  };

  const runEditorialIngest = async () => {
    if (!selectedTopic) {
      alert('Bitte wählen Sie ein Thema aus');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('Initialisierung...');
    setIngestResult(null);

    try {
      const queries = customQueries.split('\n').filter(q => q.trim().length > 0);
      
      const request: EditorialIngestRequest = {
        topic: selectedTopic,
        queries,
        jurisdiction: 'DE',
        quality_gates: ['authority_gate', 'coverage_gate', 'consistency_gate']
      };

      setCurrentStep('🔍 Tavily-Suche läuft...');
      
      // Simulate step-by-step progress
      const steps = [
        '🔍 Tavily-Suche nach autoritativen Quellen...',
        '📄 Normalisierung der Rechtsdokumente...',
        '⚙️ Extraktion von Regelspezifikationen...',
        '✍️ Generierung von Editorial-Inhalten...',
        '🛡️ Qualitätsprüfung läuft...',
        '📦 Paketierung der Ergebnisse...'
      ];

      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const result = await editorialManager.runEditorialIngest(request);
      setIngestResult(result);

      if (result.success) {
        setCurrentStep('✅ Editorial-Ingestion erfolgreich abgeschlossen');
        
        // Notify parent components
        if (onRuleSpecsGenerated) {
          onRuleSpecsGenerated(result.artifacts.rulespecs);
        }
        if (onEditorialContentGenerated) {
          onEditorialContentGenerated(result.artifacts.editorial_notes, result.artifacts.user_steps);
        }
      } else {
        setCurrentStep('❌ Editorial-Ingestion mit Fehlern abgeschlossen');
      }

    } catch (error) {
      console.error('Editorial ingestion failed:', error);
      setCurrentStep(`❌ Fehler: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tax Editorial System</h2>
          <p className="text-gray-600">Automatische Ingestion und Verarbeitung von Steuerrecht</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('single')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'single'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Einzelthema Ingestion
        </button>
        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'bulk'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database className="w-4 h-4 inline mr-2" />
          Bulk Ingestion
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'search'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Content Search
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'single' && (
        <div>

      {/* Topic Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Steuerrechtliches Thema
        </label>
        <select
          value={selectedTopic}
          onChange={(e) => handleTopicChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isProcessing}
        >
          <option value="">Thema auswählen...</option>
          {availableTopics.map(topic => (
            <option key={topic} value={topic}>{topic}</option>
          ))}
        </select>
      </div>

      {/* Custom Queries */}
      {selectedTopic && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Suchanfragen (eine pro Zeile)
          </label>
          <textarea
            value={customQueries}
            onChange={(e) => setCustomQueries(e.target.value)}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Geben Sie spezifische Suchanfragen ein..."
            disabled={isProcessing}
          />
        </div>
      )}

      {/* Action Button */}
      <div className="mb-6">
        <button
          onClick={runEditorialIngest}
          disabled={!selectedTopic || isProcessing}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              Verarbeitung läuft...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Editorial-Ingestion starten
            </>
          )}
        </button>
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Clock className="w-5 h-5 text-blue-600 animate-spin" />
            ) : currentStep.includes('✅') ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : currentStep.includes('❌') ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Search className="w-5 h-5 text-blue-600" />
            )}
            <span className="text-sm font-medium text-gray-900">{currentStep}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {ingestResult && (
        <div className="space-y-6">
          {/* Quality Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Qualitätszusammenfassung</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(ingestResult.quality_summary.coverage_score * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Abdeckung</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(ingestResult.quality_summary.consistency_score * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Konsistenz</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {(ingestResult.quality_summary.authority_score * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Autorität</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {ingestResult.quality_summary.total_violations}
                </div>
                <div className="text-sm text-gray-600">Verstöße</div>
              </div>
            </div>
          </div>

          {/* Artifacts Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-900">Regelspezifikationen</h4>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {ingestResult.artifacts.rulespecs.length}
              </div>
              <div className="text-sm text-gray-600">Extrahierte Regeln</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-900">Editorial-Notizen</h4>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {ingestResult.artifacts.editorial_notes.length}
              </div>
              <div className="text-sm text-gray-600">Erklärungen</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-gray-900">Benutzer-Schritte</h4>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {ingestResult.artifacts.user_steps.length}
              </div>
              <div className="text-sm text-gray-600">Anleitungen</div>
            </div>
          </div>

          {/* Execution Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Ausführungsdetails</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Paket-ID:</span>
                <div className="text-gray-600 font-mono text-xs">{ingestResult.package_id}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Ausführungszeit:</span>
                <div className="text-gray-600">{(ingestResult.execution_time / 1000).toFixed(1)}s</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Agenten:</span>
                <div className="text-gray-600">{ingestResult.agents_executed.length}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <div className={`font-medium ${ingestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {ingestResult.success ? 'Erfolgreich' : 'Mit Fehlern'}
                </div>
              </div>
            </div>
          </div>

          {/* Warnings and Errors */}
          {(ingestResult.warnings.length > 0 || ingestResult.errors.length > 0) && (
            <div className="space-y-3">
              {ingestResult.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Warnungen</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {ingestResult.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {ingestResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Fehler</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {ingestResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Download Button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                const dataStr = JSON.stringify(ingestResult, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `editorial_${selectedTopic}_${Date.now()}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Ergebnisse herunterladen
            </button>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Bulk Ingestion Tab */}
      {activeTab === 'bulk' && (
        <BulkEditorialIngestion />
      )}

      {/* Content Search Tab */}
      {activeTab === 'search' && (
        <EditorialSearch />
      )}
    </div>
  );
};