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

const {redirectModulePath} = require('./PackageResolve');

/**
 * Helper used by the `metro` package to create the `ResolutionContext` object.
 * As context values can be overridden by callers, this occurs externally to
 * `resolve.js`.
 */
function createDefaultContext(
  context,
  dependency,
) {
  return {
    redirectModulePath: (modulePath) =>
      redirectModulePath(context, modulePath),
    dependency,
    ...context,
  };
}

module.exports = createDefaultContext;
