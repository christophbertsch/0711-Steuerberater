/**
 * DECL_USt_VA - Umsatzsteuer-Voranmeldung Agent
 * Builds monthly/quarterly VAT advance return (UStVA)
 */

export const DECL_USt_VA_AGENT = {
  name: "DECL_USt_VA",
  system: `Role: DECL_USt_VA
Goal: Build monthly/quarterly VAT advance return (UStVA) incl. prepayments/deferrals.

Inputs: {profile.vat, period, positions_vat[], evidence}

Output JSON:
{
  "result":"ok|needs_info",
  "forms":[{"form":"UStVA","period":"YYYY-MM","fields":[{"kz":"66","value":...}, ...]}],
  "xml":{"path":"..."},
  "validation":{"eric":{"ok":true,"errors":[]}},
  "needs":[]
}

Rules: 
- Periodize correctly, handle "Dauerfristverlängerung"
- Process reverse charge, intra-EU acquisitions, OSS exclusions
- Validate VAT calculations and cross-check totals
- Call tools: form.map_kz → form.build_elster_xml → form.eric_validate`,

  io: {
    input_schema: {
      type: "object",
      required: ["profile", "period", "positions_vat"],
      properties: {
        profile: {
          type: "object",
          properties: {
            vat: {
              type: "object",
              required: ["vat_id", "obligations"],
              properties: {
                vat_id: { type: "string", pattern: "^DE[0-9]{9}$" },
                obligations: { type: "array", items: { type: "string" } },
                dauerfrist: { type: "boolean", default: false }
              }
            }
          }
        },
        period: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        positions_vat: { type: "array" },
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
        validation: { type: "object" },
        needs: { type: "array", default: [] }
      }
    }
  },

  tools: ["form.map_kz", "form.build_elster_xml", "form.eric_validate"],
  gates: ["no_negative_tax", "periodized_totals_match", "eric_ok"],

  // UStVA Kennziffern mapping
  kennziffern: {
    "UStVA": {
      "35": "Steuerpflichtige_Umsaetze_19",
      "36": "Steuer_19_Prozent",
      "37": "Steuerpflichtige_Umsaetze_7",
      "38": "Steuer_7_Prozent", 
      "41": "Innergemeinschaftliche_Erwerbe_19",
      "42": "Steuer_Erwerbe_19",
      "43": "Innergemeinschaftliche_Erwerbe_7",
      "44": "Steuer_Erwerbe_7",
      "46": "Reverse_Charge_Umsaetze",
      "47": "Reverse_Charge_Steuer",
      "62": "Abziehbare_Vorsteuer",
      "66": "Zahllast_Vorauszahlung"
    }
  }
};

export default DECL_USt_VA_AGENT;