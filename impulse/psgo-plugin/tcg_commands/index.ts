/**
 * TCG Commands Index
 * Exports all command modules as a single commands object
 */

import { coreCommands } from '../../../impulse/psgo-plugin/core';
import { collectionCommands } from '../../../impulse/psgo-plugin/collection';
import { shopCommands } from '../../../impulse/psgo-plugin/shop';
import { battleCommands } from '../../../impulse/psgo-plugin/battle';
import { rankingCommands } from '../../../impulse/psgo-plugin/ranking';
import { infoCommands } from '../../../impulse/psgo-plugin/info';
import { adminCommands } from '../../../impulse/psgo-plugin/admin';

export const commands: Chat.ChatCommands = {
	tcg: 'pokemontcg',
	pokemontcg: {
		// Core commands
		...coreCommands,
		
		// Collection commands
		...collectionCommands,
		
		// Shop commands
		...shopCommands,
		
		// Battle commands
		...battleCommands,
		
		// Ranking commands
		...rankingCommands,
		
		// Info commands
		...infoCommands,
		
		// Admin commands
		...adminCommands,
		
		// Help command
		''(target, room, user) {
			return this.parse('/help tcg');
		},
	},

	// Help content
	tcghelp: [
		'/tcg daily - Claim your free random pack of the day and 75 credits.',
		'/tcg currency [user] - Check your or another user\'s credit balance.',
		'/tcg pay [user], [amount] - Give credits to another user.',
		'/tcg shop - View the daily rotating card pack shop (100 credits each).',
		'/tcg shop buy, [set ID] - Buy a booster pack from the shop.',
		'/tcg packs - View and open your saved packs.',
		'/tcg battle challenge, [user], [wager] - Challenge a user to a pack battle.',
		'/tcg battle accept, [user] - Accept a pack battle challenge.',
		'/tcg collection [user], [filters] - View a user\'s TCG card collection.',
		'/tcg card [cardId] - View the details of a specific card.',
		'/tcg search [filter]:[value] - Search for cards in the database.',
		'/tcg setprogress [user], [set ID] - Check collection progress for a set.',
		'/tcg wishlist [user] - View a user\'s wishlist.',
		'/tcg wishlist add, [cardId] - Add a card to your wishlist.',
		'/tcg wishlist remove, [cardId] - Remove a card from your wishlist.',
		'/tcg stats [total|unique|points] - View global TCG statistics.',
		'/tcg sets - View all Pokemon TCG sets.',
		'/tcg rarities - View all card rarities.',
		'/tcg types - View all supertypes, types, and subtypes.',
		'@ /tcg givecurrency [user], [amount] - Give credits to a user.',
		'@ /tcg takecurrency [user], [amount] - Take credits from a user.',
		'@ /tcg setcurrency [user], [amount] - Set a user\'s credit balance.',
		'@ /tcg openpack [set ID] - Open a pack of cards from a specific set.',
		'@ /tcg addcard [id], [name], [set]... - Add a card to the database.',
		'/tcg rankedbattle challenge, [user] - Challenge a user to a simulated ranked battle (10 daily, earn credits).',
		'/tcg rankedbattle targets - View available players you can challenge today.',
		'/tcg rankedbattle status - Check your daily challenge status and credit earnings.',
		'/tcg season - View current season information and rewards.',
		'/tcg seasonhistory [user] - View season reward history for a user.',
		'/tcg ranking [user] - View ranking information for a user.',
		'/tcg leaderboard [elo|seasonal] - View the ELO or seasonal leaderboards.',
		'/tcg battlehistory [user] - View ranked battle history for a user.',
		'/tcg milestones - View weekly milestone progress and claim rewards.',
		'/tcg claimmilestone [id] - Claim a completed milestone reward.',
		'@ /tcg season end - Force end the current season..',
		'@ /tcg initseason - Force start a season, when there is no season.',
	],
};
