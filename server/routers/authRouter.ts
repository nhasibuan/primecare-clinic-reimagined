/**
 * Auth domain router.
 *
 * Handles session inspection and logout.  Both procedures are public so
 * unauthenticated users can check their state and clear stale sessions.
 */

import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";

export const authRouter = router({
  /** Returns the currently authenticated user, or null for anonymous. */
  me: publicProcedure.query((opts) => opts.ctx.user),

  /** Clears the session cookie and ends the user session. */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
