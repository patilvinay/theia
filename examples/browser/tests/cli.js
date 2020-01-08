// @ts-check
require('./run-test')({
    launch: {
        args: ['--no-sandbox'],
        devtools: true
    },
    collectFiles: {
        spec: ['tests/*.spec.js']
    }
});
