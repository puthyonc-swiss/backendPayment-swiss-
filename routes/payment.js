/**
 * routes/payment.js
 * ──────────────────
 * KHQR Payment Routes
 *
 * POST /api/payment/generate  → generate a KHQR code
 * POST /api/payment/verify    → verify a KHQR string (CRC check)
 * POST /api/payment/check     → check real payment via Bakong API (md5)
 */

const express = require("express");
const router  = express.Router();
const { BakongKHQR, IndividualInfo, khqrData } = require("bakong-khqr");

// Use built-in fetch (Node 18+) or fallback
const _fetch = typeof fetch !== "undefined" ? fetch : require("node-fetch");

// ── Config from .env ──────────────────────────────────────────
const BAKONG_ID     = process.env.BAKONG_ID     || "puthyon_chandara@bkrt";
const MERCHANT_NAME = process.env.MERCHANT_NAME || "Swiss System";
const MERCHANT_CITY = process.env.MERCHANT_CITY || "Phnom Penh";
const BAKONG_TOKEN  = process.env.BAKONG_TOKEN  || "";

// ── Bakong API base URL ───────────────────────────────────────
const BAKONG_API = "https://api-bakong.nbc.gov.kh";

// ─────────────────────────────────────────────────────────────
// POST /api/payment/generate
// Body: { amount: 0.01 }
// Returns: { qr, md5, amount, expiry }
// ─────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount) || 0.01;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Must be a positive number.",
      });
    }

    // Set expiry: 10 minutes from now
    const expirationTimestamp = Date.now() + 10 * 60 * 1000;

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

    const KHQR   = new BakongKHQR();
    const result = KHQR.generateIndividual(individualInfo);

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

    if (!qr || typeof qr !== "string" || qr.trim() === "") {
      return res.status(400).json({
        success: false,
        isValid: false,
        message: "QR string is required.",
      });
    }

    const verifyResult = BakongKHQR.verify(qr.trim());
    const isValid = verifyResult && verifyResult.isValid === true;

    console.log(`🔍 KHQR verify | isValid: ${isValid}`);

    return res.status(200).json({
      success: true,
      isValid: isValid,
      message: isValid ? "QR is valid." : "QR is invalid or tampered.",
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

// ─────────────────────────────────────────────────────────────
// POST /api/payment/check
// Body: { md5: "abc123..." }
// Calls Bakong Open API to confirm real money transfer
// Returns: { paid: true/false, data: {...} }
// ─────────────────────────────────────────────────────────────
router.post("/check", async (req, res) => {
  try {
    const { md5 } = req.body;

    if (!md5 || typeof md5 !== "string" || md5.trim() === "") {
      return res.status(400).json({
        success: false,
        paid:    false,
        message: "md5 hash is required.",
      });
    }

    if (!BAKONG_TOKEN) {
      console.error("BAKONG_TOKEN not set in environment variables");
      return res.status(500).json({
        success: false,
        paid:    false,
        message: "Payment service not configured.",
      });
    }

    // Call Bakong Open API
    const bakongRes = await _fetch(
      `${BAKONG_API}/v1/check_transaction_by_md5`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${BAKONG_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ md5: md5.trim() }),
      }
    );

    const bakongData = await bakongRes.json();

    console.log(`💳 Bakong check | md5: ${md5} | response:`, JSON.stringify(bakongData));

    // Bakong returns responseCode 0 = success/found
    if (
      bakongData &&
      bakongData.responseCode === 0 &&
      bakongData.data
    ) {
      return res.status(200).json({
        success: true,
        paid:    true,
        message: "Payment confirmed.",
        data:    bakongData.data,
      });
    }

    // Not paid yet
    return res.status(200).json({
      success: true,
      paid:    false,
      message: "Payment not found yet.",
    });

  } catch (err) {
    console.error("Check error:", err.message);
    return res.status(500).json({
      success: false,
      paid:    false,
      message: "Could not reach Bakong API.",
    });
  }
});

module.exports = router;
