import { existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { buildProject } from './build';
import { getOrCreateRelease } from './create-release';
import {
  configArg,
  outputDir,
  releaseBody,
  releaseId as inputReleaseId,
  releaseName,
  releaseAssetNamePattern,
  shouldUploadRelease,
  shouldUploadUpdaterJson,
  tagName as inputTagName,
  targetPath,
  isIOS,
  owner,
  repo,
  retryAttempts,
} from './inputs';
import { uploadAssets as uploadReleaseAssets } from './upload-release-assets';
import { uploadVersionJSON } from './upload-version-json';
import {
  execCommand,
  getAssetName,
  getInfo,
  getTargetInfo,
  retry,
} from './utils';

import type { Artifact } from './types';

async function copyArtifactsToDir(artifacts: Artifact[], dir: string) {
  await mkdir(dir, { recursive: true });

  const copied: string[] = [];
  for (const artifact of artifacts) {
    const outputName = getAssetName(artifact, releaseAssetNamePattern);
    const destination = join(dir, outputName);
    await mkdir(dirname(destination), { recursive: true });
    await cp(artifact.path, destination, { recursive: true, force: true });
    copied.push(destination);
  }

  console.log(`Copied artifacts to ${dir}:\n${copied.join('\n')}`);
}

async function run(): Promise<void> {
  try {
    if (isIOS && process.platform !== 'darwin') {
      throw new Error('Building for iOS is only supported on macOS hosts.');
    }

    const artifacts: Artifact[] = [];

    artifacts.push(...(await buildProject()));

    if (artifacts.length === 0) {
      throw new Error('No artifacts were found.');
    }

    console.log(`Found artifacts:\n${artifacts.map((a) => a.path).join('\n')}`);

    const targetInfo = getTargetInfo(targetPath);
    const info = getInfo(targetInfo, configArg);

    // Since artifacts are .zip archives we can do this before the .tar.gz step below.
    // Other steps may benefit from this so we do this whether or not we want to upload it.
    if (targetInfo.platform === 'macos') {
      let i = 0;
      for (const artifact of artifacts) {
        // updater provide a .tar.gz, this will prevent duplicate and overwriting of
        // signed archive
        if (
          artifact.path.endsWith('.app') &&
          !existsSync(`${artifact.path}.tar.gz`)
        ) {
          console.log(
            `Packaging ${artifact.path} directory into ${artifact.path}.tar.gz`,
          );

          await execCommand('tar', [
            'czf',
            `${artifact.path}.tar.gz`,
            '-C',
            dirname(artifact.path),
            basename(artifact.path),
          ]);
          artifact.path += '.tar.gz';
          artifact.ext += '.tar.gz';
        } else if (artifact.path.endsWith('.app')) {
          // we can't upload a directory
          artifacts.splice(i, 1);
        }
        i++;
      }
    }

    if (shouldUploadRelease) {
      if (!owner || !repo) {
        throw new Error(
          'Both --owner and --repo are required for release upload.',
        );
      }

      let tagName = inputTagName.replace('refs/tags/', '');
      let releaseId = inputReleaseId;
      const body = releaseBody.replace(/__VERSION__/g, info.version);

      if (tagName && !releaseId) {
        const templates = [
          {
            key: '__VERSION__',
            value: info.version,
          },
        ];

        templates.forEach((template) => {
          const regex = new RegExp(template.key, 'g');
          tagName = tagName.replace(regex, template.value);
        });

        const resolvedReleaseName = releaseName
          ? releaseName.replace(/__VERSION__/g, info.version)
          : undefined;
        const resolvedBody = body || undefined;

        const releaseData = await getOrCreateRelease(
          tagName,
          resolvedReleaseName || undefined,
          resolvedBody,
        );
        releaseId = releaseData.id;
      }

      if (releaseId) {
        await uploadReleaseAssets(releaseId, artifacts, retryAttempts);

        if (shouldUploadUpdaterJson) {
          await retry(
            () =>
              uploadVersionJSON(
                info.version,
                body,
                tagName,
                releaseId,
                artifacts,
                targetInfo,
                info.unzippedSigs,
              ),
            // since all jobs try to upload this file it tends to conflict often so we want to retry it at least once.
            retryAttempts === 0 ? 1 : retryAttempts,
          );
        }
      } else {
        console.log(
          'No releaseId or tagName provided, skipping release upload...',
        );
      }
    } else {
      await copyArtifactsToDir(artifacts, outputDir);
    }
  } catch (error) {
    // @ts-expect-error Catching errors in typescript is a headache
    console.error(error.message);
    process.exit(1);
  }
}

await run();
