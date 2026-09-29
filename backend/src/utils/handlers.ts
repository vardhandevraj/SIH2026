import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async route handler so rejected promises reach Express's error
 * middleware instead of becoming unhandled rejections.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
