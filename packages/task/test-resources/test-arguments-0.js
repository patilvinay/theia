const {
    compareArrayValues
} = require('./compare')

if (compareArrayValues(process.argv.slice(3), ['a', 'b', 'c'])) {
    process.exit(0) // OK
} else {
    process.exit(1) // NOT OK
}
