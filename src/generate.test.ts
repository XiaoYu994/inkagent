import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStubDocumentAgent } from './agent/stubAgent.js';
import { generateDocument, resolveDocumentAgentSelection } from './generate.js';
import { InkAgentError } from './errors.js';
import { createPdfWithText } from './ingest/officeFixtures.js';

function readJson(path: string): Promise<unknown> {
  return readFile(path, 'utf8').then(JSON.parse);
}

describe('generateDocument', () => {
  it('extracts inputs and copies stub markdown to the output directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-gen-'));
    const inputDir = join(root, 'in');
    const outputDir = join(root, 'out');
    const workDir = join(root, 'jobs');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'notes.md'), '# 材料\n\n接口超时 3s。\n');
    await writeFile(join(inputDir, 'spec.pdf'), createPdfWithText('PDF Spec'));

    const result = await generateDocument({
      inputDir,
      outputDir,
      workDir,
      brief: '根据材料写技术方案',
      documentAgent: createStubDocumentAgent('# 技术方案\n\n已生成\n'),
    });

    expect(result.outputFiles).toContain('document.md');
    expect(await readFile(join(outputDir, 'document.md'), 'utf8')).toContain('已生成');
    expect(result.extracts.filter((record) => record.status === 'ok')).toHaveLength(2);
    expect(result.extracts.map((record) => record.extractPath)).toEqual([
      'markdown/notes.md',
      'pdf/spec.pdf.md',
    ]);

    const manifest = (await readJson(join(result.jobDir, 'manifest.json'))) as {
      extracts: unknown[];
    };
    expect(manifest.extracts).toHaveLength(2);
  });

  it('rejects an empty input directory and a missing input directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-gen-empty-'));
    await mkdir(join(root, 'in'));

    await expect(
      generateDocument({
        inputDir: join(root, 'in'),
        outputDir: join(root, 'out'),
        workDir: join(root, 'jobs'),
        brief: '写文档',
        documentAgent: createStubDocumentAgent(),
      }),
    ).rejects.toThrow('输入目录中没有可用材料');

    await expect(
      generateDocument({
        inputDir: join(root, 'no-such-dir'),
        outputDir: join(root, 'out'),
        workDir: join(root, 'jobs'),
        brief: '写文档',
        documentAgent: createStubDocumentAgent(),
      }),
    ).rejects.toThrow('读取输入目录失败');
  });

  it('rejects an output path that is a file before running the agent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-gen-out-file-'));
    const inputDir = join(root, 'in');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'notes.md'), '# n\n');
    await writeFile(join(root, 'out'), 'not a dir');

    let generated = false;
    await expect(
      generateDocument({
        inputDir,
        outputDir: join(root, 'out'),
        workDir: join(root, 'jobs'),
        brief: '写文档',
        documentAgent: {
          generate: async () => {
            generated = true;
          },
        },
      }),
    ).rejects.toThrow(/不是目录/);
    expect(generated).toBe(false);
  });

  it('clears leftover markdown from a previous generate into the same out dir', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-gen-stale-'));
    const inputDir = join(root, 'in');
    const outputDir = join(root, 'out');
    const workDir = join(root, 'jobs');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'notes.md'), '# 材料\n');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'chapter-2.md'), 'stale\n');

    const result = await generateDocument({
      inputDir,
      outputDir,
      workDir,
      brief: '写文档',
      documentAgent: createStubDocumentAgent('# 新稿\n'),
    });

    expect(result.outputFiles).toEqual(['document.md']);
    await expect(readFile(join(outputDir, 'chapter-2.md'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('throws when every input file is unsupported', async () => {
    const root = await mkdtemp(join(tmpdir(), 'inkagent-gen-bad-'));
    const inputDir = join(root, 'in');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'a.zip'), 'zip');

    await expect(
      generateDocument({
        inputDir,
        outputDir: join(root, 'out'),
        workDir: join(root, 'jobs'),
        brief: '写文档',
        documentAgent: createStubDocumentAgent(),
      }),
    ).rejects.toBeInstanceOf(InkAgentError);
  });
});

describe('resolveDocumentAgentSelection', () => {
  it('lets CLI options override project config and requires a model', () => {
    expect(
      resolveDocumentAgentSelection(
        { model: 'openai/gpt-5', thinkingLevel: 'low' },
        { model: 'zai-coding-cn/glm-5.3-flash', thinkingLevel: 'xhigh' },
      ),
    ).toEqual({ model: 'openai/gpt-5', thinkingLevel: 'low' });

    expect(resolveDocumentAgentSelection({}, { model: 'zai-coding-cn/glm-5.3-flash' })).toEqual({
      model: 'zai-coding-cn/glm-5.3-flash',
    });

    expect(() => resolveDocumentAgentSelection({}, undefined)).toThrow(/必须指定模型/);
  });
});
