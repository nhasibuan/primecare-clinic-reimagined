/**
 * Discriminated union Result type for explicit, type-safe error handling.
 *
 * Prefer returning `Result<T>` over throwing exceptions in pure business-logic
 * functions. Throw at the tRPC router boundary only after converting.
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) return err("Division by zero");
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (!result.ok) throw new Error(result.error);
 * console.log(result.value); // 5
 * ```
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E = string> = { readonly ok: false; readonly error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

/** Wraps a successful value in an Ok result. */
export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** Wraps an error in an Err result. */
export const err = <E = string>(error: E): Err<E> => ({ ok: false, error });

/**
 * Maps the value of a successful result, leaving errors unchanged.
 *
 * @example
 * const doubled = mapResult(ok(5), n => n * 2); // Ok<10>
 */
export function mapResult<T, U, E = string>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Extracts the value or throws using the provided factory.
 *
 * @example
 * const value = unwrapOrThrow(result, msg => new TRPCError({ code: "BAD_REQUEST", message: msg }));
 */
export function unwrapOrThrow<T, E = string>(
  result: Result<T, E>,
  toError: (error: E) => Error
): T {
  if (!result.ok) throw toError(result.error);
  return result.value;
}

/**
 * Wraps a potentially-throwing async function in a Result.
 * Useful at I/O boundaries to convert exceptions into typed errors.
 *
 * @example
 * const result = await tryCatch(() => fetch(url), (e) => String(e));
 */
export async function tryCatch<T, E = string>(
  fn: () => Promise<T>,
  mapError: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(mapError(error));
  }
}
