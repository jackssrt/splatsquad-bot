import dedent from "dedent";
import type {
	APIEmbedField,
	ButtonInteraction,
	ChatInputCommandInteraction,
	InteractionReplyOptions,
	Message,
	StringSelectMenuInteraction,
	User,
} from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	ComponentType,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	userMention,
} from "discord.js";
import { randomInt } from "node:crypto";
import { BOOYAH_EMOJI, DIVIDER_EMOJI, OUCH_EMOJI, SQUIDSHUFFLE_EMOJI, VEEMO_PEEK_EMOJI } from "../../emojis.js";
import { IS_PROD } from "../../env.js";
import {
	constructEmbedsWrapper,
	embeds,
	futureTimestamp,
	getRandomValues,
	messageHiddenText,
	wait,
} from "../../utils.js";
import { RULES, SECONDS_TO_JOIN, SECONDS_TO_PICK_TEAMS, SECONDS_TO_PLAY_AGAIN } from "./consts.js";
import Player, { PlayerRole } from "./Player.js";

export const enum GameState {
	WaitingForPlayers,
	DecidingTeams,
	WaitingForMatchStart,
	HideTime,
	SeekTime,
	PlayAgain,
}
type DefinedAt<State extends GameState, DefinedStates extends GameState, Type> = State extends DefinedStates
	? Type
	: Type | undefined;
type NotDefinedAt<State extends GameState, NotDefinedStates extends GameState, Type> = State extends NotDefinedStates
	? Type | undefined
	: Type;
const abortButton = new ButtonBuilder()
	.setCustomId("abort")
	.setLabel("Abort")
	.setEmoji("✖️")
	.setStyle(ButtonStyle.Danger);

export default class Game<State extends GameState = GameState.WaitingForPlayers> {
	public players = new Collection<User, Player>();
	public host: Player<true>;
	// smallest possible date
	public createdTime = new Date(-8640000000000000);
	public startedTime = new Date(-8640000000000000);
	private state = GameState.WaitingForPlayers as State;
	private hostConfigInteraction = undefined as NotDefinedAt<State, GameState.WaitingForPlayers, ButtonInteraction>;
	public readonly code: string;
	private mainMessage = undefined as NotDefinedAt<State, GameState.WaitingForPlayers, Message>;
	private playedAgain = false;
	private hidingTimeUpMsg = undefined as DefinedAt<State, GameState.SeekTime, Message>;
	private startedMessage = undefined as DefinedAt<State, GameState.HideTime, Message>;
	private readonly hideTimeSeconds: number;
	private readonly seekTimeSeconds: number;

	private hostConfigEmbeds = constructEmbedsWrapper((b) =>
		b.setFooter({
			text: `Room type: ${this.mode === "turfwar" ? "Turf War" : "Ranked"}・Room code: ${
				this.code
			}・⚠️ Don't dismiss this message!`,
		}),
	);

	constructor(
		hostInteraction: ChatInputCommandInteraction,
		private readonly mode: "turfwar" | "ranked",
		private readonly maxPlayers: number,
	) {
		const host = new Player(hostInteraction, true as const, undefined, this);
		this.players.set(hostInteraction.user, host);
		this.host = host;
		this.code = `${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}${randomInt(0, 9)}`;
		this.hideTimeSeconds = IS_PROD ? (this.mode === "turfwar" ? 1 : 2) * 60 : 5;
		this.seekTimeSeconds = IS_PROD ? (this.mode === "turfwar" ? 2 : 3) * 60 : 10;
	}

	public addPlayer(interaction: ButtonInteraction) {
		const p = new Player(interaction, false as const, undefined, this);
		this.players.set(interaction.user, p);
		return p;
	}

	public playerListField(): APIEmbedField {
		const name = `👥 Player list (\`${this.players.size}/${this.maxPlayers}\`)`;
		if (this.players.first()?.role !== undefined) {
			const [seekers, hiders] = this.players.partition((v) => v.role === PlayerRole.Seeker);

			return {
				name,
				value: dedent`**🟨 Alpha Team (\`${hiders.size}/4\`)**
									${hiders.map((v) => v.playerListItem()).join("\n")}

									**🟦 Bravo Team (\`${seekers.size}/4\`)**
									${seekers.map((v) => v.playerListItem()).join("\n")}`,
			};
		} else {
			return {
				name,
				value:
					this.players
						.toJSON()
						.flatMap((v, i) => [v.playerListItem(), ...(i === 3 ? [DIVIDER_EMOJI.repeat(20)] : [])])
						.join("\n") || "no players",
			};
		}
	}
	private async awaitPlayers(this: Game<GameState.WaitingForPlayers>): Promise<boolean | void> {
		this.state = GameState.WaitingForPlayers;
		const data = {
			...(await embeds((b) => b.setDescription(`${SQUIDSHUFFLE_EMOJI} Setting everything up...`))),
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("I'm in!")
						.setEmoji("➕")
						.setCustomId("join")
						.setStyle(ButtonStyle.Success),
				),
			],
			fetchReply: true,
		} as InteractionReplyOptions & { fetchReply: true };
		this.mainMessage = (await this.host.interaction[this.playedAgain ? "followUp" : "reply"](
			data,
		)) as Message<boolean>;

		this.createdTime = new Date();
		this.players.forEach((v) => {
			v.role = undefined;
		});
		await this.updateMainMessage();
		const collector = this.mainMessage.createMessageComponentCollector({
			componentType: ComponentType.Button,
			maxUsers: 7,
			time: SECONDS_TO_JOIN * 1000,
			filter: async (x) =>
				x.user.id === this.host.user.id
					? !!void (await x.reply({ content: "You're the host!", ephemeral: true }))
					: this.players.find((y) => y.user.id === x.user.id)
					? !!void (await x.reply({ content: "You've already joined!", ephemeral: true }))
					: true,
		});
		collector.on("collect", async (collected) => {
			const p = this.addPlayer(collected);
			await collected.reply({
				...(await p.roleEmbed()),
				ephemeral: true,
			});
			await this.updateMainMessage();
		});
		collector.once("end", async (_, reason) => {
			if (reason !== "started") await this.abort();
		});
		const hostConfigMessage = await this.host.interaction.followUp({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle("Waiting for players...")
							.setDescription("Press `Everyone's joined!` once all players have joined on discord!"),
					)
				).embeds,
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId("start")
						.setLabel("Everyone's joined!")
						.setEmoji("✔️")
						.setStyle(ButtonStyle.Success),
					abortButton,
				),
			],
			ephemeral: true,
		});
		const interaction = await hostConfigMessage.awaitMessageComponent({
			componentType: ComponentType.Button,
			filter: async (x) => {
				if (x.customId === "start" && this.players.size < 2)
					return !!void (await x.reply({ content: "Nobody's joined yet!", ephemeral: true }));
				return true;
			},
		});
		await interaction.deferUpdate();
		this.hostConfigInteraction = interaction;
		if (interaction.customId === "start") collector.stop("started");
		else return !!void (await this.abort());
	}

	private async decideTeams(this: Game<GameState.DecidingTeams>): Promise<boolean | void> {
		this.state = GameState.DecidingTeams;
		await this.updateMainMessage();
		const maxNumSeekers = Math.min(4, this.players.size - 1);
		const fairestNumSeekers = Math.floor(this.players.size / 2);
		const pickTeams = await this.hostConfigInteraction.editReply({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle("Decide teams")
							.setDescription(
								`Do you want me to pick the seekers for you or do you want to pick them manually?\nExpires ${futureTimestamp(
									SECONDS_TO_PICK_TEAMS,
								)}`,
							),
					)
				).embeds,
			],
			content: "",
			components: [
				...(this.playedAgain
					? [
							new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
								new StringSelectMenuBuilder()
									.setCustomId("rotate")
									.setPlaceholder("🔄 Rotate seekers...")
									.addOptions(
										new Array(maxNumSeekers)
											.fill(false)
											.map((_, i) =>
												new StringSelectMenuOptionBuilder()
													.setLabel(
														`Rotate players and pick ${i + 1} seeker${
															i + 1 !== 1 ? "s" : ""
														}${i + 1 === fairestNumSeekers ? " [FAIREST]" : ""}`,
													)
													.setValue(`${i + 1}`),
											),
									),
							),
					  ]
					: []),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("random")
						.setPlaceholder("🎲 Pick number of random seekers...")
						.addOptions(
							new Array(maxNumSeekers)
								.fill(false)
								.map((_, i) =>
									new StringSelectMenuOptionBuilder()
										.setLabel(
											`Pick ${i + 1} random seeker${i + 1 !== 1 ? "s" : ""} for me${
												i + 1 === fairestNumSeekers ? " [FAIREST]" : ""
											}`,
										)
										.setValue(`${i + 1}`),
								),
						),
				),
				new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId("manual")
						.setMaxValues(maxNumSeekers)
						.setMinValues(1)
						.setPlaceholder("*️⃣ Pick seekers manually...")
						.addOptions(
							this.players.map((v) =>
								new StringSelectMenuOptionBuilder().setLabel(`${v.user.username}`).setValue(v.user.id),
							),
						),
				),
				new ActionRowBuilder<ButtonBuilder>().addComponents(abortButton),
			],
		});
		const pickTeamsInteraction = (await pickTeams.awaitMessageComponent({
			time: SECONDS_TO_PICK_TEAMS * 1000,
		})) as StringSelectMenuInteraction | ButtonInteraction;
		await pickTeamsInteraction.deferUpdate();
		if (pickTeamsInteraction.customId === "rotate" && pickTeamsInteraction.isStringSelectMenu()) {
			// sorts seekers first
			// inverts and converts the role to a number so that Seeker = 1 and Hider = 0
			// the roles are never undefined here because this game has been "played again"
			this.players.sort((a, b) => +!b.role - +!a.role);

			// takes the first player from the collection and inserts them at the end
			const head = this.players.first()!;
			this.players.delete(head.user);
			this.players.set(head.user, head);

			const count =
				pickTeamsInteraction.customId === "rotate" && pickTeamsInteraction.isStringSelectMenu()
					? parseInt(pickTeamsInteraction.values[0] ?? "-1")
					: fairestNumSeekers;
			let i = 0;
			// sets the first X players in the rotated players collection as seekers
			this.players.forEach((v) => {
				v.role = i++ < count ? PlayerRole.Seeker : PlayerRole.Hider;
			});
		} else if (pickTeamsInteraction.customId === "random" && pickTeamsInteraction.isStringSelectMenu()) {
			const count =
				pickTeamsInteraction.customId === "random"
					? parseInt(pickTeamsInteraction.values[0] ?? "-1")
					: fairestNumSeekers;
			if (count === -1) return await this.abort();
			const seekerKeys = getRandomValues(Array.from(this.players.keys()), count);
			this.players.map((v, k) => {
				v.role = seekerKeys.includes(k) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		} else if (pickTeamsInteraction.customId === "manual" && pickTeamsInteraction.isStringSelectMenu())
			this.players.map((v, k) => {
				v.role = pickTeamsInteraction.values.includes(k.id) ? PlayerRole.Seeker : PlayerRole.Hider;
				this.players.set(k, v);
			});
		else return !!void (await this.abort());
		await Promise.all(
			this.players.map(async (v) => {
				if (v.isNotHost()) {
					if (!this.playedAgain) await v.interaction.editReply(await v.roleEmbed());
					else await v.interaction.followUp({ ...(await v.roleEmbed()), ephemeral: true });
				}
			}),
		);
	}
	private async awaitMatchStart(this: Game<GameState.WaitingForMatchStart>): Promise<boolean | void> {
		this.state = GameState.WaitingForMatchStart;
		await this.updateMainMessage();

		const waitForMatchMessage = await this.hostConfigInteraction.editReply({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b
							.setTitle(`Waiting for match start... ${SQUIDSHUFFLE_EMOJI}`)
							.setDescription(
								'Press the `Match started!` button after the game says "Ready?" and "GO!"!',
							),
					)
				).embeds,
			],
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("Match started!")
						.setEmoji("✔️")
						.setCustomId("started")
						.setStyle(ButtonStyle.Success),
					abortButton,
				),
			],
		});
		const waitForMatchInteraction = await waitForMatchMessage.awaitMessageComponent({
			componentType: ComponentType.Button,
		});
		if (waitForMatchInteraction.customId === "abort") return !!void (await this.abort());
		this.startedTime = new Date();
		await waitForMatchInteraction.update({
			embeds: [
				...(await this.host.roleEmbed()).embeds,
				...(
					await this.hostConfigEmbeds((b) =>
						b.setTitle(`Game started! ${BOOYAH_EMOJI}`).setDescription("Have fun!").setColor("Green"),
					)
				).embeds,
			],
			components: [],
		});
		this.startedMessage = await this.host.interaction.followUp(
			`**The game has started! ${BOOYAH_EMOJI} Good luck everyone!** Hiding time ends ${futureTimestamp(
				this.hideTimeSeconds,
				this.startedTime,
			)} ${messageHiddenText(this.players.map((v) => `<@${v.user.id}>`).join(""))}`,
		);
	}
	private async hideTime(this: Game<GameState.HideTime>): Promise<boolean | void> {
		this.state = GameState.HideTime;
		await this.updateMainMessage();
		await wait(this.startedTime.getTime() / 1000 + this.hideTimeSeconds - new Date().getTime() / 1000);
		if (this.startedMessage.deletable) await this.startedMessage.delete();
		this.hidingTimeUpMsg = await this.host.interaction.followUp({
			content: `**⏰ Hiding time is up! The seekers will now go look for the hiders!** Match ends ${futureTimestamp(
				this.hideTimeSeconds + this.seekTimeSeconds,
				this.startedTime,
			)} ${messageHiddenText(this.players.map((v) => `<@${v.user.id}>`).join(""))}`,
			fetchReply: true,
		});
	}
	private async seekTime(this: Game<GameState.SeekTime>): Promise<boolean | void> {
		this.state = GameState.SeekTime;
		await this.updateMainMessage();

		await wait(
			this.startedTime.getTime() / 1000 +
				this.hideTimeSeconds +
				this.seekTimeSeconds -
				new Date().getTime() / 1000,
		);
		if (this.hidingTimeUpMsg.deletable) await this.hidingTimeUpMsg.delete();
	}
	public async playAgain(this: Game<GameState.PlayAgain>): Promise<boolean | void> {
		this.state = GameState.PlayAgain;
		await this.updateMainMessage();

		const playAgainMessage = await this.hostConfigInteraction.editReply({
			...(await this.hostConfigEmbeds((b) =>
				b
					.setTitle("Play again?")
					.setDescription(
						`Do you want to play again with the same players?\nPicking \`Nah\` ${futureTimestamp(
							SECONDS_TO_PLAY_AGAIN,
						)}`,
					),
			)),
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId("playAgain")
						.setLabel("Yeah!")
						.setEmoji("✔️")
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId("no").setLabel("Nah").setEmoji("✖️").setStyle(ButtonStyle.Danger),
				),
			],
		});
		let playAgain = false;
		try {
			const i = await playAgainMessage.awaitMessageComponent({
				componentType: ComponentType.Button,
				time: SECONDS_TO_PLAY_AGAIN * 1000,
			});
			if (i.customId === "no") throw new Error();
			await i.deferUpdate();
			this.playedAgain = true;
			playAgain = true;
		} catch {
			playAgain = false;
		}
		await Promise.all([
			this.mainMessage.edit({
				...(await embeds((b) =>
					b.setTitle(`Hide and seek game finished ${VEEMO_PEEK_EMOJI}`).addFields(this.playerListField()),
				)),
			}),
			this.hostConfigInteraction.editReply({
				...(await embeds((b) =>
					b
						.setTitle("Hide and seek game finished")
						.setColor("Green")
						.setDescription("You can dismiss this message now."),
				)),
				components: [],
			}),
		]);
		return playAgain;
	}

	public async start() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			if ((await (this as Game<GameState.WaitingForPlayers>).awaitPlayers()) === false) break;
			if ((await (this as Game<GameState.DecidingTeams>).decideTeams()) === false) break;
			if ((await (this as Game<GameState.WaitingForMatchStart>).awaitMatchStart()) === false) break;
			if ((await (this as Game<GameState.HideTime>).hideTime()) === false) break;
			if ((await (this as Game<GameState.SeekTime>).seekTime()) === false) break;
			if ((await (this as Game<GameState.PlayAgain>).playAgain()) === false) break;
		}
	}

	public async abort() {
		await Promise.all([
			this.mainMessage?.edit({
				...(await embeds((b) =>
					b
						.setTitle(`Hide and seek game was aborted ${OUCH_EMOJI}`)
						.setDescription("The game was aborted...")
						.setColor("Red"),
				)),
				components: [],
			}),
			await this.hostConfigInteraction?.editReply({
				content: "",
				...(await embeds((b) =>
					b
						.setTitle("The game has been aborted")
						.setDescription("You can dismiss this message now.")
						.setColor("Red"),
				)),
				components: [],
			}),
			this.players.toJSON().map(async (v) => {
				if (v.isNotHost() && !this.playedAgain)
					await v.interaction.editReply({
						content: "",
						...(await embeds((b) =>
							b
								.setTitle("The game has been aborted")
								.setDescription("You can dismiss this message now.")
								.setColor("Red"),
						)),
						components: [],
					});
			}),
		]);
	}
	public async updateMainMessage() {
		const parts: string[] = ["**Rules**", RULES, ""];
		switch (this.state) {
			case GameState.WaitingForPlayers:
				parts.push(`Expires ${futureTimestamp(SECONDS_TO_JOIN, this.createdTime)}`);
				break;
			case GameState.DecidingTeams:
				parts.push(`${SQUIDSHUFFLE_EMOJI} ${userMention(this.host.user.id)} is deciding teams...`);
				break;
			case GameState.WaitingForMatchStart:
				parts.push(`${SQUIDSHUFFLE_EMOJI} Waiting for the match to start...`);
				break;
			case GameState.HideTime:
				parts.push(`Hiding time ends ${futureTimestamp(this.hideTimeSeconds, this.startedTime)}`);
				break;
			case GameState.SeekTime:
				parts.push(
					`Match ends ${futureTimestamp(this.hideTimeSeconds + this.seekTimeSeconds, this.startedTime)}`,
				);
				break;
			case GameState.PlayAgain:
				parts.push(`Waiting for ${userMention(this.host.user.id)} to decide if we should play again...`);
				break;
		}
		await this.mainMessage?.edit({
			...(await embeds((b) =>
				b
					.setTitle(`Hide and seek! ${VEEMO_PEEK_EMOJI}`)
					.setDescription(parts.join("\n"))
					.addFields(this.playerListField()),
			)),
			...(this.state !== GameState.WaitingForPlayers ? { components: [] } : {}),
		});
	}
}
