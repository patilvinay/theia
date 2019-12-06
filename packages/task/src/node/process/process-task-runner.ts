/********************************************************************************
 * Copyright (C) 2017-2019 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject, named } from 'inversify';
import { isWindows, isOSX, ILogger } from '@theia/core';
import { FileUri } from '@theia/core/lib/node';
import {
    RawProcessFactory,
    TerminalProcessFactory,
    ProcessErrorEvent,
    Process,
} from '@theia/process/lib/node';
import { ShellQuotedString, ShellQuotingFunctions, BashQuotingFunctions, CmdQuotingFunctions, PowershellQuotingFunctions, createShellCommandLine, ShellQuoting } from '@theia/process/lib/common/shell-quoting';
import { TaskFactory } from './process-task';
import { TaskRunner } from '../task-runner';
import { Task } from '../task';
import { TaskConfiguration } from '../../common/task-protocol';
import { ProcessTaskError, CommandOptions } from '../../common/process/task-protocol';
import * as fs from 'fs';
import { ShellProcess } from '@theia/terminal/lib/node/shell-process';
import { deepClone } from '@theia/core';

/**
 * Task runner that runs a task as a process or a command inside a shell.
 */
@injectable()
export class ProcessTaskRunner implements TaskRunner {

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    @inject(RawProcessFactory)
    protected readonly rawProcessFactory: RawProcessFactory;

    @inject(TerminalProcessFactory)
    protected readonly terminalProcessFactory: TerminalProcessFactory;

    @inject(TaskFactory)
    protected readonly taskFactory: TaskFactory;

    /**
     * Runs a task from the given task configuration.
     * @param taskConfig task configuration to run a task from. The provided task configuration must have a shape of `CommandProperties`.
     */
    async run(taskConfig: TaskConfiguration, ctx?: string): Promise<Task> {
        if (!taskConfig.command) {
            throw new Error("Process task config must have 'command' property specified");
        }
        try {
            // Always spawn a task in a pty, the only difference between shell/process tasks is the
            // way the command is passed:
            // - process: directly look for an executable and pass a specific set of arguments/options.
            // - shell: defer the spawning to a shell that will evaluate a command line with our executable.
            // tslint:disable-next-line: no-void-expression
            const terminal: Process = this.terminalProcessFactory(this.getResolvedCommand(taskConfig));

            // Wait for the confirmation that the process is successfully started, or has failed to start.
            await new Promise((resolve, reject) => {
                terminal.onStart(resolve);
                terminal.onError((error: ProcessErrorEvent) => {
                    reject(ProcessTaskError.CouldNotRun(error.code));
                });
            });

            return this.taskFactory({
                label: taskConfig.label,
                process: terminal,
                processType: taskConfig.type as 'process' | 'shell',
                context: ctx,
                config: taskConfig
            });
        } catch (error) {
            this.logger.error(`Error occurred while creating task: ${error}`);
            throw error;
        }
    }

    private getResolvedCommand(taskConfig: TaskConfiguration): {
        command: string
        args: string[]
        options: CommandOptions
    } {
        let systemSpecificCommand: {
            command: string | undefined
            args: Array<string | ShellQuotedString> | undefined
            options: CommandOptions
        };
        // on windows, windows-specific options, if available, take precedence
        if (isWindows && taskConfig.windows !== undefined) {
            systemSpecificCommand = this.getSystemSpecificCommand(taskConfig, 'windows');
        } else if (isOSX && taskConfig.osx !== undefined) { // on macOS, mac-specific options, if available, take precedence
            systemSpecificCommand = this.getSystemSpecificCommand(taskConfig, 'osx');
        } else if (!isWindows && !isOSX && taskConfig.linux !== undefined) { // on linux, linux-specific options, if available, take precedence
            systemSpecificCommand = this.getSystemSpecificCommand(taskConfig, 'linux');
        } else { // system-specific options are unavailable, use the default
            systemSpecificCommand = this.getSystemSpecificCommand(taskConfig, undefined);
        }

        const options = systemSpecificCommand.options;
        // sanity checks:
        // - we expect the cwd to be set by the client.
        if (!options || !options.cwd) {
            throw new Error("Can't run a task when 'cwd' is not provided by the client");
        }

        // Use task's cwd with spawned process and pass node env object to
        // new process, so e.g. we can re-use the system path
        if (options) {
            options.env = {
                ...process.env,
                ...(options.env || {})
            };
        }

        if (typeof systemSpecificCommand.command === 'undefined') {
            throw new Error('The `command` field of a task cannot be undefined.');
        }

        let args: string[];
        let command = systemSpecificCommand.command;

        if (taskConfig.type === 'shell') {

            let execArgs: string[] = [];
            let quotingFunctions: ShellQuotingFunctions | undefined;
            const { shell } = systemSpecificCommand.options;

            // Actual command to execute is now a shell.
            // Thing to be run will be passed as an argument.
            command = shell && shell.executable || ShellProcess.getShellExecutablePath();

            if (/bash(.exe)?$/.test(command)) {
                quotingFunctions = BashQuotingFunctions;
                execArgs = ['-l', '-c'];

            } else if (/cmd(.exe)?$/.test(command)) {
                quotingFunctions = CmdQuotingFunctions;
                execArgs = ['/c'];

            } else if (/(ps|pwsh|powershell)(.exe)?/.test(command)) {
                quotingFunctions = PowershellQuotingFunctions;
                execArgs = ['-c'];
            }

            // Allow overriding shell options from task configuration.
            args = [...shell && shell.args || execArgs];

            // Check if an argument list is defined or not. It can be empty.
            if (systemSpecificCommand.args) {
                // Arguments are provided, so "command" is actually an executable we want to execute with args.
                args.push(createShellCommandLine(
                    [systemSpecificCommand.command, ...systemSpecificCommand.args]
                        // We want to quote arguments only if needed.
                        .map(arg => (quotingFunctions && typeof arg === 'string' && this.argumentNeedsQuotes(arg, quotingFunctions)) ? <ShellQuotedString>{
                            quoting: ShellQuoting.Strong,
                            value: arg,
                        } : arg),
                    quotingFunctions));
            } else {
                // No arguments are provided, so "command" is actually the full command line to execute.
                args.push(systemSpecificCommand.command);
            }

        } else {
            // Normalize arguments from `ShellQuotedString` to `string`.
            args = systemSpecificCommand.args && systemSpecificCommand.args
                .map(arg => typeof arg === 'string' ? arg : arg.value) || [];
        }
        return { command, args, options };
    }

    /**
     * This is task specific, to align with VS Code's behavior.
     *
     * When parsing arguments, VS Code will try to detect if the user already
     * tried to quote things.
     *
     * See: https://github.com/microsoft/vscode/blob/d363b988e1e58cf49963841c498681cdc6cb55a3/src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts#L1101-L1127
     *
     * @param value
     * @param shellQuotingOptions
     */
    protected argumentNeedsQuotes(value: string, shellQuotingOptions: ShellQuotingFunctions): boolean {
        const { characters } = shellQuotingOptions;
        const needQuotes = new Set([' ', ...characters.needQuotes]);
        if (!characters) {
            return false;
        }
        if (value.length >= 2) {
            const first = value[0] === characters.strong ? characters.strong : value[0] === characters.weak ? characters.weak : undefined;
            if (first === value[value.length - 1]) {
                return false;
            }
        }
        let quote: string | undefined;
        for (let i = 0; i < value.length; i++) {
            // We found the end quote.
            const ch = value[i];
            if (ch === quote) {
                quote = undefined;
            } else if (quote !== undefined) {
                // skip the character. We are quoted.
                continue;
            } else if (ch === characters.escape) {
                // Skip the next character
                i++;
            } else if (ch === characters.strong || ch === characters.weak) {
                quote = ch;
            } else if (needQuotes.has(ch)) {
                return true;
            }
        }
        return false;
    }

    private getSystemSpecificCommand(taskConfig: TaskConfiguration, system: 'windows' | 'linux' | 'osx' | undefined): {
        command: string | undefined,
        args: Array<string | ShellQuotedString> | undefined,
        options: CommandOptions
    } {
        // initialize with default values from the `taskConfig`
        let command: string | undefined = taskConfig.command;
        let args: Array<string | ShellQuotedString> | undefined = taskConfig.args;
        let options: CommandOptions = deepClone(taskConfig.options) || {};

        if (system) {
            if (taskConfig[system].command) {
                command = taskConfig[system].command;
            }
            if (taskConfig[system].args) {
                args = taskConfig[system].args;
            }
            if (taskConfig[system].options) {
                options = taskConfig[system].options;
            }
        }

        if (options.cwd) {
            options.cwd = this.asFsPath(options.cwd);
        }

        return { command, args, options };
    }

    protected asFsPath(uriOrPath: string): string {
        return (uriOrPath.startsWith('file:'))
            ? FileUri.fsPath(uriOrPath)
            : uriOrPath;
    }

    /**
     * @deprecated
     *
     * Remove ProcessTaskRunner.findCommand, introduce process "started" event
     * Checks for the existence of a file, at the provided path, and make sure that
     * it's readable and executable.
     */
    protected async executableFileExists(filePath: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            fs.access(filePath, fs.constants.F_OK | fs.constants.X_OK, err => {
                resolve(err ? false : true);
            });
        });
    }
}
