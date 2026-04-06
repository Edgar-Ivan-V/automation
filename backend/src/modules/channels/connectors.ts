/**
 * FILE: src/modules/channels/connectors.ts
 *
 * Sistema de conectores para ejecutar jobs de canales en plataformas reales.
 * Implementa el patrón Strategy: cada canal puede tener un conector registrado
 * que sabe cómo llamar a la API de esa plataforma.
 *
 * Por defecto los jobs corren en "preview mode" (sin llamadas reales a APIs).
 * Cuando se registra un conector para un canal, los jobs de ese canal
 * se ejecutan de verdad a través del conector.
 *
 * Cómo agregar un conector (en server.ts al arrancar):
 *   registerChannelConnector("instagram", {
 *     async execute(job, flow) {
 *       // llamar Instagram Graph API con job.payload
 *       return { outcome: "published", summary: "...", resultPayload: { postId: "..." } };
 *     }
 *   });
 *
 * El resultado debe retornar un ChannelJobOutcome válido:
 *   published | sent | replied | lead_captured | scheduled | manual_review | unknown
 *
 * Exports:
 *   - ChannelConnector: interfaz que deben implementar los conectores
 *   - ConnectorResult: tipo del resultado de execute()
 *   - registerChannelConnector(channel, connector): registra un conector
 *   - getChannelConnector(channel): obtiene el conector o null si no hay
 */

import type { ChannelFlow, ChannelJob, ChannelJobOutcome, ChannelKind } from "./types.js";

export interface ConnectorResult {
  outcome: ChannelJobOutcome;
  summary: string;
  resultPayload: Record<string, unknown>;
}

/**
 * A ChannelConnector handles real execution for a specific channel platform.
 * Register one per channel using registerChannelConnector().
 *
 * Example (Instagram):
 *   registerChannelConnector("instagram", {
 *     async execute(job, flow) {
 *       const token = job.metadata?.accessToken;
 *       // call Instagram Graph API...
 *       return { outcome: "published", summary: "Posted to feed.", resultPayload: { postId: "..." } };
 *     }
 *   });
 */
export interface ChannelConnector {
  execute(job: ChannelJob, flow: ChannelFlow): Promise<ConnectorResult>;
}

const registry = new Map<string, ChannelConnector>();

export function registerChannelConnector(channel: ChannelKind, connector: ChannelConnector): void {
  registry.set(channel, connector);
}

export function getChannelConnector(channel: ChannelKind): ChannelConnector | null {
  return registry.get(channel) ?? null;
}
