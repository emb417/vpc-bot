import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

const TRIGGERS = [
  /how (do i|do you|can i) post/i,
  /how does this work/i,
  /how do i (do this|get started)/i,
  /how.*(post|submit).*(score|point)/i,
  /how.*participate/i,
  /tutorial.*high/i,
  /get.*started.*high/i,
  /score.*(recognized|recognised|count|valid|format|template)/i,
  /required.*(format|template)/i,
  /what.*(format|template).*(score|post)/i,
];

const REPLY =
  "To participate in high scores, see the rules in the pin below, then use `/post-high-score` or type `!high 12345678 tablename`. In either case, you must attach a photo of the **entire playfield and the score** of the last game played.\n\n" +
  "📌 [High Score Rules](https://discord.com/channels/652274650524418078/919336296281960468/919338053208776794)";

export class HighScoreHelperListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "messageCreate",
    });
  }

  async run(message) {
    if (message.author.bot) return;
    if (message.channel.id !== process.env.HIGH_SCORES_CHANNEL_ID) return;

    const content = message.content;
    const isMatch = TRIGGERS.some((trigger) => trigger.test(content));
    if (!isMatch) return;

    logger.info(
      `Score help triggered by ${message.author.username}: "${message.content}"`,
    );

    await message.reply({ content: REPLY });
  }
}
