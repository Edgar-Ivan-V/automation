/**
 * FILE: src/modules/shared/errors.ts
 *
 * Clases de error personalizadas usadas en toda la aplicación.
 * El error handler central en server.ts las captura y las convierte
 * en respuestas HTTP con el código de estado apropiado:
 *   - ValidationError   → 400 Bad Request
 *   - NotFoundError     → 404 Not Found
 *   - UnauthorizedError → 401 Unauthorized
 *
 * Cualquier otro error no tipado cae en el handler genérico (500).
 */

export class ValidationError extends Error {}

export class NotFoundError extends Error {}

export class UnauthorizedError extends Error {}
