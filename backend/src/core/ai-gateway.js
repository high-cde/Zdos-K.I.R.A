class AIGateway {
  constructor() {
    this.primaryModel = process.env.PRIMARY_MODEL || "claude-3-5-sonnet";
    this.secondaryModel = process.env.SECONDARY_MODEL || "gpt-4o";
  }
  async dispatchPrompt(prompt, tier = "primary") {
    const selectedModel = tier === "primary" ? this.primaryModel : this.secondaryModel;
    console.log(`[AI-Gateway] Routing request to ${selectedModel}...`);
    return {
      model: selectedModel,
      status: "executed",
      output: `Processed via ZDOS Fly Brain using ${selectedModel}: "${prompt.substring(0, 40)}..."`
    };
  }
}
module.exports = new AIGateway();
