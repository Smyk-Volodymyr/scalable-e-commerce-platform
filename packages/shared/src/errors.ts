export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, details);
export const unauthorized = (msg = "Не авторизовано") => new AppError(401, msg);
export const notFound = (msg = "Не знайдено") => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);

export function isPgError(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err
    && typeof (err as { code: unknown }).code === "string";
}
