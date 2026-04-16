import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  RabbitMQConfig,
  RabbitMQOperation,
  RabbitMQQueueOptions,
  RabbitMQExchangeOptions,
  RabbitMQMessageProperties,
} from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface RabbitMQFormProps {
  config: RabbitMQConfig;
  onChange: (patch: Partial<RabbitMQConfig>) => void;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const sectionClass = "space-y-3 rounded-lg border border-border bg-secondary/40 px-3 py-3";

const OPERATIONS: { value: RabbitMQOperation; label: string; desc: string }[] = [
  { value: "consume",          label: "Consume",           desc: "Pull one message from a queue" },
  { value: "publish_queue",    label: "Publish → Queue",   desc: "Send message directly to a queue" },
  { value: "publish_exchange", label: "Publish → Exchange", desc: "Send message to an exchange with a routing key" },
];

const EXCHANGE_TYPES = ["direct", "fanout", "topic", "headers"] as const;

// ─── KV table (for headers / arguments) ──────────────────────────────────────

function KVTable({
  rows,
  onChange,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
}: {
  rows: Array<{ key: string; value: string }>;
  onChange: (rows: Array<{ key: string; value: string }>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}): React.ReactElement {
  const update = (idx: number, patch: Partial<{ key: string; value: string }>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { key: "", value: "" }]);

  return (
    <div className="space-y-1">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <Input
            type="text"
            className="flex-1"
            value={row.key}
            onChange={(e) => update(idx, { key: e.target.value })}
            placeholder={keyPlaceholder}
          />
          <TemplateInput
            wrapperClassName="relative flex-1"
            value={row.value}
            onChange={(v) => update(idx, { value: v })}
            placeholder={valuePlaceholder}
          />
          <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-red-400 shrink-0">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
      >
        <Plus size={12} /> Add row
      </button>
    </div>
  );
}

// ─── Checkbox helper ──────────────────────────────────────────────────────────

function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}): React.ReactElement {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 rounded accent-indigo-500 shrink-0"
      />
      <span className="text-xs text-foreground">
        {label}
        {hint && <span className="block text-[10px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

// ─── Queue options sub-section ────────────────────────────────────────────────

function QueueOptionsSection({
  options,
  onChange,
  assertQueue,
  onAssertChange,
}: {
  options: RabbitMQQueueOptions;
  onChange: (patch: Partial<RabbitMQQueueOptions>) => void;
  assertQueue: boolean;
  onAssertChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <div className={sectionClass}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Queue Options</p>

      <Checkbox
        label="Assert queue before use"
        checked={assertQueue}
        onChange={onAssertChange}
        hint="Declare the queue if it doesn't exist (safe to call repeatedly)"
      />

      {assertQueue && (
        <div className="space-y-2 pl-5">
          <Checkbox
            label="Durable"
            checked={options.durable ?? true}
            onChange={(v) => onChange({ durable: v })}
            hint="Queue survives broker restart"
          />
          <Checkbox
            label="Exclusive"
            checked={options.exclusive ?? false}
            onChange={(v) => onChange({ exclusive: v })}
            hint="Only this connection can use the queue"
          />
          <Checkbox
            label="Auto-delete"
            checked={options.autoDelete ?? false}
            onChange={(v) => onChange({ autoDelete: v })}
            hint="Queue is deleted when last consumer disconnects"
          />
          <div>
            <Label>Queue arguments</Label>
            <p className="text-[10px] text-muted-foreground mb-1">
              e.g. <code className="text-indigo-400">x-message-ttl</code> = 60000, <code className="text-indigo-400">x-dead-letter-exchange</code> = dlx
            </p>
            <KVTable
              rows={options.arguments ?? []}
              onChange={(arguments_) => onChange({ arguments: arguments_ })}
              keyPlaceholder="x-argument"
              valuePlaceholder="value"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exchange options sub-section ─────────────────────────────────────────────

function ExchangeOptionsSection({
  options,
  onChange,
  assertExchange,
  onAssertChange,
}: {
  options: RabbitMQExchangeOptions;
  onChange: (patch: Partial<RabbitMQExchangeOptions>) => void;
  assertExchange: boolean;
  onAssertChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <div className={sectionClass}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exchange Options</p>

      <div>
        <Label>Exchange type</Label>
        <select
          className={selectClass}
          value={options.type ?? "direct"}
          onChange={(e) => onChange({ type: e.target.value as RabbitMQExchangeOptions["type"] })}
        >
          {EXCHANGE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {options.type === "fanout" && "Broadcasts to all bound queues — routing key ignored"}
          {options.type === "topic" && "Routes by pattern matching (*, #) on routing key"}
          {options.type === "headers" && "Routes by message header attributes instead of routing key"}
          {(!options.type || options.type === "direct") && "Routes to queue whose binding key equals the routing key"}
        </p>
      </div>

      <Checkbox
        label="Assert exchange before use"
        checked={assertExchange}
        onChange={onAssertChange}
        hint="Declare the exchange if it doesn't exist"
      />

      {assertExchange && (
        <div className="space-y-2 pl-5">
          <Checkbox
            label="Durable"
            checked={options.durable ?? true}
            onChange={(v) => onChange({ durable: v })}
            hint="Exchange survives broker restart"
          />
          <Checkbox
            label="Auto-delete"
            checked={options.autoDelete ?? false}
            onChange={(v) => onChange({ autoDelete: v })}
            hint="Exchange is deleted when last queue un-binds"
          />
          <Checkbox
            label="Internal"
            checked={options.internal ?? false}
            onChange={(v) => onChange({ internal: v })}
            hint="Exchange cannot be directly published to by clients"
          />
          <div>
            <Label>Exchange arguments</Label>
            <KVTable
              rows={options.arguments ?? []}
              onChange={(arguments_) => onChange({ arguments: arguments_ })}
              keyPlaceholder="x-argument"
              valuePlaceholder="value"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Message properties sub-section ──────────────────────────────────────────

function MessagePropertiesSection({
  props,
  onChange,
}: {
  props: RabbitMQMessageProperties;
  onChange: (patch: Partial<RabbitMQMessageProperties>) => void;
}): React.ReactElement {
  return (
    <div className={sectionClass}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Message Properties</p>

      <Checkbox
        label="Persistent"
        checked={props.persistent ?? true}
        onChange={(v) => onChange({ persistent: v })}
        hint="Delivery mode 2 — message survives broker restart"
      />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Content-Type</Label>
          <Input
            type="text"
            value={props.contentType ?? ""}
            onChange={(e) => onChange({ contentType: e.target.value || undefined })}
            placeholder="application/json"
          />
        </div>
        <div>
          <Label>Content-Encoding</Label>
          <Input
            type="text"
            value={props.contentEncoding ?? ""}
            onChange={(e) => onChange({ contentEncoding: e.target.value || undefined })}
            placeholder="utf-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Priority (0–255)</Label>
          <Input
            type="number"
            min={0}
            max={255}
            value={props.priority ?? ""}
            onChange={(e) => onChange({ priority: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0"
          />
        </div>
        <div>
          <Label>Expiration (ms TTL)</Label>
          <Input
            type="text"
            value={props.expiration ?? ""}
            onChange={(e) => onChange({ expiration: e.target.value || undefined })}
            placeholder="60000"
          />
        </div>
      </div>

      <div>
        <Label>Correlation ID</Label>
        <TemplateInput
          value={props.correlationId ?? ""}
          onChange={(v) => onChange({ correlationId: v || undefined })}
          placeholder="{{input.requestId}}"
        />
      </div>

      <div>
        <Label>Reply-To</Label>
        <TemplateInput
          value={props.replyTo ?? ""}
          onChange={(v) => onChange({ replyTo: v || undefined })}
          placeholder="reply.queue.name"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Message ID</Label>
          <TemplateInput
            value={props.messageId ?? ""}
            onChange={(v) => onChange({ messageId: v || undefined })}
            placeholder="{{input.id}}"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Input
            type="text"
            value={props.type ?? ""}
            onChange={(e) => onChange({ type: e.target.value || undefined })}
            placeholder="order.created"
          />
        </div>
      </div>

      <div>
        <Label>App ID</Label>
        <Input
          type="text"
          value={props.appId ?? ""}
          onChange={(e) => onChange({ appId: e.target.value || undefined })}
          placeholder="my-workflow-app"
        />
      </div>

      <div>
        <Label>Headers</Label>
        <KVTable
          rows={props.headers ?? []}
          onChange={(headers) => onChange({ headers })}
          keyPlaceholder="x-header"
          valuePlaceholder="value"
        />
      </div>
    </div>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────────

export function RabbitMQForm({ config, onChange }: RabbitMQFormProps): React.ReactElement {
  const op = config.operation ?? "publish_queue";

  const queueOptions: RabbitMQQueueOptions = config.queueOptions ?? {};
  const exchangeOptions: RabbitMQExchangeOptions = config.exchangeOptions ?? {};
  const messageProperties: RabbitMQMessageProperties = config.messageProperties ?? {};

  const setQueueOptions = (patch: Partial<RabbitMQQueueOptions>) =>
    onChange({ queueOptions: { ...queueOptions, ...patch } });
  const setExchangeOptions = (patch: Partial<RabbitMQExchangeOptions>) =>
    onChange({ exchangeOptions: { ...exchangeOptions, ...patch } });
  const setMessageProperties = (patch: Partial<RabbitMQMessageProperties>) =>
    onChange({ messageProperties: { ...messageProperties, ...patch } });

  return (
    <div className="space-y-4">
      {/* ── Operation ─────────────────────────────────────────────────────── */}
      <div>
        <Label>Operation</Label>
        <div className="space-y-1">
          {OPERATIONS.map(({ value, label, desc }) => (
            <label key={value} className="flex items-start gap-2 cursor-pointer group">
              <input
                type="radio"
                name="rmq-operation"
                value={value}
                checked={op === value}
                onChange={() => onChange({ operation: value })}
                className="mt-0.5 accent-indigo-500 shrink-0"
              />
              <span className="text-xs">
                <span className="text-foreground font-medium">{label}</span>
                <span className="block text-[10px] text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-border" />

      {/* ── Connection ────────────────────────────────────────────────────── */}
      <div>
        <CredentialSelector
          kinds={["rabbitmq"]}
          value={config.credentialId}
          onChange={(id) => onChange({ credentialId: id, amqpUrl: id ? undefined : config.amqpUrl })}
          label="RabbitMQ Credential"
          placeholder="— Use inline AMQP URL —"
        />
        {!config.credentialId && (
          <div className="mt-2">
            <Label>AMQP URL</Label>
            <TemplateInput
              value={config.amqpUrl ?? ""}
              onChange={(v) => onChange({ amqpUrl: v || undefined })}
              placeholder="amqp://user:pass@localhost:5672/vhost"
            />
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* ── CONSUME ───────────────────────────────────────────────────────── */}
      {op === "consume" && (
        <>
          <div>
            <Label>Queue Name *</Label>
            <TemplateInput
              value={config.queueName ?? ""}
              onChange={(v) => onChange({ queueName: v })}
              placeholder="my.queue"
            />
          </div>

          <div className={sectionClass}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Consumer Options</p>
            <Checkbox
              label="Auto-acknowledge (noAck)"
              checked={config.noAck ?? false}
              onChange={(v) => onChange({ noAck: v })}
              hint="Messages acknowledged immediately without explicit ack — may lose messages on crash"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Prefetch count</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.prefetchCount ?? 1}
                  onChange={(e) => onChange({ prefetchCount: Number(e.target.value) || undefined })}
                  placeholder="1"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Max un-acked messages (QoS)</p>
              </div>
              <div>
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  min={1000}
                  value={config.timeoutMs ?? 30000}
                  onChange={(e) => onChange({ timeoutMs: Number(e.target.value) })}
                  placeholder="30000"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Wait up to N ms for a message</p>
              </div>
            </div>
            <div>
              <Label>Consumer tag (optional)</Label>
              <Input
                type="text"
                value={config.consumerTag ?? ""}
                onChange={(e) => onChange({ consumerTag: e.target.value || undefined })}
                placeholder="Auto-generated"
              />
            </div>
          </div>

          <QueueOptionsSection
            options={queueOptions}
            onChange={setQueueOptions}
            assertQueue={config.assertQueue ?? true}
            onAssertChange={(v) => onChange({ assertQueue: v })}
          />
        </>
      )}

      {/* ── PUBLISH TO QUEUE ──────────────────────────────────────────────── */}
      {op === "publish_queue" && (
        <>
          <div>
            <Label>Queue Name *</Label>
            <TemplateInput
              value={config.queueName ?? ""}
              onChange={(v) => onChange({ queueName: v })}
              placeholder="my.queue"
            />
          </div>

          <div>
            <Label>Message Body</Label>
            <TemplateTextarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.messageBody ?? ""}
              onChange={(v) => onChange({ messageBody: v })}
              placeholder={'{"event": "{{input.type}}", "data": {{input.payload}}}'}
            />
          </div>

          <QueueOptionsSection
            options={queueOptions}
            onChange={setQueueOptions}
            assertQueue={config.assertQueue ?? true}
            onAssertChange={(v) => onChange({ assertQueue: v })}
          />

          <MessagePropertiesSection
            props={messageProperties}
            onChange={setMessageProperties}
          />
        </>
      )}

      {/* ── PUBLISH TO EXCHANGE ───────────────────────────────────────────── */}
      {op === "publish_exchange" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Exchange Name *</Label>
              <TemplateInput
                value={config.exchangeName ?? ""}
                onChange={(v) => onChange({ exchangeName: v })}
                placeholder="my.exchange"
              />
            </div>
            <div>
              <Label>Routing Key</Label>
              <TemplateInput
                value={config.routingKey ?? ""}
                onChange={(v) => onChange({ routingKey: v })}
                placeholder="order.created"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Empty for fanout; pattern for topic (*, #)
              </p>
            </div>
          </div>

          <div>
            <Label>Message Body</Label>
            <TemplateTextarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
              value={config.messageBody ?? ""}
              onChange={(v) => onChange({ messageBody: v })}
              placeholder={'{"event": "{{input.type}}", "data": {{input.payload}}}'}
            />
          </div>

          <ExchangeOptionsSection
            options={exchangeOptions}
            onChange={setExchangeOptions}
            assertExchange={config.assertExchange ?? true}
            onAssertChange={(v) => onChange({ assertExchange: v })}
          />

          <MessagePropertiesSection
            props={messageProperties}
            onChange={setMessageProperties}
          />
        </>
      )}
    </div>
  );
}
