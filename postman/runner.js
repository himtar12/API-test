const newman = require('newman');
const path = require('path');
const program = require('commander');

/////////////////////////////////////////////////////////////////////
// Test configurations, one config object per Newman invocation
/////////////////////////////////////////////////////////////////////
let testConfigs = [
    {
        name: 'Generic',
        options: {
            collection: 'collections/exchange rate.json',
            iterationData: ''
        }
    }
];
/////////////////////////////////////////////////////////////////////


function prepareOptions(envName, configObj) {
    let name = configObj.name;
    let options = {
        environment: path.join('envs', envName + '.postman_environment.json'),
        reporters: ['cli', 'junit'],
        reporter: {
            junit: { export: path.join('reports', 'TEST_' + name + '.xml') }
        },
        collection: configObj.options.collection
    }
    if (configObj.options['folder'])
        options.folder = configObj.options.folder;

    return options;
}


function run(envName) {
    for (let k = 0; k < testConfigs.length; k++) {
        let options = prepareOptions(envName, testConfigs[k]);
        newman.run(options, (err) => {
            if (err) {
                throw err;
            }
            console.log('Collection run complete!');
        });
    }
}


program
    .option('-e, --environment <name>', 'Specify environment filename prefix to use')
    .parse(process.argv);

// Default options
let envName = program.environment ? program.environment : 'dev';

console.log('Start test for environment "' + envName + '"');
run(envName);