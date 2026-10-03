/**
 * Application-specific error hierarchy.
 * Provides structured error types for consistent error handling
 * across client and server.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Base HTTP error class with status code.
 * Throw this from route handlers to send specific HTTP errors.
 */
export class HttpError extends AppError {
  constructor(statusCode: number, message: string) {
    super(message, `HTTP_${statusCode}`, statusCode);
    this.name = "HttpError";
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor(message = "Layanan basis data sedang tidak tersedia.") {
    super(message, "DB_UNAVAILABLE", 503);
    this.name = "DatabaseUnavailableError";
  }
}

export class ValidationError extends AppError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string | number) {
    super(
      id
        ? `${entity} dengan ID ${id} tidak ditemukan.`
        : `${entity} tidak ditemukan.`,
      "NOT_FOUND",
      404
    );
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterMs: number;

  constructor(
    message = "Terlalu banyak permintaan. Silakan coba lagi nanti.",
    retryAfterMs = 0
  ) {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

// Convenience constructors (backwards-compatible)
export const BadRequestError = (msg: string) => new HttpError(400, msg);
export const UnauthorizedError = (msg: string) => new HttpError(401, msg);
export const ForbiddenError = (msg: string) => new HttpError(403, msg);
