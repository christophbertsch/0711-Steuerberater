import React, { useState, useEffect } from 'react';
import { Cpu, Play, CheckCircle, AlertCircle, Clock, FileText, Users, Target, Download, BookOpen } from 'lucide-react';
import { agentManager, AgentExecutionContext, AgentExecutionResult } from '../agents/AgentManager';
import { TAX_AGENT_REGISTRY } from '../agents/registry';
import { EditorialSystem } from './EditorialSystem';
import { RuleSpec, EditorialNote, UserStep } from '../editorial/types';

// Core Types for Tax System
interface TaxPosition {
  formular: string;
  kennziffer: string;
  value: number;
  year: number;
  evidence: string[];
  explanation: string;
  confidence: number;
  agent: string;
}

interface TaxRule {
  id: string;
  rule_type: 'calculation' | 'validation' | 'classification' | 'optimization';
  condition: string;
  action: string;
  confidence: number;
  learned_from: string[];
  last_updated: string;
  success_rate: number;
}

// Using AgentExecutionResult from AgentManager instead

interface OrchestrationPlan {
  task: string;
  profile: any;
  year: number;
  agents: string[];
  workflow_steps: WorkflowStep[];
  estimated_duration: number;
}

interface WorkflowStep {
  id: string;
  name: string;
  agents: string[];
  status: 'pending' | 'running' | 'completed' | 'error';
  dependencies: string[];
  results?: AgentExecutionResult[];
}

const TaxOrchestrator: React.FC = () => {
  const [orchestrationPlan, setOrchestrationPlan] = useState<OrchestrationPlan | null>(null);
  const [agentResults, setAgentResults] = useState<AgentExecutionResult[]>([]);
  const [taxPositions, setTaxPositions] = useState<TaxPosition[]>([]);
  const [, setLearnedRules] = useState<TaxRule[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [executionContext, setExecutionContext] = useState<AgentExecutionContext | null>(null);
  const [activeTab, setActiveTab] = useState<'orchestrator' | 'editorial'>('orchestrator');
  const [editorialRuleSpecs, setEditorialRuleSpecs] = useState<RuleSpec[]>([]);
  const [, setEditorialContent] = useState<{ notes: EditorialNote[]; steps: UserStep[] }>({ notes: [], steps: [] });

  // Initialize Tax Orchestrator
  const initializeOrchestrator = async () => {
    console.log('🧠 Initializing Tax AI Orchestrator with Production Agent System...');
    
    // Load available agents
    const agents = agentManager.listAgents();
    setAvailableAgents(agents.map(a => a.name));
    
    console.log(`✅ Loaded ${agents.length} production tax agents:`, agents.map(a => a.name));
    
    // Initialize sample execution context
    const sampleContext: AgentExecutionContext = {
      task: 'Complete income tax filing for individual',
      profile: {
        entity: 'individual',
        tax_id: '12345678901',
        marital_status: 'single',
        employer: false,
        has_trade_tax: false,
        bookkeeping: 'eur'
      },
      year: 2024,
      jurisdiction: 'DE',
      positions: [
        { type: 'wages', amount: 75000, description: 'Salary from employment' },
        { type: 'werbungskosten', amount: 1200, description: 'Work-related expenses' }
      ],
      evidence: [],
      policies: { continue_on_error: false }
    };
    
    setExecutionContext(sampleContext);
    
    // Load existing learned rules
    await loadLearnedRules();
    
    // Create orchestration plan
    const plan = await createOrchestrationPlan(sampleContext);
    setOrchestrationPlan(plan);
  };

  // Load learned tax rules from knowledge base
  const loadLearnedRules = async () => {
    try {
      const response = await fetch('/api/tax/rules');
      if (response.ok) {
        const rules = await response.json();
        setLearnedRules(rules);
        console.log(`📚 Loaded ${rules.length} learned tax rules`);
      }
    } catch (error) {
      console.error('❌ Error loading tax rules:', error);
      // Initialize with basic rules
      setLearnedRules(getBasicTaxRules());
    }
  };

  // Create orchestration plan based on execution context
  const createOrchestrationPlan = async (context: AgentExecutionContext): Promise<OrchestrationPlan> => {
    console.log('📋 Creating orchestration plan for:', context.task);
    
    // Find matching agents for the task
    const matchingAgents = agentManager.findAgentsForTask(context);
    
    const plan: OrchestrationPlan = {
      task: context.task,
      profile: context.profile,
      year: context.year,
      agents: matchingAgents,
      workflow_steps: [
        {
          id: 'agent_selection',
          name: 'Agent Selection & Validation',
          agents: matchingAgents,
          status: 'pending',
          dependencies: []
        },
        {
          id: 'form_generation',
          name: 'Tax Form Generation',
          agents: matchingAgents,
          status: 'pending',
          dependencies: ['agent_selection']
        },
        {
          id: 'validation',
          name: 'ERiC Validation & XML Generation',
          agents: ['VALIDATOR'],
          status: 'pending',
          dependencies: ['form_generation']
        }
      ],
      estimated_duration: matchingAgents.length * 30 // 30 seconds per agent
    };
    
    console.log(`✅ Created plan with ${matchingAgents.length} agents:`, matchingAgents);
    return plan;
  };

  // Execute orchestration plan with production agents
  const executeOrchestration = async () => {
    if (!orchestrationPlan || !executionContext) return;

    setProcessing(true);
    setCurrentStep('Initializing agent execution...');
    
    try {
      console.log('🚀 Starting orchestration execution with production agents');
      
      // Execute agents in sequence
      const results = await agentManager.executeAgents(
        orchestrationPlan.agents, 
        executionContext
      );
      
      setAgentResults(results);
      
      // Process results and extract tax positions
      const allPositions: TaxPosition[] = [];
      
      for (const result of results) {
        if (result.result === 'ok' && result.forms) {
          // Convert form fields to tax positions
          for (const form of result.forms) {
            for (const field of form.fields || []) {
              allPositions.push({
                formular: form.form,
                kennziffer: field.kz,
                value: typeof field.value === 'number' ? field.value : 0,
                year: executionContext.year,
                evidence: [],
                explanation: field.description || `Generated by ${result.agent}`,
                confidence: 0.95,
                agent: result.agent
              });
            }
          }
        }
      }
      
      setTaxPositions(allPositions);
      
      // Update workflow steps status
      const updatedPlan = { ...orchestrationPlan };
      updatedPlan.workflow_steps = updatedPlan.workflow_steps.map(step => ({
        ...step,
        status: 'completed' as const,
        results: results.filter(r => step.agents.includes(r.agent))
      }));
      
      setOrchestrationPlan(updatedPlan);
      
      console.log(`✅ Orchestration completed with ${results.length} agent results`);
      console.log(`📊 Generated ${allPositions.length} tax positions`);
      
    } catch (error) {
      console.error('❌ Orchestration execution failed:', error);
      setCurrentStep(`Error: ${(error as Error).message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Get basic tax rules for initialization
  const getBasicTaxRules = (): TaxRule[] => {
    return [
      {
        id: 'werbungskosten_pauschbetrag',
        rule_type: 'calculation',
        condition: 'werbungskosten < 1230',
        action: 'apply_pauschbetrag(1230)',
        confidence: 0.98,
        learned_from: ['EStG §9a'],
        last_updated: new Date().toISOString(),
        success_rate: 0.98
      },
      {
        id: 'computer_werbungskosten',
        rule_type: 'classification',
        condition: 'item_type == "computer" && business_use > 0.5',
        action: 'classify_as_werbungskosten',
        confidence: 0.85,
        learned_from: ['BFH_cases', 'user_feedback'],
        last_updated: new Date().toISOString(),
        success_rate: 0.85
      }
    ];
  };

  // Test specific agent execution
  const testAgentExecution = async (agentName: string) => {
    if (!executionContext) return;
    
    setProcessing(true);
    setCurrentStep(`Testing ${agentName}...`);
    
    try {
      const result = await agentManager.executeAgent(agentName, executionContext);
      console.log(`🧪 Test result for ${agentName}:`, result);
      
      setAgentResults([result]);
      setCurrentStep(`✅ ${agentName} test completed`);
      
    } catch (error) {
      console.error(`❌ Test failed for ${agentName}:`, error);
      setCurrentStep(`❌ ${agentName} test failed`);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    initializeOrchestrator();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with Tab Navigation */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Cpu className="w-8 h-8" />
          <div>
            <h1 className="text-3xl font-bold">Tax AI Orchestrator</h1>
            <p className="text-blue-100">Production German Tax Declaration System with Editorial Pipeline</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveTab('orchestrator')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'orchestrator'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500 text-white hover:bg-blue-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Declaration Agents
            </div>
          </button>
          <button
            onClick={() => setActiveTab('editorial')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'editorial'
                ? 'bg-white text-blue-600'
                : 'bg-blue-500 text-white hover:bg-blue-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Editorial System
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'editorial' ? (
        <EditorialSystem
          onRuleSpecsGenerated={(rulespecs) => {
            setEditorialRuleSpecs(rulespecs);
            console.log(`📋 Received ${rulespecs.length} rule specs from editorial system`);
          }}
          onEditorialContentGenerated={(notes, steps) => {
            setEditorialContent({ notes, steps });
            console.log(`📝 Received ${notes.length} editorial notes and ${steps.length} user steps`);
          }}
        />
      ) : (
        <>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  🧠 Declaration Agent System
                </h2>
                <p className="text-gray-600 mt-1">
                  Production German Tax Declaration Agents
                  {editorialRuleSpecs.length > 0 && (
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {editorialRuleSpecs.length} Editorial Rules Available
                    </span>
                  )}
                </p>
              </div>
          <div className="flex space-x-3">
            <button
              onClick={executeOrchestration}
              disabled={processing || !orchestrationPlan}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>Execute Plan</span>
            </button>
          </div>
        </div>

        {/* Agent Registry Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Available Agents</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">{availableAgents.length}</p>
            <p className="text-sm text-blue-700">Production tax agents loaded</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-900">Tax Forms</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {TAX_AGENT_REGISTRY.reduce((sum, agent) => sum + agent.forms.length, 0)}
            </p>
            <p className="text-sm text-green-700">Supported German forms</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Tax Positions</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-2">{taxPositions.length}</p>
            <p className="text-sm text-purple-700">Generated positions</p>
          </div>
        </div>

        {/* Current Execution Context */}
        {executionContext && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Current Execution Context</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Task:</span>
                <p className="font-medium">{executionContext.task}</p>
              </div>
              <div>
                <span className="text-gray-600">Entity:</span>
                <p className="font-medium">{executionContext.profile.entity}</p>
              </div>
              <div>
                <span className="text-gray-600">Year:</span>
                <p className="font-medium">{executionContext.year}</p>
              </div>
              <div>
                <span className="text-gray-600">Positions:</span>
                <p className="font-medium">{executionContext.positions?.length || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {processing && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="font-medium text-blue-900">Processing...</span>
            </div>
            <p className="text-blue-700 mt-1">{currentStep}</p>
          </div>
        )}

        {/* Orchestration Plan */}
        {orchestrationPlan && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Orchestration Plan</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-gray-600">Selected Agents:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {orchestrationPlan.agents.map(agent => (
                      <span key={agent} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Estimated Duration:</span>
                  <p className="font-medium">{orchestrationPlan.estimated_duration}s</p>
                </div>
              </div>
              
              {/* Workflow Steps */}
              <div className="space-y-2">
                {orchestrationPlan.workflow_steps.map(step => (
                  <div key={step.id} className="flex items-center space-x-3 p-2 bg-white rounded border">
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : step.status === 'running' ? (
                      <Clock className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                    )}
                    <div className="flex-1">
                      <span className="font-medium">{step.name}</span>
                      <div className="text-sm text-gray-600">
                        Agents: {step.agents.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agent Results */}
        {agentResults.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Agent Execution Results</h3>
            <div className="space-y-3">
              {agentResults.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-5 h-5 text-gray-600" />
                      <span className="font-medium">{result.agent}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {result.result === 'ok' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : result.result === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                      <span className="text-sm text-gray-600">
                        {result.execution_time}ms
                      </span>
                    </div>
                  </div>
                  
                  {result.forms && (
                    <div className="mt-2">
                      <span className="text-sm text-gray-600">Generated Forms:</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {result.forms.map((form, formIndex) => (
                          <span key={formIndex} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                            {form.form} ({form.fields?.length || 0} fields)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {result.xml && (
                    <div className="mt-2">
                      <span className="text-sm text-gray-600">XML Generated:</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {result.xml.schema}
                        </span>
                        <button className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1">
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {result.needs && result.needs.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm text-red-600">Missing Information:</span>
                      <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                        {result.needs.map((need, needIndex) => (
                          <li key={needIndex}>{need}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tax Positions Generated */}
        {taxPositions.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Generated Tax Positions</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {taxPositions.slice(0, 6).map((position, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{position.formular}</span>
                      <span className="text-xs text-gray-500">KZ {position.kennziffer}</span>
                    </div>
                    <div className="text-lg font-bold text-green-600">
                      €{position.value.toLocaleString('de-DE')}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {position.explanation}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-blue-600">{position.agent}</span>
                      <span className="text-xs text-gray-500">
                        {(position.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {taxPositions.length > 6 && (
                <div className="text-center mt-4">
                  <span className="text-sm text-gray-600">
                    ... and {taxPositions.length - 6} more positions
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Agent Tests */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold text-gray-900 mb-3">Quick Agent Tests</h3>
          <div className="flex flex-wrap gap-2">
            {availableAgents.map(agent => (
              <button
                key={agent}
                onClick={() => testAgentExecution(agent)}
                disabled={processing}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm disabled:opacity-50"
              >
                Test {agent}
              </button>
            ))}
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default TaxOrchestrator;
