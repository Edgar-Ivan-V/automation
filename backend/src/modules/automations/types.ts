export type AutomationStatus = "draft" | "active" | "paused";

export interface Automation {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  status: AutomationStatus;
  description: string | null;
  runs_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationInput {
  organizationId: string;
  name: string;
  trigger_type: string;
  action_type: string;
  description?: string | null;
  status?: AutomationStatus;
}

export interface UpdateAutomationInput {
  name?: string;
  trigger_type?: string;
  action_type?: string;
  description?: string | null;
  status?: AutomationStatus;
}
