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