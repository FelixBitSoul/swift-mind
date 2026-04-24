"use client";

import { useEffect, useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ParamSpec =
  | { type: "boolean"; default?: boolean; description?: string }
  | { type: "integer"; default?: number; min?: number; max?: number; description?: string }
  | { type: "enum"; values: string[]; default?: string; description?: string };

export type IngestOptions = {
  parsers: Record<string, { label?: string; formats?: string[]; params?: Record<string, ParamSpec> }>;
  splitters: Record<string, { label?: string; params?: Record<string, ParamSpec> }>;
};

export type IngestConfig = {
  parser_id: string;
  parser_params: Record<string, unknown>;
  splitter_id: string;
  splitter_params: Record<string, unknown>;
};

function normalizeParams(specs: Record<string, ParamSpec> | undefined, current: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = { ...(current ?? {}) };
  for (const [k, spec] of Object.entries(specs ?? {})) {
    if (out[k] !== undefined) continue;
    if (spec.type === "boolean") out[k] = spec.default ?? false;
    if (spec.type === "integer") out[k] = spec.default ?? 0;
    if (spec.type === "enum") out[k] = spec.default ?? spec.values?.[0] ?? "";
  }
  return out;
}

export function IngestConfigForm(props: {
  options: IngestOptions;
  value: IngestConfig;
  onChange: (next: IngestConfig) => void;
  className?: string;
}) {
  const { options, value, onChange, className } = props;

  const parserSpec = options.parsers[value.parser_id];
  const splitterSpec = options.splitters[value.splitter_id];

  const parserParams = useMemo(
    () => normalizeParams(parserSpec?.params, value.parser_params),
    [parserSpec?.params, value.parser_params]
  );
  const splitterParams = useMemo(
    () => normalizeParams(splitterSpec?.params, value.splitter_params),
    [splitterSpec?.params, value.splitter_params]
  );

  // Ensure defaults are populated when ids change.
  useEffect(() => {
    if (parserParams === value.parser_params && splitterParams === value.splitter_params) return;
    onChange({
      ...value,
      parser_params: parserParams,
      splitter_params: splitterParams,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.parser_id, value.splitter_id]);

  const parserIds = useMemo(() => Object.keys(options.parsers ?? {}).sort(), [options.parsers]);
  const splitterIds = useMemo(() => Object.keys(options.splitters ?? {}).sort(), [options.splitters]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Parser</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={value.parser_id}
            onChange={(e) =>
              onChange({
                ...value,
                parser_id: e.target.value,
                parser_params: {},
              })
            }
          >
            {parserIds.map((id) => (
              <option key={id} value={id}>
                {options.parsers[id]?.label ?? id}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Splitter</div>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={value.splitter_id}
            onChange={(e) =>
              onChange({
                ...value,
                splitter_id: e.target.value,
                splitter_params: {},
              })
            }
          >
            {splitterIds.map((id) => (
              <option key={id} value={id}>
                {options.splitters[id]?.label ?? id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {parserSpec?.params && Object.keys(parserSpec.params).length ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Parser params</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(parserSpec.params).map(([k, spec]) => (
              <ParamField
                key={k}
                name={k}
                spec={spec}
                value={parserParams[k]}
                onChange={(v) =>
                  onChange({
                    ...value,
                    parser_params: { ...parserParams, [k]: v },
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {splitterSpec?.params && Object.keys(splitterSpec.params).length ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Splitter params</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(splitterSpec.params).map(([k, spec]) => (
              <ParamField
                key={k}
                name={k}
                spec={spec}
                value={splitterParams[k]}
                onChange={(v) =>
                  onChange({
                    ...value,
                    splitter_params: { ...splitterParams, [k]: v },
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ParamField(props: {
  name: string;
  spec: ParamSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { name, spec, value, onChange } = props;
  const desc = "description" in spec ? spec.description : undefined;

  if (spec.type === "boolean") {
    return (
      <label className="flex items-start gap-2 rounded-md border bg-muted/20 px-3 py-2">
        <Checkbox checked={Boolean(value)} onCheckedChange={(v) => onChange(Boolean(v))} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{name}</div>
          {desc ? <div className="text-xs text-muted-foreground">{desc}</div> : null}
        </div>
      </label>
    );
  }

  if (spec.type === "enum") {
    return (
      <label className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">{name}</div>
        <select
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          value={typeof value === "string" ? value : spec.default ?? spec.values[0] ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        {desc ? <div className="text-xs text-muted-foreground">{desc}</div> : null}
      </label>
    );
  }

  return (
    <label className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{name}</div>
      <Input
        type="number"
        value={Number.isFinite(Number(value)) ? String(value) : ""}
        min={spec.min}
        max={spec.max}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) ? n : spec.default ?? 0);
        }}
      />
      {desc ? <div className="text-xs text-muted-foreground">{desc}</div> : null}
    </label>
  );
}

