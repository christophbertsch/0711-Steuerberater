/**
 * Agent Manager - Loads and manages all German tax declaration agents
 */

import { findMatchingAgents, getAgentInfo } from './registry';
import { formTools } from '../tools/formTools';
import DECL_ESt_AGENT from './DECL_ESt';
import DECL_USt_VA_AGENT from './DECL_USt_VA';
import DECL_KSt_AGENT from './DECL_KSt';
import DECL_GewSt_AGENT from './DECL_GewSt';
import DECL_EUER_AGENT from './DECL_EUER';

export interface AgentExecutionContext {
  task: string;
  profile: any;
  year: number;
  jurisdiction: string;
  artifacts?: any;
  positions?: any[];
  evidence?: any[];
  policies?: any;
}

export interface AgentExecutionResult {
  agent: string;
  result: 'ok' | 'needs_info' | 'error';
  forms?: any[];
  xml?: any;
  pdf?: any;
  manifest?: any[];
  validation?: any;
  needs?: string[];
  warnings?: string[];
  execution_time?: number;
}

/**
 * Central agent registry with all loaded agents
 */
const LOADED_AGENTS = new Map<string, any>([
  ['DECL_ESt', DECL_ESt_AGENT],
  ['DECL_USt_VA', DECL_USt_VA_AGENT],
  ['DECL_KSt', DECL_KSt_AGENT],
  ['DECL_GewSt', DECL_GewSt_AGENT],
  ['DECL_EUER', DECL_EUER_AGENT]
  // Add more agents as they are created
]);

export class AgentManager {
  private agents = LOADED_AGENTS;
  private tools = formTools;

  /**
   * Find appropriate agents for a given tax scenario
   */
  findAgentsForTask(context: AgentExecutionContext): string[] {
    console.log(`🔍 Finding agents for task: ${context.task}`);
    
    const matchingAgents = findMatchingAgents(
      context.profile, 
      context.task, 
      context.artifacts
    );
    
    console.log(`✅ Found ${matchingAgents.length} matching agents:`, matchingAgents);
    return matchingAgents;
  }

  /**
   * Execute a specific agent with given context
   */
  async executeAgent(agentName: string, context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    console.log(`🚀 Executing agent: ${agentName}`);
    
    const agent = this.agents.get(agentName);
    if (!agent) {
      return {
        agent: agentName,
        result: 'error',
        warnings: [`Agent ${agentName} not found`],
        execution_time: Date.now() - startTime
      };
    }

    try {
      // Validate input schema
      const inputValid = this.validateInput(agent, context);
      if (!inputValid.valid) {
        return {
          agent: agentName,
          result: 'needs_info',
          needs: inputValid.errors,
          execution_time: Date.now() - startTime
        };
      }

      // Execute agent logic based on agent type
      const result = await this.runAgentLogic(agent, context);
      
      console.log(`✅ Agent ${agentName} completed with result: ${result.result}`);
      return {
        ...result,
        agent: agentName,
        result: result.result || 'ok' as const,
        execution_time: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ Agent ${agentName} failed:`, error);
      return {
        agent: agentName,
        result: 'error' as const,
        warnings: [`Agent execution failed: ${(error as Error).message}`],
        execution_time: Date.now() - startTime
      };
    }
  }

  /**
   * Execute multiple agents in sequence
   */
  async executeAgents(agentNames: string[], context: AgentExecutionContext): Promise<AgentExecutionResult[]> {
    console.log(`🔄 Executing ${agentNames.length} agents in sequence`);
    
    const results: AgentExecutionResult[] = [];
    
    for (const agentName of agentNames) {
      const result = await this.executeAgent(agentName, context);
      results.push(result);
      
      // Stop on error unless policy says continue
      if (result.result === 'error' && !context.policies?.continue_on_error) {
        console.log(`⚠️ Stopping execution due to error in ${agentName}`);
        break;
      }
    }
    
    return results;
  }

  /**
   * Get agent information and capabilities
   */
  getAgentInfo(agentName: string) {
    const registryInfo = getAgentInfo(agentName);
    const agentImpl = this.agents.get(agentName);
    
    return {
      registry: registryInfo,
      implementation: agentImpl ? {
        name: agentImpl.name,
        tools: agentImpl.tools,
        gates: agentImpl.gates
      } : null
    };
  }

  /**
   * List all available agents
   */
  listAgents() {
    return Array.from(this.agents.keys()).map(name => ({
      name,
      info: this.getAgentInfo(name)
    }));
  }

  /**
   * Validate agent input against schema
   */
  private validateInput(agent: any, context: AgentExecutionContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation - in production, use proper JSON schema validator
    if (agent.io?.input_schema?.required) {
      for (const field of agent.io.input_schema.required) {
        if (!(field in context)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Run agent-specific logic
   */
  private async runAgentLogic(agent: any, context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    // This is where the actual agent execution would happen
    // For now, simulate the execution based on agent type
    
    switch (agent.name) {
      case 'DECL_ESt':
        return await this.executeEStAgent(context);
      
      case 'DECL_USt_VA':
        return await this.executeUStVAAgent(context);
      
      case 'DECL_KSt':
        return await this.executeKStAgent(context);
      
      case 'DECL_GewSt':
        return await this.executeGewStAgent(context);
      
      case 'DECL_EUER':
        return await this.executeEUERAgent(context);
      
      default:
        return {
          result: 'error',
          warnings: [`Agent logic not implemented for ${agent.name}`]
        };
    }
  }

  /**
   * ESt agent execution logic
   */
  private async executeEStAgent(context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    console.log('📋 Executing ESt (Income Tax) agent');
    
    // Map positions to Kennziffern
    const fields = await this.tools.map_kz(context.positions || [], context.year, 'ESt1A');
    
    // Build forms
    const forms = [{
      form: 'ESt1A',
      fields,
      attachments: ['Anlage N'] // Add based on positions
    }];
    
    // Generate XML
    const xml = await this.tools.build_elster_xml(forms, context.profile, context.year);
    
    // Validate
    const validation = await this.tools.eric_validate(xml);
    
    // Generate PDF
    const pdf = await this.tools.fill_pdf(forms);
    
    return {
      result: validation.ok ? 'ok' : 'needs_info',
      forms,
      xml,
      pdf,
      validation: { eric: validation },
      needs: validation.errors,
      warnings: validation.warnings
    };
  }

  /**
   * UStVA agent execution logic
   */
  private async executeUStVAAgent(context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    console.log('📋 Executing UStVA (VAT Return) agent');
    
    const fields = await this.tools.map_kz(context.positions || [], context.year, 'UStVA');
    
    const forms = [{
      form: 'UStVA',
      fields
    }];
    
    const xml = await this.tools.build_elster_xml(forms, context.profile, context.year);
    const validation = await this.tools.eric_validate(xml);
    
    return {
      result: validation.ok ? 'ok' : 'needs_info',
      forms,
      xml,
      validation: { eric: validation },
      needs: validation.errors
    };
  }

  /**
   * KSt agent execution logic
   */
  private async executeKStAgent(context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    console.log('📋 Executing KSt (Corporate Tax) agent');
    
    const fields = await this.tools.map_kz(context.positions || [], context.year, 'KSt1');
    
    const forms = [{
      form: 'KSt1',
      fields,
      attachments: ['Anlage GK']
    }];
    
    const xml = await this.tools.build_elster_xml(forms, context.profile, context.year);
    const validation = await this.tools.eric_validate(xml);
    
    return {
      result: validation.ok ? 'ok' : 'needs_info',
      forms,
      xml,
      validation: { eric: validation },
      needs: validation.errors
    };
  }

  /**
   * GewSt agent execution logic
   */
  private async executeGewStAgent(context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    console.log('📋 Executing GewSt (Trade Tax) agent');
    
    const fields = await this.tools.map_kz(context.positions || [], context.year, 'GewSt1A');
    
    const forms = [{
      form: 'GewSt1A',
      fields
    }];
    
    const xml = await this.tools.build_elster_xml(forms, context.profile, context.year);
    const validation = await this.tools.eric_validate(xml);
    
    return {
      result: validation.ok ? 'ok' : 'needs_info',
      forms,
      xml,
      validation: { eric: validation },
      needs: validation.errors
    };
  }

  /**
   * EÜR agent execution logic
   */
  private async executeEUERAgent(context: AgentExecutionContext): Promise<Partial<AgentExecutionResult>> {
    console.log('📋 Executing EÜR (Cash Basis) agent');
    
    const fields = await this.tools.map_kz(context.positions || [], context.year, 'EÜR');
    
    const forms = [{
      form: 'EÜR',
      fields
    }];
    
    const xml = await this.tools.build_elster_xml(forms, context.profile, context.year);
    const validation = await this.tools.eric_validate(xml);
    
    return {
      result: validation.ok ? 'ok' : 'needs_info',
      forms,
      xml,
      validation: { eric: validation },
      needs: validation.errors
    };
  }
}

// Export singleton instance
export const agentManager = new AgentManager();