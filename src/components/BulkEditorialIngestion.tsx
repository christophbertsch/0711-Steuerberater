/**
 * Bulk Editorial Ingestion Component
 * UI for automated processing of all tax law topics
 */

import React, { useState, useEffect } from 'react';
import { BulkIngestionManager, BulkIngestionResult } from '../editorial/BulkIngestionManager';

interface IngestionProgress {
  isRunning: boolean;
  currentTopic?: string;
  progress: number;
  totalTopics: number;
  processedTopics: number;
  results: BulkIngestionResult | null;
}

export const BulkEditorialIngestion: React.FC = () => {
  const [bulkManager] = useState(() => new BulkIngestionManager());
  const [progress, setProgress] = useState<IngestionProgress>({
    isRunning: false,
    progress: 0,
    totalTopics: 0,
    processedTopics: 0,
    results: null
  });
  const [availableTopics, setAvailableTopics] = useState<Record<string, Array<{ id: string; title: string; cadence_days: number }>>>({});
  const [selectedPriorities, setSelectedPriorities] = useState<('high' | 'medium' | 'low')[]>(['high']);

  useEffect(() => {
    // Load available topics on component mount
    const topics = bulkManager.getAvailableTopics();
    setAvailableTopics(topics);
  }, [bulkManager]);

  const startBulkIngestion = async (priorities: ('high' | 'medium' | 'low')[] = ['high']) => {
    setProgress({
      isRunning: true,
      progress: 0,
      totalTopics: 0,
      processedTopics: 0,
      results: null
    });

    try {
      console.log('🚀 Starting bulk editorial ingestion...');
      
      const result = await bulkManager.processAllTopics({
        priorities,
        max_concurrent: 2,
        delay_between_topics: 1500
      });

      setProgress({
        isRunning: false,
        progress: 100,
        totalTopics: result.total_topics,
        processedTopics: result.processed_topics,
        results: result
      });

      console.log('✅ Bulk ingestion completed:', result);
      
    } catch (error) {
      console.error('❌ Bulk ingestion failed:', error);
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        results: {
          success: false,
          total_topics: 0,
          processed_topics: 0,
          failed_topics: 1,
          execution_time: 0,
          results: [],
          summary: {
            total_rules: 0,
            total_notes: 0,
            total_steps: 0,
            high_priority_completed: 0,
            medium_priority_completed: 0,
            low_priority_completed: 0
          }
        }
      }));
    }
  };

  const startHighPriorityIngestion = async () => {
    await startBulkIngestion(['high']);
  };

  const startAllPrioritiesIngestion = async () => {
    await startBulkIngestion(['high', 'medium', 'low']);
  };

  const startSelectedPrioritiesIngestion = async () => {
    await startBulkIngestion(selectedPriorities);
  };

  const formatExecutionTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📚 Bulk Editorial Ingestion
        </h2>
        <p className="text-gray-600 mb-6">
          Automatically process all German tax law topics using the comprehensive editorial configuration.
          This will fetch authoritative sources, extract rules, and generate user-facing content.
        </p>

        {/* Available Topics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(availableTopics).map(([priority, topics]) => (
            <div key={priority} className={`p-4 rounded-lg border ${getPriorityColor(priority)}`}>
              <h3 className="font-medium capitalize mb-2">{priority} Priority</h3>
              <p className="text-sm mb-2">{topics.length} topics</p>
              <div className="text-xs space-y-1 max-h-32 overflow-y-auto">
                {topics.slice(0, 5).map(topic => (
                  <div key={topic.id} className="truncate" title={topic.title}>
                    {topic.title}
                  </div>
                ))}
                {topics.length > 5 && (
                  <div className="text-gray-500">+{topics.length - 5} more...</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Priority Selection */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Select Priorities to Process:</h3>
          <div className="flex flex-wrap gap-3">
            {(['high', 'medium', 'low'] as const).map(priority => (
              <label key={priority} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPriorities.includes(priority)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPriorities(prev => [...prev, priority]);
                    } else {
                      setSelectedPriorities(prev => prev.filter(p => p !== priority));
                    }
                  }}
                  className="mr-2"
                  disabled={progress.isRunning}
                />
                <span className={`px-2 py-1 rounded text-sm capitalize ${getPriorityColor(priority)}`}>
                  {priority} ({availableTopics[priority]?.length || 0} topics)
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={startHighPriorityIngestion}
            disabled={progress.isRunning}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Process High Priority Only
          </button>
          
          <button
            onClick={startSelectedPrioritiesIngestion}
            disabled={progress.isRunning || selectedPriorities.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚡ Process Selected Priorities
          </button>
          
          <button
            onClick={startAllPrioritiesIngestion}
            disabled={progress.isRunning}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🌟 Process All Topics
          </button>
        </div>

        {/* Progress Indicator */}
        {progress.isRunning && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Processing Topics...</span>
              <span className="text-sm text-gray-500">
                {progress.processedTopics}/{progress.totalTopics}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              ></div>
            </div>
            {progress.currentTopic && (
              <p className="text-sm text-gray-600 mt-2">
                Current: {progress.currentTopic}
              </p>
            )}
          </div>
        )}

        {/* Results Summary */}
        {progress.results && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {progress.results.success ? '✅' : '❌'} Ingestion Results
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{progress.results.processed_topics}</div>
                <div className="text-sm text-blue-800">Successful</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{progress.results.failed_topics}</div>
                <div className="text-sm text-red-800">Failed</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{progress.results.summary.total_rules}</div>
                <div className="text-sm text-green-800">Rules Generated</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{progress.results.summary.total_notes}</div>
                <div className="text-sm text-purple-800">Editorial Notes</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Execution Summary:</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>⏱️ Total execution time: {formatExecutionTime(progress.results.execution_time)}</div>
                <div>📊 User steps generated: {progress.results.summary.total_steps}</div>
                <div>🎯 By priority: High({progress.results.summary.high_priority_completed}), Medium({progress.results.summary.medium_priority_completed}), Low({progress.results.summary.low_priority_completed})</div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="max-h-64 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-2">Topic Results:</h4>
              <div className="space-y-2">
                {progress.results.results.map((result, index) => (
                  <div key={index} className={`p-3 rounded-lg border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {result.success ? '✅' : '❌'} {result.topic_title}
                        </div>
                        {result.success && result.stats && (
                          <div className="text-xs text-gray-600 mt-1">
                            {result.stats.rules} rules, {result.stats.notes} notes, {result.stats.steps} steps
                          </div>
                        )}
                        {!result.success && result.error && (
                          <div className="text-xs text-red-600 mt-1">{result.error}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 ml-2">
                        {formatExecutionTime(result.execution_time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};