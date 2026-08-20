import { tool } from "ai";
import { z } from "zod";

const statusSchema = z.enum(["Active", "Inactive"]).optional();

export const TOOL_LABELS: Record<string, string> = {
  listCatalog: "Looking up records",
  createProduct: "Creating product",
  createBatch: "Creating batch",
  createStudyType: "Creating study type",
  createStorageCondition: "Creating storage condition",
  createPullPoint: "Creating pull point",
  createChamber: "Creating chamber",
  createLocation: "Creating storage location",
  createUnit: "Creating unit",
  chargeStudy: "Charging stability study",
  withdrawSample: "Withdrawing sample",
  moveSample: "Moving sample",
  disposeSample: "Disposing sample",
  reconcileSample: "Reconciling inventory",
  acknowledgeAlert: "Acknowledging alert",
};

export const skymapTools = {
  listCatalog: tool({
    description:
      "Look up live SkyMap master or inventory records by name/code before creating or changing anything. Use this to resolve IDs.",
    inputSchema: z.object({
      kind: z.enum([
        "products",
        "batches",
        "studyTypes",
        "storageConditions",
        "pullPoints",
        "chambers",
        "locations",
        "units",
        "samples",
        "duePulls",
        "alerts",
      ]),
      query: z.string().optional().describe("Optional name, code, batch, or sample id filter."),
    }),
  }),

  createProduct: tool({
    description: "Create a product in Product Master. Call this when the user asks to add/create a product.",
    inputSchema: z.object({
      productName: z.string().describe("Product name, e.g. Paracetamol 500 mg tablet"),
      productCode: z.string().optional(),
      strength: z.string().optional(),
      dosageForm: z.string().optional(),
      status: statusSchema,
    }),
  }),

  createBatch: tool({
    description: "Create a batch for an existing product.",
    inputSchema: z.object({
      productName: z.string().describe("Exact or unique product name"),
      batchNumber: z.string(),
      manufacturingDate: z.string().describe("YYYY-MM-DD"),
      expiryDate: z.string().describe("YYYY-MM-DD"),
      status: statusSchema,
    }),
  }),

  createStudyType: tool({
    description: "Create a stability study type (Accelerated, Long Term, etc.).",
    inputSchema: z.object({
      name: z.string(),
      code: z.string().describe("Short unique code, e.g. ACC"),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
      status: statusSchema,
    }),
  }),

  createStorageCondition: tool({
    description: "Create a storage condition (temperature / RH).",
    inputSchema: z.object({
      name: z.string(),
      temperature: z.string().describe("e.g. 25°C ± 2°C"),
      relativeHumidity: z.string().describe("e.g. 60% ± 5% RH"),
      displayLabel: z.string().optional(),
      status: statusSchema,
    }),
  }),

  createPullPoint: tool({
    description: "Create a pull-point master (3M, 6M, 12M, etc.).",
    inputSchema: z.object({
      code: z.string().describe("e.g. 3M"),
      label: z.string().describe("e.g. 3 Months"),
      months: z.number(),
      sortOrder: z.number().optional(),
      studyTypeNames: z.array(z.string()).optional().describe("Limit to these study types; omit for all."),
      status: statusSchema,
    }),
  }),

  createChamber: tool({
    description: "Create a stability chamber.",
    inputSchema: z.object({
      chamberId: z.string().describe("Business ID, e.g. CH-001"),
      chamberName: z.string(),
      chamberType: z.string().optional().describe("Walk-in / Reach-in / Photostability"),
      temperature: z.string(),
      relativeHumidity: z.string(),
      capacity: z.number(),
      location: z.string().describe("Physical location"),
      status: z.enum(["Active", "Under Maintenance", "Inactive"]).optional(),
    }),
  }),

  createLocation: tool({
    description: "Create a rack/shelf/position slot inside a chamber.",
    inputSchema: z.object({
      chamber: z.string().describe("Chamber name or chamber ID"),
      rack: z.string(),
      shelf: z.string(),
      position: z.string(),
      status: statusSchema,
    }),
  }),

  createUnit: tool({
    description: "Create a quantity unit (Bottle, Tablet, Vial).",
    inputSchema: z.object({
      name: z.string(),
      abbreviation: z.string(),
      status: statusSchema,
    }),
  }),

  chargeStudy: tool({
    description:
      "Create a stability study and charge samples into a chamber. Resolve masters with listCatalog first if names might not be unique.",
    inputSchema: z.object({
      productName: z.string(),
      batchNumber: z.string(),
      studyType: z.string().describe("Study type name or code"),
      storageCondition: z.string().describe("Condition name or display label"),
      chamber: z.string().describe("Chamber name or chamber ID"),
      rack: z.string(),
      shelf: z.string(),
      position: z.string(),
      totalQuantity: z.number(),
      reservedQuantity: z.number().optional(),
      unit: z.string().describe("Unit name or abbreviation"),
      chargingDate: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      notes: z.string().optional(),
      pullAllocations: z
        .array(z.object({ code: z.string(), quantity: z.number() }))
        .describe("Quantities per pull-point code, e.g. [{code:'3M', quantity:10}]"),
    }),
  }),

  withdrawSample: tool({
    description: "Withdraw samples for a due pull point.",
    inputSchema: z.object({
      pullPointDocId: z.string().optional().describe("studyPullPoints document id from listCatalog duePulls"),
      sampleId: z.string().optional(),
      productName: z.string().optional(),
      batchNumber: z.string().optional(),
      pullPoint: z.string().optional().describe("Pull code or label, e.g. 3M"),
      actualQuantity: z.number(),
      withdrawalDate: z.string().optional().describe("YYYY-MM-DD"),
      receivedBy: z.string().optional(),
      remarks: z.string().optional(),
    }),
  }),

  moveSample: tool({
    description: "Move a sample to another chamber location.",
    inputSchema: z.object({
      sampleId: z.string(),
      toChamber: z.string().describe("Destination chamber name or ID"),
      rack: z.string(),
      shelf: z.string(),
      position: z.string(),
      reason: z.string(),
      movementDate: z.string().optional().describe("YYYY-MM-DD"),
      remarks: z.string().optional(),
    }),
  }),

  disposeSample: tool({
    description: "Dispose available sample quantity.",
    inputSchema: z.object({
      sampleId: z.string(),
      quantity: z.number(),
      reason: z.enum(["Study Completed", "Expired", "Damaged", "Excess Sample", "Other"]),
      disposalDate: z.string().optional().describe("YYYY-MM-DD"),
      remarks: z.string().optional(),
    }),
  }),

  reconcileSample: tool({
    description: "Record a physical count. Set adjust=true to change system quantity.",
    inputSchema: z.object({
      sampleId: z.string(),
      physicalQuantity: z.number(),
      adjust: z.boolean().optional(),
      reason: z.string().optional(),
      remarks: z.string().optional(),
    }),
  }),

  acknowledgeAlert: tool({
    description: "Mark a QA alert as acknowledged.",
    inputSchema: z.object({
      title: z.string().describe("Alert title or unique fragment"),
    }),
  }),
};

export type SkymapTools = typeof skymapTools;
export const SKYMAP_TOOL_NAMES = Object.keys(skymapTools);
