/**
 * FILE: src/modules/shared/validation.ts
 *
 * Funciones de validación y normalización de datos de entrada usadas
 * por todos los módulos de negocio (voice, channels).
 *
 * Se aplican en la capa de servicios para validar los campos del body
 * antes de persistirlos en la base de datos. Lanzan ValidationError
 * si el valor no cumple la restricción, lo que produce un 400.
 *
 * Exports:
 *   - requireNonEmptyString(value, field): garantiza string no vacío
 *   - optionalString(value, field): acepta null/vacío, retorna null
 *   - requireNumber(value, field): parsea y valida número
 */

import { ValidationError } from "./errors.js";

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
