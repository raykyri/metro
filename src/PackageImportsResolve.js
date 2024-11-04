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

const InvalidPackageConfigurationError = require('./errors/InvalidPackageConfigurationError');
const PackageImportNotResolvedError = require('./errors/PackageImportNotResolvedError');
const resolveAsset = require('./resolveAsset');
const isAssetFile = require('./utils/isAssetFile');
const {isSubpathDefinedInExportsLike} = require('./utils/isSubpathDefinedInExportsLike');
const {matchSubpathFromExportsLike} = require('./utils/matchSubpathFromExportsLike');
const path = require('path');

/**
 * Resolve a package subpath based on the entry points defined in the package's
 * "imports" field. If there is no match for the given subpath (which may be
 * augmented by resolution of conditional exports for the passed `context`),
 * throws a `PackagePathNotExportedError`.
 *
 * Implementation of PACKAGE_IMPORTS_RESOLVE described in https://nodejs.org/api/esm.html
 *
 * @throws {InvalidPackageConfigurationError} Raised if configuration specified
 *   by `importsMap` is invalid.
 */
function resolvePackageTargetFromImports(
  context,
  packagePath,
  importPath,
  importsMap,
  platform,
) {
  const createConfigError = (reason) => {
    return new InvalidPackageConfigurationError({
      reason,
      packagePath,
    });
  };

  const firstLevelKeys = Object.keys(importsMap);
  const keysWithoutPrefix = firstLevelKeys.filter(key => !key.startsWith('#'));
  if (firstLevelKeys.length === 0) {
    throw createConfigError('The "imports" field cannot be empty');
  } else if (keysWithoutPrefix.length !== 0) {
    throw createConfigError(
      'The "imports" field cannot have keys which do not start with #',
    );
  }

  const normalizedMap = new Map(Object.entries(importsMap));
  if (!isSubpathDefinedInExportsLike(normalizedMap, importPath)) {
    throw new PackageImportNotResolvedError({
      importSpecifier: importPath,
      reason: `"${importPath}" could not be matched using "imports" of ${packagePath}`,
    });
  }

  const {target, patternMatch} = matchSubpathFromExportsLike(
    context,
    importPath,
    normalizedMap,
    platform,
    createConfigError,
  );

  if (target == null) {
    throw new PackageImportNotResolvedError({
      importSpecifier: importPath,
      reason:
        `"${importPath}" which matches a subpath "imports" in ${packagePath}` +
        `however no match was resolved for this request (platform = ${platform ?? 'null'}).`,
    });
  }

  const filePath = path.join(
    packagePath,
    patternMatch != null ? target.replace('*', patternMatch) : target,
  );

  if (isAssetFile(filePath, context.assetExts)) {
    const assetResult = resolveAsset(context, filePath);

    if (assetResult != null) {
      return assetResult;
    }
  }

  const lookupResult = context.fileSystemLookup(filePath);
  if (lookupResult.exists && lookupResult.type === 'f') {
    return {
      type: 'sourceFile',
      filePath: lookupResult.realPath,
    };
  }

  throw createConfigError(
    `The resolved path for "${importPath}" defined in "imports" is ${filePath}, ` +
      'however this file does not exist.',
  );
}

module.exports = {
  resolvePackageTargetFromImports,
};
