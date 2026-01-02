import fs from 'node:fs';

import { Octokit } from '@octokit/rest';

import {
  commitish,
  draft,
  generateReleaseNotes,
  githubBaseUrl,
  githubToken,
  owner,
  prerelease,
  releaseBodyPath,
  repo,
} from './inputs';

interface Release {
  id: number;
  uploadUrl: string;
  htmlUrl: string;
}

interface GitHubRelease {
  id: number;
  upload_url: string;
  html_url: string;
  tag_name: string;
  draft: boolean;
}

function allReleases(github: Octokit) {
  const params = { per_page: 100, owner, repo };
  return github.paginate.iterator(
    github.rest.repos.listReleases.endpoint.merge(params),
  ) as AsyncIterableIterator<{ data: GitHubRelease[] }>;
}

/// Try to get release by tag. If there's none, releaseName is required to create one.
export async function getOrCreateRelease(
  tagName: string,
  releaseName?: string,
  body?: string,
): Promise<Release> {
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN (or --github-token) is required');
  }

  const github = new Octokit({
    auth: githubToken,
    baseUrl: githubBaseUrl,
  });

  let bodyFileContent: string | null = null;
  if (releaseBodyPath) {
    try {
      bodyFileContent = fs.readFileSync(releaseBodyPath, { encoding: 'utf8' });
    } catch (error) {
      // @ts-expect-error Catching errors in typescript is a headache
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      throw new Error(error.message);
    }
  }

  let release: GitHubRelease | null = null;
  try {
    // you can't get a an existing draft by tag
    // so we must find one in the list of all releases
    if (draft) {
      console.log(`Looking for a draft release with tag ${tagName}...`);
      for await (const response of allReleases(github)) {
        const releases = response.data;
        const releaseWithTag = releases.find(
          (release) => release.tag_name === tagName,
        );
        if (releaseWithTag) {
          if (!releaseWithTag.draft) {
            console.warn(
              `Found release with tag ${tagName} but it's NOT a draft!`,
            );
            break;
          }
          release = releaseWithTag;
          console.log(
            `Found draft release with tag ${tagName} on the release list.`,
          );
          break;
        }
      }
      if (!release) {
        throw new Error('release not found');
      }
    } else {
      const foundRelease = await github.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag: tagName,
      });
      release = foundRelease.data as GitHubRelease;
      console.log(`Found release with tag ${tagName}.`);
    }
  } catch (error) {
    // @ts-expect-error Catching errors in typescript is a headache
    if (error.status === 404 || error.message === 'release not found') {
      console.log(`Couldn't find release with tag ${tagName}. Creating one.`);

      if (!releaseName) {
        console.error('"releaseName" not set but required to create release.');
      } else {
        const createdRelease = await github.rest.repos.createRelease({
          owner,
          repo,
          tag_name: tagName,
          name: releaseName,
          body: bodyFileContent || body,
          draft,
          prerelease,
          target_commitish: commitish || undefined,
          generate_release_notes: generateReleaseNotes,
        });

        release = createdRelease.data as GitHubRelease;
      }
    } else {
      console.log(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `⚠️ Unexpected error fetching GitHub release for tag ${tagName}: ${error}`,
      );
      throw error;
    }
  }

  if (!release) {
    throw new Error('Release not found or created.');
  }

  return {
    id: release.id,
    uploadUrl: release.upload_url,
    htmlUrl: release.html_url,
  };
}
