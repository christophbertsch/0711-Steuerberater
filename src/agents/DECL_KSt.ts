/**
 * DECL_KSt - Körperschaftsteuer Agent
 * Corporate income tax return with relevant annexes
 */

export const DECL_KSt_AGENT = {
  name: "DECL_KSt",
  system: `Role: DECL_KSt
Goal: Corporate income tax return with relevant annexes (GK, WA, Zinsschranke, etc.).

Inputs: {profile.corporation, year, positions[], evidence}

Output JSON:
{
  "result":"ok",
  "forms":[{"form":"KSt1","fields":[...]}],
  "xml":{"path":"..."},
  "validation":{"eric":{"ok":true}}
}

Rules: 
- Link to E-Bilanz taxonomy figures
- Handle loss carry, add-backs/deductions via GewSt agent (no duplication)
- Validate corporate structure and shareholdings
- Apply correct tax rates (15% + Solidaritätszuschlag)
- Call tools: form.map_kz → form.build_elster_xml → form.eric_validate`,

  io: {
    input_schema: {
      type: "object",
      required: ["profile", "year", "positions"],
      properties: {
        profile: {
          type: "object",
          properties: {
            corporation: {
              type: "object",
              required: ["legal_form", "tax_id"],
              properties: {
                legal_form: { enum: ["GmbH", "AG", "UG", "KGaA"] },
                tax_id: { type: "string" },
                shareholders: { type: "array" },
                fiscal_year_end: { type: "string" }
              }
            }
          }
        },
        year: { type: "integer" },
        positions: { type: "array" },
        evidence: { type: "array", default: [] }
      }
    },
    output_schema: {
      type: "object",
      required: ["result", "forms", "xml", "validation"],
      properties: {
        result: { enum: ["ok", "needs_info", "error"] },
        forms: { type: "array" },
        xml: { type: "object" },
        validation: { type: "object" }
      }
    }
  },

  tools: ["form.map_kz", "form.build_elster_xml", "form.eric_validate"],
  gates: ["corporate_structure_valid", "tax_rate_correct", "eric_ok"],

  // KSt Kennziffern mapping
  kennziffern: {
    "KSt1": {
      "240": "Einkommen_vor_Verlustabzug",
      "241": "Verlustabzug",
      "242": "Zu_versteuerndes_Einkommen",
      "243": "Koerperschaftsteuer_15_Prozent",
      "244": "Solidaritaetszuschlag",
      "245": "Koerperschaftsteuer_gesamt"
    },
    "Anlage_GK": {
      "001": "Gewinn_Verlust_Handelsbilanz",
      "002": "Steuerliche_Korrekturen",
      "003": "Einkommen_Koerperschaftsteuer"
    }
  }
};

export default DECL_KSt_AGENT;