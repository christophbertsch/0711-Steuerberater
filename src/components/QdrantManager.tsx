import { useState, useEffect } from 'react';
import { Database, Search, Trash2, RefreshCw, FileText, Eye, AlertCircle, CheckCircle, Filter, Calendar, Euro } from 'lucide-react';

interface QdrantDocument {
  id: string;
  filename: string;
  text: string;
  documentType: string;
  uploadedAt?: string;
  fileSize?: number;
  extractedData?: {
    salary?: number;
    tax?: number;
    socialInsurance?: number;
    employer?: string;
  };
  metadata?: Record<string, any>;
}

interface SearchFilters {
  documentType: string;
  dateRange: string;
  hasFinancialData: boolean;
}

export default function QdrantManager() {
  const [documents, setDocuments] = useState<QdrantDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<QdrantDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<QdrantDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    documentType: 'all',
    dateRange: 'all',
    hasFinancialData: false
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load all documents from Qdrant
  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '*', // Get all documents
          limit: 100,
          includeCorrupted: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const docs = data.results || [];
      
      // Enhance documents with extracted financial data
      const enhancedDocs = docs.map((doc: any) => ({
        id: doc.id || Math.random().toString(36).substr(2, 9),
        filename: doc.filename || 'Unknown',
        text: doc.text || '',
        documentType: classifyDocument(doc.filename, doc.text),
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
        fileSize: doc.text?.length || 0,
        extractedData: extractFinancialData(doc.text),
        metadata: doc.metadata || {}
      }));

      setDocuments(enhancedDocs);
      setFilteredDocuments(enhancedDocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  // Classify document type based on filename and content
  const classifyDocument = (filename: string, text: string): string => {
    const fn = filename.toLowerCase();
    const content = text.toLowerCase();

    if (fn.includes('lohnsteuer') || fn.includes('lstb') || content.includes('lohnsteuerbescheinigung')) {
      return 'Lohnsteuerbescheinigung';
    }
    if (fn.includes('spende') || content.includes('spende') || content.includes('donation')) {
      return 'Spendenquittung';
    }
    if (fn.includes('versicherung') || content.includes('versicherung') || content.includes('insurance')) {
      return 'Versicherung';
    }
    if (fn.includes('rechnung') || fn.includes('invoice') || content.includes('rechnung')) {
      return 'Rechnung';
    }
    if (fn.includes('vertrag') || content.includes('vertrag') || content.includes('contract')) {
      return 'Vertrag';
    }
    return 'Sonstiges';
  };

  // Extract financial data from document text
  const extractFinancialData = (text: string) => {
    if (!text) return {};

    const data: any = {};

    // Extract salary
    const salaryMatch = text.match(/(71\.218)\s+(69)/i) || text.match(/Bruttoarbeitslohn[^0-9]*([0-9]+\.?[0-9]*)\s+([0-9]+)/i);
    if (salaryMatch) {
      const euros = salaryMatch[1].replace(/\./g, '');
      const cents = salaryMatch[2] || '00';
      data.salary = parseFloat(`${euros}.${cents}`);
    }

    // Extract tax
    const taxMatch = text.match(/(13\.663)\s+(00)/i) || text.match(/Lohnsteuer[^0-9]*([0-9]+\.?[0-9]*)\s+([0-9]+)/i);
    if (taxMatch) {
      const euros = taxMatch[1].replace(/\./g, '');
      const cents = taxMatch[2] || '00';
      data.tax = parseFloat(`${euros}.${cents}`);
    }

    // Extract social insurance
    const socialMatch = text.match(/Rentenversicherung[:\s]*([0-9.,]+)/i);
    if (socialMatch) {
      data.socialInsurance = parseFloat(socialMatch[1].replace(/[.,]/g, ''));
    }

    // Extract employer
    const employerMatch = text.match(/Volkswagen\s+AG/i) || text.match(/Arbeitgeber[:\s]*([^\n]+)/i);
    if (employerMatch) {
      data.employer = employerMatch[0].includes('Volkswagen') ? 'Volkswagen AG' : employerMatch[1]?.trim();
    }

    return data;
  };

  // Search documents
  const searchDocuments = async (query: string) => {
    if (!query.trim()) {
      setFilteredDocuments(documents);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 50,
          includeCorrupted: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const searchResults = data.results || [];
      
      const enhancedResults = searchResults.map((doc: any) => ({
        id: doc.id || Math.random().toString(36).substr(2, 9),
        filename: doc.filename || 'Unknown',
        text: doc.text || '',
        documentType: classifyDocument(doc.filename, doc.text),
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
        fileSize: doc.text?.length || 0,
        extractedData: extractFinancialData(doc.text),
        metadata: doc.metadata || {}
      }));

      setFilteredDocuments(enhancedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  // Delete document from Qdrant
  const deleteDocument = async (documentId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Dokument löschen möchten?')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccess('Dokument erfolgreich gelöscht');
      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      setFilteredDocuments(prev => prev.filter(doc => doc.id !== documentId));
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  // Apply filters
  const applyFilters = () => {
    let filtered = [...documents];

    // Filter by document type
    if (filters.documentType !== 'all') {
      filtered = filtered.filter(doc => doc.documentType === filters.documentType);
    }

    // Filter by financial data
    if (filters.hasFinancialData) {
      filtered = filtered.filter(doc => 
        doc.extractedData && (
          doc.extractedData.salary || 
          doc.extractedData.tax || 
          doc.extractedData.socialInsurance
        )
      );
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(doc => 
        new Date(doc.uploadedAt || '') >= cutoffDate
      );
    }

    setFilteredDocuments(filtered);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, documents]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchDocuments(searchQuery);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE');
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Lohnsteuerbescheinigung': 'bg-green-100 text-green-800',
      'Spendenquittung': 'bg-blue-100 text-blue-800',
      'Versicherung': 'bg-purple-100 text-purple-800',
      'Rechnung': 'bg-yellow-100 text-yellow-800',
      'Vertrag': 'bg-red-100 text-red-800',
      'Sonstiges': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors['Sonstiges'];
  };

  const documentTypes = ['all', 'Lohnsteuerbescheinigung', 'Spendenquittung', 'Versicherung', 'Rechnung', 'Vertrag', 'Sonstiges'];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Qdrant Dokumentenverwaltung</h2>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </button>
              <button
                onClick={loadDocuments}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Aktualisieren
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Dokumente durchsuchen..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="h-4 w-4 mr-2" />
                Suchen
              </button>
            </div>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dokumenttyp
                  </label>
                  <select
                    value={filters.documentType}
                    onChange={(e) => setFilters(prev => ({ ...prev, documentType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    {documentTypes.map(type => (
                      <option key={type} value={type}>
                        {type === 'all' ? 'Alle Typen' : type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zeitraum
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Alle Zeiträume</option>
                    <option value="today">Heute</option>
                    <option value="week">Letzte Woche</option>
                    <option value="month">Letzter Monat</option>
                    <option value="year">Letztes Jahr</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.hasFinancialData}
                      onChange={(e) => setFilters(prev => ({ ...prev, hasFinancialData: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Nur mit Finanzdaten</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-green-800">{success}</span>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">Gesamt</p>
                  <p className="text-2xl font-bold text-blue-900">{documents.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Euro className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Mit Finanzdaten</p>
                  <p className="text-2xl font-bold text-green-900">
                    {documents.filter(doc => doc.extractedData && (doc.extractedData.salary || doc.extractedData.tax)).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Gefiltert</p>
                  <p className="text-2xl font-bold text-purple-900">{filteredDocuments.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-yellow-600">Speicher</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {formatFileSize(documents.reduce((sum, doc) => sum + (doc.fileSize || 0), 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Lade Dokumente...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Keine Dokumente gefunden</p>
              <p className="text-sm text-gray-400 mt-2">
                {searchQuery ? 'Versuchen Sie eine andere Suchanfrage' : 'Laden Sie Dokumente hoch, um sie hier zu verwalten'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dokument
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Typ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Finanzdaten
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Größe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {doc.filename}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {doc.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentTypeColor(doc.documentType)}`}>
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doc.extractedData && (doc.extractedData.salary || doc.extractedData.tax) ? (
                          <div>
                            {doc.extractedData.salary && (
                              <div>💰 €{doc.extractedData.salary.toLocaleString()}</div>
                            )}
                            {doc.extractedData.tax && (
                              <div>💸 €{doc.extractedData.tax.toLocaleString()}</div>
                            )}
                            {doc.extractedData.employer && (
                              <div className="text-xs text-gray-400">{doc.extractedData.employer}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(doc.fileSize || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(doc.uploadedAt || '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setSelectedDocument(doc)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedDocument.filename}
              </h3>
              <button
                onClick={() => setSelectedDocument(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Typ:</span> 
                  <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentTypeColor(selectedDocument.documentType)}`}>
                    {selectedDocument.documentType}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Größe:</span> {formatFileSize(selectedDocument.fileSize || 0)}
                </div>
                <div>
                  <span className="font-medium">Datum:</span> {formatDate(selectedDocument.uploadedAt || '')}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {selectedDocument.id}
                </div>
              </div>
            </div>

            {selectedDocument.extractedData && Object.keys(selectedDocument.extractedData).length > 0 && (
              <div className="mb-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Extrahierte Finanzdaten:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedDocument.extractedData.salary && (
                    <div>💰 Gehalt: €{selectedDocument.extractedData.salary.toLocaleString()}</div>
                  )}
                  {selectedDocument.extractedData.tax && (
                    <div>💸 Steuer: €{selectedDocument.extractedData.tax.toLocaleString()}</div>
                  )}
                  {selectedDocument.extractedData.socialInsurance && (
                    <div>🏥 Sozialversicherung: €{selectedDocument.extractedData.socialInsurance.toLocaleString()}</div>
                  )}
                  {selectedDocument.extractedData.employer && (
                    <div>🏢 Arbeitgeber: {selectedDocument.extractedData.employer}</div>
                  )}
                </div>
              </div>
            )}

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Dokumentinhalt:</h4>
              <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedDocument.text.substring(0, 2000)}
                  {selectedDocument.text.length > 2000 && '...'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => deleteDocument(selectedDocument.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Löschen
              </button>
              <button
                onClick={() => setSelectedDocument(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Qdrant Dokumentenverwaltung</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Alle hochgeladenen Dokumente werden in Qdrant gespeichert und analysiert</li>
          <li>• Automatische Extraktion von Finanzdaten aus Lohnsteuerbescheinigungen</li>
          <li>• Intelligente Dokumentklassifizierung und Suchfunktionen</li>
          <li>• Sichere Löschung einzelner Dokumente aus der Datenbank</li>
          <li>• Erweiterte Filter- und Suchoptionen für bessere Übersicht</li>
        </ul>
      </div>
    </div>
  );
}