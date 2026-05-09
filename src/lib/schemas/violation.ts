import { z } from "zod";

export const ViolationEventSchema = z.object({
  session_id:     z.string().uuid(),
  violation_type: z.enum(["tab_switch","focus_loss","copy_attempt","fullscreen_exit","suspicious_activity"]),
  details:        z.record(z.string(), z.unknown()).optional(),
});

export type ViolationEventInput = z.infer<typeof ViolationEventSchema>;
