import { z } from "zod";

const difficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);

export const typingResultSchema = z.object({
  body: z.object({
    typingTestId: z.string().min(1),
    difficulty: difficultyEnum,
    wpm: z.number().min(0).max(400),
    accuracy: z.number().min(0).max(100),
    errorCount: z.number().int().min(0),
    timeTaken: z.number().int().min(1).max(600),
    textLength: z.number().int().min(1).max(5000),
    isTournament: z.boolean().optional(),
    tournamentId: z.string().optional(),
    won: z.boolean().optional()
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional()
});

export const typingTextSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    difficulty: difficultyEnum
  }),
  params: z.object({}).optional()
});
