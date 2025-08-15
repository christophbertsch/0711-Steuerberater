/**
 * Bulk Ingestion Manager - Automated processing of all editorial topics
 * Processes comprehensive tax law configuration with priority-based scheduling
 */

import { EditorialManager, EditorialIngestRequest } from './EditorialManager';
import editorialConfig from './config/editorial-config.json';

export interface BulkIngestionConfig {
  version: string;
  jurisdiction: string;
  default_year: number;
  scheduler: {
    global_rate_limit_rps: number;
    max_parallel_domains: number;
    default_recrawl_days: number;
    high_priority_recrawl_days: number;
    pdf_ocr: string;
  };
  evidence_policy: {
    allow_secondary: boolean;
    require_primary_citation: boolean;
    min_citation_coverage: number;
    store_headers: string[];
  };
  whitelist_sources: Array<{
    domain: string;
    type: string;
    priority: number;
    sitemaps: string[];
  }>;
  blacklist_domains: string[];
  topics: Array<{
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    update_cadence_days: number;
    queries: Record<string, string[]>;
    extract: string[];
    form_map_targets: string[];
  }>;
}

export interface BulkIngestionResult {
  success: boolean;
  total_topics: number;
  processed_topics: number;
  failed_topics: number;
  execution_time: number;
  results: Array<{
    topic_id: string;
    topic_title: string;
    success: boolean;
    package_id?: string;
    execution_time: number;
    error?: string;
    stats?: {
      rules: number;
      notes: number;
      steps: number;
    };
  }>;
  summary: {
    total_rules: number;
    total_notes: number;
    total_steps: number;
    high_priority_completed: number;
    medium_priority_completed: number;
    low_priority_completed: number;
  };
}

export class BulkIngestionManager {
  private editorialManager: EditorialManager;
  private config: BulkIngestionConfig;

  constructor() {
    this.editorialManager = new EditorialManager();
    this.config = editorialConfig as BulkIngestionConfig;
  }

  /**
   * Process all topics from configuration with priority-based scheduling
   */
  async processAllTopics(options: {
    priorities?: ('high' | 'medium' | 'low')[];
    max_concurrent?: number;
    delay_between_topics?: number;
  } = {}): Promise<BulkIngestionResult> {
    const startTime = Date.now();
    const {
      priorities = ['high', 'medium', 'low'],
      max_concurrent = 3,
      delay_between_topics = 2000
    } = options;

    console.log('🚀 Starting Bulk Editorial Ingestion');
    console.log(`📋 Configuration: ${this.config.version} (${this.config.jurisdiction})`);
    console.log(`🎯 Processing priorities: ${priorities.join(', ')}`);
    console.log(`⚡ Max concurrent: ${max_concurrent}, Delay: ${delay_between_topics}ms`);

    // Filter topics by priority
    const topicsToProcess = this.config.topics.filter(topic => 
      priorities.includes(topic.priority)
    );

    // Sort by priority (high -> medium -> low) and update cadence
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    topicsToProcess.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.update_cadence_days - b.update_cadence_days; // More frequent updates first
    });

    console.log(`📊 Processing ${topicsToProcess.length} topics out of ${this.config.topics.length} total`);

    const results: BulkIngestionResult['results'] = [];
    const summary = {
      total_rules: 0,
      total_notes: 0,
      total_steps: 0,
      high_priority_completed: 0,
      medium_priority_completed: 0,
      low_priority_completed: 0
    };

    // Process topics in batches to respect rate limits
    for (let i = 0; i < topicsToProcess.length; i += max_concurrent) {
      const batch = topicsToProcess.slice(i, i + max_concurrent);
      console.log(`\n📦 Processing batch ${Math.floor(i / max_concurrent) + 1}/${Math.ceil(topicsToProcess.length / max_concurrent)}`);
      
      const batchPromises = batch.map(async (topic, batchIndex) => {
        const topicStartTime = Date.now();
        
        try {
          console.log(`\n🔍 [${i + batchIndex + 1}/${topicsToProcess.length}] Processing: ${topic.title}`);
          console.log(`📋 Priority: ${topic.priority}, Update cadence: ${topic.update_cadence_days} days`);
          
          // Convert topic configuration to ingestion request
          const request = this.buildIngestionRequest(topic);
          
          // Execute editorial ingestion
          const result = await this.editorialManager.runEditorialIngest(request);
          
          const executionTime = Date.now() - topicStartTime;
          
          if (result.success) {
            console.log(`✅ Completed: ${topic.title} (${executionTime}ms)`);
            console.log(`📊 Generated: ${result.artifacts.rulespecs.length} rules, ${result.artifacts.editorial_notes.length} notes, ${result.artifacts.user_steps.length} steps`);
            
            // Update summary
            summary.total_rules += result.artifacts.rulespecs.length;
            summary.total_notes += result.artifacts.editorial_notes.length;
            summary.total_steps += result.artifacts.user_steps.length;
            summary[`${topic.priority}_priority_completed`]++;
            
            return {
              topic_id: topic.id,
              topic_title: topic.title,
              success: true,
              package_id: result.package_id,
              execution_time: executionTime,
              stats: {
                rules: result.artifacts.rulespecs.length,
                notes: result.artifacts.editorial_notes.length,
                steps: result.artifacts.user_steps.length
              }
            };
          } else {
            console.log(`❌ Failed: ${topic.title} - ${result.errors.join(', ')}`);
            return {
              topic_id: topic.id,
              topic_title: topic.title,
              success: false,
              execution_time: executionTime,
              error: result.errors.join(', ')
            };
          }
          
        } catch (error) {
          const executionTime = Date.now() - topicStartTime;
          console.log(`💥 Error processing ${topic.title}: ${error}`);
          return {
            topic_id: topic.id,
            topic_title: topic.title,
            success: false,
            execution_time: executionTime,
            error: (error as Error).message
          };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + max_concurrent < topicsToProcess.length && delay_between_topics > 0) {
        console.log(`⏳ Waiting ${delay_between_topics}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay_between_topics));
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const successfulTopics = results.filter(r => r.success).length;
    const failedTopics = results.filter(r => !r.success).length;

    console.log(`\n🎉 Bulk Editorial Ingestion Complete!`);
    console.log(`⏱️  Total execution time: ${totalExecutionTime}ms`);
    console.log(`✅ Successful: ${successfulTopics}/${topicsToProcess.length}`);
    console.log(`❌ Failed: ${failedTopics}/${topicsToProcess.length}`);
    console.log(`📊 Total generated: ${summary.total_rules} rules, ${summary.total_notes} notes, ${summary.total_steps} steps`);
    console.log(`🎯 By priority: High(${summary.high_priority_completed}), Medium(${summary.medium_priority_completed}), Low(${summary.low_priority_completed})`);

    return {
      success: failedTopics === 0,
      total_topics: topicsToProcess.length,
      processed_topics: successfulTopics,
      failed_topics: failedTopics,
      execution_time: totalExecutionTime,
      results,
      summary
    };
  }

  /**
   * Process only high priority topics
   */
  async processHighPriorityTopics(): Promise<BulkIngestionResult> {
    return this.processAllTopics({ 
      priorities: ['high'],
      max_concurrent: 2,
      delay_between_topics: 1000
    });
  }

  /**
   * Process specific topics by ID
   */
  async processSpecificTopics(topicIds: string[]): Promise<BulkIngestionResult> {
    const startTime = Date.now();
    
    console.log(`🎯 Processing specific topics: ${topicIds.join(', ')}`);
    
    const topicsToProcess = this.config.topics.filter(topic => 
      topicIds.includes(topic.id)
    );

    if (topicsToProcess.length === 0) {
      console.log('❌ No matching topics found');
      return {
        success: false,
        total_topics: 0,
        processed_topics: 0,
        failed_topics: 0,
        execution_time: Date.now() - startTime,
        results: [],
        summary: {
          total_rules: 0,
          total_notes: 0,
          total_steps: 0,
          high_priority_completed: 0,
          medium_priority_completed: 0,
          low_priority_completed: 0
        }
      };
    }

    return this.processTopicList(topicsToProcess);
  }

  /**
   * Get available topics grouped by priority
   */
  getAvailableTopics(): Record<string, Array<{ id: string; title: string; cadence_days: number }>> {
    const grouped: Record<string, Array<{ id: string; title: string; cadence_days: number }>> = {
      high: [],
      medium: [],
      low: []
    };

    this.config.topics.forEach(topic => {
      grouped[topic.priority].push({
        id: topic.id,
        title: topic.title,
        cadence_days: topic.update_cadence_days
      });
    });

    return grouped;
  }

  private async processTopicList(topics: BulkIngestionConfig['topics']): Promise<BulkIngestionResult> {
    const startTime = Date.now();
    const results: BulkIngestionResult['results'] = [];
    const summary = {
      total_rules: 0,
      total_notes: 0,
      total_steps: 0,
      high_priority_completed: 0,
      medium_priority_completed: 0,
      low_priority_completed: 0
    };

    for (const topic of topics) {
      const topicStartTime = Date.now();
      
      try {
        console.log(`\n🔍 Processing: ${topic.title}`);
        
        const request = this.buildIngestionRequest(topic);
        const result = await this.editorialManager.runEditorialIngest(request);
        
        const executionTime = Date.now() - topicStartTime;
        
        if (result.success) {
          summary.total_rules += result.artifacts.rulespecs.length;
          summary.total_notes += result.artifacts.editorial_notes.length;
          summary.total_steps += result.artifacts.user_steps.length;
          summary[`${topic.priority}_priority_completed`]++;
          
          results.push({
            topic_id: topic.id,
            topic_title: topic.title,
            success: true,
            package_id: result.package_id,
            execution_time: executionTime,
            stats: {
              rules: result.artifacts.rulespecs.length,
              notes: result.artifacts.editorial_notes.length,
              steps: result.artifacts.user_steps.length
            }
          });
        } else {
          results.push({
            topic_id: topic.id,
            topic_title: topic.title,
            success: false,
            execution_time: executionTime,
            error: result.errors.join(', ')
          });
        }
        
      } catch (error) {
        const executionTime = Date.now() - topicStartTime;
        results.push({
          topic_id: topic.id,
          topic_title: topic.title,
          success: false,
          execution_time: executionTime,
          error: (error as Error).message
        });
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    const successfulTopics = results.filter(r => r.success).length;
    const failedTopics = results.filter(r => !r.success).length;

    return {
      success: failedTopics === 0,
      total_topics: topics.length,
      processed_topics: successfulTopics,
      failed_topics: failedTopics,
      execution_time: totalExecutionTime,
      results,
      summary
    };
  }

  private buildIngestionRequest(topic: BulkIngestionConfig['topics'][0]): EditorialIngestRequest {
    // Flatten all queries from different source types
    const allQueries: string[] = [];
    
    Object.entries(topic.queries).forEach(([, queries]) => {
      allQueries.push(...queries);
    });

    // Get authorized sources from whitelist
    const authorizedSources = this.config.whitelist_sources.map(source => ({
      domain: source.domain,
      type: source.type as any,
      priority: source.priority
    }));

    return {
      topic: topic.title,
      queries: allQueries,
      jurisdiction: this.config.jurisdiction,
      sources: authorizedSources,
      quality_gates: [
        'authority_gate',
        'citation_coverage_gate',
        'consistency_gate'
      ]
    };
  }
}