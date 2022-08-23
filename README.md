[![nlm-github](https://img.shields.io/badge/github-groupon%2Fgh--grep%2Fissues-F4D03F?logo=github&logoColor=white)](https://github.com/groupon/gh-grep/issues)
![nlm-node](https://img.shields.io/badge/node-%3E%3D14-blue?logo=node.js&logoColor=white)
![nlm-version](https://img.shields.io/badge/version-1.0.0-blue?logo=version&logoColor=white)
# GitHub CLI "grep" Extension

## Requirements

* [GitHub CLI](https://cli.github.com/)
* [NodeJS](https://nodejs.org/) >= 14.x

## Installation

```
$ gh extension install groupon/gh-grep
```

The first time you run `gh grep` additional dependencies will be automatically
installed.

## Usage

```
$ gh grep [options] <pattern> path/in/repos/to/file [owner1/repo1 [owner2/repo2 [...]]]
$ gh grep [options] <pattern> '[' path/to/file1 path/to/file2 ']' [owner1/repo1 [...]]
```

This command greps files in GitHub repos, without checking out the repo.
Use `--help` to see all of the options.

`pattern` is a JavaScript-compatible regexp string.

If you wish to grep multiple files, you must enclose them in `'['` and `']'`
arguments to separate them from the list of owner/repos.

If you omit the repos to search, it will do an implicit GH code search first
to get a list of repos to try the `grep` on.

## Examples

Find uses of `lodash` as a dependency in a few different repos:

```
$ gh grep lodash package.json groupon/gofer groupon/gofer-openapi testiumjs/testium-driver-wd
groupon/gofer-openapi:     "lodash.camelcase": "^4.3.0",
groupon/gofer-openapi:     "lodash.upperfirst": "^4.3.1",
groupon/gofer-openapi:     "@types/lodash.camelcase": "^4.3.6",
groupon/gofer-openapi:     "@types/lodash.upperfirst": "^4.3.6",
groupon/gofer:     "lodash.isplainobject": "^4.0.6",
groupon/gofer:     "lodash.merge": "^4.6.2",
groupon/gofer:     "lodash.mergewith": "^4.6.2"
testiumjs/testium-driver-wd:     "lodash.method": "^4.5.2",
```

Find a term in specific files in any repo on a private GitHub instance
(performs a search first)

```
$ GH_HOST=github.example.com gh grep kittens \[ README.md CHANGELOG.md \]
org1/repo1: README.md: But the kittens are here
org1/repo1: CHANGELOG.md: Removed kittens after
org2/repo2: CHANGELOG.md: Added kittens because
```