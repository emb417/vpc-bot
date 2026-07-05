import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

export class ShowCompetitionRulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-competition-rules",
      description: "Show the Competition Corner rules.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    return showCompetitionRules(interaction);
  }
}

export const showCompetitionRules = async (interaction) => {
  const rulesEmbed = new EmbedBuilder()
    .setTitle("🕹️ Welcome to COMPETITION CORNER")
    .setDescription(
      `Where we all play the [**Table of the Week!**](https://discord.com/channels/${process.env.GUILD_ID}/${process.env.COMPETITION_CHANNEL_ID}/${process.env.COMPETITION_WEEKLY_POST_ID})`,
    )
    .addFields(
      {
        name: "📜 General Rules",
        value:
          "1. You **MUST** use the specified table and version. Use `/show-table-of-the-week` for a link to the current table.\n" +
          "2. No table or script modifications allowed that affect gameplay (including ROM selection).\n" +
          "3. Number of balls per game **MUST NOT** be modified.\n" +
          "4. No **EXTRA BALL** buy-ins.\n" +
          "5. Only **SINGLE-PLAYER** games allowed.\n" +
          "6. **Death Saves** and **Bangbacks** are banned. Natural lazarus bounces are permitted.",
      },
      {
        name: "📸 Score Submission & Deadlines",
        value:
          "1. You **MUST** post a clear, high-resolution screenshot or photo of your final score. The image must capture the full table (and the backglass, if the score is displayed there).\n" +
          "  * **Timing:** The image must be taken at the immediate end of the game (e.g., during the Match Sequence, Credit Award, Initials Entry, or Previous Game Score).\n" +
          "  * **Prohibited Images:** High score roster/leaderboard screenshots are strictly invalid and will not be counted.\n" +
          "  * **Legibility:** If a submission is blurry, cropped, glare-ridden, or otherwise unreadable, the score will be rejected. It is your responsibility to ensure the text is legible before posting.\n" +
          "2. **Rollovers:** Scores exceeding game limits require proof prior to rollover (photo or video).\n" +
          "3. To post a score you **MUST** use `/post-score`.\n" +
          "4. Gameplay runs **Monday–Sunday**, ending and starting a new week at **Monday, 12am PST**.",
      },
      {
        name: "🤖 How to Use Score Bot",
        value:
          "Post a score: `/post-score`\n" +
          "View the current leaderboard: `/show-leaderboard`\n" +
          "View the current table of the week: `/show-table-of-the-week`",
      },
      {
        name: "🎟️ Table Raffle",
        value:
          "Post a score, then use `/enter-raffle` to enter a table of your choice. Draw happens at **Monday, 12am PST**.\n" +
          "Monitor the raffle with `/show-raffle-board`.\n" +
          "See raffle rules with `/show-raffle-rules`.",
      },
    )
    .setColor("Blue");

  const leagueEmbed = new EmbedBuilder()
    .setTitle("🏆 Competition Corner Pinball League")
    .addFields(
      {
        name: "📊 Weekly Scoring",
        value:
          "1st: 12pts | 2nd: 10pts | 3rd: 9pts | 4th: 8pts | 5th: 7pts\n" +
          "6th: 6pts | 7th: 5pts | 8th: 4pts | 9th: 3pts | 10th: 2pts | 11th+: 1pt\n" +
          " * Ties broken by total accumulated scores.\n" +
          " * Scores must be posted by **Monday, 12am PST**.\n" +
          " * Missing a week means **no points**.",
      },
      {
        name: "❔ Questionable Scores",
        value:
          "If you see a score that you think should not be counted, add a ❔ (grey_question) emoji to the score post, and post the reason. If the score gets 5 ❔s, it will be deleted automatically.",
      },
      {
        name: "🙋‍♂️ Questions?",
        value:
          "Contact <@718313274164117505> with questions about posting scores or deleted scores.\n\n" +
          `Winner at the end of the weekly competition will be posted with their score in the [**${process.env.BRAGGING_RIGHTS_CHANNEL_NAME}**](https://discord.com/channels/${process.env.GUILD_ID}/${process.env.BRAGGING_RIGHTS_CHANNEL_ID}) channel.`,
      },
    )
    .setColor("Blue");

  return interaction.reply({ embeds: [rulesEmbed, leagueEmbed], flags: 64 });
};
