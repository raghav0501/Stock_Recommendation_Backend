/**
 * Creates a typed Error with statusCode and code properties.
 * Use this in service layer to produce consistent HTTP responses
 * without importing http-status-codes in every file.
 *
 * Usage:
 *   throw appError(404, 'NOT_FOUND', 'User not found');
 *   throw appError(403, 'INDICATOR_NOT_ENTITLED', `Not entitled to: ${ids.join(', ')}`);
 */
export function appError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = statusCode;
  err.code       = code;
  return err;
}