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

import { injectable } from 'inversify';
import { VSCodeExtensionPart, VSCodeExtensionFull, VSCodeExtensionReviewList } from './vsx-registry-types';

export interface ExtensionRegistryAPIRequest<T> {
    endpoint: string,
    operation: (response: Response) => Promise<T>
    method: 'GET'
}

@injectable()
export class VSXRegistryAPI {
    async run<T>(req: ExtensionRegistryAPIRequest<T>): Promise<T> {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const param: RequestInit = {
            method: req.method,
            headers
        };

        const response = await fetch(req.endpoint, param);

        return await req.operation(response);
    }

    async getExtensions(endpoint: string): Promise<VSCodeExtensionPart[]> {
        const extensions = await this.run<VSCodeExtensionPart[]>({
            method: 'GET',
            endpoint,
            operation: async response => {
                const resp = await response.json() as { offset: number; extensions: VSCodeExtensionPart[] };
                return resp.extensions;
            }
        });
        return extensions;
    }

    async getExtension(endpoint: string): Promise<VSCodeExtensionFull> {
        const ext = await this.run<VSCodeExtensionFull>({
            method: 'GET',
            endpoint,
            operation: async response => await response.json()
        });
        return ext;
    }

    async getExtensionReadMe(endpoint: string): Promise<string> {
        const readme = await this.run<string>({
            method: 'GET',
            endpoint,
            operation: async response => await response.text()
        });
        return readme;
    }

    async getExtensionReviews(endpoint: string): Promise<VSCodeExtensionReviewList> {
        const reviews = await this.run<VSCodeExtensionReviewList>({
            method: 'GET',
            endpoint,
            operation: async response => await response.json()
        });
        return reviews;
    }
}
