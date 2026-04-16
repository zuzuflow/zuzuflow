import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { IfElseConfig, ConditionRule } from "@workflow/shared";
import { TemplateInput } from "../TemplateInput";
import { Label } from "../../ui/label";

interface IfElseFormProps {
  config: IfElseConfig;
  onChange: (patch: Partial<IfElseConfig>) => void;
}

const OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
  "is_empty",
  "is_not_empty",
  "regex",
] as const;

const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);

function emptyRule(): ConditionRule {
  return { field: "", operator: "equals", value: "" };
}

export function IfElseForm({ config, onChange }: IfElseFormProps): React.ReactElement {
  const { condition } = config;

  const updateRule = (idx: number, patch: Partial<ConditionRule>) => {
    const rules = condition.rules.map((r, i) =>
      i === idx ? { ...r, ...patch } : r
    );
    onChange({ condition: { ...condition, rules } });
  };

  const addRule = () => {
    onChange({ condition: { ...condition, rules: [...condition.rules, emptyRule()] } });
  };

  const removeRule = (idx: number) => {
    const rules = condition.rules.filter((_, i) => i !== idx);
    onChange({ condition: { ...condition, rules } });
  };

  const toggleCombinator = () => {
    onChange({
      condition: {
        ...condition,
        combinator: condition.combinator === "and" ? "or" : "and",
      },
    });
  };

  return (
    <div className="space-y-3">
      {/* Combinator toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Match</span>
        <button
          type="button"
          onClick={toggleCombinator}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-amber-900 text-amber-300 hover:bg-amber-800 transition-colors"
        >
          {condition.combinator === "and" ? "ALL" : "ANY"}
        </button>
        <span className="text-xs text-muted-foreground">of the following rules</span>
      </div>

      {/* Rules */}
      <div className="space-y-2">
        {condition.rules.map((rule, idx) => (
          <div key={idx} className="bg-slate-850 border border-border rounded-md p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {idx > 0 && (
                <span className="text-[10px] font-bold text-amber-400 w-6 shrink-0">
                  {condition.combinator.toUpperCase()}
                </span>
              )}
              <TemplateInput
                wrapperClassName="relative flex-1"
                value={rule.field}
                onChange={(v) => updateRule(idx, { field: v })}
                placeholder="{{input.field}}"
              />
              <button
                type="button"
                onClick={() => removeRule(idx)}
                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1"
                value={rule.operator}
                onChange={(e) =>
                  updateRule(idx, { operator: e.target.value as ConditionRule["operator"] })
                }
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op.replace(/_/g, " ")}
                  </option>
                ))}
              </select>

              {!NO_VALUE_OPS.has(rule.operator) && (
                <TemplateInput
                  wrapperClassName="relative flex-1"
                  value={String(rule.value ?? "")}
                  onChange={(v) => updateRule(idx, { value: v })}
                  placeholder="value"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        <Plus size={13} />
        Add rule
      </button>
    </div>
  );
}
