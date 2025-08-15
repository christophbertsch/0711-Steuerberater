/**
 * German Tax Declaration Agent Registry
 * Maps tax scenarios to appropriate declaration agents
 */

export interface AgentRegistryEntry {
  agent: string;
  when: string;
  description: string;
  forms: string[];
}

export const TAX_AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    agent: "DECL_ESt",
    when: "profile.entity=='individual' && task.includes('income tax')",
    description: "Einkommensteuer für natürliche Personen (ESt 1 A + Anlagen)",
    forms: ["ESt1A", "Anlage N", "Anlage KAP", "Anlage R", "Anlage V", "Anlage S", "Anlage G"]
  },
  {
    agent: "DECL_GuE",
    when: "profile.entity in ['partnership','gemeinschaft'] && task.includes('feststellung')",
    description: "Gesonderte & einheitliche Feststellung für Personengesellschaften",
    forms: ["GuE", "Anlage FB", "Anlage FE"]
  },
  {
    agent: "DECL_USt_VA",
    when: "profile.vat.obligations.includes('voranmeldung')",
    description: "Umsatzsteuer-Voranmeldung (monatlich/vierteljährlich)",
    forms: ["UStVA"]
  },
  {
    agent: "DECL_USt_J",
    when: "profile.vat.obligations.includes('jahreserklaerung')",
    description: "Umsatzsteuer-Jahreserklärung",
    forms: ["USt-2A"]
  },
  {
    agent: "DECL_ZM",
    when: "profile.vat.has_ic_supplies==true",
    description: "Zusammenfassende Meldung (EU-Lieferungen)",
    forms: ["ZM"]
  },
  {
    agent: "DECL_OSS",
    when: "profile.vat.scheme=='OSS'",
    description: "OSS Union Scheme Return (grenzüberschreitende B2C)",
    forms: ["OSS"]
  },
  {
    agent: "DECL_KSt",
    when: "profile.entity=='corporation'",
    description: "Körperschaftsteuer für Kapitalgesellschaften",
    forms: ["KSt1", "Anlage GK", "Anlage WA"]
  },
  {
    agent: "DECL_GewSt",
    when: "profile.has_trade_tax==true",
    description: "Gewerbesteuer-Erklärung",
    forms: ["GewSt1A"]
  },
  {
    agent: "DECL_EBilanz",
    when: "profile.bookkeeping=='bilanz'",
    description: "E-Bilanz (XBRL-Taxonomie)",
    forms: ["E-Bilanz"]
  },
  {
    agent: "DECL_EUER",
    when: "profile.bookkeeping=='eur'",
    description: "Einnahmen-Überschuss-Rechnung",
    forms: ["EÜR"]
  },
  {
    agent: "DECL_LSt_Anm",
    when: "profile.employer==true",
    description: "Lohnsteuer-Anmeldung für Arbeitgeber",
    forms: ["LSt-Anmeldung"]
  },
  {
    agent: "DECL_KapESt_Anm",
    when: "profile.withholds_capital_tax==true",
    description: "Kapitalertragsteuer-Anmeldung",
    forms: ["KapESt-Anmeldung"]
  },
  {
    agent: "DECL_ErbSt",
    when: "task.includes('inheritance') || artifacts.events.includes('erwerb-von-todes-wegen')",
    description: "Erbschaftsteuer-Erklärung",
    forms: ["ErbSt"]
  },
  {
    agent: "DECL_SchenkSt",
    when: "artifacts.events.includes('schenkung')",
    description: "Schenkungsteuer-Erklärung",
    forms: ["SchenkSt"]
  },
  {
    agent: "DECL_GrESt",
    when: "artifacts.events.includes('grunderwerb')",
    description: "Grunderwerbsteuer-Erklärung",
    forms: ["GrESt"]
  },
  {
    agent: "DECL_Grundsteuer",
    when: "artifacts.events.includes('grundsteuer-wert')",
    description: "Grundsteuer-Wertermittlung",
    forms: ["Grundsteuer"]
  },
  {
    agent: "DECL_InvStG",
    when: "profile.is_fund_mgmt || artifacts.reports.includes('invstg')",
    description: "Investmentsteuergesetz-Meldungen",
    forms: ["InvStG-Report"]
  },
  {
    agent: "DECL_EnergyTax",
    when: "profile.sector_energy==true",
    description: "Energie-/Stromsteuer-Anmeldungen",
    forms: ["Energiesteuer", "Stromsteuer"]
  },
  {
    agent: "DECL_InsuranceTax",
    when: "profile.issuer_insurance==true",
    description: "Versicherungsteuer-Anmeldungen",
    forms: ["VersSt"]
  }
];

/**
 * Evaluates registry conditions to find matching agents
 */
export function findMatchingAgents(profile: any, task: string, artifacts: any = {}): string[] {
  const matchingAgents: string[] = [];
  
  for (const entry of TAX_AGENT_REGISTRY) {
    try {
      // Simple condition evaluation (in production, use a proper expression evaluator)
      const condition = entry.when
        .replace(/profile\./g, 'profile.')
        .replace(/task\./g, 'task.')
        .replace(/artifacts\./g, 'artifacts.');
      
      // For now, do basic string matching - in production, implement proper condition evaluation
      if (evaluateCondition(condition, { profile, task, artifacts })) {
        matchingAgents.push(entry.agent);
      }
    } catch (error) {
      console.warn(`Error evaluating condition for ${entry.agent}:`, error);
    }
  }
  
  return matchingAgents;
}

/**
 * Basic condition evaluator (simplified for demo)
 * In production, use a proper expression parser/evaluator
 */
function evaluateCondition(condition: string, context: any): boolean {
  const { profile, task } = context;
  
  // Handle common patterns
  if (condition.includes("profile.entity=='individual'") && condition.includes("task.includes('income tax')")) {
    return profile?.entity === 'individual' && task.toLowerCase().includes('income tax');
  }
  
  if (condition.includes("profile.entity=='corporation'")) {
    return profile?.entity === 'corporation';
  }
  
  if (condition.includes("profile.employer==true")) {
    return profile?.employer === true;
  }
  
  if (condition.includes("profile.has_trade_tax==true")) {
    return profile?.has_trade_tax === true;
  }
  
  if (condition.includes("profile.bookkeeping=='eur'")) {
    return profile?.bookkeeping === 'eur';
  }
  
  if (condition.includes("profile.bookkeeping=='bilanz'")) {
    return profile?.bookkeeping === 'bilanz';
  }
  
  if (condition.includes("task.includes('inheritance')")) {
    return task.toLowerCase().includes('inheritance') || task.toLowerCase().includes('erbschaft');
  }
  
  // Add more condition patterns as needed
  return false;
}

export function getAgentInfo(agentName: string): AgentRegistryEntry | undefined {
  return TAX_AGENT_REGISTRY.find(entry => entry.agent === agentName);
}