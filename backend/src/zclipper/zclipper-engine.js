class ZClipperEngine {
  constructor() {
    this.dsnToken = process.env.DSN_CONTRACT_ADDRESS;
  }
  allocateTaskBudget(taskId, dsnAmount) {
    console.log(`[ZClipper] Allocating ${dsnAmount} $DSN (Contract: ${this.dsnToken}) for task ${taskId}`);
    return { authorized: true, lockedTokens: dsnAmount };
  }
}
module.exports = new ZClipperEngine();
