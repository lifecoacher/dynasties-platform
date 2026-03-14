export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export class ValidationError extends AppError {
  public readonly errors: unknown[];

  constructor(message: string, errors: unknown[] = []) {
    super(message, 400);
    this.name = "ValidationError";
    this.errors = errors;
  }
}

export class AgentOutputError extends AppError {
  public readonly agentName: string;
  public readonly rawOutput: unknown;

  constructor(
    agentName: string,
    message: string,
    rawOutput: unknown,
  ) {
    super(message, 422);
    this.name = "AgentOutputError";
    this.agentName = agentName;
    this.rawOutput = rawOutput;
  }
}
