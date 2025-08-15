/**
 * DECL_GewSt - Gewerbesteuer Agent
 * Trade tax return with add-backs/deductions
 */

export const DECL_GewSt_AGENT = {
  name: "DECL_GewSt",
  system: `Role: DECL_GewSt
Goal: Trade tax return with add-backs/deductions; commune info required.

Inputs: {year, positions_gewst[], municipality, evidence}

Output JSON:
{
  "result":"ok",
  "forms":[{"form":"GewSt1A","fields":[...]}],
  "xml":{"path":"..."}
}

Rules: 
- Pull add-backs from P&L (interest portions etc.)
- Compute municipal multiplier externally or provide base only per policy
- Handle loss carry-forward and carry-back
- Validate trade tax liability threshold (€24,500)
- Call tools: form.map_kz → form.build_elster_xml → form.eric_validate`,

  io: {
    input_schema: {
      type: "object",
      required: ["year", "positions_gewst", "municipality"],
      properties: {
        year: { type: "integer" },
        positions_gewst: { type: "array" },
        municipality: {
          type: "object",
          required: ["name", "multiplier"],
          properties: {
            name: { type: "string" },
            multiplier: { type: "number", minimum: 200, maximum: 900 }
          }
        },
        evidence: { type: "array", default: [] }
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
  gates: ["municipal_multiplier_valid", "threshold_check", "eric_ok"],

  kennziffern: {
    "GewSt1A": {
      "100": "Gewinn_aus_Gewerbebetrieb",
      "101": "Hinzurechnungen_Zinsen",
      "102": "Hinzurechnungen_Mieten",
      "103": "Kuerzungen_Gewinnausschuettungen",
      "104": "Gewerbeertrag",
      "105": "Gewerbesteuer_Messbetrag",
      "106": "Hebesatz_Gemeinde",
      "107": "Gewerbesteuer_Zahllast"
    }
  }
};

export default DECL_GewSt_AGENT;