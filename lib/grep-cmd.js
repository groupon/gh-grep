"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const path_1 = require("path");
const rest_1 = require("@octokit/rest");
const plugin_request_log_1 = require("@octokit/plugin-request-log");
const chalk_1 = __importDefault(require("chalk"));
const debug_1 = __importDefault(require("debug"));
const promise_limit_1 = __importDefault(require("promise-limit"));
const gh_auth_status_1 = __importDefault(require("./gh-auth-status"));
const repo_contents_1 = __importDefault(require("./repo-contents"));
const search_code_1 = __importDefault(require("./search-code"));
const logger_1 = __importDefault(require("./logger"));
const debug = (0, debug_1.default)('gh-grep');
const { bold } = chalk_1.default;
function parseRepos(repos) {
    return repos.map(ownerRepo => {
        const [owner, repo] = ownerRepo.split('/');
        return {
            owner,
            repo,
        };
    });
}
function splitBracketedFiles(filesAndRepos) {
    let files;
    let repos;
    if (filesAndRepos[0] === '[') {
        const endPos = filesAndRepos.indexOf(']');
        if (endPos === -1)
            throw 'You must end a list of files with a ] argument';
        files = filesAndRepos.slice(1, endPos);
        repos = filesAndRepos.slice(endPos + 1);
    }
    else {
        [files, repos] = [filesAndRepos.slice(0, 1), filesAndRepos.slice(1)];
    }
    return {
        files: files.map(f => f.replace(/^\//, '')),
        repos: parseRepos(repos),
    };
}
async function searchForRepos(files, reStr, gh) {
    if (/[^\w\s=,/;-]/.test(reStr)) {
        throw new Error('grep with an actual regexp requires explicit repos');
    } // take the file names and determine the unique set of filename: extension:
    // and path: search qualifiers we can infer from them
    const qualSets = new Set(files.map(file => {
        const filename = (0, path_1.basename)(file);
        const extension = (0, path_1.extname)(file).replace(/^\./, '');
        const path = (0, path_1.dirname)(file.replace(/^(?=[^/])/, '/'));
        return `filename:${filename} path:${path}${extension && ` extension:${extension}`}`;
    }));
    debug('searchForRepos', {
        files,
        reStr,
        qualSets,
    }); // do searches in parallel for all of those combinations,
    // saving the unique set of ownerRepos in the properties of repos
    const repos = new Set();
    await Promise.all([...qualSets].map(quals => (0, search_code_1.default)(gh, 999, 1, `${reStr} ${quals}`, {}, null, hit => {
        repos.add(`${hit.repository.owner.login}/${hit.repository.name}`);
    })));
    const repoKeys = [...repos];
    debug('searchForRepos', {
        result: repoKeys,
    });
    return repoKeys;
}
function getLines(content, re, afterContext, beforeContext) {
    const res = [];
    const allLines = content.split('\n');
    allLines.forEach((line, i) => {
        if (!re.test(line))
            return;
        const sliceStart = Math.max(i - beforeContext, 0);
        const sliceEnd = i + afterContext + 1;
        if ((afterContext || beforeContext) && res.length > 0)
            res.push('--');
        res.push(...allLines.slice(sliceStart, sliceEnd));
    });
    return res;
}
async function grepCmd(reStr, filesAndRepos, opts) {
    const { filesWithMatches, filesWithoutMatch, reposWithMatches, reposWithoutMatch, onlyMatching, filename, reponame, ignoreCase, buffer, context, parallel, json, } = opts;
    const { files, repos: explicitRepos } = splitBracketedFiles(filesAndRepos);
    function getRegExp(flags = '') {
        return new RegExp(reStr, `${flags}${ignoreCase ? 'i' : ''}`);
    }
    const withoutMatch = filesWithoutMatch || reposWithoutMatch;
    const showFile = filesWithMatches ||
        filesWithoutMatch ||
        (!reposWithoutMatch && filename && files.length > 1);
    const showRepo = reposWithMatches ||
        reposWithoutMatch ||
        (reponame && explicitRepos.length !== 1);
    const showContent = !withoutMatch && !reposWithMatches && !filesWithMatches;
    let { afterContext, beforeContext } = opts;
    if (context)
        afterContext = beforeContext = context;
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
    const { token, host } = await (0, gh_auth_status_1.default)();
    const ghOpts = {
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
    if (host !== 'github.com')
        ghOpts.baseUrl = `https://${host}/api/v3`;
    const OctokitWithLogging = rest_1.Octokit.plugin(plugin_request_log_1.requestLog);
    const gh = new OctokitWithLogging(ghOpts);
    const log = (0, logger_1.default)({
        json,
        buffer,
    });
    const repos = explicitRepos.length > 0
        ? explicitRepos
        : parseRepos(await searchForRepos(files, reStr, gh));
    const limit = (0, promise_limit_1.default)(parallel);
    await limit.map(repos, async (r) => {
        // for some reason promiseLimit emits type "unknown" items :-/
        const { owner, repo } = r;
        const res = await Promise.all(files.map(filePath => (0, repo_contents_1.default)(gh, {
            owner,
            repo,
            path: filePath,
        })
            .then(content => ({
            path: filePath,
            content,
        }))
            .catch((err) => {
            if (!('status' in err) || err.status !== 404)
                throw err;
            return {
                path: filePath,
                content: '',
            };
        })));
        let anyMatches = false;
        for (const { path: filePath, content } of res) {
            const lines = getLines(content, getRegExp(), afterContext, beforeContext);
            const parts = [];
            const data = {
                owner,
                repo,
                path: filePath,
            };
            if (showRepo)
                parts.push(`${owner}/${repo}`);
            if (showFile)
                parts.push(filePath);
            if (lines.length === 0) {
                if (filesWithoutMatch)
                    log(parts.join(': '), data);
                continue;
            }
            anyMatches = true;
            if (withoutMatch)
                continue;
            if (showContent) {
                for (const line of lines) {
                    if (onlyMatching) {
                        for (const match of line.match(getRegExp('g')) || []) {
                            log(parts.concat([match]).join(': '), Object.assign({
                                match,
                                line,
                            }, data));
                        }
                    }
                    else {
                        log(parts
                            .concat([line.replace(getRegExp('g'), x => bold(x))])
                            .join(': '), Object.assign({
                            line,
                        }, data));
                    }
                }
            }
            else {
                log(parts.join(': '), data);
                if (!showFile)
                    break;
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
exports.default = grepCmd;
