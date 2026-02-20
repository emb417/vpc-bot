import { Listener } from "@sapphire/framework";
import logger from "../../utils/logger.js";

const TRIGGERS = [
  /how (do i|do you|can i) post/i,
  /how does this work/i,
  /how do i (do this|get started)/i,
  /how.*(post|submit).*(score|point)/i,
  /how.*(join|enter|get into|participate).*(competition|comp|contest)/i,
  /how.*participate/i,
  /tutorial.*competi/i,
  /get.*started.*competi/i,
  /score.*(recognized|recognised|count|valid|format|template)/i,
  /what.*(valid|acceptable).*(score|photo|pic)/i,
  /required.*(format|template)/i,
  /what.*(format|template).*(score|post)/i,
];

const REPLY =
  "To participate in the competition, see the Weekly Table pin below to get the table details, then submit your score by using `/post-score` or type `!score 12345678`. In either case, you must attach a photo of the **entire playfield and the score** of the last game played.\n\n" +
  "📌 [Weekly Table](https://discord.com/channels/652274650524418078/720381436842213397/863936182839410709) --- 📌 [Competition Rules](https://discord.com/channels/652274650524418078/720381436842213397/720392464690577539)";

export class WeeklyScoreHelperListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "messageCreate",
    });
  }

  async run(message) {
    if (message.author.bot) return;
    if (message.channel.id !== process.env.COMPETITION_CHANNEL_ID) return;

    const content = message.content;
    const isMatch = TRIGGERS.some((trigger) => trigger.test(content));
    if (!isMatch) return;

    logger.info(
      `Score help triggered by ${message.author.username}: "${message.content}"`,
    );

    await message.reply({ content: REPLY });
  }
}
