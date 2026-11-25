export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'ERROR',
    public details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
  static badRequest(m: string, details?: unknown) {
    return new AppError(400, m, 'BAD_REQUEST', details);
  }
  static unauthorized(m = 'Authentication required') {
    return new AppError(401, m, 'UNAUTHORIZED');
  }
  static forbidden(m = 'You do not have permission to perform this action') {
    return new AppError(403, m, 'FORBIDDEN');
  }
  static notFound(m = 'Resource not found') {
    return new AppError(404, m, 'NOT_FOUND');
  }
  static conflict(m: string) {
    return new AppError(409, m, 'CONFLICT');
  }
}
