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
    registry.registerChatInputCommand((builder) =>
      builder.setName(this.name).setDescription(this.description),
    );
  }

  async chatInputRun(interaction) {
    return interaction.reply({
      content: `For an up to date list of high score tables, please visit:\n<${process.env.HIGH_SCORES_URL}>`,
      flags: 64,
    });
  }
}
