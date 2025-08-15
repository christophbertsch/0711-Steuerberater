/**
 * Demo script for Bulk Editorial Ingestion
 * Runs the complete system with high priority topics
 */

import { BulkIngestionManager } from './src/editorial/BulkIngestionManager';

async function runBulkIngestionDemo() {
  console.log('🚀 Starting Bulk Editorial Ingestion Demo');
  console.log('=========================================');

  const bulkManager = new BulkIngestionManager();
  
  // Get available topics
  const availableTopics = bulkManager.getAvailableTopics();
  console.log('📚 Available topics:');
  Object.entries(availableTopics).forEach(([priority, topics]) => {
    console.log(`   ${priority}: ${topics.length} topics`);
    topics.forEach(topic => {
      console.log(`     • ${topic.title} (${topic.cadence_days} days)`);
    });
  });

  console.log('\n🎯 Processing HIGH PRIORITY topics only...');
  
  try {
    const result = await bulkManager.processHighPriorityTopics();
    
    console.log('\n🎉 Bulk Ingestion Results:');
    console.log('==========================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Total topics: ${result.total_topics}`);
    console.log(`✅ Processed: ${result.processed_topics}`);
    console.log(`❌ Failed: ${result.failed_topics}`);
    console.log(`⏱️  Execution time: ${result.execution_time}ms`);
    
    console.log('\n📈 Summary:');
    console.log(`   Rules generated: ${result.summary.total_rules}`);
    console.log(`   Editorial notes: ${result.summary.total_notes}`);
    console.log(`   User steps: ${result.summary.total_steps}`);
    console.log(`   High priority completed: ${result.summary.high_priority_completed}`);
    
    console.log('\n📋 Individual Results:');
    result.results.forEach((topicResult, index) => {
      const status = topicResult.success ? '✅' : '❌';
      const stats = topicResult.stats 
        ? `(${topicResult.stats.rules}R, ${topicResult.stats.notes}N, ${topicResult.stats.steps}S)`
        : '';
      const error = topicResult.error ? ` - ${topicResult.error}` : '';
      
      console.log(`   ${index + 1}. ${status} ${topicResult.topic_title} ${stats}${error}`);
      if (topicResult.package_id) {
        console.log(`      Package ID: ${topicResult.package_id}`);
      }
    });
    
    if (result.success) {
      console.log('\n🎉 All topics processed successfully!');
      console.log('📦 Editorial packages are now stored in the database');
      console.log('🔗 Rule specifications are available for declaration agents');
    } else {
      console.log('\n⚠️  Some topics failed to process');
      console.log('📋 Check the individual results above for details');
    }
    
  } catch (error) {
    console.error('💥 Bulk ingestion failed:', error);
  }
}

// Run the demo
runBulkIngestionDemo().catch(console.error);