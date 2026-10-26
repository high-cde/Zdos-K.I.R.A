const zbagBridge = require('./zbag-bridge');

async function zbagAuthMiddleware(req, res, next) {
  const { dsnFee, wallet } = req.body;
  const verification = await zbagBridge.verifyAndDeductToken(wallet, dsnFee || 10);
  
  if (!verification.success) {
    return res.status(403).json({ error: "Fondi $DSN insufficienti o transazione non autorizzata on-chain." });
  }
  
  req.zbagReceipt = verification;
  next();
}

module.exports = zbagAuthMiddleware;
