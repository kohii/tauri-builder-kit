import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import stringArgv from 'string-argv';

const parsed = parseArgs({
  args: process.argv.slice(2),
  strict: false,
  allowPositionals: true,
  options: {
    projectPath: { type: 'string', short: 'p' },
    outputDir: { type: 'string', short: 'o' },
    uploadRelease: { type: 'boolean' },
    githubToken: { type: 'string' },
    tagName: { type: 'string' },
    releaseId: { type: 'string' },
    releaseName: { type: 'string' },
    releaseBody: { type: 'string' },
    releaseBodyPath: { type: 'string' },
    retryAttempts: { type: 'string' },
    tauriScript: { type: 'string' },
    args: { type: 'string' },
    releaseAssetNamePattern: { type: 'string' },
    uploadUpdaterJson: { type: 'boolean' },
    uploadUpdaterSignatures: { type: 'boolean' },
    updaterJsonPreferNsis: { type: 'boolean' },
    uploadPlainBinary: { type: 'boolean' },
    owner: { type: 'string' },
    repo: { type: 'string' },
    githubBaseUrl: { type: 'string' },
    isGitea: { type: 'boolean' },
    generateReleaseNotes: { type: 'boolean' },
    releaseDraft: { type: 'boolean' },
    prerelease: { type: 'boolean' },
    releaseCommitish: { type: 'string' },
    mobile: { type: 'string' },
    target: { type: 'string', short: 't' },
    config: { type: 'string', short: 'c' },
    debug: { type: 'boolean', short: 'd' },
    profile: { type: 'string' },
  },
});

const parsedValues = parsed.values;

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const projectPath = resolve(
  process.cwd(),
  getString(parsedValues.projectPath, '.'),
);

export const outputDir = resolve(
  process.cwd(),
  getString(parsedValues.outputDir, 'artifacts'),
);

export const shouldUploadRelease = !!parsedValues.uploadRelease;

export const githubToken =
  parsedValues.githubToken || process.env.GITHUB_TOKEN || '';

export const tagName = (parsedValues.tagName as string | undefined) || '';
export const releaseId = Number(getString(parsedValues.releaseId, '0'));
export const releaseName =
  (parsedValues.releaseName as string | undefined) || '';
export const releaseBody =
  (parsedValues.releaseBody as string | undefined) || '';
export const releaseBodyPath =
  (parsedValues.releaseBodyPath as string | undefined) || '';

export const shouldUploadUpdaterJson = !!parsedValues.uploadUpdaterJson;
export const uploadUpdaterSignatures = !!parsedValues.uploadUpdaterSignatures;
export const updaterJsonPreferNsis = !!parsedValues.updaterJsonPreferNsis;

export const retryAttempts = parseInt(
  (parsedValues.retryAttempts as string | undefined) || '0',
  10,
);

export const tauriScript =
  (parsedValues.tauriScript as string | undefined) || undefined;

export const releaseAssetNamePattern =
  (parsedValues.releaseAssetNamePattern as string | undefined) || undefined;

const argsInput = (parsedValues.args as string | undefined) || '';
export const rawArgs = [...stringArgv(argsInput), ...parsed.positionals];

const parsedArgs_ = parseArgs({
  args: rawArgs,
  strict: false,
  allowPositionals: true,
  options: {
    target: { type: 'string', short: 't' },
    config: {
      type: 'string',
      short: 'c',
    },
    debug: { type: 'boolean', short: 'd' },
  },
});

export const parsedArgs = parsedArgs_.values;

export const parsedRunnerArgs = { profile: parsedValues.profile };

export const uploadPlainBinary = !!parsedValues.uploadPlainBinary;

export const owner = (parsedValues.owner as string | undefined) || '';
export const repo = (parsedValues.repo as string | undefined) || '';

export const draft = !!parsedValues.releaseDraft;
export const prerelease = !!parsedValues.prerelease;

export const commitish =
  (parsedValues.releaseCommitish as string | undefined) || '';

export const githubBaseUrl =
  (parsedValues.githubBaseUrl as string | undefined) ||
  process.env.GITHUB_API_URL ||
  'https://api.github.com';

export const isGitea = !!parsedValues.isGitea;

export const generateReleaseNotes = !!parsedValues.generateReleaseNotes;

export const isAndroid =
  (parsedValues.mobile as string | undefined)?.toLowerCase() === 'android';
export const isIOS =
  (parsedValues.mobile as string | undefined)?.toLowerCase() === 'ios';
export const isDebug = !!parsedArgs['debug'];

export const targetPath = parsedArgs['target'] as string | undefined;
export const configArg = parsedArgs['config'] as string | undefined;
