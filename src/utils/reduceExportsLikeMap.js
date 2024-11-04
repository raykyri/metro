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

/**
 * Reduce an "exports"-like mapping to a flat subpath mapping after resolving
 * conditional exports.
 */

function reduceExportsLikeMap(
  exportsLikeMap,
  conditionNames,
  createConfigError,
) {
  const result = new Map();

  for (const [subpath, value] of exportsLikeMap) {
    const subpathValue = reduceConditionalExport(value, conditionNames);

    // If a subpath has no resolution for the passed `conditionNames`, do not
    // include it in the result. (This includes only explicit `null` values,
    // which may conditionally hide higher-specificity subpath patterns.)
    if (subpathValue !== 'no-match') {
      result.set(subpath, subpathValue);
    }
  }

  for (const value of result.values()) {
    if (value != null && !value.startsWith('./')) {
      throw createConfigError(
        'One or more mappings for subpaths defined in "exports" are invalid. ' +
          'All values must begin with "./".',
      );
    }
  }

  return result;
}

/**
 * Reduce an "exports"-like subpath value after asserting the passed
 * `conditionNames` in any nested conditions.
 */
function reduceConditionalExport(
  subpathValue,
  conditionNames,
) {
  let reducedValue = subpathValue;

  while (reducedValue != null && typeof reducedValue !== 'string') {
    let match;

    // when conditions are present and default is not specified
    // the default condition is implicitly set to null, to allow
    // for restricting access to unexported internals of a package.
    if ('default' in reducedValue) {
      match = 'no-match';
    } else {
      match = null;
    }

    for (const conditionName in reducedValue) {
      if (conditionNames.has(conditionName)) {
        match = reducedValue[conditionName];
        break;
      }
    }

    reducedValue = match;
  }

  return reducedValue;
}

// Export the main function
module.exports = {
  reduceExportsLikeMap,
};
