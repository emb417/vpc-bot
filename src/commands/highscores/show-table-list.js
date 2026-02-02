import { Command } from "@sapphire/framework";

export class ShowTableListCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-table-list",
      description: "Show the list of high score tables.",
      preconditions: ["HighScoresChannel"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    return interaction.reply({
      content: `VPC High Score Corner\n<${process.env.HIGH_SCORES_URL}>`,
      flags: 64,
    });
  }
}
