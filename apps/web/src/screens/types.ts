import type { BusinessRuntime } from '../business/runtime.js';
export interface ScreenProps {
  runtime: BusinessRuntime;
  run: (task: () => Promise<unknown>) => void;
  busy: boolean;
}
