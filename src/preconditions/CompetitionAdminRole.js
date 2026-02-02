import "dotenv/config";
import { Precondition } from "@sapphire/framework";
import { GuildMember } from "discord.js";

const ADMIN_ROLE_ID = process.env.BOT_COMPETITION_ADMIN_ROLE_ID;

export class CompetitionAdminRolePrecondition extends Precondition {
  chatInputRun(interaction) {
    if (!(interaction.member instanceof GuildMember)) {
      return this.error({
        message: "This command can only be used in a server.",
      });
    }

    return this.checkRole(interaction.member);
  }

  messageRun(message) {
    if (!(message.member instanceof GuildMember)) {
      return this.error({
        message: "This command can only be used in a server.",
      });
    }

    return this.checkRole(message.member);
  }

  checkRole(member) {
    if (!ADMIN_ROLE_ID) {
      return this.error({
        message: "Bot configuration error. Please contact an administrator.",
      });
    }

    const hasRole = member.roles.cache.has(ADMIN_ROLE_ID);

    return hasRole
      ? this.ok()
      : this.error({
          message: "Permission denied! You do not have access to this command.",
        });
  }
}
