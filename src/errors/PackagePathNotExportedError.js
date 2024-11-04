/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *       strict
 * @format
 * @oncall react_native
 */

/**
 * Raised when package exports do not define or permit a target subpath in the
 * package for the given module.
 */
class PackagePathNotExportedError extends Error {}

module.exports = PackagePathNotExportedError;
