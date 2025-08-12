import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = 'http://localhost:56534/api';

// Test data
const testPersonalInfo = {
  firstName: 'Max',
  lastName: 'Mustermann',
  address: 'Musterstraße 123, 12345 Berlin',
  taxId: '12345678901',
  maritalStatus: 'single',
  children: 0
};

const testIncomeData = {
  salary: 45000,
  freelance: 5000,
  investments: 1200,
  other: 800,
  total: 52000
};

const testDeductionData = {
  workExpenses: 1200,
  donations: 500,
  healthInsurance: 3600,
  education: 800,
  other: 300,
  total: 6400
};

async function testAPI(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();
    
    console.log(`✓ ${method} ${endpoint}: ${response.status}`);
    if (!response.ok) {
      console.log(`  Error: ${result.error || 'Unknown error'}`);
    }
    
    return { success: response.ok, data: result };
  } catch (error) {
    console.log(`✗ ${method} ${endpoint}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testDocumentUpload() {
  console.log('\n=== Testing Document Upload ===');
  
  // Create a test XML file (simulating a tax document)
  const testXMLContent = `<?xml version="1.0" encoding="UTF-8"?>
<tax-document>
  <type>salary_statement</type>
  <year>2024</year>
  <employee>
    <name>Max Mustermann</name>
    <id>12345</id>
  </employee>
  <income>
    <gross>45000</gross>
    <net>32000</net>
    <tax_paid>8500</tax_paid>
  </income>
</tax-document>`;
  
  const testFilePath = path.join(__dirname, 'test-salary-statement.xml');
  fs.writeFileSync(testFilePath, testXMLContent);
  
  try {
    // Test file upload using FormData
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('document', fs.createReadStream(testFilePath));
    
    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: form
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✓ Document upload successful');
      console.log(`  Document ID: ${result.id}`);
      return result;
    } else {
      console.log('✗ Document upload failed');
      console.log(`  Error: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.log(`✗ Document upload error: ${error.message}`);
    return null;
  } finally {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }
}

async function testDocumentAnalysis(documentId) {
  console.log('\n=== Testing Document Analysis ===');
  
  const result = await testAPI('/ai/analyze', 'POST', { documentId });
  
  if (result.success) {
    console.log('  Analysis results:');
    console.log(`    Document Type: ${result.data.documentType}`);
    console.log(`    Tax Relevance: ${result.data.taxRelevance}`);
    console.log(`    Confidence: ${Math.round(result.data.confidence * 100)}%`);
    console.log(`    Potential Deductions: ${result.data.expertOpinion.potentialDeductions.length}`);
  }
  
  return result;
}

async function testTaxResearch() {
  console.log('\n=== Testing Tax Research ===');
  
  // Test search functionality
  const searchResult = await testAPI('/research/search', 'POST', {
    query: 'German tax changes 2024'
  });
  
  if (searchResult.success) {
    console.log(`  Found ${searchResult.data.results.length} search results`);
    console.log(`  Summary: ${searchResult.data.summary.substring(0, 100)}...`);
  }
  
  // Test recent updates
  const updatesResult = await testAPI('/research/updates/2024');
  
  if (updatesResult.success) {
    console.log(`  Found ${updatesResult.data.length} recent updates`);
  }
  
  return { searchResult, updatesResult };
}

async function testTaxDeclarationGeneration() {
  console.log('\n=== Testing Tax Declaration Generation ===');
  
  const declarationData = {
    personalInfo: testPersonalInfo,
    incomeData: testIncomeData,
    deductionData: testDeductionData,
    documents: []
  };
  
  const result = await testAPI('/tax/generate-declaration', 'POST', declarationData);
  
  if (result.success) {
    console.log('  Tax declaration generated successfully:');
    console.log(`    Calculated Tax: €${result.data.calculatedTax}`);
    console.log(`    Expected Refund: €${result.data.refundAmount}`);
    console.log(`    Taxable Income: €${result.data.income.total - result.data.deductions.total}`);
  }
  
  return result;
}

async function testServerHealth() {
  console.log('=== Testing Server Health ===');
  
  try {
    const response = await fetch(`http://localhost:56534`);
    if (response.ok) {
      console.log('✓ Server is running and accessible');
      return true;
    } else {
      console.log(`✗ Server responded with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`✗ Server is not accessible: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Tax & Law AI App Tests\n');
  
  // Test server health
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server is not running. Please start the server first with: npm run server');
    return;
  }
  
  // Test document upload
  const uploadedDoc = await testDocumentUpload();
  
  // Test document analysis (if upload was successful)
  let analysisResult = null;
  if (uploadedDoc) {
    analysisResult = await testDocumentAnalysis(uploadedDoc.id);
  }
  
  // Test tax research
  const researchResults = await testTaxResearch();
  
  // Test tax declaration generation
  const declarationResult = await testTaxDeclarationGeneration();
  
  // Test document listing
  console.log('\n=== Testing Document Listing ===');
  const documentsResult = await testAPI('/documents');
  if (documentsResult.success) {
    console.log(`  Found ${documentsResult.data.length} documents in system`);
  }
  
  // Summary
  console.log('\n=== Test Summary ===');
  const tests = [
    { name: 'Server Health', success: serverHealthy },
    { name: 'Document Upload', success: uploadedDoc !== null },
    { name: 'Document Analysis', success: analysisResult?.success || false },
    { name: 'Tax Research Search', success: researchResults.searchResult?.success || false },
    { name: 'Recent Updates', success: researchResults.updatesResult?.success || false },
    { name: 'Tax Declaration', success: declarationResult?.success || false },
    { name: 'Document Listing', success: documentsResult?.success || false }
  ];
  
  const passedTests = tests.filter(t => t.success).length;
  const totalTests = tests.length;
  
  console.log(`\nPassed: ${passedTests}/${totalTests} tests`);
  
  tests.forEach(test => {
    console.log(`${test.success ? '✓' : '✗'} ${test.name}`);
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! The application is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the server logs and configuration.');
  }
  
  // Clean up - delete uploaded test documents
  if (uploadedDoc) {
    console.log('\n=== Cleaning Up ===');
    const deleteResult = await testAPI(`/documents/${uploadedDoc.id}`, 'DELETE');
    if (deleteResult.success) {
      console.log('✓ Test document cleaned up');
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testAPI };