import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "./logger";

/**
 * Centralised API error handling and typed JSON responses.
 *
 * Every route wraps its body in `handleRoute`, so an unexpected throw becomes
 * a stable error envelope rather than a stack trace leaking to the client.
 */

export type ApiErrorCode =
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "verification_conflict"
  | "provider_unavailable"
  | "extraction_failed"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    /** Safe-to-surface hint shown in the UI. */
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, hint?: string) {
    return new ApiError("invalid_request", message, 400, hint);
  }
  static notFound(message = "Not found") {
    return new ApiError("not_found", message, 404);
  }
  static rateLimited(hint = "Too many requests. Wait a moment and try again.") {
    return new ApiError("rate_limited", "Rate limit exceeded", 429, hint);
  }
  static conflict(message: string, hint?: string) {
    return new ApiError("verification_conflict", message, 409, hint);
  }
  static providerUnavailable(message: string, hint?: string) {
    return new ApiError("provider_unavailable", message, 502, hint);
  }
}

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; hint?: string };
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonError(error: ApiError): NextResponse {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, hint: error.hint },
  };
  return NextResponse.json(body, { status: error.status });
}

/** Wrap a route handler so nothing escapes as an unhandled exception. */
export async function handleRoute(
  name: string,
  run: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError) {
      logger.warn("api.error", { route: name, code: error.code, message: error.message });
      return jsonError(error);
    }
    if (error instanceof z.ZodError) {
      logger.warn("api.validation_failed", { route: name, issues: error.issues.length });
      return jsonError(
        ApiError.badRequest(
          "Request did not match the expected shape.",
          error.issues[0]?.message ?? "Check the submitted fields.",
        ),
      );
    }
    logger.error("api.unhandled", {
      route: name,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError(
      new ApiError(
        "internal_error",
        "Something went wrong handling that request.",
        500,
        "Try again. If it keeps happening the server logs have the detail.",
      ),
    );
  }
}

/** Parse a JSON body against a schema, converting failures into ApiError. */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw ApiError.badRequest("Request body was not valid JSON.");
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw ApiError.badRequest(
      "Request did not match the expected shape.",
      result.error.issues[0]?.message ?? "Check the submitted fields.",
    );
  }
  return result.data;
}
