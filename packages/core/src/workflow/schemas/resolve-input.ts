import type { InputMapping } from "./schema-types.js";

export type ResolveInputError = {
  code:
    | "missing_dependency_output"
    | "invalid_path"
    | "path_not_found"
    | "mapping_target";
  message: string;
};

export type ResolveTaskInputResult =
  { ok: true; input: unknown } | { ok: false; errors: ResolveInputError[] };

const PATH_RE = /^\$((?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;

export function parseJsonPath(path: string): string[] | null {
  const m = PATH_RE.exec(path.trim());
  if (!m) return null;
  const rest = m[1] ?? "";
  if (!rest) return [];
  return rest.slice(1).split(".");
}

export function getAtPath(value: unknown, path: string): unknown {
  const segments = parseJsonPath(path);
  if (segments === null) {
    throw new Error(`invalid path: ${path}`);
  }
  let cur: unknown = value;
  for (const seg of segments) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function setAtPath(opts: {
  target: Record<string, unknown>;
  path: string;
  value: unknown;
}): void {
  const segments = parseJsonPath(opts.path);
  if (segments === null || segments.length === 0) {
    throw new Error(`invalid target path: ${opts.path}`);
  }
  let cur: Record<string, unknown> = opts.target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = cur[seg];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segments[segments.length - 1]!] = opts.value;
}

function fanInInput(opts: {
  dependencyValues: Record<string, unknown>;
  dependencyIds: string[];
}): ResolveTaskInputResult {
  const errors: ResolveInputError[] = [];
  const input: Record<string, unknown> = {};
  for (const id of opts.dependencyIds) {
    if (!(id in opts.dependencyValues)) {
      errors.push({
        code: "missing_dependency_output",
        message: `Missing output for dependency "${id}"`
      });
      continue;
    }
    input[id] = opts.dependencyValues[id];
  }
  return errors.length ? { ok: false, errors } : { ok: true, input };
}

function applyMapping(opts: {
  mapping: InputMapping;
  dependencyValues: Record<string, unknown>;
  input: Record<string, unknown>;
  errors: ResolveInputError[];
}): void {
  const { mapping, errors, input } = opts;
  if (!(mapping.fromTask in opts.dependencyValues)) {
    errors.push({
      code: "missing_dependency_output",
      message: `Missing output for mapping fromTask "${mapping.fromTask}"`
    });
    return;
  }
  const source = opts.dependencyValues[mapping.fromTask];
  let extracted: unknown = source;
  if (mapping.outputPath) {
    if (parseJsonPath(mapping.outputPath) === null) {
      errors.push({
        code: "invalid_path",
        message: `Invalid outputPath "${mapping.outputPath}"`
      });
      return;
    }
    try {
      extracted = getAtPath(source, mapping.outputPath);
    } catch {
      errors.push({
        code: "invalid_path",
        message: `Invalid outputPath "${mapping.outputPath}"`
      });
      return;
    }
    if (extracted === undefined) {
      errors.push({
        code: "path_not_found",
        message: `outputPath "${mapping.outputPath}" not found on "${mapping.fromTask}"`
      });
      return;
    }
  }
  if (!mapping.targetPath) {
    if (
      extracted !== null &&
      typeof extracted === "object" &&
      !Array.isArray(extracted)
    ) {
      Object.assign(input, extracted as Record<string, unknown>);
    } else {
      input[mapping.fromTask] = extracted;
    }
    return;
  }
  if (parseJsonPath(mapping.targetPath) === null) {
    errors.push({
      code: "invalid_path",
      message: `Invalid targetPath "${mapping.targetPath}"`
    });
    return;
  }
  try {
    setAtPath({
      target: input,
      path: mapping.targetPath,
      value: extracted
    });
  } catch (err) {
    errors.push({
      code: "mapping_target",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}

export function resolveTaskInput(opts: {
  dependencyValues: Record<string, unknown>;
  dependencyIds: string[];
  mappings?: InputMapping[];
  staticInput?: unknown;
}): ResolveTaskInputResult {
  const mappings = opts.mappings ?? [];

  if (opts.dependencyIds.length === 0) {
    return {
      ok: true,
      input: opts.staticInput !== undefined ? opts.staticInput : {}
    };
  }

  if (mappings.length === 0) {
    return fanInInput({
      dependencyValues: opts.dependencyValues,
      dependencyIds: opts.dependencyIds
    });
  }

  const input: Record<string, unknown> = {};
  const errors: ResolveInputError[] = [];
  for (const mapping of mappings) {
    applyMapping({
      mapping,
      dependencyValues: opts.dependencyValues,
      input,
      errors
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, input };
}
