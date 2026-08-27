export type DocumentAgent = {
  generate(jobDir: string): Promise<void>;
};
