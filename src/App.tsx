import { useState, useEffect } from 'react';
import { Upload, Calculator, Search, Brain, FileCheck, Users, Database, Receipt, BookOpen, Cpu } from 'lucide-react';
import DocumentUpload from './components/DocumentUpload';
import DocumentAnalysis from './components/DocumentAnalysis';
import TaxDeclarationGenerator from './components/TaxDeclarationGenerator';
import TaxResearch from './components/TaxResearch';
import SpecializedAgents from './components/SpecializedAgents';
import QdrantManager from './components/QdrantManager';
import InvoiceAnalyzer from './components/InvoiceAnalyzer';
import TaxOrchestrator from './components/TaxOrchestrator';
import TaxKnowledgeBase from './components/TaxKnowledgeBase';
import { Document } from './types';
import { documentService } from './services/documentService';

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeTab, setActiveTab] = useState('upload');

  // Fetch existing documents on app load
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const existingDocuments = await documentService.getDocuments();
        setDocuments(existingDocuments);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      }
    };
    
    fetchDocuments();
  }, []);

  const handleDocumentUpload = (newDocuments: Document[]) => {
    setDocuments(prev => [...prev, ...newDocuments]);
  };

  const tabs = [
    { id: 'upload', label: 'Dokumente hochladen', icon: Upload },
    { id: 'analysis', label: 'KI-Analyse', icon: Brain },
    { id: 'orchestrator', label: 'Tax AI Orchestrator', icon: Cpu },
    { id: 'knowledge', label: 'Tax Knowledge Base', icon: BookOpen },
    { id: 'research', label: 'Steuerforschung 2024', icon: Search },
    { id: 'agents', label: 'Spezialisierte Agenten', icon: Users },
    { id: 'invoices', label: 'Rechnungsanalyse', icon: Receipt },
    { id: 'declaration', label: 'Steuererklärung', icon: Calculator },
    { id: 'storage', label: 'Qdrant Verwaltung', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <FileCheck className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">Steuer & Recht KI-Experte</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {documents.length} Dokumente hochgeladen
              </span>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'upload' && (
          <DocumentUpload 
            documents={documents} 
            onDocumentUpload={handleDocumentUpload} 
          />
        )}
        
        {activeTab === 'analysis' && (
          <DocumentAnalysis documents={documents} />
        )}
        
        {activeTab === 'orchestrator' && (
          <TaxOrchestrator />
        )}
        
        {activeTab === 'knowledge' && (
          <TaxKnowledgeBase />
        )}
        
        {activeTab === 'research' && (
          <TaxResearch />
        )}
        
        {activeTab === 'agents' && (
          <SpecializedAgents />
        )}
        
        {activeTab === 'invoices' && (
          <InvoiceAnalyzer />
        )}
        
        {activeTab === 'declaration' && (
          <TaxDeclarationGenerator documents={documents} />
        )}
        
        {activeTab === 'storage' && (
          <QdrantManager />
        )}
      </main>
    </div>
  );
}

export default App;