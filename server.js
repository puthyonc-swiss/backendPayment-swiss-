/**
 * server.js
 * ──────────
 * Swiss System Payment Backend
 * Hosted on Render.com
 *
 * Endpoints:
 *   GET  /              → health check
 *   POST /api/payment/generate  → generate KHQR
 *   POST /api/payment/verify    → verify KHQR
 */

require("dotenv").config();

const express      = require("express");
const cors         = require("cors");
const paymentRoutes = require("./routes/payment");
const telegramRoutes = require("./routes/telegram");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "10mb" }));

// ── Health Check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    service: "Swiss System Payment Backend",
    version: "1.0.0",
  });
});

// ── Payment Routes ────────────────────────────────────────────
app.use("/api/payment", paymentRoutes);

// ── Telegram Routes ───────────────────────────────────────────
app.use("/api/telegram", telegramRoutes);

// ── 404 Handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Swiss System Payment Backend running on port ${PORT}`);
  console.log(`   Bakong ID: ${process.env.BAKONG_ID}`);
  console.log(`   Merchant:  ${process.env.MERCHANT_NAME}`);
});
