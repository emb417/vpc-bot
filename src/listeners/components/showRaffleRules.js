import { Listener } from "@sapphire/framework";
import { showRaffleRules } from "../../commands/raffle/show-raffle-rules.js";

export class ShowRaffleRulesButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_raffle_rules") return;

    await showRaffleRules(interaction);
  }
}
