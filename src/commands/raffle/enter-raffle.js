import { Command } from "@sapphire/framework";
import { buildRaffleModal } from "../../lib/raffle/raffleModal.js";

export class EnterRaffleCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "enter-raffle",
      description: "Enter a table for the weekly raffle.",
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [process.env.GUILD_ID] },
    );
  }

  async chatInputRun(interaction) {
    await interaction.showModal(
      buildRaffleModal("enter-raffle-modal", "Enter Raffle", true),
    );
  }
}
