/**
 * routes/telegram.js
 * ───────────────────
 * Handles posting reports to Telegram automatically (1-click share
 * from the web app). This does NOT touch or replace bot.py — that
 * bot keeps working separately for manual screenshot use.
 */

const express = require("express");
const router = express.Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TEST_GROUP_CHAT_ID = "-5324605890"; // "Test" group, for trying this out first

router.post("/share", async (req, res) => {
  try {
    const { caption, imageBase64 } = req.body;

    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(500).json({ success: false, message: "Bot token not configured on server." });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "No image provided." });
    }

    // Convert base64 string (e.g. "data:image/png;base64,....") into raw bytes
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Build multipart form data for Telegram's sendPhoto endpoint
    const formData = new FormData();
    formData.append("chat_id", TEST_GROUP_CHAT_ID);
    formData.append("caption", caption || "");
    formData.append("photo", new Blob([imageBuffer]), "report.png");

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      { method: "POST", body: formData }
    );

    const result = await telegramResponse.json();

    if (!result.ok) {
      console.error("Telegram API error:", result);
      return res.status(502).json({ success: false, message: "Telegram rejected the request.", details: result });
    }

    res.json({ success: true, message: "Sent to Telegram." });
  } catch (err) {
    console.error("Telegram share error:", err);
    res.status(500).json({ success: false, message: "Server error while sending to Telegram." });
  }
});

module.exports = router;
