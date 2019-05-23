#!/usr/bin/env node

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');
const fs = require('fs-extra');

function relativePath(pathToAdd) {
  return path.join(__dirname, pathToAdd);
}

function getRootDirectory() {
  const PATHS_TO_TEST = [
    relativePath('../')
  ];

  for (const path of PATHS_TO_TEST) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  throw `Can't find contracts directory`;
}

const ROOT_DIRECTORY = getRootDirectory();

async function executeCommand(command, directory) {
  const options = {};

  if (directory) {
    options.cwd = directory;
  }

  try {
    const { stdout, stderr } = await exec(command, options);

    console.log(stdout);
    console.error(stderr);
  } catch (error) {
    if (error && error.stdout) {
      console.error(error.stdout);
    } else {
      console.error(error);
    }
  }
}

async function run() {
  console.log('MARKET_LIB_BUILD: Start...');

  await executeCommand('npx ew-market-contracts-build', ROOT_DIRECTORY)
  await executeCommand('npm run build', ROOT_DIRECTORY)

  if (!(await fs.pathExists(`${ROOT_DIRECTORY}/dist/js/src`))) {
    await fs.move(`${ROOT_DIRECTORY}/dist/js`, `${ROOT_DIRECTORY}/dist/js-temp`);
    await fs.ensureDir(`${ROOT_DIRECTORY}/dist/js`);
    await fs.move(`${ROOT_DIRECTORY}/dist/js-temp`, `${ROOT_DIRECTORY}/dist/js/src`);
    await fs.move(`${ROOT_DIRECTORY}/schemas`, `${ROOT_DIRECTORY}/dist/js/schemas`);
  }

  console.log('MARKET_LIB_BUILD: End');
}

run();