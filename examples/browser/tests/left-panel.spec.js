/********************************************************************************
 * Copyright (C) 2017 Ericsson and others.
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
describe('Left Activity Bar', function () {

    const { assert } = chai;

    /** @type {import('@theia/core/lib/browser/shell/application-shell')} */
    const { ApplicationShell } = window['theia']['@theia/core/lib/browser/shell/application-shell'];
    /** @type {import('@theia/navigator/lib/browser/navigator-contribution')} */
    const { FileNavigatorContribution } = window['theia']['@theia/navigator/lib/browser/navigator-contribution'];
    /** @type {import('@theia/scm/lib/browser/scm-contribution')} */
    const { SCM_VIEW_CONTAINER_TITLE_OPTIONS } = window['theia']['@theia/scm/lib/browser/scm-contribution'];

    /** @type {import('inversify').Container} */
    const container = window['theia'].container;
    const shell = container.get(ApplicationShell);
    const navigatorContribution = container.get(FileNavigatorContribution);

    before(() => {
        shell.leftPanelHandler.collapse();
    });

    it('should toggle Explorer', async () => {
        let navigator = await navigatorContribution.closeView();
        if (navigator) {
            assert.notEqual(shell.getAreaFor(navigator), 'left');
            assert.isFalse(navigator.isVisible);
            assert.notEqual(navigator, shell.activeWidget);
        }

        navigator = await navigatorContribution.toggleView();
        assert.notEqual(navigator, undefined);
        assert.equal(shell.getAreaFor(navigator), 'left');
        assert.isTrue(navigator.isVisible);
        assert.equal(navigator, shell.activeWidget);

        navigator = await navigatorContribution.toggleView();
        assert.notEqual(navigator, undefined);
        assert.equal(shell.getAreaFor(navigator), 'left');
        assert.isFalse(navigator.isVisible);
        assert.notEqual(navigator, shell.activeWidget);
    });

    /*describe('SCM tab', () => {
        it('should open/close the SCM tab', () => {
            leftPanel.openCloseTab('Source Control');
            expect(leftPanel.isScmContainerVisible()).to.be.true;
            expect(leftPanel.isTabActive('Source Control')).to.be.true;

            leftPanel.openCloseTab('Source Control');
            expect(leftPanel.isScmContainerVisible()).to.be.false;
            expect(leftPanel.isTabActive('Source Control')).to.be.false;
        });
    });*/

});
