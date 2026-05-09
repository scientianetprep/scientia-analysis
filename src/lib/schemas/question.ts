import { z } from "zod";

export const QUESTION_IMAGE_POSITIONS = ["right", "top", "bottom", "inline"] as const;
export type QuestionImagePosition = (typeof QUESTION_IMAGE_POSITIONS)[number];

export const QuestionSchema = z.object({
  subject:        z.string().min(1, "Subject is required"),
  topic:          z.string().nullish(),
  chapter:        z.string().nullish(),
  tags:           z.array(z.string()).default([]),
  difficulty:     z.enum(["easy", "medium", "hard"]).default("medium"),
  bloom_level:    z.enum(["remember","understand","apply","analyze","evaluate","create"]).nullish(),
  text:           z.string().min(10, "Question text must be at least 10 characters"),
  option_a:       z.string().min(1, "Option A is required"),
  option_b:       z.string().min(1, "Option B is required"),
  option_c:       z.string().min(1, "Option C is required"),
  option_d:       z.string().min(1, "Option D is required"),
  correct:        z.enum(["A", "B", "C", "D"]),
  explanation:    z.string().nullish(),
  estimated_time: z.number().int().min(10).max(600).default(60),
  status:         z.enum(["draft","review","approved","retired"]).default("draft"),
  marks:          z.number().int().min(1).max(10).default(1),
  // Optional illustration / graph attached to the question. `image_url`
  // points at an object inside the public `question-images` bucket (see
  // `question_images_and_test_sections` migration). `image_position`
  // controls where the student session renders it.
  image_url:       z.string().url().nullable().optional(),
  image_position:  z.enum(QUESTION_IMAGE_POSITIONS).default("right"),
});

export type QuestionInput = z.infer<typeof QuestionSchema>;
