import { z } from "zod";

/**
 * Public "request access" form on the landing page. `website` is a honeypot: the form hides it
 * from people, so a filled value means a bot, and the route then drops the request silently.
 */
export const accessRequestSubmitSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).email(),
  reason: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(),
});

/** Operator decision on one request. Approving issues an API key with these spending limits. */
export const accessRequestDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    dailyUsageLimitUsd: z.number().positive().max(10_000).default(1),
    weeklyUsageLimitUsd: z.number().positive().max(10_000).default(5),
  }),
  z.object({ action: z.literal("reject") }),
]);

export type AccessRequestSubmitInput = z.infer<typeof accessRequestSubmitSchema>;
export type AccessRequestDecisionInput = z.infer<typeof accessRequestDecisionSchema>;
