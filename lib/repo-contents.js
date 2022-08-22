"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * older versions of GitHub Enterprise can't even handle > 1MB < 100MB files
 * with the standard API, so we have to use the blob API ;;
 */
async function largeRepoContents(gh, opts) {
    const { owner, repo } = opts;
    let { ref, path: filePath } = opts;
    filePath = filePath.replace(/^\//, '');
    if (!ref) {
        ref = `heads/${(await gh.repos.get({
            owner,
            repo,
        })).data.default_branch}`;
    }
    let commit;
    try {
        const { data: gitRefs } = await gh.git.getRef({
            owner,
            repo,
            ref,
        });
        const { sha } = gitRefs.object;
        commit = (await gh.git.getCommit({
            owner,
            repo,
            commit_sha: sha,
        })).data;
    }
    catch (err) {
        const { status } = err;
        if (status !== 404 || !/^[\da-f]{7,40}$/.test(ref))
            throw err;
        commit = (await gh.repos.getCommit({
            owner,
            repo,
            ref,
        })).data.commit;
    }
    const treeRes = (await gh.git.getTree({
        ...opts,
        tree_sha: commit.tree.sha,
        ...(filePath.includes('/') && {
            recursive: 'true',
        }),
    })).data;
    const treeEntry = treeRes.tree.find(e => e.path === filePath);
    /* istanbul ignore if */
    if (!treeEntry) {
        if (treeRes.truncated) {
            throw new Error("Tree request truncated; can't get contents");
        }
        throw new Error(`Couldn't find tree entry for ${filePath} in ${JSON.stringify(treeRes.tree)}`);
    }
    const file_sha = treeEntry.sha || '';
    const { content, encoding } = (await gh.git.getBlob({
        owner,
        repo,
        file_sha,
    })).data;
    if (encoding !== 'base64') {
        throw new Error(`unknown data encoding: ${encoding}`);
    }
    return Buffer.from(content, encoding).toString('utf8');
}
function repoContents(gh, opts) {
    return gh.repos
        .getContent({
        ...opts,
        mediaType: {
            format: 'raw',
        },
    })
        .then(res => {
        if (typeof res.data !== 'string') {
            throw new Error('unexpected getContent() response');
        }
        return res.data;
    }, (err) => {
        const errors = err.response?.data?.errors || [];
        if (!errors.some(e => e.code === 'too_large'))
            throw err;
        return largeRepoContents(gh, opts);
    });
}
exports.default = repoContents;
