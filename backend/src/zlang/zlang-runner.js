const zlangBridge = require('./zlang-compiler-bridge');

class ZLangRunner {
  async run(code) {
    return await zlangBridge.compileAndExecute(code);
  }
}

module.exports = new ZLangRunner();
