import { z } from "zod";

const difficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);

export const createTypingTestSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(120),
    difficulty: difficultyEnum,
    text: z.string().min(20).max(3000),
    timeLimit: z.number().int().min(15).max(180),
    isActive: z.boolean().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

export const updateTypingTestSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(120).optional(),
    difficulty: difficultyEnum.optional(),
    text: z.string().min(20).max(3000).optional(),
    timeLimit: z.number().int().min(15).max(180).optional(),
    isActive: z.boolean().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().min(1)
  })
});

export const typingTestIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({
    id: z.string().min(1)
  })
});
