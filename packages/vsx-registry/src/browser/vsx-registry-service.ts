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

import { injectable, inject, postConstruct } from 'inversify';
import * as showdown from 'showdown';
import * as sanitize from 'sanitize-html';
import { DisposableCollection, Emitter } from '@theia/core';
import { VSXRegistryAPI } from './vsx-registry-api';
import { VSXRegistrySearchParam, VSCodeExtensionPart, VSCodeExtensionFull, VSCodeExtensionReviewList } from './vsx-registry-types';
import { VSXRegistryModel } from './vsx-registry-model';
import { OpenerService, open } from '@theia/core/lib/browser';
import { VSXRegistryUri, VSXRegistryDetailOpenerOptions } from './view/detail/vsx-registry-open-handler';
import { PluginServer } from '@theia/plugin-ext';
import { HostedPluginSupport } from '@theia/plugin-ext/lib/hosted/browser/hosted-plugin';
import { VSXRegistryPreferences } from './vsx-registry-preferences';

export type ExtensionKeywords = string[];
export const ExtensionKeywords = Symbol('ExtensionKeyword');

@injectable()
export class VSXRegistryService {
    apiUrl: string;
    
    protected readonly toDispose = new DisposableCollection();

    protected readonly onDidUpdateSearchEmitter = new Emitter<void>();
    readonly onDidUpdateSearch = this.onDidUpdateSearchEmitter.event;

    protected readonly onDidUpdateInstalledEmitter = new Emitter<void>();
    readonly onDidUpdateInstalled = this.onDidUpdateInstalledEmitter.event;

    @inject(VSXRegistryAPI) protected readonly api: VSXRegistryAPI;
    @inject(VSXRegistryModel) protected readonly model: VSXRegistryModel;
    @inject(OpenerService) protected readonly openerService: OpenerService;
    @inject(HostedPluginSupport) protected readonly pluginSupport: HostedPluginSupport;
    @inject(PluginServer) protected readonly pluginServer: PluginServer;
    @inject(VSXRegistryPreferences) protected readonly vsxRegistryPreferences: VSXRegistryPreferences;

    @postConstruct()
    protected async init(): Promise<void> {
        this.vsxRegistryPreferences.onPreferenceChanged(e => {
            this.apiUrl = this.vsxRegistryPreferences['vsx-registry.api-url'];
            this.toDispose.push(this.pluginSupport.onDidChangePlugins(() => this.updateInstalled()));
            this.updateSearch();
            this.updateInstalled();
        });
    }

    protected createEndpoint(arr: string[], queries?: { key: string, value: string | number }[]): string {
        const url = '/' + arr.reduce((acc, curr) => acc + (curr ? '/' + curr : ''));
        const queryString = queries ? '?' + queries.map<string>(obj => obj.key + '=' + obj.value).join('&') : '';
        if (this.apiUrl) {
            return this.apiUrl + url + queryString;
        } else {
            throw Error('No URL for Open VSX Registry given. Enter an URL in preferences.');
        }
    }

    dispose(): void {
        this.toDispose.dispose();
    }

    async updateSearch(param?: VSXRegistrySearchParam): Promise<void> {
        const endpoint = this.createEndpoint(['-', 'search'], param && param.query ? [{ key: 'query', value: param.query }] : undefined);
        const extensions = await this.api.getExtensions(endpoint);
        this.model.registryExtensions = extensions;
        this.onDidUpdateSearchEmitter.fire(undefined);
    }

    async updateInstalled(): Promise<void> {
        const plugins = this.pluginSupport.plugins;
        const rawVSCodeExtensions: VSCodeExtensionPart[] = [];
        await Promise.all(plugins.map(async plugin => {
            if (plugin.model.engine.type === 'vscode') {
                const url = this.createEndpoint([plugin.model.publisher, plugin.model.name]);
                const ext = await this.api.getExtension(url);
                rawVSCodeExtensions.push({
                    ...ext,
                    url
                });
            }
        }));
        this.model.installedExtensions = rawVSCodeExtensions;
        this.onDidUpdateInstalledEmitter.fire();
    }

    async install(extension: VSCodeExtensionPart): Promise<void> {
        await this.pluginServer.deploy(extension.downloadUrl);
    }

    async uninstall(extension: VSCodeExtensionPart): Promise<void> {
        const id = extension.publisher.toLowerCase() + '.' + extension.name.toLowerCase();
        await this.pluginServer.undeploy(id);
    }

    async outdated(): Promise<VSCodeExtensionPart[]> {
        const result: VSCodeExtensionPart[] = [];
        const promises: Promise<void>[] = [];
        // TODO get outdated extensions
        await Promise.all(promises);
        return result;
    }

    async getExtensionDetail(extensionURL: string): Promise<VSCodeExtensionFull> {
        return this.api.getExtension(extensionURL);
    }

    async getExtensionReadMe(readMeUrl: string): Promise<string> {
        const readMeRaw = await this.api.getExtensionReadMe(readMeUrl);
        return readMeRaw;
    }

    async getExtensionReviews(reviewsUrl: string): Promise<VSCodeExtensionReviewList> {
        return this.api.getExtensionReviews(reviewsUrl);
    }

    async openExtensionDetail(extensionRaw: VSCodeExtensionPart): Promise<void> {
        const options: VSXRegistryDetailOpenerOptions = {
            mode: 'reveal',
            url: extensionRaw.url
        };
        open(this.openerService, VSXRegistryUri.toUri(extensionRaw.name), options);
    }

    async compileDocumentation(extension: VSCodeExtensionFull): Promise<string> {
        if (extension.readmeUrl) {
            const markdownConverter = new showdown.Converter({
                noHeaderId: true,
                strikethrough: true,
                headerLevelStart: 2
            });
            const readme = await this.api.getExtensionReadMe(extension.readmeUrl);
            const readmeHtml = markdownConverter.makeHtml(readme);
            return sanitize(readmeHtml, {
                allowedTags: sanitize.defaults.allowedTags.concat(['h1', 'h2', 'img'])
            });
        }
        return '';
    }
}
