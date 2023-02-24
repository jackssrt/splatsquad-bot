import axios from "axios";
import consola from "consola";
import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, TimestampStyles } from "discord.js";
import { USER_AGENT } from "../client.js";
import database from "../database.js";
import type Event from "../event.js";
// Generated by https://quicktype.io

export interface Data {
	US: Ap;
	EU: Ap;
	JP: Ap;
	AP: Ap;
}

export interface Ap {
	data: DataClass;
}

export interface DataClass {
	festRecords: FestRecords;
	currentPlayer: CurrentPlayer;
}

export interface CurrentPlayer {
	name: string;
	userIcon: UserIcon;
}

export interface UserIcon {
	url: string;
}

export interface FestRecords {
	nodes: Node[];
}

export interface Node {
	id: string;
	state: State;
	startTime: string;
	endTime: string;
	title: string;
	lang: Lang;
	image: UserIcon;
	playerResult: null;
	teams: Team[];
	myTeam: null;
	__typename: NodeTypename;
	isVotable: boolean;
	undecidedVotes: Votes | null;
}

export enum NodeTypename {
	Fest = "Fest",
}

export enum Lang {
	EUen = "EUen",
	JPja = "JPja",
	USen = "USen",
}

export enum State {
	Closed = "CLOSED",
	Scheduled = "SCHEDULED",
}

export interface Team {
	result: Result | null;
	id: string;
	teamName: string;
	color: Color;
	image: UserIcon;
	myVoteState: null;
	preVotes: Votes | null;
	votes: Votes | null;
	role: Role | null;
}

export interface Color {
	a: number;
	b: number;
	g: number;
	r: number;
}

export interface Votes {
	totalCount: number;
}

export interface Result {
	__typename: ResultTypename;
	isWinner: boolean;
	horagaiRatio: number;
	isHoragaiRatioTop: boolean;
	voteRatio: number;
	isVoteRatioTop: boolean;
	regularContributionRatio: number;
	isRegularContributionRatioTop: boolean;
	challengeContributionRatio: number;
	isChallengeContributionRatioTop: boolean;
	tricolorContributionRatio: number | null;
	isTricolorContributionRatioTop: boolean | null;
}

export enum ResultTypename {
	FestTeamResult = "FestTeamResult",
}

export enum Role {
	Attack = "ATTACK",
	Defense = "DEFENSE",
}
export default {
	event: "ready",
	async on({ client }) {
		const {
			data: {
				EU: {
					data: {
						festRecords: { nodes: fests },
					},
				},
			},
		} = await axios.get<Data>("https://splatoon3.ink/data/festivals.json", {
			headers: {
				"User-Agent": USER_AGENT,
			},
		});
		const fest = fests.find((v) => v.state !== State.Closed);
		if (!fest || (await database.isSplatfestEventCreated(fest.id))) return;
		const guild = await client.guilds.fetch(process.env["GUILD_ID"]!);
		await Promise.all([
			(async () => {
				await guild.scheduledEvents.create({
					entityType: GuildScheduledEventEntityType.External,
					name: fest.title,
					privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
					scheduledStartTime: new Date(Date.parse(fest.startTime)),
					scheduledEndTime: new Date(Date.parse(fest.endTime)),
					entityMetadata: { location: "Splatoon 3" },
					image: fest.image.url,
					description: `Automatically created event for the upcoming splatfest.\n<t:${Math.floor(
						new Date(Date.parse(fest.startTime)).getTime() / 1000,
					)}:${TimestampStyles.RelativeTime}>\nData provided by https://splatoon3.ink`,
				});
				await database.setSplatfestEventCreated(fest.id);
			})(),
			(async () => {
				const categoryRolePosition = (await guild.roles.fetch("1072199262475132989"))?.position;
				if (!categoryRolePosition) return consola.error("Splatfest role category role not found");
				for (const [i, team] of Object.entries(fest.teams)) {
					consola.log(team.color);
					await guild.roles.create({
						name: `⚽・${team.teamName}`,
						color: [team.color.r * 255, team.color.g * 255, team.color.b * 255],
						permissions: [],
						mentionable: false,
						position: +i + categoryRolePosition,
					});
				}
			})(),
		]);
	},
} as Event<"ready">;
