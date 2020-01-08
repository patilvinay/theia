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

const path = require('path');
import * as webpack from 'webpack';
import { ApplicationPackage } from '@theia/application-package/lib/application-package';

const extensions: { dir: string, name: string }[] = [];
for (const extensionPackage of new ApplicationPackage({ projectPath: process.cwd() }).extensionPackages) {
    extensions.push({
        name: extensionPackage.name,
        dir: path.dirname(extensionPackage.raw.installed!.packagePath)
    });
}

export = function (this: webpack.loader.LoaderContext, source: string): string {
    if (this.cacheable) {
        this.cacheable();
    }

    const extension = extensions.find(({ dir }) => this.resourcePath.startsWith(dir));
    if (extension) {
        const { dir, name } = path.parse(this.resourcePath);
        let moduleName = path.join(extension.name, dir.substring(extension.dir.length));
        if (name !== 'index') {
            moduleName = path.join(moduleName, name);
        }
        return source + `(global['theia'] = global['theia'] || {})['${moduleName}'] = exports;\n`;
    }
    return source;
};
