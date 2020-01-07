/********************************************************************************
 * Copyright (C) 2019 TypeFox and others.
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

import { injectable, inject } from 'inversify';
import { MessageService, Command, CommandRegistry } from '@theia/core';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { VSXRegistryWidget } from './view/list/vsx-registry-widget';
import { Widget } from '@theia/core/lib/browser';
import { VSXRegistryService } from './vsx-registry-service';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry, Color } from '@theia/core/lib/browser/color-registry';

export namespace VSCodeExtensionsCommands {
    export const CLEAR_ALL: Command = {
        id: 'vsx-registry.clear-all',
        category: 'Extensions',
        label: 'Clear Search Results',
        iconClass: 'clear-all'
    };
}

@injectable()
export class VSXRegistryContribution extends AbstractViewContribution<VSXRegistryWidget> implements ColorContribution {

    @inject(MessageService) protected readonly messageService: MessageService;
    @inject(VSXRegistryService) protected readonly service: VSXRegistryService;

    constructor() {
        super({
            widgetId: VSXRegistryWidget.ID,
            widgetName: VSXRegistryWidget.LABEL,
            defaultWidgetOptions: {
                area: 'left',
                rank: 500
            },
            toggleCommandId: 'vsxRegistryView:toggle',
            toggleKeybinding: 'ctrlcmd+shift+x'
        });
    }

    async registerCommands(commands: CommandRegistry): Promise<void> {
        super.registerCommands(commands);
        commands.registerCommand(VSCodeExtensionsCommands.CLEAR_ALL, {
            execute: w => this.withWidget(w, widget => widget.clear()),
            isEnabled: w => this.withWidget(w, widget => !!widget.getSearchTerm()),
            isVisible: w => this.withWidget(w, () => true)
        });
    }

    async registerColors(colors: ColorRegistry): Promise<void> {
        colors.register(
            {
                id: 'extensionButton.prominentBackground', defaults: {
                    dark: '#327e36',
                    light: '#327e36'
                }, description: "Button background color for actions extension that stand out (e.g. install button)."
            },
            {
                id: 'extensionButton.prominentForeground', defaults: {
                    dark: Color.white,
                    light: Color.white
                }, description: "Button foreground color for actions extension that stand out (e.g. install button)."
            },
            {
                id: 'extensionButton.prominentHoverBackground', defaults: {
                    dark: '#28632b',
                    light: '#28632b'
                }, description: "Button background hover color for actions extension that stand out (e.g. install button)."
            }
        );
    }

    protected withWidget<T>(widget: Widget | undefined = this.tryGetWidget(), fn: (widget: VSXRegistryWidget) => T): T | false {
        if (widget instanceof VSXRegistryWidget && widget.id === VSXRegistryWidget.ID) {
            return fn(widget);
        }
        return false;
    }
}
