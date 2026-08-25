export type CardStatus = string;
export type StageAction = "generate" | "implement";
export type GateKind = "human" | "auto";
export interface PipelineStage {
  id: string;
  agent: string;
  column: CardStatus;
  action: StageAction;
  commentTitle: string;
  gate: GateKind;
}
export interface PipelineDefinition {
  name: string;
  version: number;
  stages: PipelineStage[];
  finalColumn: CardStatus;
}
