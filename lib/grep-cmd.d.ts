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
export default function grepCmd(reStr: string, filesAndRepos: string[], opts: GrepOpts): Promise<void>;
