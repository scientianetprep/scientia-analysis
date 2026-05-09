import { z } from "zod";

export const AttemptSubmitSchema = z.object({
  session_id:  z.string().uuid(),
  answers:     z.record(z.string().uuid(), z.enum(["A","B","C","D"]).nullable()),
  time_taken:  z.number().int().min(0),
  status:      z.enum(["submitted", "timed_out", "auto_submitted"]).optional(),
});

export const AutoSaveSchema = z.object({
  session_id:  z.string().uuid(),
  question_id: z.string().uuid(),
  selected:    z.enum(["A","B","C","D"]).nullable(),
  is_flagged:  z.boolean().optional(),
  time_remaining_s: z.number().int().min(0).optional(),
});

export type AttemptSubmitInput = z.infer<typeof AttemptSubmitSchema>;
export type AutoSaveInput = z.infer<typeof AutoSaveSchema>;
