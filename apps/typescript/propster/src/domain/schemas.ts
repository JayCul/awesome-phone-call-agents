import { z } from "zod";
import { CURRENCIES, DEFAULT_CURRENCY } from "./money";

/**
 * Every boundary where untrusted data enters Propster is validated here:
 * user input, LLM output, and the structured result CALL-E extracts from the
 * phone conversation. Nothing downstream trusts a raw object.
 */

export const rentPeriodSchema = z.enum(["monthly", "yearly"]);

const trimmedString = z.string().trim();

/** Requirements as produced by the extractor (LLM or rule-based). */
export const propertySearchRequirementSchema = z.object({
  location: trimmedString.min(2).max(120),
  propertyType: trimmedString.min(2).max(60).optional(),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().int().min(0).max(20).optional(),
  minRent: z.number().min(0).max(10_000_000_000).optional(),
  maxRent: z.number().min(0).max(10_000_000_000).optional(),
  currency: z.enum(CURRENCIES).default(DEFAULT_CURRENCY),
  rentPeriod: rentPeriodSchema.default("yearly"),
  moveInDate: trimmedString.max(60).optional(),
  amenities: z.array(trimmedString.min(1).max(60)).max(30).default([]),
  additionalRequirements: z.array(trimmedString.min(1).max(200)).max(20).default([]),
});

export type ParsedRequirement = z.infer<typeof propertySearchRequirementSchema>;

/** POST /api/search body. */
export const searchRequestSchema = z
  .object({
    naturalLanguage: trimmedString.max(1500).optional(),
    structured: propertySearchRequirementSchema.partial().optional(),
  })
  .refine(
    (value) =>
      (value.naturalLanguage && value.naturalLanguage.length >= 3) ||
      (value.structured?.location && value.structured.location.length >= 2),
    { message: "Describe what you are looking for, or at least give a location." },
  );

export const verifyRequestSchema = z.object({
  searchId: z.string().min(1).max(80),
});

/**
 * The shape CALL-E is asked to extract from the conversation, and the shape we
 * re-validate on the way back in. Fields are optional because a real agent may
 * simply not answer a question — an unanswered question must stay `undefined`
 * rather than being invented.
 */
export const callVerificationResultSchema = z.object({
  reached_contact: z.boolean(),
  property_available: z.boolean().nullable(),
  current_rent: z.number().nullable().optional(),
  rent_period: z.enum(["monthly", "yearly"]).nullable().optional(),
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.number().int().min(0).max(20).nullable().optional(),
  service_charge: z.number().nullable().optional(),
  agency_fee: z.number().nullable().optional(),
  legal_fee: z.number().nullable().optional(),
  caution_fee: z.number().nullable().optional(),
  electricity_type: z.string().max(120).nullable().optional(),
  water_supply: z.string().max(120).nullable().optional(),
  parking_available: z.boolean().nullable().optional(),
  security_available: z.boolean().nullable().optional(),
  generator_available: z.boolean().nullable().optional(),
  internet_available: z.boolean().nullable().optional(),
  air_conditioning: z.boolean().nullable().optional(),
  furnished: z.boolean().nullable().optional(),
  pets_allowed: z.boolean().nullable().optional(),
  viewing_available: z.boolean().nullable().optional(),
  viewing_fee: z.number().nullable().optional(),
  earliest_move_in: z.string().max(120).nullable().optional(),
  agent_notes: z.string().max(2000).nullable().optional(),
});

export type CallVerificationResult = z.infer<typeof callVerificationResultSchema>;

/**
 * JSON Schema handed to CALL-E as `recipientResultSchema`. It mirrors
 * `callVerificationResultSchema` above; the Zod schema is the enforcement copy
 * and this is the instruction copy.
 */
export function buildCallResultJsonSchema(): Record<string, unknown> {
  const nullable = (type: string, extra: Record<string, unknown> = {}) => ({
    type: [type, "null"],
    ...extra,
  });

  return {
    type: "object",
    required: ["reached_contact", "property_available"],
    properties: {
      reached_contact: {
        type: "boolean",
        description: "True if a human actually answered and engaged with the questions.",
      },
      property_available: nullable("boolean", {
        description:
          "Is the advertised property still available to rent? null if the contact would not say.",
      }),
      current_rent: nullable("number", {
        description:
          "Current asking rent as a plain number in the listing's own currency, e.g. 1650 or 7500000. Do not convert currencies. null if not stated.",
      }),
      rent_period: {
        type: ["string", "null"],
        enum: ["monthly", "yearly", null],
        description: "Whether the quoted rent is per month or per year.",
      },
      bedrooms: nullable("integer", { description: "Confirmed number of bedrooms." }),
      bathrooms: nullable("integer", { description: "Confirmed number of bathrooms." }),
      service_charge: nullable("number", {
        description: "Service or maintenance charge, in the listing's currency.",
      }),
      agency_fee: nullable("number", {
        description: "Agency or letting fee, in the listing's currency.",
      }),
      legal_fee: nullable("number", {
        description: "Legal, contract or admin fee, in the listing's currency.",
      }),
      caution_fee: nullable("number", {
        description: "Refundable deposit or bond, in the listing's currency.",
      }),
      electricity_type: nullable("string", {
        description: "How electricity is billed, e.g. 'prepaid meter', 'postpaid', 'estate billing'.",
      }),
      water_supply: nullable("string", {
        description: "Water supply, e.g. 'mains', 'borehole', 'included in rent'.",
      }),
      parking_available: nullable("boolean", { description: "Is dedicated parking included?" }),
      security_available: nullable("boolean", { description: "Is there estate or on-site security?" }),
      generator_available: nullable("boolean", { description: "Is there a backup generator?" }),
      internet_available: nullable("boolean", { description: "Is fibre or broadband available?" }),
      air_conditioning: nullable("boolean", { description: "Are air conditioning units fitted?" }),
      furnished: nullable("boolean", { description: "Is the property furnished?" }),
      pets_allowed: nullable("boolean", { description: "Are pets permitted?" }),
      viewing_available: nullable("boolean", { description: "Can the property be viewed?" }),
      viewing_fee: nullable("number", {
        description: "Viewing or inspection fee, in the listing's currency. 0 if free.",
      }),
      earliest_move_in: nullable("string", {
        description: "Earliest move-in described in the contact's own words, e.g. 'immediately', 'mid October'.",
      }),
      agent_notes: nullable("string", {
        description: "Anything else material the contact said that the questions did not cover.",
      }),
    },
  };
}

/** Task-level roll-up CALL-E returns for the whole call. */
export function buildCallTaskJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["verification_completed"],
    properties: {
      verification_completed: {
        type: "boolean",
        description: "True if enough information was gathered to judge the listing.",
      },
      outcome_summary: {
        type: ["string", "null"],
        description: "One or two sentences summarising what the contact confirmed or denied.",
      },
    },
  };
}

/**
 * A listing someone submits through /try so they can watch Propster verify it
 * against their own phone.
 *
 * `agentPhone` must be E.164 and `consent` must be explicitly true: this object
 * results in a real telephone call, so the intent has to be unambiguous at the
 * boundary rather than inferred later.
 */
export const testPropertySchema = z.object({
  title: trimmedString.min(3).max(120),
  description: trimmedString.max(600).optional(),
  area: trimmedString.min(2).max(80),
  country: trimmedString.min(2).max(80).optional(),
  propertyType: trimmedString.min(2).max(40),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20).optional(),
  rent: z.number().min(1).max(10_000_000_000),
  currency: z.enum(CURRENCIES).default(DEFAULT_CURRENCY),
  rentPeriod: rentPeriodSchema,
  amenities: z.array(trimmedString.min(1).max(60)).max(20).default([]),
  agentName: trimmedString.min(2).max(80).optional(),
  /** E.164, e.g. +351912345678. */
  agentPhone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Enter the number in international format, starting with your country code."),
  /** Must be true. The submitter asserts the number is theirs. */
  consent: z.boolean(),
});

export type TestPropertyInput = z.infer<typeof testPropertySchema>;

