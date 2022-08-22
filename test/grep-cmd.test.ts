import assert from 'assert';

import chalk from 'chalk';
import { DeclarativeNock } from 'declarative-nock';

import grepCmd, { type GrepOpts } from '../lib/grep-cmd';

const { bold } = chalk;

function fileContent(repo: string, filePath: string, content: string) {
  return {
    [`get /repos/org/${repo}/contents/${encodeURIComponent(filePath)}`]: {
      headers: {
        'content-type': 'text/plain',
      },
      body: content,
    },
  };
}

const dn = new DeclarativeNock({
  github: {
    url: 'https://api.github.com',
    mocks: {
      ...fileContent('repo1', 'file1', 'This\nis\na repo1\nfile1\nabc\nadc\n'),
      ...fileContent('repo1', 'dir/file2', 'This\nis\na repo1\nfile2\nyadda\n'),
      ...fileContent('repo2', 'file1', 'this\nis\na repo2\nfile1\nyadda\n'),
      'get /search/code': {
        body: {
          items: [
            { repository: { owner: { login: 'org' }, name: 'repo1' } },
            { repository: { owner: { login: 'org' }, name: 'repo2' } },
          ],
        },
      },
    },
  },
});

describe('grepCmd()', () => {
  dn.addMochaHooks();

  // inject our mocks dir into the front of PATH so that when "gh" is exec'ed
  // we get our mock version that responds with plausible-looking auth status
  before(() => {
    process.env.PATH = `${__dirname}/../mocks:${process.env.PATH || '/bin'}`;
  });

  after(() => {
    process.env.PATH = (process.env.PATH || '.:/bin').replace(/^[^:]+:/, '');
  });

  const opts: GrepOpts = {
    beforeContext: 0,
    afterContext: 0,
    buffer: [],
    filename: true,
    reponame: true,
    reposWithMatches: false,
    reposWithoutMatch: false,
    filesWithMatches: false,
    filesWithoutMatch: false,
    json: false,
    parallel: 5,
    ignoreCase: false,
    onlyMatching: false,
  };

  beforeEach(() => {
    opts.buffer = [];
  });

  async function runGrep(
    pattern: string,
    files: string[],
    repos: string[],
    optOverrides: Partial<GrepOpts>
  ) {
    const filesAndRepos =
      files.length === 1 ? [...files] : ['[', ...files, ']'];
    filesAndRepos.push(...repos);
    await grepCmd(pattern, filesAndRepos, { ...opts, ...optOverrides });
    return (opts.buffer || []).map(line => line.trim());
  }

  async function assertGrep(
    pattern: string,
    files: string[],
    repos: string[],
    optOverrides: Partial<GrepOpts>,
    expected: string[]
  ) {
    assert.deepStrictEqual(
      await runGrep(pattern, files, repos, optOverrides),
      expected
    );
  }

  it('respects filesWithMatches: true', () =>
    assertGrep(
      'a.c',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { filesWithMatches: true },
      ['org/repo1: file1']
    ));

  it('respects filesWithoutMatch: true and multiple files', () =>
    assertGrep(
      'a.c',
      ['file1', 'dir/file2'],
      ['org/repo1'],
      { filesWithoutMatch: true },
      ['dir/file2']
    ));

  it('handles implicit multi-repo search and reponame: false', async () => {
    await assertGrep('repo', ['file1'], [], { reponame: false }, [
      `a ${bold('repo')}1`,
      `a ${bold('repo')}2`,
    ]);

    // verify the search query was correct
    const searchReq = dn.origins.github.one('get /search/code');
    assert.strictEqual(searchReq.query.q, 'repo filename:file1 path:/'); // and while we're here, verify auth was sent right

    assert.deepStrictEqual(
      searchReq.headers.authorization, // this value is returned by mocks/gh
      ['token gho_1234567890abcdefghijklmnopqrstuvwxyz']
    );
  });

  it('errors on non-basic regexp with multi-repo search', () =>
    assert.rejects(
      runGrep('a.*c', ['file1'], [], {}),
      /grep with an actual regexp/
    ));

  it('respects reposWithMatches: true', () =>
    assertGrep(
      '.',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { reposWithMatches: true },
      ['org/repo1', 'org/repo2']
    ));

  it('respects reposWithoutMatch: true', () =>
    assertGrep(
      'repo1',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { reposWithoutMatch: true },
      ['org/repo2']
    ));

  it('respects onlyMatching: true', () =>
    assertGrep(
      'repo\\d',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { onlyMatching: true },
      ['org/repo1: repo1', 'org/repo2: repo2']
    ));

  it('respects filename: true', () =>
    assertGrep('file\\d', ['file1', 'dir/file2'], ['org/repo1'], {}, [
      `file1: ${bold('file1')}`,
      `dir/file2: ${bold('file2')}`,
    ]));

  it('respects filename: false', () =>
    assertGrep(
      'file\\d',
      ['file1', 'dir/file2'],
      ['org/repo1'],
      { filename: false },
      [bold('file1'), bold('file2')]
    ));

  it('respects ignoreCase: false', () =>
    assertGrep(
      'this',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { reponame: false },
      [bold('this')]
    ));

  it('respects ignoreCase: true', () =>
    assertGrep(
      'this',
      ['file1'],
      ['org/repo1', 'org/repo2'],
      { reponame: false, ignoreCase: true },
      [bold('This'), bold('this')]
    ));

  it('respects afterContext', () =>
    assertGrep('^is$', ['file1'], ['org/repo1'], { afterContext: 1 }, [
      bold('is'),
      'a repo1',
    ]));

  it('respects beforeContext', () =>
    assertGrep('^is$', ['file1'], ['org/repo1'], { beforeContext: 5 }, [
      'This',
      bold('is'),
    ]));

  it('respects context', () =>
    assertGrep('^is$', ['file1'], ['org/repo1'], { context: 2 }, [
      'This',
      bold('is'),
      'a repo1',
      'file1',
    ]));

  it('respects json', async () => {
    const lines = await runGrep('^is$', ['file1'], ['org/repo1'], {
      context: 2,
      json: true,
    });
    const objs = lines.map(
      line => JSON.parse(line) as { t: number; data: unknown }
    );
    const t1 = objs[0].t;
    assert.strictEqual(typeof t1, 'number');
    assert.ok(t1 > Date.now() - 100);
    assert.ok(t1 <= Date.now());
    assert.deepStrictEqual(
      objs.map(o => o.data),
      [
        { line: 'This', owner: 'org', path: 'file1', repo: 'repo1' },
        { line: 'is', owner: 'org', path: 'file1', repo: 'repo1' },
        { line: 'a repo1', owner: 'org', path: 'file1', repo: 'repo1' },
        { line: 'file1', owner: 'org', path: 'file1', repo: 'repo1' },
      ]
    );
  });
});
