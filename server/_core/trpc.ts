import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter(opts) {
    const { shape, error } = opts;
    const isDev = process.env.NODE_ENV !== "production";
    
    return {
      ...shape,
      message: !isDev && error.code === "INTERNAL_SERVER_ERROR"
        ? "Internal Server Error"
        : shape.message,
      data: {
        ...shape.data,
        retryAfterMs: (error as any).retryAfterMs ?? (error.cause as any)?.retryAfterMs,
        stack: isDev ? error.stack : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      user: ctx.user, // Let TS infer user is NonNullable
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = protectedProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        user: ctx.user,
      },
    });
  }),
);
