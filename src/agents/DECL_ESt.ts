/**
 * DECL_ESt - Einkommensteuer Agent
 * Produces complete German income tax filing for individuals (ESt 1 A + required Anlagen)
 */

export const DECL_ESt_AGENT = {
  name: "DECL_ESt",
  system: `Role: DECL_ESt
Goal: Produce a complete German income tax filing for individuals (ESt 1 A + required Anlagen) from validated positions. Map all values to official forms/fields (Kennziffern), build ERiC-conform XML and optionally a filled official PDF.

Inputs: {task, profile, year, positions[], evidence[], policies}

Output JSON:
{
  "result":"ok|needs_info|error",
  "forms":[{"form":"ESt1A","fields":[{"kz":"...","value":...}], "attachments":["Anlage N","Anlage Vorsorgeaufwand", "..."]}],
  "xml": {"path":"...", "schema":"ELSTER-ERiC", "hash":"..."},
  "pdf": {"path":"...", "fields_filled":true},
  "manifest":[{"name":"Anlage N","pages":2}, {"name":"Anlage KAP"}],
  "validation":{"eric":{"ok":true,"errors":[]}, "cross_form":{"ok":true,"violations":[]}},
  "needs":[], "warnings":[]
}

Rules:
- Use positions already vetted by council (wages, WK, Vorsorge, Sonderausgaben, etc.).
- Resolve filing type (single/joint) via profile; auto-include required Anlagen (N, KAP, R, V, S, G, SO, KIN, AV, AGBEL, HAUS, ENERG, WA-ESt, N-AUS, N-Doppelte) only if positions exist.
- Call tools: form.map_kz → form.build_elster_xml → form.eric_validate → form.fill_pdf.
- Fail hard on ERiC schema errors; return minimal "needs" list for missing mandatory profile fields (IdNr, IBAN, marital status, children).
- Numbers are BigDecimal; set locale de_DE.`,

  io: {
    input_schema: {
      type: "object",
      required: ["task", "profile", "year", "positions"],
      properties: {
        task: { type: "string" },
        profile: {
          type: "object",
          required: ["entity", "tax_id"],
          properties: {
            entity: { enum: ["individual"] },
            tax_id: { type: "string" },
            marital_status: { enum: ["single", "married_joint", "married_separate"] },
            children: { type: "array" },
            iban: { type: "string" }
          }
        },
        year: { type: "integer", minimum: 2020, maximum: 2030 },
        positions: { type: "array" },
        evidence: { type: "array", default: [] },
        policies: { type: "object", default: {} }
      }
    },
    output_schema: {
      type: "object",
      required: ["result", "forms", "validation"],
      properties: {
        result: { enum: ["ok", "needs_info", "error"] },
        forms: { type: "array" },
        xml: { type: "object" },
        pdf: { type: "object" },
        manifest: { type: "array" },
        validation: { type: "object" },
        needs: { type: "array", default: [] },
        warnings: { type: "array", default: [] }
      }
    }
  },

  tools: ["form.map_kz", "form.build_elster_xml", "form.eric_validate", "form.fill_pdf"],
  gates: ["no_negative_tax", "mandatory_fields_present", "eric_schema_valid"],

  // Key form mappings for ESt
  kennziffern: {
    "ESt1A": {
      "010": "Steuerpflichtiger_Name",
      "020": "Steuerpflichtiger_Vorname", 
      "030": "Geburtsdatum",
      "040": "Steuer_ID",
      "240": "Einkuenfte_aus_nichtselbstaendiger_Arbeit",
      "270": "Werbungskosten_Arbeitnehmer",
      "370": "Sonderausgaben_gesamt",
      "400": "Aussergewoehnliche_Belastungen"
    },
    "Anlage_N": {
      "011": "Arbeitgeber_Name",
      "012": "Arbeitgeber_Adresse",
      "021": "Bruttoarbeitslohn",
      "022": "Lohnsteuer",
      "101": "Werbungskosten_Fahrten",
      "102": "Werbungskosten_Arbeitsmittel"
    }
  }
};

export default DECL_ESt_AGENT;