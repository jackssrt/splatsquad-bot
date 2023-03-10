import type { Awaitable, InteractionReplyOptions, TextChannel, User, WebhookMessageCreateOptions } from "discord.js";
import { EmbedBuilder, GuildMember, TimestampStyles } from "discord.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type Client from "./client.js";
export interface Config {
	token: string;
	guildId: string;
	clientId: string;
	generalChannelId: string;
	levelUpChannelId: string;
	ownerId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFunction = (...args: any[]) => any;

/**
 * Pauses the program for the specified amount of time.
 * @param delay how many **seconds** (not milliseconds) it should wait
 */
export function wait(delay: number) {
	return new Promise<void>((resolve) => setTimeout(() => resolve(), delay * 1000));
}

/**
 * Loads a json file.
 * @param path the path to the json file
 * @returns the loaded json file
 * @throws if the file doesn't exist
 */
export async function loadJson<T>(path: string, reviver?: Parameters<JSON["parse"]>[1]): Promise<T> {
	if (existsSync(path)) {
		try {
			const data = (await readFile(path, { encoding: "utf-8" })).replace(/(\/\/.*)|(\/\*(.|[\n\r])*\*\/)/gm, "");
			return JSON.parse(data, function (this: unknown, key: string, value: unknown) {
				const res: unknown = reviver?.(key, value);
				return reviver ? res : value;
			}) as T;
		} catch (e) {
			throw new Error(`Failed to read ${path} (${(e as Error).name} - ${(e as Error).message})`);
		}
	} else {
		throw new Error(`File ${path} does not exist.`);
	}
}
export async function generatorToArray<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const x of gen) {
		out.push(x);
	}
	return out;
}
export type EmbedFactory = (b: EmbedBuilder) => Awaitable<EmbedBuilder>;

export async function embeds(...funcs: EmbedFactory[]) {
	return {
		embeds: await Promise.all(funcs.map(async (func) => await func(new EmbedBuilder().setColor("#2b2d31")))),
	} satisfies InteractionReplyOptions;
}
export function constructEmbedsWrapper(baseFactory: EmbedFactory): typeof embeds {
	return async (...funcs) => await embeds(...funcs.map<EmbedFactory>((v) => async (b) => v(await baseFactory(b))));
}
export function errorEmbeds(...data: { title: string; description: string }[]) {
	// I guess it got a little too much for ts to imply the types
	return embeds(
		...data.map<EmbedFactory>(
			(v) => (b) => b.setTitle(`Error: ${v.title}`).setDescription(v.description).setColor("Red"),
		),
	);
}

export function pluralize(word: string, count: number | bigint): string {
	return (
		word + ((typeof count === "bigint" && count === 1n) || (typeof count === "number" && count === 1) ? "" : "s")
	);
}

export function formatTime(totalSeconds: number | bigint): string {
	const parts: string[] = [];
	if (typeof totalSeconds === "number") {
		const hours = Math.floor(totalSeconds / 60 / 60);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = Math.floor(totalSeconds);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
		if (seconds % 60 > 0 || totalSeconds < 60) parts.push(`${seconds % 60}s`);
	} else {
		const hours = totalSeconds / 60n / 60n;
		const minutes = totalSeconds / 60n;
		const seconds = totalSeconds;
		if (hours > 0n) parts.push(`${hours}h`);
		if (minutes % 60n > 0n) parts.push(`${minutes % 60n}m`);

		if (seconds % 60n > 0n || totalSeconds < 60) parts.push(`${seconds % 60n}s`);
	}
	return parts.join(" ");
}
export function futureTimestamp(inXSeconds: number, from = new Date()) {
	return relativeTimestamp(new Date(from.getTime() + inXSeconds * 1000));
}
export function relativeTimestamp(date: Date) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${TimestampStyles.RelativeTime}>` as const;
}
export function dateTimestamp(date: Date) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${TimestampStyles.ShortDate}>` as const;
}
export function timeTimestamp(date: Date, includeSeconds: boolean) {
	return `<t:${Math.floor(date.getTime() / 1000)}:${
		includeSeconds ? TimestampStyles.LongTime : TimestampStyles.ShortTime
	}>` as const;
}
/**
 * @link https://stackoverflow.com/a/12646864
 */
export function getRandomValues<T extends unknown[]>(arr: T, count: number): T[number][] {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}

	return arr.slice(0, count);
}

const WEBHOOK_NAME = "splatsquad-bot impersonation webhook";
export async function impersonate(
	client: Client<true>,
	user: GuildMember | User,
	channel: TextChannel,
	message: string | WebhookMessageCreateOptions,
) {
	const webhook =
		(await channel.fetchWebhooks()).find((v) => v.token !== undefined && v.name === WEBHOOK_NAME) ??
		(await channel.createWebhook({
			name: WEBHOOK_NAME,
			reason: "impersonation webhook",
			avatar: client.user.avatarURL({ size: 128 }),
		}));
	await webhook.send({
		...(typeof message === "string" ? { content: message } : message),
		username: `${user instanceof GuildMember ? user.nickname ?? user.user.username : user.username}`,
		avatarURL: user.displayAvatarURL({ size: 128 }),
	} satisfies WebhookMessageCreateOptions);
}
export function messageHiddenText(text: string) {
	// eslint-disable-next-line no-irregular-whitespace
	return ` ||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???||||???|| ${text}` as const;
}

export function shortenStageName(stage: string): string {
	return ["Wahoo World", "Scorch Gorge", "Flounder Heights", "Um'ami Ruins", "Manta Maria"].includes(stage)
		? stage
		: stage.split(" ")[0]!;
}
