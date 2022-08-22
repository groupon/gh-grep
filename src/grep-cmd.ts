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
import { extname, dirname, basename } from 'path';

import { Octokit } from '@octokit/rest';
import { requestLog } from '@octokit/plugin-request-log';
import chalk from 'chalk';
import Debug from 'debug';
import promiseLimit from 'promise-limit';

import getAuthStatus from './gh-auth-status';
import repoContents from './repo-contents';
import searchCode from './search-code';
import makeLogger from './logger';
import type { RequestError } from '@octokit/request-error';

const debug = Debug('gh-grep');
const { bold } = chalk;

export interface GrepOpts {
  json: boolean;
  parallel: number;
  buffer?: string[];
  ignoreCase: boolean;
  filesWithMatches: boolean;
  filesWithoutMatch: boolean;
  reposWithMatches: boolean;
  reposWithoutMatch: boolean;
  onlyMatching: boolean;
  filename: boolean;
  reponame: boolean;
  context?: number;
  afterContext: number;
  beforeContext: number;
}

function parseRepos(repos: string[]) {
  return repos.map(ownerRepo => {
    const [owner, repo] = ownerRepo.split('/');
    return {
      owner,
      repo,
    };
  });
}

function splitBracketedFiles(filesAndRepos: string[]) {
  let files;
  let repos;

  if (filesAndRepos[0] === '[') {
    const endPos = filesAndRepos.indexOf(']');
    if (endPos === -1) throw 'You must end a list of files with a ] argument';
    files = filesAndRepos.slice(1, endPos);
    repos = filesAndRepos.slice(endPos + 1);
  } else {
    [files, repos] = [filesAndRepos.slice(0, 1), filesAndRepos.slice(1)];
  }

  return {
    files: files.map(f => f.replace(/^\//, '')),
    repos: parseRepos(repos),
  };
}

async function searchForRepos(files: string[], reStr: string, gh: Octokit) {
  if (/[^\w\s=,/;-]/.test(reStr)) {
    throw new Error('grep with an actual regexp requires explicit repos');
  } // take the file names and determine the unique set of filename: extension:
  // and path: search qualifiers we can infer from them

  const qualSets = new Set(
    files.map(file => {
      const filename = basename(file);
      const extension = extname(file).replace(/^\./, '');
      const path = dirname(file.replace(/^(?=[^/])/, '/'));
      return `filename:${filename} path:${path}${
        extension && ` extension:${extension}`
      }`;
    })
  );
  debug('searchForRepos', {
    files,
    reStr,
    qualSets,
  }); // do searches in parallel for all of those combinations,
  // saving the unique set of ownerRepos in the properties of repos

  const repos: Set<string> = new Set();
  await Promise.all(
    [...qualSets].map(quals =>
      searchCode(gh, 999, 1, `${reStr} ${quals}`, {}, null, hit => {
        repos.add(`${hit.repository.owner.login}/${hit.repository.name}`);
      })
    )
  );
  const repoKeys = [...repos];
  debug('searchForRepos', {
    result: repoKeys,
  });
  return repoKeys;
}

function getLines(
  content: string,
  re: RegExp,
  afterContext: number,
  beforeContext: number
) {
  const res: string[] = [];
  const allLines = content.split('\n');
  allLines.forEach((line, i) => {
    if (!re.test(line)) return;
    const sliceStart = Math.max(i - beforeContext, 0);
    const sliceEnd = i + afterContext + 1;
    if ((afterContext || beforeContext) && res.length > 0) res.push('--');
    res.push(...allLines.slice(sliceStart, sliceEnd));
  });
  return res;
}

export default async function grepCmd(
  reStr: string,
  filesAndRepos: string[],
  opts: GrepOpts
) {
  const {
    filesWithMatches,
    filesWithoutMatch,
    reposWithMatches,
    reposWithoutMatch,
    onlyMatching,
    filename,
    reponame,
    ignoreCase,
    buffer,
    context,
    parallel,
    json,
  } = opts;
  const { files, repos: explicitRepos } = splitBracketedFiles(filesAndRepos);

  function getRegExp(flags = '') {
    return new RegExp(reStr, `${flags}${ignoreCase ? 'i' : ''}`);
  }

  const withoutMatch = filesWithoutMatch || reposWithoutMatch;
  const showFile =
    filesWithMatches ||
    filesWithoutMatch ||
    (!reposWithoutMatch && filename && files.length > 1);
  const showRepo =
    reposWithMatches ||
    reposWithoutMatch ||
    (reponame && explicitRepos.length !== 1);
  const showContent = !withoutMatch && !reposWithMatches && !filesWithMatches;
  let { afterContext, beforeContext } = opts;
  if (context) afterContext = beforeContext = context;
  debug('grep', {
    reStr,
    files,
    explicitRepos,
    onlyMatching,
    showFile,
    showRepo,
    showContent,
    afterContext,
    beforeContext,
  });
  const { token, host } = await getAuthStatus();
  const ghOpts: Exclude<ConstructorParameters<typeof Octokit>[0], undefined> = {
    auth: token,
    log: {
      debug: () => {
        /* maybe include this? */
      },
      info: debug,
      warn: debug,
      error: debug,
    },
  };
  if (host !== 'github.com') ghOpts.baseUrl = `https://${host}/api/v3`;
  const OctokitWithLogging = Octokit.plugin(requestLog);
  const gh = new OctokitWithLogging(ghOpts);
  const log = makeLogger({
    json,
    buffer,
  });
  const repos =
    explicitRepos.length > 0
      ? explicitRepos
      : parseRepos(await searchForRepos(files, reStr, gh));
  const limit = promiseLimit(parallel);
  await limit.map(repos, async r => {
    // for some reason promiseLimit emits type "unknown" items :-/
    const { owner, repo } = r as { owner: string; repo: string };
    const res = await Promise.all(
      files.map(filePath =>
        repoContents(gh, {
          owner,
          repo,
          path: filePath,
        })
          .then(content => ({
            path: filePath,
            content,
          }))
          .catch((err: Error | RequestError) => {
            if (!('status' in err) || err.status !== 404) throw err;
            return {
              path: filePath,
              content: '',
            };
          })
      )
    );
    let anyMatches = false;

    for (const { path: filePath, content } of res) {
      const lines = getLines(content, getRegExp(), afterContext, beforeContext);
      const parts = [];
      const data = {
        owner,
        repo,
        path: filePath,
      };
      if (showRepo) parts.push(`${owner}/${repo}`);
      if (showFile) parts.push(filePath);

      if (lines.length === 0) {
        if (filesWithoutMatch) log(parts.join(': '), data);
        continue;
      }

      anyMatches = true;
      if (withoutMatch) continue;

      if (showContent) {
        for (const line of lines) {
          if (onlyMatching) {
            for (const match of line.match(getRegExp('g')) || []) {
              log(
                parts.concat([match]).join(': '),
                Object.assign(
                  {
                    match,
                    line,
                  },
                  data
                )
              );
            }
          } else {
            log(
              parts
                .concat([line.replace(getRegExp('g'), x => bold(x))])
                .join(': '),
              Object.assign(
                {
                  line,
                },
                data
              )
            );
          }
        }
      } else {
        log(parts.join(': '), data);
        if (!showFile) break;
      }
    }

    if (reposWithoutMatch && !anyMatches) {
      log(`${owner}/${repo}`, {
        owner,
        repo,
      });
    }
  });
}
