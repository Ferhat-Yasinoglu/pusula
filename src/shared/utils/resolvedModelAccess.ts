/** Compatibility entry point; model authority and response identity are engine contracts. */
export {
  checkResolvedModelPermission,
  hasApiKeyModelRestrictions,
  isLocalModelPolicyResponse,
  markLocalModelPolicyResponse,
  type ModelAccessMetadata,
  type ResolvedModelPermission,
} from "@pusula/open-sse/services/resolvedModelAccess.ts";
