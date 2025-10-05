/**
 * TCG Commands Index
 * Exports all command modules as a single commands object
 */

import { coreCommands } from '../../../impulse/psgo-plugin/tcg_commands/core';
import { shopCommands } from '../../../impulse/psgo-plugin/tcg_commands/shop';
import { infoCommands } from '../../../impulse/psgo-plugin/tcg_commands/info';
import { adminCommands } from '../../../impulse/psgo-plugin/tcg_commands/admin';

export const commands: Chat.ChatCommands = {
	tcg: 'pokemontcg',
	pokemontcg: {
		// Core commands
		...coreCommands,
		
		// Shop commands
		...shopCommands,
		
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
		'/tcg collection [user], [filters] - View a user\'s TCG card collection.',
		'/tcg card [cardId] - View the details of a specific card.',
		'/tcg search [filter]:[value] - Search for cards in the database.',
		'/tcg setprogress [user], [set ID] - Check collection progress for a set.',
		'/tcg stats [total|unique|points] - View global TCG statistics.',
		'/tcg sets - View all Pokemon TCG sets.',
		'/tcg rarities - View all card rarities.',
		'/tcg types - View all supertypes, types, and subtypes.',
		'/tcg battle - View your battle campaign progress.',
		'/tcg battle challenge [level] - Start a battle challenge.',
		'/tcg battle fight [cardId1], [cardId2], ... - Execute battle with selected cards.',
		'/tcg leaderboard - View the top 25 battle campaign players.',
		'@ /tcg givecurrency [user], [amount] - Give credits to a user.',
		'@ /tcg takecurrency [user], [amount] - Take credits from a user.',
		'@ /tcg setcurrency [user], [amount] - Set a user\'s credit balance.',
		'@ /tcg openpack [set ID] - Open a pack of cards from a specific set.',
		'@ /tcg addcard [id], [name], [set]... - Add a card to the database.',
	],
};
