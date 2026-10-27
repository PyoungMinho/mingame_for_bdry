// src/lib/cloudcheck/collector/__scenarios__/index.ts — shim 시나리오 모음 (AWS 16 · Azure 8)
export { AWS_SCENARIOS, awsCase, POISON_MARKERS, AWS_BUCKET_DATA } from "./aws";
export { AZURE_SCENARIOS, azureCase, AZ_SUB_SECOND } from "./azure";
export * from "./aws-base";
export * from "./azure-base";
export type { ScenarioCase } from "./types";
