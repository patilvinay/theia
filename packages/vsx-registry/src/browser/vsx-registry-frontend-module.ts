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

import { ContainerModule, interfaces } from 'inversify';
import { WidgetFactory, bindViewContribution, FrontendApplicationContribution, ViewContainerIdentifier, OpenHandler } from '@theia/core/lib/browser';
import { VSXRegistryWidget, VSXRegistryInstalledList, VSXRegistryList } from './view/list/vsx-registry-widget';
import { VSXRegistryContribution } from './vsx-registry-contribution';
import { VSXRegistrySearchbarWidget } from './view/list/vsx-registry-searchbar-widget';
import { VSXRegistryListWidget } from './view/list/vsx-registry-list-widget';
import { VSXRegistryAPI } from './vsx-registry-api';
import { VSXRegistryService } from './vsx-registry-service';
import { VSXRegistryModel } from './vsx-registry-model';
import { VSXRegistryOpenHandler } from './view/detail/vsx-registry-open-handler';
import { VSXRegistryDetailWidgetFactory } from './view/detail/vsx-registry-detail-widget-factory';

import '../../src/browser/style/index.css';
import { bindVSXRegistryPreferences } from './vsx-registry-preferences';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';

export default new ContainerModule(bind => {
    bindViewContribution(bind, VSXRegistryContribution);
    bind(FrontendApplicationContribution).toService(VSXRegistryContribution);
    bind(ColorContribution).toService(VSXRegistryContribution);

    bind(VSXRegistrySearchbarWidget).toSelf().inSingletonScope();
    bind(VSXRegistryService).toSelf().inSingletonScope();
    bind(VSXRegistryModel).toSelf().inSingletonScope();
    bind(VSXRegistryAPI).toSelf().inSingletonScope();

    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: VSXRegistryWidget.ID,
        createWidget: async () => {
            const container = ctx.container.createChild();
            bindViewContainer(container);
            container.bind(ViewContainerIdentifier).toConstantValue({ id: VSXRegistryWidget.ID });
            container.bind(VSXRegistryWidget).toSelf().inSingletonScope();
            return container.get(VSXRegistryWidget);
        }
    })).inSingletonScope();

    bind(VSXRegistryDetailWidgetFactory).toSelf().inSingletonScope();
    bind(WidgetFactory).toService(VSXRegistryDetailWidgetFactory);

    bind(VSXRegistryOpenHandler).toSelf().inSingletonScope();
    bind(OpenHandler).toService(VSXRegistryOpenHandler);

    bindVSXRegistryPreferences(bind);
});

export function bindViewContainer(parent: interfaces.Container): void {
    parent.bind(VSXRegistryInstalledList).toDynamicValue(({ container }) =>
        VSXRegistryListWidget.createWidget(container,
            {
                id: 'installed_extension_list',
                label: 'Installed Extensions',
                location: 'installed'
            }));
    parent.bind(VSXRegistryList).toDynamicValue(({ container }) =>
        VSXRegistryListWidget.createWidget(container,
            {
                id: 'extension_list',
                label: 'Open VSX Registry',
                location: 'registry'
            }));
}
