import https from "https";
import logger from "../utils/logger.js";

const PUSH_URL = process.env.KUMA_PUSH_URL;
const INTERVAL = Number(process.env.KUMA_PUSH_INTERVAL || 900) * 1000;

let timer;

function sendHeartbeat() {
  if (!PUSH_URL) return;

  https
    .get(PUSH_URL, (res) => {
      res.resume();
    })
    .on("error", (err) => {
      logger.warn("Heartbeat failed:", err.message);
    });
}

export function startHeartbeat() {
  if (!PUSH_URL) {
    logger.info("Kuma heartbeat disabled");
    return;
  }

  logger.info("Starting Kuma heartbeat");
  timer = setInterval(sendHeartbeat, INTERVAL);
}

export function stopHeartbeat() {
  if (timer) clearInterval(timer);
}
