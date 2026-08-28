import {
  ModelRuntime,
  resolveCliModel,
  type CreateModelRuntimeOptions,
  type ProviderConfig,
  type ResolveCliModelResult,
} from '@earendil-works/pi-coding-agent';

import { InkAgentError } from '../../errors.js';

export type PiModel = {
  runtime: ModelRuntime;
  model: NonNullable<ResolveCliModelResult['model']>;
  thinkingLevel?: ResolveCliModelResult['thinkingLevel'];
};

export async function createProjectModelRuntime(
  providers?: Record<string, unknown>,
  options: Omit<CreateModelRuntimeOptions, 'modelsPath'> = {},
): Promise<ModelRuntime> {
  const runtime = await ModelRuntime.create({ ...options, modelsPath: null });
  registerProjectProviders(runtime, providers);
  return runtime;
}

export async function listAvailableModelIds(
  providers?: Record<string, unknown>,
): Promise<string[]> {
  const runtime = await createAuthenticatedRuntime(providers);
  const models = await runtime.getAvailable();
  return models.map((model) => `${model.provider}/${model.id}`).sort();
}

export async function resolveAuthenticatedModel(
  reference: string,
  providers?: Record<string, unknown>,
): Promise<PiModel> {
  const runtime = await createAuthenticatedRuntime(providers);
  const resolved = resolveModel(runtime, reference);
  const availableModels = await runtime.getAvailable();
  assertModelIsAuthenticated({
    model: resolved.model,
    availableModels,
    reference,
  });
  return { runtime, ...resolved };
}

async function createAuthenticatedRuntime(
  providers?: Record<string, unknown>,
): Promise<ModelRuntime> {
  const runtime = await createProjectModelRuntime(providers);
  const availableModels = await runtime.getAvailable();
  if (availableModels.length === 0) {
    throw new InkAgentError('没有可用的模型。请先配置 API 密钥（环境变量或 `pi auth`）。');
  }
  return runtime;
}

function resolveModel(
  runtime: ModelRuntime,
  reference: string,
): Pick<PiModel, 'model' | 'thinkingLevel'> {
  const result = resolveCliModel({ cliModel: reference, modelRuntime: runtime });
  if (result.warning !== undefined) {
    process.stderr.write(`${result.warning}\n`);
  }
  if (result.error !== undefined || result.model === undefined) {
    throw new InkAgentError(
      result.error ?? `找不到模型 "${reference}"，请检查项目配置或 --model 参数。`,
    );
  }
  return {
    model: result.model,
    ...(result.thinkingLevel === undefined ? {} : { thinkingLevel: result.thinkingLevel }),
  };
}

type AuthenticatedModelRequest = {
  model: NonNullable<ResolveCliModelResult['model']>;
  availableModels: readonly { provider: string; id: string }[];
  reference: string;
};

function assertModelIsAuthenticated({
  model,
  availableModels,
  reference,
}: AuthenticatedModelRequest): void {
  const isAuthenticated = availableModels.some(
    (availableModel) =>
      availableModel.provider === model.provider && availableModel.id === model.id,
  );
  if (!isAuthenticated) {
    throw new InkAgentError(
      `模型 "${reference}" 没有可用的 API 密钥。请设置对应环境变量，或运行 \`pi auth\`。`,
    );
  }
}

function registerProjectProviders(
  runtime: ModelRuntime,
  providers: Record<string, unknown> | undefined,
): void {
  if (providers === undefined) {
    return;
  }
  try {
    for (const [providerId, provider] of Object.entries(providers)) {
      runtime.registerProvider(providerId, provider as ProviderConfig);
    }
  } catch (error) {
    throw new InkAgentError('项目 providers 无法交给 Pi', { cause: error });
  }
}
