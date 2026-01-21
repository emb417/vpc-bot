import "dotenv/config";
import { Precondition } from "@sapphire/framework";

const ADMIN_ROLE_NAME = process.env.BOT_COMPETITION_ADMIN_ROLE_NAME;

export class CompetitionAdminRolePrecondition extends Precondition {
  async chatInputRun(interaction) {
    return this.checkRole(interaction);
  }

  async messageRun(message) {
    return this.checkRoleFromMessage(message);
  }

  async checkRole(interaction) {
    const guild = await interaction.client.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    const hasRole = [...member.roles.cache.values()].some(
      (role) => role.name === ADMIN_ROLE_NAME,
    );

    return hasRole
      ? this.ok()
      : this.error({
          message: `You do not have the required role (${ADMIN_ROLE_NAME}) to run this command.`,
        });
  }

  async checkRoleFromMessage(message) {
    const member = message.member;
    if (!member) {
      return this.error({ message: "Could not determine your roles." });
    }

    const hasRole = [...member.roles.cache.values()].some(
      (role) => role.name === ADMIN_ROLE_NAME,
    );

    return hasRole
      ? this.ok()
      : this.error({
          message: `You do not have the required role (${ADMIN_ROLE_NAME}) to run this command.`,
        });
  }
}
