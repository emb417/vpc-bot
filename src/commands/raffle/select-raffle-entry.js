import "dotenv/config";
import { Command } from "@sapphire/framework";
import { showSelectRaffleEntry } from "../../lib/raffle/selectRaffleEntry.js";

export class SelectRaffleEntryCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "select-raffle-entry",
      description: "Enter a table already picked by another player this week.",
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [process.env.GUILD_ID] },
    );
  }

  async chatInputRun(interaction) {
    return showSelectRaffleEntry(interaction);
  }
}
