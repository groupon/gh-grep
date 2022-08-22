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
import { readFileSync } from 'fs';

import { program } from 'commander';

import grepCmd from './grep-cmd';

const { version } = JSON.parse(
  readFileSync(require.resolve('../package.json'), 'utf8')
) as { version: string };

const DEF_LIMIT = 5;
program
  .name('gh grep')
  .version(version)
  .arguments('<pattern> <files-then-optional-repos...>')
  .description(
    'search for given JS-format regexp in given files - multiple must be like: \\[ first second third \\]'
  )
  .option('--json', 'Return output as JSON rows')
  .option('--parallel <n>', `Parallelism limit`, Number, DEF_LIMIT)
  .option('-i, --ignore-case', 'Add /i to your pattern')
  .option(
    '-l, --files-with-matches',
    'Only the repo/names of matching files will be output'
  )
  .option(
    '-L, --files-without-match',
    'Only the repo/names of non-matching files will be output'
  )
  .option('-h, --no-filename', 'Even for multiple files, never show the name')
  .option('-R, --no-reponame', 'Even for multiple repos, never show the name')
  .option(
    '-p, --repos-with-matches',
    'Only the repos of matching files will be output'
  )
  .option(
    '-P, --repos-without-match',
    'Only the repos where none of the files match will be output'
  )
  .option('-o, --only-matching', 'Only outputs the matching parts of lines')
  .option(
    '-A, --after-context <num>',
    'Print num lines of trailing context after each match.',
    Number,
    0
  )
  .option(
    '-B, --before-context <num>',
    'Print num lines of leading context before each match.',
    Number,
    0
  )
  .option(
    '-C, --context <number>',
    'Print num lines of leading and trailing context surrounding each match.',
    Number
  )
  .action(grepCmd);

program.parseAsync(process.argv).catch((err: any) => {
  process.nextTick(() => {
    throw err;
  });
});
