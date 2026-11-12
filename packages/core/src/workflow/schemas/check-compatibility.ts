import type { InputMapping } from "./schema-types.js";
import { parseJsonPath } from "./resolve-input.js";

export type MappingValidationError = {
  code: "mapping_not_dependency" | "invalid_path";
  message: string;
  taskId?: string;
};

export function validateInputMappings(opts: {
  taskId: string;
  dependencies: string[];
  mappings: InputMapping[];
}): MappingValidationError[] {
  const deps = new Set(opts.dependencies);
  const errors: MappingValidationError[] = [];
  for (const mapping of opts.mappings) {
    if (!deps.has(mapping.fromTask)) {
      errors.push({
        code: "mapping_not_dependency",
        message: `Task "${opts.taskId}" mapping fromTask "${mapping.fromTask}" is not a dependency`,
        taskId: opts.taskId
      });
    }
    if (mapping.outputPath && parseJsonPath(mapping.outputPath) === null) {
      errors.push({
        code: "invalid_path",
        message: `Task "${opts.taskId}" has invalid outputPath "${mapping.outputPath}"`,
        taskId: opts.taskId
      });
    }
    if (mapping.targetPath && parseJsonPath(mapping.targetPath) === null) {
      errors.push({
        code: "invalid_path",
        message: `Task "${opts.taskId}" has invalid targetPath "${mapping.targetPath}"`,
        taskId: opts.taskId
      });
    }
  }
  return errors;
}
