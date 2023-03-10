import { BULLET_EMOJI, EMPTY_EMOJI, SEEKER_EMOJI, SUB_EMOJI, VEEMO_PEEK_EMOJI } from "../../emojis.js";
import { PlayerRole } from "./Player.js";

export const SECONDS_TO_JOIN = 60 * 10;
export const SECONDS_TO_PICK_TEAMS = 60 * 10;
export const SECONDS_TO_PLAY_AGAIN = 60 * 1;

export const ROLE_ICON_MAP = {
	[PlayerRole.Seeker]: SEEKER_EMOJI,
	[PlayerRole.Hider]: VEEMO_PEEK_EMOJI,
} as const;

export const RULES = `${BULLET_EMOJI}No location revealing specials:
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}Tenta missiles
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Killer wail 5.1
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}Wave breaker
${BULLET_EMOJI}No ninja squid.
${BULLET_EMOJI}No hiding in your own base.

${BULLET_EMOJI}First the hiders will pick their hiding spots
${BULLET_EMOJI}After 1 minute in turf war or 2 minutes in ranked,
${EMPTY_EMOJI}the seekers will go look for the hiders.

${BULLET_EMOJI}**Seekers ${ROLE_ICON_MAP[PlayerRole.Seeker]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map during hiding time
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}aren't allowed to use sub weapons while seeking for hiders
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are allowed to super jump to squid beacons and big bubblers
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they splat all hiders once

${BULLET_EMOJI}**Hiders ${ROLE_ICON_MAP[PlayerRole.Hider]}**
${EMPTY_EMOJI}${SUB_EMOJI}${BULLET_EMOJI}aren't allowed to use the map
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}are allowed to fight back with their main weapons, sub weapons, special weapons if they get found
${EMPTY_EMOJI}${EMPTY_EMOJI}${BULLET_EMOJI}win if they survive until 5 seconds before the match ends`;
export const SEEKER_EXPLANATION = `${BULLET_EMOJI}As a seeker you're first going to back up and face away from the map.
${BULLET_EMOJI}Meanwhile the hiders are going to be painting the map and picking their hiding spots...
${BULLET_EMOJI}Only after hiding time is up can you start seeking!
${BULLET_EMOJI}Remember that the hiders can fight back!`;
export const HIDER_EXPLANATION = `${BULLET_EMOJI}As a hider you're going to head straight to the other teams base or mid,
${EMPTY_EMOJI}paint it and find a good hiding spot.
${BULLET_EMOJI}The seekers will start seeking after I send a message saying that hiding time is up.
${BULLET_EMOJI}When there's 5 seconds left of the match you can reveal your hiding spot if you want, you've won!`;
