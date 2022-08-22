/*
 * Copyright (c) 2022, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
import { Octokit } from '@octokit/rest';
import type { RequestError } from '@octokit/request-error';

/**
 * older versions of GitHub Enterprise can't even handle > 1MB < 100MB files
 * with the standard API, so we have to use the blob API ;;
 */
async function largeRepoContents(
  gh: Octokit,
  opts: {
    owner: string;
    repo: string;
    ref?: string | null;
    path: string;
  }
) {
  const { owner, repo } = opts;
  let { ref, path: filePath } = opts;
  filePath = filePath.replace(/^\//, '');

  if (!ref) {
    ref = `heads/${
      (
        await gh.repos.get({
          owner,
          repo,
        })
      ).data.default_branch
    }`;
  }

  let commit: {
    tree: {
      sha: string;
    };
  };

  try {
    const { data: gitRefs } = await gh.git.getRef({
      owner,
      repo,
      ref,
    });
    const { sha } = gitRefs.object;
    commit = (
      await gh.git.getCommit({
        owner,
        repo,
        commit_sha: sha,
      })
    ).data;
  } catch (err: any) {
    const { status } = err as RequestError;
    if (status !== 404 || !/^[\da-f]{7,40}$/.test(ref)) throw err;
    commit = (
      await gh.repos.getCommit({
        owner,
        repo,
        ref,
      })
    ).data.commit;
  }

  const treeRes = (
    await gh.git.getTree({
      ...opts,
      tree_sha: commit.tree.sha,
      ...(filePath.includes('/') && {
        recursive: 'true',
      }),
    })
  ).data;
  const treeEntry = treeRes.tree.find(e => e.path === filePath);
  /* istanbul ignore if */

  if (!treeEntry) {
    if (treeRes.truncated) {
      throw new Error("Tree request truncated; can't get contents");
    }

    throw new Error(
      `Couldn't find tree entry for ${filePath} in ${JSON.stringify(
        treeRes.tree
      )}`
    );
  }

  const file_sha = treeEntry.sha || '';
  const { content, encoding } = (
    await gh.git.getBlob({
      owner,
      repo,
      file_sha,
    })
  ).data;

  if (encoding !== 'base64') {
    throw new Error(`unknown data encoding: ${encoding}`);
  }

  return Buffer.from(content, encoding).toString('utf8');
}

export default function repoContents(
  gh: Octokit,
  opts: {
    owner: string;
    repo: string;
    ref?: string;
    path: string;
  }
): Promise<string> {
  return gh.repos
    .getContent({
      ...opts,
      mediaType: {
        format: 'raw',
      },
    })
    .then(
      res => {
        if (typeof res.data !== 'string') {
          throw new Error('unexpected getContent() response');
        }

        return res.data;
      },
      (
        err: Error & {
          response?: {
            data: {
              errors?: {
                code: string;
              }[];
            };
          };
        }
      ) => {
        const errors = err.response?.data?.errors || [];
        if (!errors.some(e => e.code === 'too_large')) throw err;
        return largeRepoContents(gh, opts);
      }
    );
}
