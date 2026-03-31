"use client";

import type { Automation } from "@agency/backend";
import { Bot, PauseCircle, PhoneCall, PlayCircle, RadioTower, Sparkles } from "lucide-react";
import { useState } from "react";
import { useVoiceAutomationCenter } from "@/lib/hooks";
import { Badge, Button, Card, Input } from "@/components/ui";

export function AutomationsPage({ automations }: { automations: Automation[] }) {
  const { data, loading, refresh } = useVoiceAutomationCenter();
  const [agentName, setAgentName] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [flowName, setFlowName] = useState("");
  const [objective, setObjective] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [automationId, setAutomationId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [contactId, setContactId] = useState("");
  const [toNumber, setToNumber] = useState("");

  async function createAgent() {
    if (!agentName.trim()) return;
    await fetch("/api/voice/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agentName,
        fromNumber
      })
    });
    setAgentName("");
    setFromNumber("");
    await refresh();
  }

  async function createFlow() {
    if (!flowName.trim() || !objective.trim() || !promptTemplate.trim()) return;
    await fetch("/api/voice/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: flowName,
        objective,
        promptTemplate,
        automationId: automationId || undefined,
        status: "active"
      })
    });
    setFlowName("");
    setObjective("");
    setPromptTemplate("");
    setAutomationId("");
    await refresh();
  }

  async function triggerCall() {
    if (!agentId || !flowId || !toNumber.trim()) return;
    await fetch("/api/voice/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        flowId,
        contactId: contactId || undefined,
        automationId: automationId || undefined,
        toNumber
      })
    });
    setContactId("");
    setToNumber("");
    await refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="font-display text-3xl text-slate-950">Automations</div>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Workflow cards, plus Twilio-powered call bots that you can attach to automations and trigger from this same control room.
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        {automations.map((automation) => (
          <Card key={automation.id} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />
            <div className="mb-4 flex items-start justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-3xl bg-indigo-50 text-indigo-600">
                <Bot className="h-5 w-5" />
              </div>
              <Badge className={automation.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}>
                {automation.status}
              </Badge>
            </div>
            <div className="font-display text-2xl text-slate-950">{automation.name}</div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{automation.description}</p>
            <div className="mt-6 space-y-3 rounded-[28px] bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-3">{automation.status === "active" ? <PlayCircle className="h-4 w-4 text-emerald-600" /> : <PauseCircle className="h-4 w-4 text-amber-600" />} Trigger: {automation.trigger_type}</div>
              <div className="flex items-center gap-3"><Bot className="h-4 w-4 text-indigo-600" /> Action: {automation.action_type}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-display text-2xl text-slate-950">Call bot control</div>
                <p className="mt-1 text-sm text-slate-500">Twilio-backed outbound voice bots linked to your automations.</p>
              </div>
              <Badge className={data?.configured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-700"}>
                {data?.configured ? "Twilio connected" : "Twilio env missing"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-100 p-4">
                <div className="text-sm text-slate-500">Agents</div>
                <div className="mt-3 font-display text-4xl text-slate-950">{data?.agents.length ?? 0}</div>
              </div>
              <div className="rounded-3xl border border-slate-100 p-4">
                <div className="text-sm text-slate-500">Flows</div>
                <div className="mt-3 font-display text-4xl text-slate-950">{data?.flows.length ?? 0}</div>
              </div>
              <div className="rounded-3xl border border-slate-100 p-4">
                <div className="text-sm text-slate-500">Call jobs</div>
                <div className="mt-3 font-display text-4xl text-slate-950">{data?.jobs.length ?? 0}</div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="font-display text-2xl text-slate-950">Recent call jobs</div>
            {loading ? (
              <div className="text-sm text-slate-500">Loading voice automations...</div>
            ) : (
              (data?.jobs ?? []).map((job) => (
                <div key={job.id} className="rounded-3xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-950">{(job as any).contact?.full_name ?? job.to_number}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {(job as any).flow?.name ?? job.flow_id} · {(job as any).agent?.name ?? job.agent_id}
                      </div>
                    </div>
                    <Badge>{job.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                    <div>Outcome: {job.outcome ?? "pending"}</div>
                    <div>Phone: {job.to_number}</div>
                    <div>Twilio SID: {job.twilio_call_sid ?? "pending"}</div>
                  </div>
                </div>
              ))
            )}
          </Card>

          <Card className="space-y-4">
            <div className="font-display text-2xl text-slate-950">Active call flows</div>
            {(data?.flows ?? []).map((flow) => (
              <div key={flow.id} className="rounded-3xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-950">{flow.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{flow.objective}</div>
                  </div>
                  <Badge>{flow.status}</Badge>
                </div>
                <div className="mt-3 text-sm text-slate-600">{flow.prompt_template}</div>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3">
            <div className="flex items-center gap-2 font-display text-2xl text-slate-950">
              <RadioTower className="h-5 w-5" />
              Create agent
            </div>
            <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Collections bot" />
            <Input value={fromNumber} onChange={(event) => setFromNumber(event.target.value)} placeholder="+15005550006" />
            <Button onClick={createAgent}>Save agent</Button>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 font-display text-2xl text-slate-950">
              <Sparkles className="h-5 w-5" />
              Create call flow
            </div>
            <Input value={flowName} onChange={(event) => setFlowName(event.target.value)} placeholder="Appointment confirmation" />
            <Input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Confirm tomorrow's appointment" />
            <Input value={promptTemplate} onChange={(event) => setPromptTemplate(event.target.value)} placeholder="Hello, this is Agency Hub calling to confirm your appointment. Press 1 to confirm, 2 if you need a callback, or 3 if you're not interested." />
            <select value={automationId} onChange={(event) => setAutomationId(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none">
              <option value="">Link to automation later</option>
              {(data?.automations ?? []).map((automation) => (
                <option key={automation.id} value={automation.id}>
                  {automation.name}
                </option>
              ))}
            </select>
            <Button onClick={createFlow}>Save flow</Button>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2 font-display text-2xl text-slate-950">
              <PhoneCall className="h-5 w-5" />
              Trigger test call
            </div>
            <select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none">
              <option value="">Select agent</option>
              {(data?.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            <select value={flowId} onChange={(event) => setFlowId(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none">
              <option value="">Select flow</option>
              {(data?.flows ?? []).map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <select value={contactId} onChange={(event) => {
              const selected = event.target.value;
              setContactId(selected);
              const contact = (data?.contacts ?? []).find((item) => item.id === selected);
              if (contact?.phone) {
                setToNumber(contact.phone);
              }
            }} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none">
              <option value="">Optional contact</option>
              {(data?.contacts ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.full_name}
                </option>
              ))}
            </select>
            <Input value={toNumber} onChange={(event) => setToNumber(event.target.value)} placeholder="+5215512345678" />
            <Button onClick={triggerCall} disabled={!data?.configured}>Launch Twilio call</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
