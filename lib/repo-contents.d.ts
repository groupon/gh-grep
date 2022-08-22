import { Octokit } from '@octokit/rest';
export default function repoContents(gh: Octokit, opts: {
    owner: string;
    repo: string;
    ref?: string;
    path: string;
}): Promise<string>;
