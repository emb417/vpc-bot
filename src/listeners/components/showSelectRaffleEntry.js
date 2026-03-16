import "dotenv/config";
import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import { showSelectRaffleEntry } from "../../lib/raffle/selectRaffleEntry.js";

export class ShowSelectRaffleEntryListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "show_select_raffle_entry") return;

    return showSelectRaffleEntry(interaction);
  }
}
