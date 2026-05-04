import pino from "pino";

export function createLogger(serviceName: string) {
  return pino({
    name: serviceName,
    level: process.env["LOG_LEVEL"] ?? "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
        "*.secret",
        "*.stripeCustomerId",
        "*.email",
        "*.refreshToken",
        "*.tokenEncrypted",
        "*.refreshTokenEncrypted",
      ],
      censor: "[REDACTED]",
    },
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}
