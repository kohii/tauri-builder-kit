import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  configArg,
  isAndroid,
  isDebug,
  isIOS,
  profile,
  targetPath,
  uploadPlainBinary,
} from './inputs';
import {
  createArtifact,
  getInfo,
  getTargetDir,
  getTargetInfo,
  getWorkspaceDir,
} from './utils';

import type { Artifact } from './types';

function resolveTargetCandidates(
  baseTargetDir: string,
  profileDir: string,
): string[] {
  const candidates = new Set<string>();

  if (existsSync(join(baseTargetDir, profileDir))) {
    candidates.add('');
  }

  try {
    const entries = readdirSync(baseTargetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === profileDir) continue;

      if (existsSync(join(baseTargetDir, entry.name, profileDir))) {
        candidates.add(entry.name);
      }
    }
  } catch {
    // If target dir doesn't exist yet, fall back to the default candidate.
  }

  return [...candidates];
}

export function buildProject(): Artifact[] {
  const profileDir = profile ? profile : isDebug ? 'debug' : 'release';
  const baseTargetInfo = getTargetInfo(targetPath);
  const baseInfo = getInfo(baseTargetInfo, configArg);

  if (!baseInfo.tauriPath) {
    throw Error("Couldn't detect path of tauri app");
  }

  // This CLI expects the project to be built externally. It only collects artifacts.

  const workspacePath =
    getWorkspaceDir(baseInfo.tauriPath) ?? baseInfo.tauriPath;
  const baseTargetDir = getTargetDir(
    workspacePath,
    baseInfo.tauriPath,
    true,
  );
  let targetCandidates = targetPath
    ? [targetPath]
    : isAndroid || isIOS
      ? ['']
      : resolveTargetCandidates(baseTargetDir, profileDir);
  if (targetCandidates.length === 0) {
    targetCandidates = [''];
  }

  let artifacts: Artifact[] = [];

  for (const candidate of targetCandidates) {
    const targetInfo = getTargetInfo(candidate || undefined);
    const info = getInfo(targetInfo, configArg);

    const app = {
      tauriPath: info.tauriPath,
      name: info.name,
      mainBinaryName: info.mainBinaryName,
      version: info.version,
      wixLanguage: info.wixLanguage,
      rpmRelease: info.rpmRelease,
    };

    let artifactsPath = join(baseTargetDir, candidate, profileDir);
    if (isAndroid) {
      artifactsPath = join(info.tauriPath, 'gen/android/app/build/outputs/');
    }
    if (isIOS) {
      artifactsPath = join(info.tauriPath, 'gen/apple/build/');
    }

    let candidateArtifacts: Artifact[] = [];

    let arch = targetInfo.arch;

    if (targetInfo.platform === 'macos') {
      if (arch === 'x86_64') {
        arch = 'x64';
      } else if (arch === 'arm64') {
        arch = 'aarch64';
      }

      candidateArtifacts = [
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/dmg/${app.name}_${app.version}_${arch}.dmg`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'dmg', // could be 'dmg' or 'app' depending on the usecase
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `bundle/macos/${app.name}.app`),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'app',
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `bundle/macos/${app.name}.app.tar.gz`),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'app',
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `bundle/macos/${app.name}.app.tar.gz.sig`),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'app',
          version: app.version,
        }),
      ];
    } else if (targetInfo.platform === 'windows') {
      if (arch.startsWith('i')) {
        arch = 'x86';
      } else if (arch === 'aarch64' || arch === 'arm64') {
        arch = 'arm64';
      } else {
        arch = 'x64';
      }

      // If multiple Wix languages are specified, multiple installers (.msi) will be made
      // The .zip and .sig are only generated for the first specified language
      let langs;
      if (typeof app.wixLanguage === 'string') {
        langs = [app.wixLanguage];
      } else if (Array.isArray(app.wixLanguage)) {
        langs = app.wixLanguage;
      } else {
        langs = Object.keys(app.wixLanguage);
      }

      const winArtifacts: Artifact[] = [];

      // wix v2
      langs.forEach((lang) => {
        winArtifacts.push(
          createArtifact({
            path: join(
              artifactsPath,
              `bundle/msi/${app.name}_${app.version}_${arch}_${lang}.msi`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch,
            bundle: 'msi',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `bundle/msi/${app.name}_${app.version}_${arch}_${lang}.msi.sig`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch,
            bundle: 'msi',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `bundle/msi/${app.name}_${app.version}_${arch}_${lang}.msi.zip`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch,
            bundle: 'msi',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `bundle/msi/${app.name}_${app.version}_${arch}_${lang}.msi.zip.sig`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch,
            bundle: 'msi',
            version: app.version,
          }),
        );
      });

      winArtifacts.push(
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/nsis/${app.name}_${app.version}_${arch}-setup.exe`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'nsis',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/nsis/${app.name}_${app.version}_${arch}-setup.exe.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'nsis',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/nsis/${app.name}_${app.version}_${arch}-setup.nsis.zip`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'nsis',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/nsis/${app.name}_${app.version}_${arch}-setup.nsis.zip.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch,
          bundle: 'nsis',
          version: app.version,
        }),
      );

      candidateArtifacts = winArtifacts;
    } else if (targetInfo.platform === 'linux') {
      const debianArch =
        arch === 'x64' || arch === 'x86_64'
          ? 'amd64'
          : arch === 'x32' || arch === 'i686'
            ? 'i386'
            : arch === 'arm'
              ? 'armhf'
              : arch === 'aarch64'
                ? 'arm64'
                : arch;
      const rpmArch =
        arch === 'x64' || arch === 'x86_64'
          ? 'x86_64'
          : arch === 'x32' || arch === 'x86' || arch === 'i686'
            ? 'i386'
            : arch === 'arm'
              ? 'armhfp'
              : arch === 'arm64'
                ? 'aarch64'
                : arch;
      const appImageArch =
        arch === 'x64' || arch === 'x86_64'
          ? 'amd64'
          : arch === 'x32' || arch === 'i686'
            ? 'i386'
            : arch === 'arm' // TODO: Confirm this
              ? 'arm'
              : arch === 'arm64' // TODO: This is probably a Tauri bug
                ? 'aarch64'
                : arch;

      candidateArtifacts = [
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/deb/${app.name}_${app.version}_${debianArch}.deb`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: debianArch,
          bundle: 'deb',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/deb/${app.name}_${app.version}_${debianArch}.deb.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: debianArch,
          bundle: 'deb',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/rpm/${app.name}-${app.version}-${app.rpmRelease}.${rpmArch}.rpm`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: rpmArch,
          bundle: 'rpm',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/rpm/${app.name}-${app.version}-${app.rpmRelease}.${rpmArch}.rpm.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: rpmArch,
          bundle: 'rpm',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/appimage/${app.name}_${app.version}_${appImageArch}.AppImage`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: appImageArch,
          bundle: 'appimage',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/appimage/${app.name}_${app.version}_${appImageArch}.AppImage.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: appImageArch,
          bundle: 'appimage',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/appimage/${app.name}_${app.version}_${appImageArch}.AppImage.tar.gz`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: appImageArch,
          bundle: 'appimage',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `bundle/appimage/${app.name}_${app.version}_${appImageArch}.AppImage.tar.gz.sig`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: appImageArch,
          bundle: 'appimage',
          version: app.version,
        }),
      ];
    } else if (targetInfo.platform === 'android') {
      const debug = isDebug ? 'debug' : 'release';
      const aabDebug = isDebug ? 'Debug' : 'Release';

      // TODO: detect (un)signed beforehand

      if (!isDebug) {
        // unsigned release apks
        candidateArtifacts.push(
          createArtifact({
            path: join(
              artifactsPath,
              `apk/universal/release/app-universal-release-unsigend.apk`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch: 'universal',
            bundle: 'apk',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `apk/arm64/release/app-arm64-release-unsigend.apk`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch: 'arm64',
            bundle: 'apk',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `apk/arm/release/app-arm-release-unsigend.apk`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch: 'universal',
            bundle: 'apk',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `apk/x86_64/release/app-x86_64-release-unsigend.apk`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch: 'arm',
            bundle: 'apk',
            version: app.version,
          }),
          createArtifact({
            path: join(
              artifactsPath,
              `apk/x86/release/app-x86-release-unsigend.apk`,
            ),
            name: app.name,
            platform: targetInfo.platform,
            arch: 'x86',
            bundle: 'apk',
            version: app.version,
          }),
        );
      }

      candidateArtifacts.push(
        // signed release apks and debug apks
        createArtifact({
          path: join(
            artifactsPath,
            `apk/universal/${debug}/app-universal-${debug}.apk`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'universal',
          bundle: 'apk',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `apk/arm64/${debug}/app-arm64-${debug}.apk`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm64',
          bundle: 'apk',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `apk/arm/${debug}/app-arm-${debug}.apk`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'universal',
          bundle: 'apk',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `apk/x86_64/${debug}/app-x86_64-${debug}.apk`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm',
          bundle: 'apk',
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `apk/x86/${debug}/app-x86-${debug}.apk`),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'x86',
          bundle: 'apk',
          version: app.version,
        }),
        //
        // aabs
        //
        createArtifact({
          path: join(
            artifactsPath,
            `/bundle/universal${aabDebug}/app-universal-${debug}.aab`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'universal',
          bundle: 'aab',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `/bundle/arm64${aabDebug}/app-arm64-${debug}.aab`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm64',
          bundle: 'aab',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `/bundle/arm${aabDebug}/app-arm-${debug}.aab`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm',
          bundle: 'aab',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `/bundle/x86_64${aabDebug}/app-x86_64-${debug}.aab`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'x86_64',
          bundle: 'aab',
          version: app.version,
        }),
        createArtifact({
          path: join(
            artifactsPath,
            `/bundle/x86${aabDebug}/app-x86-${debug}.aab`,
          ),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'x86',
          bundle: 'aab',
          version: app.version,
        }),
      );
    } else if (targetInfo.platform === 'ios') {
      // TODO: Confirm that info.name is correct.
      candidateArtifacts = [
        createArtifact({
          path: join(artifactsPath, `x86_64/${app.name}.ipa`),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'x86_64',
          bundle: 'ipa',
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `arm64/${app.name}.ipa`),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm64',
          bundle: 'ipa',
          version: app.version,
        }),
        createArtifact({
          path: join(artifactsPath, `arm64-sim/${app.name}.ipa`),
          name: app.name,
          platform: targetInfo.platform,
          arch: 'arm64-sim',
          bundle: 'ipa',
          version: app.version,
        }),
      ];
    } else {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      console.error(`Unhandled target platform: "${targetInfo.platform}"`);
    }

    if (uploadPlainBinary) {
      const ext = targetInfo.platform === 'windows' ? '.exe' : '';
      candidateArtifacts.push(
        createArtifact({
          path: join(artifactsPath, `${app.mainBinaryName}${ext}`),
          name: 'binary', // app.mainBinaryName,
          bundle: 'bin',

          platform: targetInfo.platform,
          arch,
          version: app.version,
        }),
      );
    }

    const label = candidate || 'native';
    console.log(
      `Looking for artifacts (${label}) in:\n${candidateArtifacts
        .map((a) => a.path)
        .join('\n')}`,
    );
    artifacts.push(...candidateArtifacts.filter((p) => existsSync(p.path)));
  }

  return artifacts;
}
