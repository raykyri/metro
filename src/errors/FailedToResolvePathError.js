/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict-local
 * @format
 * @oncall react_native
 */

'use strict';

                                                   

const formatFileCandidates = require('./formatFileCandidates');

class FailedToResolvePathError extends Error {
  candidates                      ;

  constructor(candidates                      ) {
    super(
      'The module could not be resolved because none of these files exist:\n\n' +
        [candidates.file, candidates.dir]
          .filter(Boolean)
          .map(candidates => `  * ${formatFileCandidates(candidates)}`)
          .join('\n'),
    );
    this.candidates = candidates;
  }
}

module.exports = FailedToResolvePathError;
