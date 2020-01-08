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

// @ts-check
describe('Editors', function () {

    const { assert } = chai;

    /** @type {import('@theia/editor/lib/browser/editor-manager')} */
    const { EditorManager } = window['theia']['@theia/editor/lib/browser/editor-manager'];
    /** @type {import('@theia/core/lib/common/uri')} */
    const Uri = window['theia']['@theia/core/lib/common/uri'];
    /** @type {import('@theia/workspace/lib/browser/workspace-service')} */
    const { WorkspaceService } = window['theia']['@theia/workspace/lib/browser/workspace-service'];
    
    /** @type {import('inversify').Container} */
    const container = window['theia'].container;
    const editorManager = container.get(EditorManager);
    const workspaceService = container.get(WorkspaceService);

    before(function () {
        for (const editor of editorManager.all) {
            editor.close();
        }
    });

    it('open', async () => {
        const root = (await workspaceService.roots)[0];
        assert.equal(editorManager.all.length, 0);
        await editorManager.open(new Uri.default(root.uri).resolve('package.json'), {
            mode: 'reveal'
        });
        assert.equal(editorManager.all.length, 1);
    });

});
