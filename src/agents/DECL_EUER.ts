/**
 * DECL_EUER - Einnahmen-Überschuss-Rechnung Agent
 * Cash basis statement for transfer to ESt/KSt
 */

export const DECL_EUER_AGENT = {
  name: "DECL_EUER",
  system: `Role: DECL_EUER
Goal: Einnahmen-Überschuss-Rechnung (cash basis) statement for transfer to ESt/KSt where applicable.

Inputs: {eur_lines[], bank_reconciliations[]}

Output JSON:
{
  "result":"ok",
  "forms":[{"form":"EÜR","fields":[...]}],
  "xml":{"path":"..."}
}

Rules: 
- Tie totals to ESt (Anlage G/S)
- Ensure cash principle flags
- Validate business income/expenses categorization
- Handle depreciation (AfA) correctly
- Cross-check with bank statements
- Call tools: form.map_kz → form.build_elster_xml → form.eric_validate`,

  io: {
    input_schema: {
      type: "object",
      required: ["eur_lines"],
      properties: {
        eur_lines: {
          type: "array",
          items: {
            type: "object",
            required: ["category", "amount", "description"],
            properties: {
              category: { enum: ["income", "expense", "afa", "investment"] },
              amount: { type: "number" },
              description: { type: "string" },
              date: { type: "string", format: "date" }
            }
          }
        },
        bank_reconciliations: { type: "array", default: [] }
      }
    },
    output_schema: {
      type: "object",
      required: ["result", "forms", "xml"],
      properties: {
        result: { enum: ["ok", "needs_info", "error"] },
        forms: { type: "array" },
        xml: { type: "object" }
      }
    }
  },

  tools: ["form.map_kz", "form.build_elster_xml", "form.eric_validate"],
  gates: ["cash_principle_valid", "totals_reconciled", "eric_ok"],

  kennziffern: {
    "EÜR": {
      "511": "Umsaetze_Einnahmen",
      "512": "Sonstige_Einnahmen",
      "520": "Wareneinkauf",
      "521": "Personalkosten",
      "522": "Mieten_Pachten",
      "523": "Abschreibungen_AfA",
      "524": "Sonstige_Betriebsausgaben",
      "525": "Vorsteuer",
      "526": "Umsatzsteuer",
      "527": "Gewinn_Verlust"
    }
  }
};

export default DECL_EUER_AGENT;