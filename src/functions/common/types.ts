import { OperationResponse } from "@azure/cosmos";

export type BatchSummary = {
  totalOperationsCount: number;
  sucessfulOperationsCount: number;
  failedOperationsCount: number;
};

export type BatchResponse = {
  responses?: OperationResponse[];
  summary: BatchSummary;
};
