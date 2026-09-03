import { useState } from "react";
import type { AskUserProposal } from "../lib/ask-user.js";
import {
  askUserFormReply,
  askUserInitialValues,
  askUserMcqReply
} from "../lib/ask-user.js";

export type AskUserSubmitResult = {
  text: string;
  values?: Record<string, string>;
};

export function AskUserPrompt(options: {
  proposal: AskUserProposal;
  onSubmit: (result: AskUserSubmitResult) => void;
  onDismiss: () => void;
  submitting?: boolean;
}) {
  const { proposal, onSubmit, onDismiss, submitting } = options;
  const [values, setValues] = useState<Record<string, string>>(() =>
    askUserInitialValues(proposal.fields)
  );

  const shell =
    "mx-auto w-full max-w-md rounded-lg border border-border bg-card text-xs shadow-sm";

  if (proposal.kind === "mcq") {
    return (
      <div
        className={`${shell} px-3 py-2`}
        role="group"
        aria-label="Agent question"
        data-testid="ask-user-prompt"
      >
        <p className="mb-2 text-muted-foreground">{proposal.prompt}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {proposal.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={submitting}
              className="rounded-md bg-foreground px-2.5 py-1 font-medium text-background disabled:opacity-40"
              onClick={() => onSubmit({ text: askUserMcqReply(opt) })}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            disabled={submitting}
            onClick={onDismiss}
            className="ml-auto rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const canSubmit =
    !submitting && proposal.fields.every((f) => (values[f.id] ?? "").trim());

  return (
    <div
      className={shell}
      role="group"
      aria-label="Agent question"
      data-testid="ask-user-prompt"
    >
      <p className="border-b border-border px-3 py-2 text-muted-foreground">
        {proposal.prompt}
      </p>
      <div className="max-h-56 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-2">
          {proposal.fields.map((field) => (
            <label key={field.id} className="flex flex-col gap-1">
              <span className="font-medium text-foreground">{field.label}</span>
              <input
                type={field.secret ? "password" : "text"}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
                placeholder={field.placeholder}
                value={values[field.id] ?? ""}
                disabled={submitting}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                }
                autoComplete="off"
              />
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-border px-3 py-2">
        <button
          type="button"
          disabled={submitting}
          onClick={onDismiss}
          className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              text: askUserFormReply(proposal.fields, values),
              values
            })
          }
          className="ml-auto rounded-md bg-foreground px-2.5 py-1 font-medium text-background disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
