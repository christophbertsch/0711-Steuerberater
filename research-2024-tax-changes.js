import fetch from 'node-fetch';
import fs from 'fs';

// Tavily API configuration
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || 'your-tavily-api-key-here';
const TAVILY_API_URL = 'https://api.tavily.com/search';

// Research queries for 2024 German tax changes
const researchQueries = [
  'German tax changes 2024 Steuerreform',
  'Einkommensteuer Änderungen 2024 Deutschland',
  'Abschreibung neue Regeln 2024 Germany',
  'Homeoffice Pauschale 2024 Steuer',
  'Elektroauto Steuervorteile 2024',
  'Digitale Belege Pflicht 2024 Steuer',
  'Sonderausgaben Höchstbeträge 2024',
  'Werbungskosten Pauschale 2024',
  'Kindergeld Freibeträge 2024',
  'Grundfreibetrag 2024 Deutschland'
];

async function searchTaxLaw(query) {
  try {
    console.log(`Searching for: ${query}`);
    
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query: query,
        search_depth: 'advanced',
        include_domains: [
          'bundesfinanzministerium.de',
          'gesetze-im-internet.de',
          'steuerberater.de',
          'haufe.de',
          'steuertipps.de',
          'smartsteuer.de',
          'vlh.de'
        ],
        max_results: 5,
        include_answer: true,
        include_raw_content: false
      })
    });

    if (!response.ok) {
      console.error(`Tavily API error for query "${query}": ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return {
      query,
      answer: data.answer,
      results: data.results || []
    };
  } catch (error) {
    console.error(`Error searching for "${query}":`, error.message);
    return null;
  }
}

async function conductTaxResearch() {
  console.log('Starting comprehensive tax law research for 2024...\n');
  
  const allResults = [];
  
  for (const query of researchQueries) {
    const result = await searchTaxLaw(query);
    if (result) {
      allResults.push(result);
      console.log(`✓ Completed: ${query}`);
      console.log(`  Found ${result.results.length} results\n`);
    } else {
      console.log(`✗ Failed: ${query}\n`);
    }
    
    // Add delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Process and structure the results
  const structuredResults = {
    researchDate: new Date().toISOString(),
    totalQueries: researchQueries.length,
    successfulQueries: allResults.length,
    categories: {
      generalChanges: [],
      deductions: [],
      digitalRequirements: [],
      vehicleBenefits: [],
      personalAllowances: []
    },
    detailedFindings: allResults
  };
  
  // Categorize findings
  allResults.forEach(result => {
    const query = result.query.toLowerCase();
    
    if (query.includes('homeoffice') || query.includes('werbungskosten') || query.includes('sonderausgaben')) {
      structuredResults.categories.deductions.push(result);
    } else if (query.includes('digital') || query.includes('belege')) {
      structuredResults.categories.digitalRequirements.push(result);
    } else if (query.includes('elektroauto') || query.includes('auto')) {
      structuredResults.categories.vehicleBenefits.push(result);
    } else if (query.includes('grundfreibetrag') || query.includes('kindergeld') || query.includes('freibeträge')) {
      structuredResults.categories.personalAllowances.push(result);
    } else {
      structuredResults.categories.generalChanges.push(result);
    }
  });
  
  // Save results to file
  const filename = `tax-research-2024-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(structuredResults, null, 2));
  
  console.log('\n=== RESEARCH SUMMARY ===');
  console.log(`Total queries: ${structuredResults.totalQueries}`);
  console.log(`Successful queries: ${structuredResults.successfulQueries}`);
  console.log(`Results saved to: ${filename}`);
  
  // Generate summary report
  generateSummaryReport(structuredResults);
  
  return structuredResults;
}

function generateSummaryReport(results) {
  console.log('\n=== KEY FINDINGS FOR 2024 ===\n');
  
  // Extract key insights from answers
  const keyInsights = [];
  
  results.detailedFindings.forEach(finding => {
    if (finding.answer) {
      keyInsights.push({
        topic: finding.query,
        insight: finding.answer.substring(0, 200) + '...'
      });
    }
  });
  
  keyInsights.forEach((insight, index) => {
    console.log(`${index + 1}. ${insight.topic}`);
    console.log(`   ${insight.insight}\n`);
  });
  
  // Generate markdown report
  const markdownReport = generateMarkdownReport(results);
  fs.writeFileSync('tax-changes-2024-report.md', markdownReport);
  console.log('Detailed report saved to: tax-changes-2024-report.md');
}

function generateMarkdownReport(results) {
  let markdown = `# German Tax Law Changes 2024 - Research Report

Generated on: ${new Date().toLocaleDateString()}
Research queries: ${results.totalQueries}
Successful queries: ${results.successfulQueries}

## Executive Summary

This report contains comprehensive research on German tax law changes for 2024, covering:
- General tax reforms and changes
- Deduction rule updates
- Digital documentation requirements
- Vehicle tax benefits
- Personal allowances and exemptions

`;

  // Add category sections
  Object.entries(results.categories).forEach(([category, findings]) => {
    if (findings.length > 0) {
      markdown += `## ${category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')}\n\n`;
      
      findings.forEach(finding => {
        markdown += `### ${finding.query}\n\n`;
        if (finding.answer) {
          markdown += `**Key Finding:** ${finding.answer}\n\n`;
        }
        
        if (finding.results && finding.results.length > 0) {
          markdown += `**Sources:**\n`;
          finding.results.forEach(result => {
            markdown += `- [${result.title}](${result.url})\n`;
            if (result.content) {
              markdown += `  ${result.content.substring(0, 150)}...\n`;
            }
          });
          markdown += '\n';
        }
      });
    }
  });
  
  markdown += `## Detailed Research Data

For complete research data including all queries and responses, see the JSON file: tax-research-2024-${new Date().toISOString().split('T')[0]}.json

---
*This report was generated automatically using Tavily API for tax law research.*
`;

  return markdown;
}

// Run the research if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!TAVILY_API_KEY || TAVILY_API_KEY === 'your-tavily-api-key-here') {
    console.error('Please set your TAVILY_API_KEY environment variable');
    console.log('You can get a free API key at: https://tavily.com');
    process.exit(1);
  }
  
  conductTaxResearch()
    .then(() => {
      console.log('\nResearch completed successfully!');
    })
    .catch(error => {
      console.error('Research failed:', error);
      process.exit(1);
    });
}

export { conductTaxResearch, searchTaxLaw };