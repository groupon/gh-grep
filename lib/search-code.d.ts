declare type CodeSearchResultItem = import('@octokit/openapi-types').components['schemas']['code-search-result-item'];
/**
 * Does not handle pagination!
 */
export default function searchCode(gh: import('@octokit/rest').Octokit, limit: number, parallel: number, terms: string, quals: Record<string, string>, repos: (string | null)[] | null, fn: (hit: CodeSearchResultItem) => void): Promise<void>;
export {};
