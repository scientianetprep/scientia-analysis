import { z } from "zod";

/**
 * One section of a multi-subject / full-length test. The section's
 * question_ids must be a subset of the parent test's aggregate
 * question_ids list — the admin form keeps these in sync automatically.
 */
export const TestSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  subject: z.string().min(1, "Subject is required"),
  question_ids: z.array(z.string().uuid()).min(1, "Section needs at least one question"),
});
export type TestSection = z.infer<typeof TestSectionSchema>;

// Every optional text field on this schema is mirrored to a nullable
// Postgres column. Supabase returns `null` for unset values, which the
// TestBuilder seeds straight into React state, and Zod's vanilla
// `.optional()` rejects `null` ("Expected string, received null"). The
// form has no visible per-field error next to the access-password or
// description inputs, so admins see only a generic "Fix validation
// errors" toast and — because they assume the schema matches the DB —
// blame whichever field they most recently touched.
//
// Widening these to `.nullable().optional()` lets us accept both DB
// reads and fresh "never set" undefineds symmetrically. The server
// writes null back to the DB when the admin clears the field.
export const TestConfigSchema = z.object({
  name:               z.string().min(3, "Test name must be at least 3 characters"),
  subject:            z.string().min(1, "Subject is required"),
  description:        z.string().nullable().optional(),
  instructions:       z.string().nullable().optional(),
  time_limit:         z.number().int().min(1).max(360),
  question_ids:       z.array(z.string().uuid()).min(1, "Select at least one question"),
  negative_marking:   z.number().min(0).max(2).default(0),
  shuffle_questions:  z.boolean().default(false),
  shuffle_options:    z.boolean().default(false),
  max_attempts:       z.number().int().min(1).max(100).nullable().optional(),
  pass_percentage:    z.number().min(0).max(100).default(50),
  is_published:       z.boolean().default(false),
  is_mock:            z.boolean().default(false),
  show_results:       z.boolean().default(true),
  show_explanations:  z.boolean().default(true),
  access_password:    z.string().nullable().optional(),
  scheduled_open:     z.string().datetime().optional().nullable(),
  scheduled_close:    z.string().datetime().optional().nullable(),
  // Multi-subject tests. When `is_full_length` is true the session UI
  // exposes Next Section / Prev Section navigation; otherwise the
  // sections array is ignored (and may be empty).
  is_full_length:     z.boolean().default(false),
  sections:           z.array(TestSectionSchema).default([]),
});

export type TestConfigInput = z.infer<typeof TestConfigSchema>;
