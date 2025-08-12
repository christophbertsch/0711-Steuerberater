import React, { useState, useEffect } from 'react';
import { Search, Calendar, TrendingUp, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { TaxResearchResult, TaxLawUpdate } from '../types';
import { researchService } from '../services/researchService';

const TaxResearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TaxResearchResult | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<TaxLawUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUpdates, setLoadingUpdates] = useState(false);

  useEffect(() => {
    loadRecentUpdates();
  }, []);

  const loadRecentUpdates = async () => {
    setLoadingUpdates(true);
    try {
      const updates = await researchService.getRecentTaxUpdates2024();
      setRecentUpdates(updates);
    } catch (error) {
      console.error('Error loading recent updates:', error);
    } finally {
      setLoadingUpdates(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const results = await researchService.searchTaxLaw(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching tax law:', error);
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

  const predefinedQueries = [
    'Steueränderungen 2024 Deutschland',
    'Neue Abzugsregeln 2024',
    'Digitale Steuerpflichten',
    'Homeoffice-Abzüge 2024',
    'Elektrofahrzeug-Steuervorteile',
    'Kryptowährungsbesteuerung 2024'
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Steuerrechtsforschung 2024</h2>
        <p className="text-gray-600 mb-6">
          Bleiben Sie auf dem Laufenden über die neuesten Steuerrechtsänderungen und -vorschriften für 2024. 
          Suchen Sie nach bestimmten Themen oder durchsuchen Sie aktuelle Updates.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suchen Sie nach Steuerrechtsänderungen, Abzügen, Vorschriften..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center space-x-2"
            >
              <Search className="h-5 w-5" />
              <span>{loading ? 'Suche...' : 'Suchen'}</span>
            </button>
          </div>
        </form>

        {/* Predefined Queries */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Beliebte Suchanfragen:</h3>
          <div className="flex flex-wrap gap-2">
            {predefinedQueries.map((query) => (
              <button
                key={query}
                onClick={() => setSearchQuery(query)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="card">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Search Results for "{searchResults.query}"
          </h3>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
            <p className="text-blue-800">{searchResults.summary}</p>
          </div>

          {searchResults.relevantChanges.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Key Changes for 2024:</h4>
              <ul className="space-y-2">
                {searchResults.relevantChanges.map((change, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            {searchResults.results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-gray-900">{result.title}</h5>
                  <span className={`text-xs px-2 py-1 rounded-full ${getImpactColor(result.impact)}`}>
                    {result.impact} impact
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{result.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      Effective: {result.effectiveDate}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {result.category}
                    </span>
                  </div>
                  <a
                    href={result.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary-600 hover:text-primary-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Source
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Updates */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">Recent Tax Law Updates 2024</h3>
          <button
            onClick={loadRecentUpdates}
            disabled={loadingUpdates}
            className="btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${loadingUpdates ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loadingUpdates ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-gray-500">Loading latest updates...</p>
          </div>
        ) : recentUpdates.length > 0 ? (
          <div className="space-y-4">
            {recentUpdates.map((update, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{update.title}</h4>
                  <span className={`text-xs px-2 py-1 rounded-full ${getImpactColor(update.impact)}`}>
                    {update.impact} impact
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{update.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {update.effectiveDate}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                      {update.category}
                    </span>
                  </div>
                  <a
                    href={update.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary-600 hover:text-primary-700"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Read More
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No recent updates available</p>
          </div>
        )}
      </div>

      {/* Important Notice */}
      <div className="card bg-yellow-50 border-yellow-200">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Important Legal Notice</h3>
            <p className="text-yellow-800 text-sm">
              The information provided here is for educational purposes only and should not be considered 
              as professional tax or legal advice. Always consult with a qualified tax professional or 
              attorney for specific situations. Tax laws are subject to change and may vary by jurisdiction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaxResearch;