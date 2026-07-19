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

// ── EDIT THESE LINES to set your real group chat IDs (up to 5) ──
// Every "Share Update" click posts to ALL groups listed here.
// Get each group's chat ID the same way as before:
//   1. Add the bot to the group
//   2. Send any message in the group
//   3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates
//   4. Look for "chat":{"id": ... } in the response
const GROUP_CHAT_IDS = [
  "-5324605890", // Group 1 (currently the "Test" group — replace when ready)
  "-5442602994",
  "",
  "",
  "",
];

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

    // Send to every configured group. Placeholder IDs (not yet edited) are skipped.
    const targetGroups = GROUP_CHAT_IDS.filter(id => id && !id.startsWith("PASTE_"));

    if (targetGroups.length === 0) {
      return res.status(500).json({ success: false, message: "No group chat IDs configured yet." });
    }

    const sendResults = await Promise.all(
      targetGroups.map(async (chatId) => {
        try {
          const formData = new FormData();
          formData.append("chat_id", chatId);
          formData.append("caption", caption || "");
          formData.append("photo", new Blob([imageBuffer]), "report.png");

          const telegramResponse = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
            { method: "POST", body: formData }
          );
          const result = await telegramResponse.json();
          if (!result.ok) {
            console.error(`Telegram API error for group ${chatId}:`, result);
            return { chatId, ok: false, error: result.description || "Telegram rejected the request." };
          }
          return { chatId, ok: true };
        } catch (err) {
          console.error(`Telegram send error for group ${chatId}:`, err);
          return { chatId, ok: false, error: "Could not reach Telegram." };
        }
      })
    );

    const failed = sendResults.filter(r => !r.ok);
    const succeeded = sendResults.filter(r => r.ok);

    if (succeeded.length === 0) {
      return res.status(502).json({ success: false, message: "Failed to send to all groups.", details: sendResults });
    }

    res.json({
      success: true,
      message: `Sent to ${succeeded.length} of ${targetGroups.length} group(s).`,
      failed: failed.length ? failed : undefined,
    });
  } catch (err) {
    console.error("Telegram share error:", err);
    res.status(500).json({ success: false, message: "Server error while sending to Telegram." });
  }
});

module.exports = router;
