import { supabaseAdmin } from "./supabase";
import { invokeLLM } from "./_core/llm";
import crypto from "crypto";

// ============================================
// Product Intelligence Service
// ============================================
// AI acts as ANALYZER only - no decisions
// All outputs are versioned (no overwrite)
// ============================================

// ============================================
// Types
// ============================================

export interface ProductIntelligenceInput {
  productId: string;
  tenantId: string;
  name: string;
  description?: string;
  imageUrls?: string[];
  price?: number;
  category?: string;
}

export interface AudienceProfile {
  primaryDemographic: string;
  ageRange: string;
  gender: "male" | "female" | "unisex";
  incomeLevel: "low" | "medium" | "high" | "premium";
  interests: string[];
  buyingBehavior: string;
}

export interface PainPoint {
  problem: string;
  severity: "low" | "medium" | "high";
  frequency: string;
}

export interface PriceSensitivity {
  level: "low" | "medium" | "high";
  priceRange: { min: number; max: number };
  elasticity: string;
  competitorComparison: string;
}

export interface UniqueSellingPoint {
  primary: string;
  secondary: string[];
  differentiators: string[];
}

export interface VisualStyle {
  dominantColors: string[];
  aesthetic: string;
  mood: string;
  targetPlatformFit: Record<string, number>; // platform -> fit score 0-100
}

export interface CompetitorInsight {
  name: string;
  priceRange: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
}

export interface ProductIntelligence {
  id: string;
  productId: string;
  tenantId: string;
  version: number;
  
  // Structured Analysis Output
  audience: AudienceProfile;
  painPoints: PainPoint[];
  priceSensitivity: PriceSensitivity;
  usp: UniqueSellingPoint;
  visualStyle: VisualStyle;
  keywords: {
    primary: string[];
    secondary: string[];
    longTail: string[];
    negative: string[];
  };
  competitors: CompetitorInsight[];
  
  // Metadata
  confidence: number; // 0-100
  analysisSource: "ai" | "manual" | "hybrid";
  inputHash: string; // Hash of inputs for change detection
  createdAt: string;
  createdBy?: string;
}

// ============================================
// Helper: Generate input hash for versioning
// ============================================
function generateInputHash(input: ProductIntelligenceInput): string {
  const normalized = JSON.stringify({
    name: input.name,
    description: input.description || "",
    imageUrls: (input.imageUrls || []).sort(),
    price: input.price,
    category: input.category,
  });
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ============================================
// Helper: Get latest version number
// ============================================
async function getLatestVersion(productId: string, tenantId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("product_intelligence")
    .select("version")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  return data?.version || 0;
}

// ============================================
// Helper: Check if analysis exists with same input
// ============================================
async function findExistingAnalysis(
  productId: string,
  tenantId: string,
  inputHash: string
): Promise<ProductIntelligence | null> {
  const { data } = await supabaseAdmin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .eq("input_hash", inputHash)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  return transformDbToIntelligence(data);
}

// ============================================
// Transform DB row to ProductIntelligence
// ============================================
function transformDbToIntelligence(row: any): ProductIntelligence {
  return {
    id: row.id,
    productId: row.product_id,
    tenantId: row.tenant_id,
    version: row.version,
    audience: row.audience,
    painPoints: row.pain_points,
    priceSensitivity: row.price_sensitivity,
    usp: row.usp,
    visualStyle: row.visual_style,
    keywords: row.keywords,
    competitors: row.competitors,
    confidence: row.confidence,
    analysisSource: row.analysis_source,
    inputHash: row.input_hash,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

// ============================================
// AI Analysis Prompt
// ============================================
function buildAnalysisPrompt(input: ProductIntelligenceInput): string {
  return `You are a product intelligence analyst. Analyze the following product and provide structured insights.

PRODUCT INFORMATION:
- Name: ${input.name}
- Description: ${input.description || "Not provided"}
- Price: ${input.price ? `${input.price} SAR` : "Not provided"}
- Category: ${input.category || "Not specified"}
- Images: ${input.imageUrls?.length || 0} image(s) provided

ANALYSIS REQUIREMENTS:
Provide a comprehensive analysis in the following JSON structure. Be specific and data-driven.

{
  "audience": {
    "primaryDemographic": "string - main target customer type",
    "ageRange": "string - e.g., '25-34'",
    "gender": "male|female|unisex",
    "incomeLevel": "low|medium|high|premium",
    "interests": ["array of relevant interests"],
    "buyingBehavior": "string - how they typically buy"
  },
  "painPoints": [
    {
      "problem": "string - specific problem this product solves",
      "severity": "low|medium|high",
      "frequency": "string - how often this problem occurs"
    }
  ],
  "priceSensitivity": {
    "level": "low|medium|high",
    "priceRange": { "min": number, "max": number },
    "elasticity": "string - how price changes affect demand",
    "competitorComparison": "string - how price compares to market"
  },
  "usp": {
    "primary": "string - main unique selling point",
    "secondary": ["array of secondary USPs"],
    "differentiators": ["what makes this different from competitors"]
  },
  "visualStyle": {
    "dominantColors": ["array of color names"],
    "aesthetic": "string - overall visual style",
    "mood": "string - emotional tone",
    "targetPlatformFit": {
      "instagram": 0-100,
      "facebook": 0-100,
      "tiktok": 0-100,
      "snapchat": 0-100,
      "google": 0-100
    }
  },
  "keywords": {
    "primary": ["5-10 main keywords"],
    "secondary": ["10-15 related keywords"],
    "longTail": ["5-10 long-tail phrases"],
    "negative": ["keywords to exclude in ads"]
  },
  "competitors": [
    {
      "name": "string - competitor name or type",
      "priceRange": "string - their price range",
      "strengths": ["their advantages"],
      "weaknesses": ["their disadvantages"],
      "marketPosition": "string - their market positioning"
    }
  ],
  "confidence": 0-100
}

IMPORTANT:
- Be specific to the Saudi/MENA market context
- Consider Arabic-speaking audience preferences
- Focus on actionable insights
- Confidence score reflects data quality and analysis certainty

Return ONLY valid JSON, no additional text.`;
}

// ============================================
// Main Analysis Function
// ============================================
export async function analyzeProduct(
  input: ProductIntelligenceInput,
  options?: { forceReanalyze?: boolean; createdBy?: string }
): Promise<ProductIntelligence> {
  const inputHash = generateInputHash(input);

  // Check for existing analysis with same inputs (unless forced)
  if (!options?.forceReanalyze) {
    const existing = await findExistingAnalysis(input.productId, input.tenantId, inputHash);
    if (existing) {
      return existing;
    }
  }

  // Build messages for LLM
  type MessageContent = 
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const messages: Array<{ role: "system" | "user"; content: string | MessageContent[] }> = [
    {
      role: "system",
      content: "You are a product intelligence analyst specializing in e-commerce and digital marketing for the MENA region. Provide structured, actionable insights.",
    },
  ];

  // Add images if available
  if (input.imageUrls && input.imageUrls.length > 0) {
    const content: MessageContent[] = [
      { type: "text" as const, text: buildAnalysisPrompt(input) },
    ];
    
    for (const url of input.imageUrls.slice(0, 4)) { // Max 4 images
      content.push({
        type: "image_url" as const,
        image_url: { url },
      });
    }
    
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: buildAnalysisPrompt(input) });
  }

  // Call LLM
  const response = await invokeLLM({
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "product_intelligence",
        strict: true,
        schema: {
          type: "object",
          properties: {
            audience: {
              type: "object",
              properties: {
                primaryDemographic: { type: "string" },
                ageRange: { type: "string" },
                gender: { type: "string", enum: ["male", "female", "unisex"] },
                incomeLevel: { type: "string", enum: ["low", "medium", "high", "premium"] },
                interests: { type: "array", items: { type: "string" } },
                buyingBehavior: { type: "string" },
              },
              required: ["primaryDemographic", "ageRange", "gender", "incomeLevel", "interests", "buyingBehavior"],
              additionalProperties: false,
            },
            painPoints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  problem: { type: "string" },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  frequency: { type: "string" },
                },
                required: ["problem", "severity", "frequency"],
                additionalProperties: false,
              },
            },
            priceSensitivity: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["low", "medium", "high"] },
                priceRange: {
                  type: "object",
                  properties: {
                    min: { type: "number" },
                    max: { type: "number" },
                  },
                  required: ["min", "max"],
                  additionalProperties: false,
                },
                elasticity: { type: "string" },
                competitorComparison: { type: "string" },
              },
              required: ["level", "priceRange", "elasticity", "competitorComparison"],
              additionalProperties: false,
            },
            usp: {
              type: "object",
              properties: {
                primary: { type: "string" },
                secondary: { type: "array", items: { type: "string" } },
                differentiators: { type: "array", items: { type: "string" } },
              },
              required: ["primary", "secondary", "differentiators"],
              additionalProperties: false,
            },
            visualStyle: {
              type: "object",
              properties: {
                dominantColors: { type: "array", items: { type: "string" } },
                aesthetic: { type: "string" },
                mood: { type: "string" },
                targetPlatformFit: {
                  type: "object",
                  properties: {
                    instagram: { type: "number" },
                    facebook: { type: "number" },
                    tiktok: { type: "number" },
                    snapchat: { type: "number" },
                    google: { type: "number" },
                  },
                  required: ["instagram", "facebook", "tiktok", "snapchat", "google"],
                  additionalProperties: false,
                },
              },
              required: ["dominantColors", "aesthetic", "mood", "targetPlatformFit"],
              additionalProperties: false,
            },
            keywords: {
              type: "object",
              properties: {
                primary: { type: "array", items: { type: "string" } },
                secondary: { type: "array", items: { type: "string" } },
                longTail: { type: "array", items: { type: "string" } },
                negative: { type: "array", items: { type: "string" } },
              },
              required: ["primary", "secondary", "longTail", "negative"],
              additionalProperties: false,
            },
            competitors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  priceRange: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                  marketPosition: { type: "string" },
                },
                required: ["name", "priceRange", "strengths", "weaknesses", "marketPosition"],
                additionalProperties: false,
              },
            },
            confidence: { type: "number" },
          },
          required: ["audience", "painPoints", "priceSensitivity", "usp", "visualStyle", "keywords", "competitors", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  // Parse response
  const analysisContent = response.choices[0]?.message?.content;
  if (!analysisContent) {
    throw new Error("No analysis content received from AI");
  }

  // Handle both string and array content types
  const contentString = typeof analysisContent === "string" 
    ? analysisContent 
    : JSON.stringify(analysisContent);
  const analysis = JSON.parse(contentString);

  // Get next version number
  const latestVersion = await getLatestVersion(input.productId, input.tenantId);
  const newVersion = latestVersion + 1;

  // Generate unique ID
  const id = `pi_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Save to database (versioned - never overwrite)
  const { error } = await supabaseAdmin.from("product_intelligence").insert({
    id,
    product_id: input.productId,
    tenant_id: input.tenantId,
    version: newVersion,
    audience: analysis.audience,
    pain_points: analysis.painPoints,
    price_sensitivity: analysis.priceSensitivity,
    usp: analysis.usp,
    visual_style: analysis.visualStyle,
    keywords: analysis.keywords,
    competitors: analysis.competitors,
    confidence: analysis.confidence,
    analysis_source: "ai",
    input_hash: inputHash,
    created_by: options?.createdBy,
    created_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save product intelligence: ${error.message}`);
  }

  // Create audit log
  await supabaseAdmin.from("audit_logs").insert({
    tenant_id: input.tenantId,
    event_type: "PRODUCT_INTELLIGENCE_CREATED",
    entity_type: "product_intelligence",
    entity_id: id,
    action: "analyze",
    new_value: {
      productId: input.productId,
      version: newVersion,
      confidence: analysis.confidence,
      inputHash,
    },
    created_at: new Date().toISOString(),
  });

  return {
    id,
    productId: input.productId,
    tenantId: input.tenantId,
    version: newVersion,
    audience: analysis.audience,
    painPoints: analysis.painPoints,
    priceSensitivity: analysis.priceSensitivity,
    usp: analysis.usp,
    visualStyle: analysis.visualStyle,
    keywords: analysis.keywords,
    competitors: analysis.competitors,
    confidence: analysis.confidence,
    analysisSource: "ai",
    inputHash,
    createdAt: new Date().toISOString(),
    createdBy: options?.createdBy,
  };
}

// ============================================
// Get Latest Intelligence for Product
// ============================================
export async function getProductIntelligence(
  productId: string,
  tenantId: string
): Promise<ProductIntelligence | null> {
  const { data, error } = await supabaseAdmin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return transformDbToIntelligence(data);
}

// ============================================
// Get Intelligence History for Product
// ============================================
export async function getProductIntelligenceHistory(
  productId: string,
  tenantId: string,
  limit: number = 10
): Promise<ProductIntelligence[]> {
  const { data, error } = await supabaseAdmin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .order("version", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(transformDbToIntelligence);
}

// ============================================
// Get Specific Version
// ============================================
export async function getProductIntelligenceVersion(
  productId: string,
  tenantId: string,
  version: number
): Promise<ProductIntelligence | null> {
  const { data, error } = await supabaseAdmin
    .from("product_intelligence")
    .select("*")
    .eq("product_id", productId)
    .eq("tenant_id", tenantId)
    .eq("version", version)
    .single();

  if (error || !data) return null;

  return transformDbToIntelligence(data);
}

// ============================================
// Compare Two Versions
// ============================================
export async function compareIntelligenceVersions(
  productId: string,
  tenantId: string,
  versionA: number,
  versionB: number
): Promise<{
  versionA: ProductIntelligence | null;
  versionB: ProductIntelligence | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}> {
  const [a, b] = await Promise.all([
    getProductIntelligenceVersion(productId, tenantId, versionA),
    getProductIntelligenceVersion(productId, tenantId, versionB),
  ]);

  const changes: Record<string, { before: unknown; after: unknown }> = {};

  if (a && b) {
    const fieldsToCompare = ["audience", "painPoints", "priceSensitivity", "usp", "visualStyle", "keywords", "competitors", "confidence"];
    
    for (const field of fieldsToCompare) {
      const valueA = (a as any)[field];
      const valueB = (b as any)[field];
      
      if (JSON.stringify(valueA) !== JSON.stringify(valueB)) {
        changes[field] = { before: valueA, after: valueB };
      }
    }
  }

  return { versionA: a, versionB: b, changes };
}

// ============================================
// Batch Analysis
// ============================================
export async function analyzeProductsBatch(
  products: ProductIntelligenceInput[],
  options?: { createdBy?: string }
): Promise<{ success: ProductIntelligence[]; failed: { productId: string; error: string }[] }> {
  const results: ProductIntelligence[] = [];
  const failed: { productId: string; error: string }[] = [];

  for (const product of products) {
    try {
      const intelligence = await analyzeProduct(product, options);
      results.push(intelligence);
    } catch (error) {
      failed.push({
        productId: product.productId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { success: results, failed };
}
