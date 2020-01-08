// @ts-check

/**
 * @typedef {Object} TestOptions
 * @property {boolean} exit
 * @property {import('puppeteer').LaunchOptions} launch
 * @property {Partial<Parameters<import('mocha/lib/cli/collect-files')>[0]>} collectFiles
 */

/**
 * @param {Partial<TestOptions>} [options]
 */
module.exports = async options => {
    const exit = options && options.exit || false;
    const launch = options && options.launch;
    const collectFiles = {
        ignore: options && options.collectFiles && options.collectFiles.ignore || [],
        extension: options && options.collectFiles && options.collectFiles.extension || [],
        file: options && options.collectFiles && options.collectFiles.file || [],
        recursive: options && options.collectFiles && options.collectFiles.recursive || false,
        sort: options && options.collectFiles && options.collectFiles.sort || false,
        spec: options && options.collectFiles && options.collectFiles.spec || []
    };

    const files = require('mocha/lib/cli/collect-files')(collectFiles);
    const puppeteer = require('puppeteer');

    const address = await require('../src-gen/backend/main');
    const browser = await puppeteer.launch(launch);

    const page = await browser.newPage();
    page.on('dialog', dialog => dialog.dismiss());
    page.on('pageerror', console.error);

    let chaiLoaded = false;
    page.exposeFunction('unloadChai', () => chaiLoaded = false);
    const loadChai = () => {
        if (chaiLoaded) {
            return;
        }
        console.log('loading chai...');
        chaiLoaded = true;
        page.addScriptTag({ path: require.resolve('chai/chai.js') });
        page.evaluate(() =>
            window.addEventListener('beforeunload', () => window['unloadChai']())
        );
    }
    page.on('frameattached', loadChai);
    page.on('framenavigated', loadChai);

    page.on('load', async () => {
        console.log('loading mocha...');
        // replace console.log by theia logger for mocha
        await page.waitForFunction(() => !!window['theia']['@theia/core/lib/common/logger'].logger, {
            timeout: 30 * 1000
        });
        await page.addScriptTag({ path: require.resolve('mocha/mocha.js') });

        console.log('loading test files...');
        await page.waitForFunction(() => !!window['chai'] && !!window['mocha'] && !!window['theia'].container, {
            timeout: 30 * 1000
        });
        await page.evaluate(async () => {
            mocha.setup({
                reporter: 'spec',
                ui: 'bdd',
                useColors: true
            });
        });
        for (const file of files) {
            await page.addScriptTag({ path: file });
        }
        const failures = await page.evaluate(async () => {
            /** @type {import('@theia/core/lib/browser/frontend-application-state')} */
            const { FrontendApplicationStateService } = window['theia']['@theia/core/lib/browser/frontend-application-state'];
            /** @type {import('@theia/core/lib/browser/preferences/preference-service')} */
            const { PreferenceService } = window['theia']['@theia/core/lib/browser/preferences/preference-service'];
            /** @type {import('@theia/workspace/lib/browser/workspace-service')} */
            const { WorkspaceService } = window['theia']['@theia/workspace/lib/browser/workspace-service'];

            /** @type {import('inversify').Container} */
            const container = window['theia'].container;
            const frontendApplicationState = container.get(FrontendApplicationStateService);
            /** @type {import('@theia/core/lib/browser/preferences/preference-service').PreferenceService} */
            const preferenceService = container.get(PreferenceService);
            const workspaceService = container.get(WorkspaceService);

            await Promise.all([
                frontendApplicationState.reachedState('ready'),
                preferenceService.ready,
                workspaceService.roots
            ]);

            return new Promise(resolve => mocha.run(resolve))
        });
        if (exit) {
            await page.close();
            process.exit(failures > 0 ? 1 : 0);
        }
    });
    page.goto(`http://${address.address}:${address.port}`);
}
