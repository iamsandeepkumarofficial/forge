import { useMemo, useState } from "react";
import type { PlanCardSchemaNode, PlanCardTask } from "./plan-card.js";
import {
  defaultValueFor,
  isFlatSchema,
  schemaJsonSeed
} from "./human-output-seed.js";

const NESTED_JSON_ROWS = 5;
const PLAIN_JSON_ROWS = 4;

export { schemaJsonSeed } from "./human-output-seed.js";

function StopDecisionButtons(props: {
  submitting: boolean;
  onReject: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <button
        type="button"
        disabled={props.submitting}
        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        onClick={props.onReject}
      >
        Reject
      </button>
      <button
        type="button"
        disabled={props.submitting}
        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        onClick={props.onSkip}
      >
        Skip
      </button>
    </>
  );
}

function JsonAnswerForm(props: {
  schema: PlanCardSchemaNode | undefined;
  jsonDraft: string;
  error: string | null;
  submitting: boolean;
  onDraft: (value: string) => void;
  onSubmit: (payload: unknown) => void;
  onInvalid: () => void;
  onReject: () => void;
  onSkip: () => void;
}) {
  const nested = props.schema?.type === "object";
  return (
    <form
      className="mt-2 space-y-2 rounded-md border border-border bg-background p-2"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          props.onSubmit(JSON.parse(props.jsonDraft) as unknown);
        } catch {
          props.onInvalid();
        }
      }}
    >
      <label className="block text-xs text-muted-foreground">
        {nested ? "Nested response JSON" : "Response JSON"}
        <textarea
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-xs"
          rows={nested ? NESTED_JSON_ROWS : PLAIN_JSON_ROWS}
          value={props.jsonDraft}
          onChange={(e) => props.onDraft(e.target.value)}
        />
      </label>
      {props.error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{props.error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.submitting}
          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Submit
        </button>
        <StopDecisionButtons
          submitting={props.submitting}
          onReject={props.onReject}
          onSkip={props.onSkip}
        />
      </div>
    </form>
  );
}

function SchemaField(props: {
  fieldKey: string;
  node: PlanCardSchemaNode;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = props.node.description || props.fieldKey;
  if (props.node.enum) {
    return (
      <EnumField
        label={label}
        options={props.node.enum}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }
  if (props.node.type === "boolean") {
    return (
      <BooleanField
        label={label}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }
  if (props.node.type === "number" || props.node.type === "integer") {
    return (
      <NumberField
        label={label}
        integer={props.node.type === "integer"}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type="text"
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        value={String(props.value ?? "")}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function EnumField(props: {
  label: string;
  options: Array<string | number | boolean | null>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {props.label}
      <select
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        value={String(props.value ?? "")}
        onChange={(e) => {
          const raw = e.target.value;
          props.onChange(props.options.find((v) => String(v) === raw));
        }}
      >
        {props.options.map((opt) => (
          <option key={String(opt)} value={String(opt)}>
            {String(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BooleanField(props: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const selected =
    props.value === true ? "true" : props.value === false ? "false" : "";
  return (
    <label className="block text-xs text-muted-foreground">
      {props.label}
      <select
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        value={selected}
        onChange={(e) => {
          const raw = e.target.value;
          props.onChange(
            raw === "true" ? true : raw === "false" ? false : undefined
          );
        }}
      >
        <option value="">Choose</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

function NumberField(props: {
  label: string;
  integer: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {props.label}
      <input
        type="number"
        className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
        value={Number(props.value ?? 0)}
        onChange={(e) =>
          props.onChange(
            props.integer
              ? Number.parseInt(e.target.value || "0", 10)
              : Number(e.target.value || 0)
          )
        }
      />
    </label>
  );
}

type HumanAnswer = {
  decision: "approve" | "reject" | "skip";
  payload?: unknown;
};

async function sendHumanAnswer(opts: {
  answer: HumanAnswer;
  onSubmit: (answer: HumanAnswer) => void | Promise<void>;
  setSubmitting: (value: boolean) => void;
  setError: (value: string | null) => void;
}): Promise<void> {
  opts.setSubmitting(true);
  opts.setError(null);
  try {
    await opts.onSubmit(opts.answer);
  } catch (err) {
    opts.setError(err instanceof Error ? err.message : String(err));
  } finally {
    opts.setSubmitting(false);
  }
}

function missingRequiredBoolean(opts: {
  entries: Array<[string, PlanCardSchemaNode]>;
  required: string[] | undefined;
  values: Record<string, unknown>;
}): string | null {
  for (const [key, node] of opts.entries) {
    if (node.type !== "boolean") continue;
    if (!(opts.required ?? []).includes(key)) continue;
    if (typeof opts.values[key] !== "boolean") return key;
  }
  return null;
}

export function HumanOutputForm(props: {
  task: PlanCardTask;
  onSubmit: (answer: {
    decision: "approve" | "reject" | "skip";
    payload?: unknown;
  }) => void | Promise<void>;
}) {
  const schema = props.task.outputSchema;
  const properties = schema?.properties;
  const entries = useMemo(() => Object.entries(properties ?? {}), [properties]);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(schema?.properties ?? {})) {
      init[key] = defaultValueFor(node);
    }
    return init;
  });
  const [jsonDraft, setJsonDraft] = useState(() => schemaJsonSeed(schema));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const flat = isFlatSchema({ schema, entries });
  const submit = (answer: HumanAnswer) =>
    sendHumanAnswer({
      answer,
      onSubmit: props.onSubmit,
      setSubmitting,
      setError
    });

  if (!schema || schema.type !== "object" || !flat) {
    return (
      <JsonAnswerForm
        schema={schema}
        jsonDraft={jsonDraft}
        error={error}
        submitting={submitting}
        onDraft={setJsonDraft}
        onSubmit={(payload) => void submit({ decision: "approve", payload })}
        onInvalid={() => setError("Invalid JSON")}
        onReject={() => void submit({ decision: "reject" })}
        onSkip={() => void submit({ decision: "skip" })}
      />
    );
  }

  return (
    <FlatAnswerForm
      entries={entries}
      values={values}
      error={error}
      submitting={submitting}
      required={schema.required}
      onChange={(key, value) =>
        setValues((prev) => ({ ...prev, [key]: value }))
      }
      onError={setError}
      onApprove={() => void submit({ decision: "approve", payload: values })}
      onReject={() => void submit({ decision: "reject" })}
      onSkip={() => void submit({ decision: "skip" })}
    />
  );
}

function FlatAnswerForm(props: {
  entries: Array<[string, PlanCardSchemaNode]>;
  values: Record<string, unknown>;
  error: string | null;
  submitting: boolean;
  required?: string[];
  onChange: (key: string, value: unknown) => void;
  onError: (message: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSkip: () => void;
}) {
  return (
    <form
      className="mt-2 space-y-2 rounded-md border border-border bg-background p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const missing = missingRequiredBoolean({
          entries: props.entries,
          required: props.required,
          values: props.values
        });
        if (missing) {
          props.onError(`Choose yes or no for ${missing}`);
          return;
        }
        props.onApprove();
      }}
    >
      {props.entries.map(([key, node]) => (
        <SchemaField
          key={key}
          fieldKey={key}
          node={node}
          value={props.values[key]}
          onChange={(value) => props.onChange(key, value)}
        />
      ))}
      {props.error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{props.error}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={props.submitting}
          className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          Submit
        </button>
        <StopDecisionButtons
          submitting={props.submitting}
          onReject={props.onReject}
          onSkip={props.onSkip}
        />
      </div>
    </form>
  );
}
