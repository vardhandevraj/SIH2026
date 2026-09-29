export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  invalidAddress: () => new AppError("Invalid Ethereum wallet address. Expected format: 0x followed by 40 hexadecimal characters.", 400, "INVALID_ADDRESS"),
  noTransactions: (address: string) => new AppError(`No transactions found for ${address} on Ethereum mainnet.`, 404, "NO_TRANSACTIONS"),
  apiUnavailable: (provider: string) => new AppError(`Blockchain data could not be retrieved from ${provider} right now. Try again or enable Demo Mode.`, 503, "API_UNAVAILABLE"),
  rateLimited: (provider: string) => new AppError(`${provider} rate limit reached. Please wait a moment and try again, or enable Demo Mode.`, 429, "RATE_LIMITED"),
  timeout: () => new AppError("The blockchain request timed out. Try again or enable Demo Mode.", 504, "TIMEOUT"),
  notFound: (what: string) => new AppError(`${what} not found.`, 404, "NOT_FOUND"),
  internal: (msg: string) => new AppError(msg, 500, "INTERNAL_ERROR"),
};
