import { ValidationError } from "./errors";

export function requireNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${field} is required.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string.`);
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function requireNumber(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed)) throw new ValidationError(`${field} must be a valid number.`);
  return parsed;
}
