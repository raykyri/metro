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



const path = require('path');

/**
 * Resolve a file path as an asset. Returns the set of files found after
 * expanding asset resolutions (e.g. `icon@2x.png`). Users may override this
 * behaviour via `context.resolveAsset`.
 */
module.exports = function resolveAsset(
  context                   ,
  filePath        ,
)                         {
  const dirPath = path.dirname(filePath);
  const extension = path.extname(filePath);
  const basename = path.basename(filePath, extension);

  try {
    if (!/@\d+(?:\.\d+)?x$/.test(basename)) {
      const assets = context.resolveAsset(dirPath, basename, extension);
      if (assets != null) {
        return {
          type: 'assetFiles',
          filePaths: assets,
        };
      }
    }
  } catch (e) {}

  return null;
}
