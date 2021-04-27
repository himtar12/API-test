const fs = require('fs');
const path = require('path');
const ps = require('child_process');
const program = require('commander');
const xmlescape = require('xml-escape');

program.version('0.0.1');
program
  .option('-t, --tests <pattern>', 'select tests to run based on the pattern given. Only tests including the given string are executed')
  .option('-s, --suites <suite(s)>', 'select test suite(s) to run. "all" will run all available suites')
  .option('-o, --output <path>', 'output path for test report. Defaults to "TestReport.xml"')
  .option('-e, --environment <path>', 'points to the environment given at the run time')

program.parse(process.argv);

async function run(command) {
  return new Promise((resolve, reject) => {
    const proc = ps.exec(command, { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      }

      resolve({ stdout, stderr });
    });

    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
  });
}

function publish(tests) {
  let out = `<?xml version="1.0" encoding="UTF-8" ?>`;
  out += `<testsuites>`;

  for (const suite of tests.suites) {
    if (suite.tests.length < 1) continue;

    out += `<testsuite name="${suite.name}" tests="${suite.tests.length}" errors="${suite.errors}" failures="${suite.failures}" time="${suite.elapsed}">`;

    for (const test of suite.tests) {
      out += `<testcase name="${test.name}" classname="${suite.name}.${test.name}" time="${test.elapsed}">`;
      if (test.failure) {
        out += `<failure>`;
        out += xmlescape(test.error.toString());
        out += `</failure>`;
      }
      out += `</testcase>`;
    }

    out += `</testsuite>`;
  }

  out += `</testsuites>`;

  const reportPath = program.output ? program.output : 'TestReport.xml';

  fs.writeFileSync(reportPath, out);
}

async function suite(tests, configPath, suitePath, outPath,env) {
  const files = fs.readdirSync(suitePath);
  const suite = {
    id: suitePath,
    name: suitePath,
    errors: 0,
    failures: 0,
    tests: [],
    start: Date.now()
  }

  const testFilter = program.tests ? program.tests : null;

  for (const file of files) {
    if (!file.endsWith('.yml')) continue;
    if (testFilter && !file.includes(testFilter)) continue;

    const name = file.substr(0, file.length - 4);

    const test = {
      id: name,
      name: name,
      failure: false,
      error: '',
      start: Date.now(),
    };

    try {
      const runPath = path.join(suitePath, file);
      const jsonPath = path.join(outPath, `${suitePath}_${name}.json`);


      await run(`node node_modules/artillery/bin/artillery run -c ${configPath} -o ${jsonPath} ${runPath} -e ${env}`);

      // Additional test failure/success conditions & details based on the data aggregated
      // by Artillery here:
      const json = fs.readFileSync(`${jsonPath}`, { encoding: 'utf-8' });
      const data = JSON.parse(json);

      // Artillery JSON report list errors in the aggregate.errors object. If empty, no errors.
      // Report "errors", i.e. failed expects, as failures to capture as much info as possible.
      const errors = data.aggregate.errors;
      const errorKeys = Object.keys(errors);
      test.failure = errorKeys.length > 0;
      for (const k in errorKeys) {
        test.error += errorKeys[k] + '\n';
      }
    } catch (e) {
      console.error(e.error);

      test.failure = true;
      test.error = e.stdout;
    }
    if (test.failure) {
      suite.failures++;
      tests.failures++;
    }

    test.finish = Date.now();
    test.elapsed = (test.finish - test.start) / 1000.0;

    suite.tests.push(test);
    tests.tests++;
  }

  suite.finish = Date.now();
  suite.elapsed = (suite.finish - suite.start) / 1000.0;

  tests.suites.push(suite);
}

async function main() {
  const tests = {
    suites: [],
    tests: 0,
    failures: 0,
    start: Date.now()
  };

  let suitesFilter = program.suites ? program.suites.split(',') : ['regression', 'smoke'];
  if (suitesFilter.length && suitesFilter[0] === 'all') suitesFilter = undefined;

  const files = fs.readdirSync('.');

  if (!fs.existsSync('results')) 
    fs.mkdirSync('results');

  for (let file of files) {
    if (file === 'config') continue;
    if (file === 'node_modules') continue;
    if (file === 'results') continue;
    if (file === 'processors') continue;
    if (suitesFilter && suitesFilter.indexOf(file) === -1) continue;

    const stat = fs.statSync(file);

    if (stat.isDirectory()) {
      let configPath = 'config/default.yml';
      let env= program.environment ? program.environment : 'dev';

      if (fs.existsSync(`config/${file}.yml`))
        configPath = `config/${file}.yml`

      await suite(tests, configPath, file, 'results',env);
    }
  }

  tests.finish = Date.now();
  tests.elapsed = (tests.finish - tests.start) / 1000.0;
  publish(tests);
}

main().then();
