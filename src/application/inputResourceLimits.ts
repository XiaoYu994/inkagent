import { InkAgentError } from '../errors.js';
import type { InputResourceLimits } from './ports.js';

export function assertValidInputResourceLimits(limits: InputResourceLimits): void {
  assertPositiveSafeInteger(limits.maxFiles, 'maxFiles');
  assertPositiveSafeInteger(limits.maxFileBytes, 'maxFileBytes');
  assertPositiveSafeInteger(limits.maxTotalBytes, 'maxTotalBytes');
}

function assertPositiveSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new InkAgentError(`输入资源限制 ${name} 必须是正整数`);
  }
}
