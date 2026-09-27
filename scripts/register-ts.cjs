// Compile only local TypeScript for Node's built-in test runner; no test dependency.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...rest) {
  return resolve.call(this, id.startsWith('@/') ? path.join(process.cwd(), 'src', id.slice(2)) : id, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
