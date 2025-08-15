import React, { useState, useEffect } from 'react';
import { Search, FileText, BookOpen, CheckSquare, Filter, Database, Eye, Tag } from 'lucide-react';

interface EditorialDocument {
  id: string;
  filename: string;
  text: string;
  documentType: 'editorial_rule' | 'editorial_note' | 'editorial_step';
  metadata: {
    package_id: string;
    topic: string;
    content_type: string;
    rule_id?: string;
    note_id?: string;
    step_id?: string;
    priority?: string;
    note_type?: string;
    step_type?: string;
    version: string;
  };
  score?: number;
}

interface SearchFilters {
  contentType: string;
  topic: string;
  priority: string;
}

export default function EditorialSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EditorialDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<EditorialDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({
    contentType: 'all',
    topic: 'all',
    priority: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);

  // Load available topics on component mount
  useEffect(() => {
    loadAvailableTopics();
  }, []);

  const loadAvailableTopics = async () => {
    try {
      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '*',
          limit: 100,
          includeCorrupted: false,
          filters: {
            documentType: ['editorial_rule', 'editorial_note', 'editorial_step']
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        const topics = [...new Set(results.map((doc: any) => doc.metadata?.topic).filter(Boolean))];
        setAvailableTopics(topics.sort());
      }
    } catch (error) {
      console.warn('Failed to load available topics:', error);
    }
  };

  const searchEditorialContent = async (query: string) => {
    if (!query.trim() && filters.contentType === 'all' && filters.topic === 'all') {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchFilters: any = {};
      
      if (filters.contentType !== 'all') {
        searchFilters.documentType = [filters.contentType];
      } else {
        searchFilters.documentType = ['editorial_rule', 'editorial_note', 'editorial_step'];
      }
      
      if (filters.topic !== 'all') {
        searchFilters.topic = [filters.topic];
      }

      const response = await fetch('/api/documents/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim() || '*',
          limit: 50,
          includeCorrupted: false,
          filters: searchFilters
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      let results = data.results || [];

      // Apply priority filter if specified
      if (filters.priority !== 'all') {
        results = results.filter((doc: any) => doc.metadata?.priority === filters.priority);
      }

      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchEditorialContent(searchQuery);
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'editorial_rule':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'editorial_note':
        return <BookOpen className="h-5 w-5 text-green-600" />;
      case 'editorial_step':
        return <CheckSquare className="h-5 w-5 text-purple-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'editorial_rule':
        return 'Rule Specification';
      case 'editorial_note':
        return 'Editorial Note';
      case 'editorial_step':
        return 'User Step';
      default:
        return type;
    }
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'editorial_rule':
        return 'bg-blue-100 text-blue-800';
      case 'editorial_note':
        return 'bg-green-100 text-green-800';
      case 'editorial_step':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Editorial Content Search</h2>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search editorial content (rules, notes, steps)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </div>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content Type
                  </label>
                  <select
                    value={filters.contentType}
                    onChange={(e) => setFilters(prev => ({ ...prev, contentType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="editorial_rule">Rule Specifications</option>
                    <option value="editorial_note">Editorial Notes</option>
                    <option value="editorial_step">User Steps</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Topic
                  </label>
                  <select
                    value={filters.topic}
                    onChange={(e) => setFilters(prev => ({ ...prev, topic: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Topics</option>
                    {availableTopics.map(topic => (
                      <option key={topic} value={topic}>{topic}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => searchEditorialContent(searchQuery)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Searching editorial content...</span>
            </div>
          )}

          {!loading && searchResults.length === 0 && (searchQuery || filters.contentType !== 'all' || filters.topic !== 'all') && (
            <div className="text-center py-8 text-gray-500">
              No editorial content found matching your search criteria.
            </div>
          )}

          {!loading && searchResults.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Search Results ({searchResults.length})
                </h3>
              </div>

              <div className="grid gap-4">
                {searchResults.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getDocumentIcon(doc.documentType)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {doc.filename}
                            </h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDocumentTypeColor(doc.documentType)}`}>
                              {getDocumentTypeLabel(doc.documentType)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {truncateText(doc.text)}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              {doc.metadata.topic}
                            </span>
                            {doc.metadata.priority && (
                              <span className={`px-2 py-1 rounded ${
                                doc.metadata.priority === 'high' ? 'bg-red-100 text-red-800' :
                                doc.metadata.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {doc.metadata.priority}
                              </span>
                            )}
                            <span>v{doc.metadata.version}</span>
                            {doc.score && (
                              <span className="text-blue-600">
                                Score: {(doc.score * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button className="ml-4 p-1 text-gray-400 hover:text-gray-600">
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getDocumentIcon(selectedDocument.documentType)}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedDocument.filename}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getDocumentTypeLabel(selectedDocument.documentType)} • {selectedDocument.metadata.topic}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDocument(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {selectedDocument.text}
                </pre>
              </div>
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Metadata</h4>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">Package ID</dt>
                    <dd className="text-gray-900">{selectedDocument.metadata.package_id}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Content Type</dt>
                    <dd className="text-gray-900">{selectedDocument.metadata.content_type}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Topic</dt>
                    <dd className="text-gray-900">{selectedDocument.metadata.topic}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Version</dt>
                    <dd className="text-gray-900">{selectedDocument.metadata.version}</dd>
                  </div>
                  {selectedDocument.metadata.priority && (
                    <div>
                      <dt className="font-medium text-gray-500">Priority</dt>
                      <dd className="text-gray-900">{selectedDocument.metadata.priority}</dd>
                    </div>
                  )}
                  {selectedDocument.score && (
                    <div>
                      <dt className="font-medium text-gray-500">Relevance Score</dt>
                      <dd className="text-gray-900">{(selectedDocument.score * 100).toFixed(1)}%</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}