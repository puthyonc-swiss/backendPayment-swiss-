/**
 * routes/payment.js
 * ──────────────────
 * KHQR Payment Routes
 *
 * POST /api/payment/generate  → generate a KHQR code
 * POST /api/payment/verify    → verify a KHQR code
 */

const express      = require("express");
const router       = express.Router();
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");

// ── Config from .env ──────────────────────────────────────────
const BAKONG_ID     = process.env.BAKONG_ID     || "puthyon_chandara@bkrt";
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Swiss System";
const MERCHANT_CITY = process.env.MERCHANT_CITY || "Phnom Penh";

// ─────────────────────────────────────────────────────────────
// POST /api/payment/generate
// Body: { amount: 0.01 }
// Returns: { qr: "...", md5: "..." }
// ─────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 0.01;

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number.",
      });
    }

    // Set expiry: 10 minutes from now
    const expirationTimestamp = Date.now() + 10 * 60 * 1000;

    // Build Individual KHQR info
    const optionalData = {
      currency:             khqrData.currency.usd,
      amount:               amount,
      merchantCategoryCode: "5999",
      purposeOfTransaction: "Tournament Entry Fee",
      expirationTimestamp:  expirationTimestamp,
    };

    const individualInfo = new IndividualInfo(
      BAKONG_ID,
      MERCHANT_NAME,
      MERCHANT_CITY,
      optionalData
    );

    // Generate KHQR
    const KHQR   = new BakongKHQR();
    const result = KHQR.generateIndividual(individualInfo);

    // Check SDK response
    if (!result || !result.data || !result.data.qr) {
      console.error("KHQR generate failed:", result);
      return res.status(500).json({
        success: false,
        message: "Failed to generate KHQR. Please try again.",
      });
    }

    console.log(`✅ KHQR generated | amount: $${amount} | md5: ${result.data.md5}`);

    return res.status(200).json({
      success: true,
      qr:      result.data.qr,
      md5:     result.data.md5,
      amount:  amount,
      expiry:  expirationTimestamp,
    });

  } catch (err) {
    console.error("Generate error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/payment/verify
// Body: { qr: "00020101..." }
// Returns: { isValid: true/false }
// ─────────────────────────────────────────────────────────────
router.post("/verify", async (req, res) => {
  try {
    const { qr } = req.body;

    // Validate input
    if (!qr || typeof qr !== "string" || qr.trim() === "") {
      return res.status(400).json({
        success:  false,
        isValid:  false,
        message:  "QR string is required.",
      });
    }

    // Verify KHQR using SDK
    const verifyResult = BakongKHQR.verify(qr.trim());

    const isValid = verifyResult && verifyResult.isValid === true;

    console.log(`🔍 KHQR verify | isValid: ${isValid}`);

    return res.status(200).json({
      success:  true,
      isValid:  isValid,
      message:  isValid ? "QR is valid." : "QR is invalid or tampered.",
    });

  } catch (err) {
    console.error("Verify error:", err.message);
    return res.status(500).json({
      success:  false,
      isValid:  false,
      message:  "Internal server error.",
    });
  }
});

module.exports = router;
