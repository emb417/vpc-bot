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
      content: `VPC High Score Corner\n<${process.env.HIGH_SCORES_URL}>`,
      flags: 64,
    });
  }
}
