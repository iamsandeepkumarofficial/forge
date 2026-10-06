import { useEffect, useId, useMemo, useState } from "react";
import type { AskUserField, AskUserProposal } from "../lib/ask-user.js";
import {
  askUserFormReply,
  askUserInitialValues,
  askUserMcqReply,
  askUserOtherReply,
  askUserSkipReply,
  groupAskUserFields
} from "../lib/ask-user.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AskUserChrome } from "./ask-user-chrome.js";

export type AskUserSubmitResult = {
  text: string;
  values?: Record<string, string>;
};

const OTHER_ID = "__other__";

function isBooleanField(field: AskUserField): boolean {
  return field.type === "boolean";
}

function isSecretField(field: AskUserField): boolean {
  return field.type === "secret" || field.secret === true;
}

function fieldIsFilled(
  field: AskUserField,
  values: Record<string, string>
): boolean {
  if (isBooleanField(field)) {
    const v = values[field.id];
    return v === "true" || v === "false";
  }
  return (values[field.id] ?? "").trim().length > 0;
}

function McqOtherField(options: {
  otherText: string;
  submitting?: boolean;
  onChange: (next: string) => void;
  onSend: () => void;
}) {
  const { otherText, submitting, onChange, onSend } = options;
  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        aria-label="Other answer"
        value={otherText}
        disabled={submitting}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        disabled={submitting || !otherText.trim()}
        onClick={onSend}
      >
        Send
      </Button>
    </div>
  );
}

function AskUserMcq(options: {
  proposal: AskUserProposal;
  submitting?: boolean;
  onSubmit: (result: AskUserSubmitResult) => void;
}) {
  const { proposal, submitting, onSubmit } = options;
  const groupId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const optionIds = useMemo(
    () => [...proposal.options.map((o) => o.id), OTHER_ID],
    [proposal.options]
  );
  const submitSelected = (id: string) => {
    if (id === OTHER_ID) {
      const trimmed = otherText.trim();
      if (!trimmed) return;
      onSubmit({ text: askUserOtherReply(trimmed) });
      return;
    }
    const opt = proposal.options.find((o) => o.id === id);
    if (!opt) return;
    onSubmit({ text: askUserMcqReply(opt) });
  };
  const moveSelection = (delta: number) => {
    const current = selected ? optionIds.indexOf(selected) : -1;
    const next =
      current < 0
        ? delta > 0
          ? 0
          : optionIds.length - 1
        : (current + delta + optionIds.length) % optionIds.length;
    setSelected(optionIds[next] ?? null);
  };
  return (
    <AskUserChrome
      prompt={proposal.prompt}
      submitting={submitting}
      onSkip={() => onSubmit({ text: askUserSkipReply() })}
      onClose={() => onSubmit({ text: askUserSkipReply() })}
    >
      <McqChoices
        groupId={groupId}
        proposal={proposal}
        selected={selected}
        otherText={otherText}
        submitting={submitting}
        onMove={moveSelection}
        onPick={(id) => {
          setSelected(id);
          if (id !== OTHER_ID) submitSelected(id);
        }}
        onOtherText={setOtherText}
        onSendOther={() => submitSelected(OTHER_ID)}
      />
    </AskUserChrome>
  );
}

function McqChoices(options: {
  groupId: string;
  proposal: AskUserProposal;
  selected: string | null;
  otherText: string;
  submitting?: boolean;
  onMove: (delta: number) => void;
  onPick: (id: string) => void;
  onOtherText: (next: string) => void;
  onSendOther: () => void;
}) {
  const {
    groupId,
    proposal,
    selected,
    otherText,
    submitting,
    onMove,
    onPick,
    onOtherText,
    onSendOther
  } = options;
  return (
    <div
      className="flex flex-col gap-1.5 px-3 pb-3"
      role="radiogroup"
      aria-labelledby={groupId}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          onMove(1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          onMove(-1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (selected === OTHER_ID) onSendOther();
          else if (selected) onPick(selected);
        }
      }}
    >
      <span id={groupId} className="sr-only">
        Choose an option
      </span>
      {proposal.options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={selected === opt.id}
          disabled={submitting}
          className="w-full rounded-md border border-border px-2.5 py-1.5 text-left font-medium text-foreground hover:bg-muted disabled:opacity-40 aria-checked:border-foreground"
          onClick={() => onPick(opt.id)}
        >
          {opt.label}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={selected === OTHER_ID}
        disabled={submitting}
        className="w-full rounded-md border border-border px-2.5 py-1.5 text-left font-medium text-foreground hover:bg-muted disabled:opacity-40 aria-checked:border-foreground"
        onClick={() => onPick(OTHER_ID)}
      >
        Other
      </button>
      {selected === OTHER_ID ? (
        <McqOtherField
          otherText={otherText}
          submitting={submitting}
          onChange={onOtherText}
          onSend={onSendOther}
        />
      ) : null}
    </div>
  );
}

function FormFieldControl(options: {
  field: AskUserField;
  value: string;
  submitting?: boolean;
  onChange: (next: string) => void;
}) {
  const { field, value, submitting, onChange } = options;
  if (isBooleanField(field)) {
    return (
      <div className="flex gap-1.5" role="group" aria-label={field.label}>
        <Button
          type="button"
          size="sm"
          variant={value === "true" ? "default" : "outline"}
          aria-pressed={value === "true"}
          disabled={submitting}
          onClick={() => onChange("true")}
        >
          Yes
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === "false" ? "default" : "outline"}
          aria-pressed={value === "false"}
          disabled={submitting}
          onClick={() => onChange("false")}
        >
          No
        </Button>
      </div>
    );
  }
  return (
    <Input
      type={isSecretField(field) ? "password" : "text"}
      aria-label={field.label}
      placeholder={field.placeholder}
      value={value}
      disabled={submitting}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function initAskUserFormValues(fields: AskUserField[]): Record<string, string> {
  const init = askUserInitialValues(fields);
  for (const field of fields) {
    if (
      isBooleanField(field) &&
      init[field.id] !== "true" &&
      init[field.id] !== "false"
    ) {
      init[field.id] = field.value === "true" ? "true" : "false";
    }
  }
  return init;
}

function AskUserFormSections(options: {
  fields: AskUserField[];
  values: Record<string, string>;
  submitting?: boolean;
  onChange: (fieldId: string, next: string) => void;
}) {
  const { fields, values, submitting, onChange } = options;
  const sections = groupAskUserFields(fields);
  return (
    <div className="max-h-72 overflow-y-auto px-3 py-2">
      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <div
            key={section.group ?? "__ungrouped"}
            className="flex flex-col gap-2"
          >
            {section.group ? (
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {section.group}
              </p>
            ) : null}
            {section.fields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <span className="font-medium text-foreground">
                  {field.label}
                </span>
                {field.label !== field.id ? (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {field.id}
                  </span>
                ) : null}
                <FormFieldControl
                  field={field}
                  value={values[field.id] ?? ""}
                  submitting={submitting}
                  onChange={(next) => onChange(field.id, next)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AskUserForm(options: {
  proposal: AskUserProposal;
  submitting?: boolean;
  onSubmit: (result: AskUserSubmitResult) => void;
}) {
  const { proposal, submitting, onSubmit } = options;
  const [values, setValues] = useState(() =>
    initAskUserFormValues(proposal.fields)
  );
  const canSubmit =
    !submitting && proposal.fields.every((f) => fieldIsFilled(f, values));
  return (
    <AskUserChrome
      prompt={proposal.prompt}
      submitting={submitting}
      onSkip={() => onSubmit({ text: askUserSkipReply() })}
      onClose={() => onSubmit({ text: askUserSkipReply() })}
    >
      <AskUserFormSections
        fields={proposal.fields}
        values={values}
        submitting={submitting}
        onChange={(fieldId, next) =>
          setValues((prev) => ({ ...prev, [fieldId]: next }))
        }
      />
      <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
        <Button
          type="button"
          className="ml-auto"
          size="sm"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              text: askUserFormReply({ fields: proposal.fields, values }),
              values
            })
          }
        >
          {submitting ? "Saving…" : "Submit"}
        </Button>
      </div>
    </AskUserChrome>
  );
}

export function AskUserPrompt(options: {
  proposal: AskUserProposal;
  onSubmit: (result: AskUserSubmitResult) => void;
  submitting?: boolean;
}) {
  const { proposal, onSubmit, submitting } = options;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSubmit({ text: askUserSkipReply() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSubmit]);

  if (proposal.kind === "mcq") {
    return (
      <AskUserMcq
        proposal={proposal}
        submitting={submitting}
        onSubmit={onSubmit}
      />
    );
  }
  return (
    <AskUserForm
      proposal={proposal}
      submitting={submitting}
      onSubmit={onSubmit}
    />
  );
}
