/**
 * @deprecated This file is a backwards-compatibility shim.
 *
 * The application router has been split into focused domain sub-routers.
 * Import from `./routers/index` (or the specific domain router file)
 * for new code.
 *
 * All existing imports and test mocks continue to work unchanged.
 */
export { appRouter } from "./routers/index";
export type { AppRouter } from "./routers/index";
