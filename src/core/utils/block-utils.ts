import { REPEATER_TYPES } from "../constants/STRINGS";

export function isRepeaterBlock(block: any): boolean {
  if (!block || !block._type) return false;
  return REPEATER_TYPES.includes(block._type);
}
