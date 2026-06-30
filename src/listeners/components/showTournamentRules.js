import { Listener } from "@sapphire/framework";
import { showTournamentRules } from "../../commands/tournaments/show-tournament-rules.js";

export class ShowTournamentRulesButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "showTournamentRules") return;

    await showTournamentRules(interaction);
  }
}
