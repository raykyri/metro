/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

'use strict';

const chalk = require('chalk');
const formatBanner = require('./formatBanner');
const path = require('path');
const reporting = require('./reporting');
const throttle = require('lodash/throttle');

const {
  AmbiguousModuleResolutionError,
} = require('../node-haste/DependencyGraph/ResolutionRequest');

import type {BundleOptions} from '../shared/types.flow';
import type Terminal from './Terminal';
import type {ReportableEvent, GlobalCacheDisabledReason} from './reporting';

const DEP_GRAPH_MESSAGE = 'Loading dependency graph';
const GLOBAL_CACHE_DISABLED_MESSAGE_FORMAT =
  'The global cache is now disabled because %s';

type BundleProgress = {
  bundleOptions: BundleOptions,
  transformedFileCount: number,
  totalFileCount: number,
  ratio: number,
};

const DARK_BLOCK_CHAR = '\u2593';
const LIGHT_BLOCK_CHAR = '\u2591';
const MAX_PROGRESS_BAR_CHAR_WIDTH = 16;

export type TerminalReportableEvent =
  | ReportableEvent
  | {
      buildID: string,
      type: 'bundle_transform_progressed_throttled',
      transformedFileCount: number,
      totalFileCount: number,
    };

type BuildPhase = 'in_progress' | 'done' | 'failed';

/**
 * We try to print useful information to the terminal for interactive builds.
 * This implements the `Reporter` interface from the './reporting' module.
 */
class TerminalReporter {
  /**
   * The bundle builds for which we are actively maintaining the status on the
   * terminal, ie. showing a progress bar. There can be several bundles being
   * built at the same time.
   */
  _activeBundles: Map<string, BundleProgress>;

  _dependencyGraphHasLoaded: boolean;
  _scheduleUpdateBundleProgress: (data: {
    buildID: string,
    transformedFileCount: number,
    totalFileCount: number,
  }) => void;

  +terminal: Terminal;

  constructor(terminal: Terminal) {
    this._dependencyGraphHasLoaded = false;
    this._activeBundles = new Map();
    this._scheduleUpdateBundleProgress = throttle(data => {
      this.update({...data, type: 'bundle_transform_progressed_throttled'});
    }, 100);
    (this: any).terminal = terminal;
  }

  /**
   * Construct a message that represents the progress of a
   * single bundle build, for example:
   *
   *     BUNDLE [ios, dev, minified] foo.js  ▓▓▓▓▓░░░░░░░░░░░ 36.6% (4790/7922)
   */
  _getBundleStatusMessage(
    {
      bundleOptions,
      transformedFileCount,
      totalFileCount,
      ratio,
    }: BundleProgress,
    phase: BuildPhase,
  ): string {
    const localPath = path.relative('.', bundleOptions.entryFile);
    const fileName = path.basename(localPath);
    const dirName = path.dirname(localPath);

    const platform = bundleOptions.platform
      ? bundleOptions.platform + ', '
      : '';
    const devOrProd = bundleOptions.dev ? 'dev' : 'prod';
    const min = bundleOptions.minify ? ', minified' : '';
    const progress = (100 * ratio).toFixed(1);
    const currentPhase =
      phase === 'done' ? ', done.' : phase === 'failed' ? ', failed.' : '';

    const filledBar = Math.floor(ratio * MAX_PROGRESS_BAR_CHAR_WIDTH);

    return (
      chalk.inverse.green.bold(` ${bundleOptions.bundleType.toUpperCase()} `) +
      chalk.dim(` [${platform}${devOrProd}${min}] ${dirName}/`) +
      chalk.bold(fileName) +
      ' ' +
      chalk.green.bgGreen(DARK_BLOCK_CHAR.repeat(filledBar)) +
      chalk.bgWhite.white(
        LIGHT_BLOCK_CHAR.repeat(MAX_PROGRESS_BAR_CHAR_WIDTH - filledBar),
      ) +
      chalk.bold(` ${progress}% `) +
      chalk.dim(`(${transformedFileCount}/${totalFileCount})`) +
      currentPhase +
      '\n'
    );
  }

  _logCacheDisabled(reason: GlobalCacheDisabledReason): void {
    const format = GLOBAL_CACHE_DISABLED_MESSAGE_FORMAT;
    switch (reason) {
      case 'too_many_errors':
        reporting.logWarning(
          this.terminal,
          format,
          'it has been failing too many times.',
        );
        break;
      case 'too_many_misses':
        reporting.logWarning(
          this.terminal,
          format,
          'it has been missing too many consecutive keys.',
        );
        break;
    }
  }

  _logBundleBuildDone(buildID: string) {
    const progress = this._activeBundles.get(buildID);
    if (progress != null) {
      const msg = this._getBundleStatusMessage(
        {
          ...progress,
          ratio: 1,
          transformedFileCount: progress.totalFileCount,
        },
        'done',
      );
      this.terminal.log(msg);
    }
  }

  _logBundleBuildFailed(buildID: string) {
    const progress = this._activeBundles.get(buildID);
    if (progress != null) {
      const msg = this._getBundleStatusMessage(progress, 'failed');
      this.terminal.log(msg);
    }
  }

  _logInitializing(port: number, projectRoots: $ReadOnlyArray<string>) {
    this.terminal.log(
      formatBanner(
        'Running Metro Bundler on port ' +
          port +
          '.\n\n' +
          'Keep Metro Bundler running while developing on any JS projects. ' +
          'Feel free to close this tab and run your own Metro Bundler ' +
          ' instance if you prefer.\n\n' +
          'https://github.com/facebook/react-native',
        {
          marginLeft: 1,
          marginRight: 1,
          paddingBottom: 1,
        },
      ),
    );

    this.terminal.log(
      'Looking for JS files in\n  ',
      chalk.dim(projectRoots.join('\n   ')),
      '\n',
    );
  }

  _logInitializingFailed(port: number, error: Error) {
    if (error.code === 'EADDRINUSE') {
      this.terminal.log(
        chalk.bgRed.bold(' ERROR '),
        chalk.red("Metro Bundler can't listen on port", chalk.bold(port)),
      );
      this.terminal.log(
        'Most likely another process is already using this port',
      );
      this.terminal.log('Run the following command to find out which process:');
      this.terminal.log('\n  ', chalk.bold('lsof -i :' + port), '\n');
      this.terminal.log('Then, you can either shut down the other process:');
      this.terminal.log('\n  ', chalk.bold('kill -9 <PID>'), '\n');
      this.terminal.log('or run Metro Bundler on different port.');
    } else {
      this.terminal.log(chalk.bgRed.bold(' ERROR '), chalk.red(error.message));
      const errorAttributes = JSON.stringify(error);
      if (errorAttributes !== '{}') {
        this.terminal.log(chalk.red(errorAttributes));
      }
      this.terminal.log(chalk.red(error.stack));
    }
  }

  /**
   * This function is only concerned with logging and should not do state
   * or terminal status updates.
   */
  _log(event: TerminalReportableEvent): void {
    switch (event.type) {
      case 'initialize_started':
        this._logInitializing(event.port, event.projectRoots);
        break;
      case 'initialize_done':
        this.terminal.log('\nMetro Bundler ready.\n');
        break;
      case 'initialize_failed':
        this._logInitializingFailed(event.port, event.error);
        break;
      case 'bundle_build_done':
        this._logBundleBuildDone(event.buildID);
        break;
      case 'bundle_build_failed':
        this._logBundleBuildFailed(event.buildID);
        break;
      case 'bundling_error':
        this._logBundlingError(event.error);
        break;
      case 'dep_graph_loaded':
        this.terminal.log(`${DEP_GRAPH_MESSAGE}, done.`);
        break;
      case 'global_cache_disabled':
        this._logCacheDisabled(event.reason);
        break;
      case 'transform_cache_reset':
        reporting.logWarning(this.terminal, 'the transform cache was reset.');
        break;
      case 'worker_stdout_chunk':
        this._logWorkerChunk('stdout', event.chunk);
        break;
      case 'worker_stderr_chunk':
        this._logWorkerChunk('stderr', event.chunk);
        break;
      case 'hmr_client_error':
        this._logHmrClientError(event.error);
        break;
    }
  }

  /**
   * We do not want to log the whole stacktrace for bundling error, because
   * these are operational errors, not programming errors, and the stacktrace
   * is not actionable to end users.
   */
  _logBundlingError(error: Error) {
    if (error instanceof AmbiguousModuleResolutionError) {
      const he = error.hasteError;
      const message =
        'ambiguous resolution: module `' +
        `${error.fromModulePath}\` tries to require \`${he.hasteName}\`, ` +
        `but there are several files providing this module. You can delete ` +
        'or fix them: \n\n' +
        Object.keys(he.duplicatesSet)
          .sort()
          .map(dupFilePath => `  * \`${dupFilePath}\`\n`)
          .join('');
      this._logBundlingErrorMessage(message);
      return;
    }

    let message =
      error.snippet == null && error.stack != null
        ? error.stack
        : error.message;
    //$FlowFixMe T19379628
    if (error.filename && !message.includes(error.filename)) {
      //$FlowFixMe T19379628
      message += ` [${error.filename}]`;
    }

    if (error.snippet != null) {
      //$FlowFixMe T19379628
      message += '\n' + error.snippet;
    }
    this._logBundlingErrorMessage(message);
  }

  _logBundlingErrorMessage(message: string) {
    reporting.logError(this.terminal, 'bundling failed: %s', message);
  }

  _logWorkerChunk(origin: 'stdout' | 'stderr', chunk: string) {
    const lines = chunk.split('\n');
    if (lines.length >= 1 && lines[lines.length - 1] === '') {
      lines.splice(lines.length - 1, 1);
    }
    lines.forEach(line => {
      this.terminal.log(`transform[${origin}]: ${line}`);
    });
  }

  /**
   * We use Math.pow(ratio, 2) to as a conservative measure of progress because
   * we know the `totalCount` is going to progressively increase as well. We
   * also prevent the ratio from going backwards.
   */
  _updateBundleProgress({
    buildID,
    transformedFileCount,
    totalFileCount,
  }: {
    buildID: string,
    transformedFileCount: number,
    totalFileCount: number,
  }) {
    const currentProgress = this._activeBundles.get(buildID);
    if (currentProgress == null) {
      return;
    }
    const rawRatio = transformedFileCount / totalFileCount;
    const conservativeRatio = Math.pow(rawRatio, 2);
    const ratio = Math.max(conservativeRatio, currentProgress.ratio);
    Object.assign(currentProgress, {
      ratio,
      transformedFileCount,
      totalFileCount,
    });
  }

  /**
   * This function is exclusively concerned with updating the internal state.
   * No logging or status updates should be done at this point.
   */
  _updateState(event: TerminalReportableEvent): void {
    switch (event.type) {
      case 'bundle_build_done':
      case 'bundle_build_failed':
        this._activeBundles.delete(event.buildID);
        break;
      case 'bundle_build_started':
        this._activeBundles.set(event.buildID, {
          bundleOptions: event.bundleOptions,
          transformedFileCount: 0,
          totalFileCount: 1,
          ratio: 0,
        });
        break;
      case 'bundle_transform_progressed':
        if (event.totalFileCount === event.transformedFileCount) {
          this._scheduleUpdateBundleProgress.cancel();
          this._updateBundleProgress(event);
        } else {
          this._scheduleUpdateBundleProgress(event);
        }
        break;
      case 'bundle_transform_progressed_throttled':
        this._updateBundleProgress(event);
        break;
      case 'dep_graph_loading':
        this._dependencyGraphHasLoaded = false;
        break;
      case 'dep_graph_loaded':
        this._dependencyGraphHasLoaded = true;
        break;
    }
  }

  _getDepGraphStatusMessage(): ?string {
    if (!this._dependencyGraphHasLoaded) {
      return `${DEP_GRAPH_MESSAGE}...`;
    }
    return null;
  }

  /**
   * Return a status message that is always consistent with the current state
   * of the application. Having this single function ensures we don't have
   * different callsites overriding each other status messages.
   */
  _getStatusMessage(): string {
    return [this._getDepGraphStatusMessage()]
      .concat(
        Array.from(this._activeBundles.entries()).map(([_, progress]) =>
          this._getBundleStatusMessage(progress, 'in_progress'),
        ),
      )
      .filter(str => str != null)
      .join('\n');
  }

  _logHmrClientError(e: Error): void {
    reporting.logError(
      this.terminal,
      'A WebSocket client got a connection error. Please reload your device ' +
        'to get HMR working again: %s',
      e,
    );
  }

  /**
   * Single entry point for reporting events. That allows us to implement the
   * corresponding JSON reporter easily and have a consistent reporting.
   */
  update(event: TerminalReportableEvent) {
    this._log(event);
    this._updateState(event);
    this.terminal.status(this._getStatusMessage());
  }
}

module.exports = TerminalReporter;
