export const jobPhases = [
  'created',
  'collecting',
  'extracting',
  'generating',
  'publishing',
  'succeeded',
  'failed',
] as const;

export type JobPhase = (typeof jobPhases)[number];

export type JobFailure = {
  phase: JobPhase;
  message: string;
};
