"use strict";
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
/**
 * Gracefully handle things like piping the output to head(1),
 * which sends an EPIPE when it's had enough data
 */
function pipeErrorHandler(err) {
    // eslint-disable-next-line no-process-exit
    if (err.code === 'EPIPE')
        process.exit(0);
    throw err;
}
let addedStdoutHandler = false;
function makeLogger({ json, prefix = '', buffer, }) {
    let inTmp = false;
    function log(message, data, tmpLog) {
        let line;
        if (json)
            line = `${JSON.stringify({
                t: Date.now(),
                data,
            })}\n`;
        else {
            line = prefix + message;
            if (inTmp)
                line = `\r\x1b[K${line}`;
            if (!tmpLog)
                line += '\n';
            inTmp = !!tmpLog;
        }
        if (buffer)
            buffer.push(line);
        else
            process.stdout.write(line);
    }
    log.tmp = (message, data) => {
        log(message, data, true);
    };
    if (!buffer && !addedStdoutHandler) {
        process.stdout.on('error', pipeErrorHandler);
        addedStdoutHandler = true;
    }
    return log;
}
exports.default = makeLogger;
