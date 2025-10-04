/**
 * Admin-only TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { VALIDATION_LIMITS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { POKEMON_SETS, getRarityColor } from '../../../impulse/psgo-plugin/tcg_data';
import { generatePack, getCardPoints, ensureUserCollection } from './shared';

export const adminCommands: Chat.ChatCommands = {
	async addcard(target, room, user) {
		this.checkCan('globalban');
		const parts = target.split(',').map(x => x.trim());
		
		if (parts.length < 6) {
			return this.errorReply('Usage: /tcg addcard [cardId], [name], [set], [rarity], [supertype], [subtypes], [type], [hp]');
		}

		const [cardId, name, set, rarity, supertype, subtypesStr, type, hp] = parts;

		try {
			const subtypes = subtypesStr ? subtypesStr.split('/').map(s => s.trim()) : [];
			
			await TCGCards.updateOne(
				{ cardId },
				{
					$set: {
						cardId, 
						name: name.substring(0, VALIDATION_LIMITS.MAX_CARD_NAME_LENGTH), 
						set, 
						rarity, 
						supertype, 
						subtypes,
						type: type || undefined,
						hp: hp ? parseInt(hp) : undefined,
						stage: subtypes.includes('Basic') ? 'basic' : subtypes.includes('Stage 1') ? 'stage1' : subtypes.includes('Stage 2') ? 'stage2' : undefined,
					}
				},
				{ upsert: true }
			);
			return this.sendReply(`${SUCCESS_MESSAGES.CARD_ADDED}: "${name}" (${cardId}).`);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async openpack(target, room, user) {
		this.checkCan('globalban');
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!target) {
			return this.errorReply("Usage: /tcg openpack [set ID]. This is an admin command.");
		}
		
		const userId = user.id;
		const setId = target.trim().toLowerCase();

		try {
			const pack = await generatePack(setId);
			if (!pack) {
				return this.errorReply(`Set with ID "${target.trim()}" not found or is missing required card rarities. Use /tcg sets to see a list of sets.`);
			}

			let collection = await ensureUserCollection(userId);

			let pointsGained = 0;
			for (const card of pack) {
				pointsGained += getCardPoints(card);
				const existingCard = collection.cards.find(c => c.cardId === card.cardId);
				if (existingCard) {
					existingCard.quantity++;
				} else {
					collection.cards.push({ cardId: card.cardId, quantity: 1, addedAt: Date.now() });
				}
			}

			collection.stats.totalCards = collection.cards.reduce((sum, c) => sum + c.quantity, 0);
			collection.stats.uniqueCards = collection.cards.length;
			collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
			collection.lastUpdated = Date.now();

			await UserCollections.updateOne(
				{ userId },
				{ $set: collection },
				{ upsert: true }
			);
			
			const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(setId));
			const displaySetName = setInfo ? setInfo.name : setId;

			pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));

			// Build table with battle value
			let tableHtml = `<div style="max-height: 380px; overflow-y: auto;"><table class="themed-table">` +
				`<tr class="themed-table-header">` +
				`<th>Name</th>` +
				`<th>Set</th>` +
				`<th>Rarity</th>` +
				`<th>Type</th>` +
				`<th>⚔️ BV</th>` +
				`</tr>`;

			for (const card of pack) {
				const rarityColor = getRarityColor(card.rarity);
				
				tableHtml += `<tr class="themed-table-row">` +
					`<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>` +
					`<td>${card.set}</td>` +
					`<td><span style="color: ${rarityColor}">${card.rarity.toUpperCase()}</span></td>` +
					`<td>${card.type || card.supertype}</td>`;
				
				// Battle Value with color coding
				if (card.battleValue) {
					let bvColor = '#95a5a6';
					if (card.battleValue >= 150) bvColor = '#e74c3c';
					else if (card.battleValue >= 100) bvColor = '#f39c12';
					else if (card.battleValue >= 70) bvColor = '#3498db';
					
					tableHtml += `<td><strong style="color: ${bvColor}">${card.battleValue}</strong></td>`;
				} else {
					tableHtml += `<td>-</td>`;
				}
				
				tableHtml += `</tr>`;
			}

			tableHtml += `</table></div>`;

			const output = TCG_UI.buildPage(`🎴 ${user.name} opened a ${displaySetName} Pack!`, tableHtml);
			await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);

			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async givecurrency(target, room, user) {
		this.checkCan('globalban');
		const [targetUser, amountStr] = target.split(',').map(p => p.trim());
		if (!targetUser || !amountStr) {
			return this.errorReply("Usage: /tcg givecurrency [user], [amount]");
		}

		const amount = parseInt(amountStr);
		if (isNaN(amount) || amount < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT || amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
			return this.errorReply(`Amount must be between ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT} and ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}.`);
		}

		const targetId = toID(targetUser);
		try {
			const success = await TCG_Economy.grantCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${targetUser} has been given ${amount} Credits.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|You have received ${amount} Credits from ${user.name}.`);
			} else {
				this.errorReply(`Failed to give currency to ${targetUser}.`);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async takecurrency(target, room, user) {
		this.checkCan('globalban');
		const [targetUser, amountStr] = target.split(',').map(p => p.trim());
		if (!targetUser || !amountStr) {
			return this.errorReply("Usage: /tcg takecurrency [user], [amount]");
		}

		const amount = parseInt(amountStr);
		if (isNaN(amount) || amount < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT || amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
			return this.errorReply(`Amount must be between ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT} and ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}.`);
		}

		const targetId = toID(targetUser);
		try {
			const success = await TCG_Economy.deductCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${amount} Credits have been taken from ${targetUser}.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|${amount} Credits were taken from your account by ${user.name}.`);
			} else {
				this.errorReply(`${targetUser} does not have enough currency.`);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async setcurrency(target, room, user) {
		this.checkCan('globalban');
		const [targetUser, amountStr] = target.split(',').map(p => p.trim());
		if (!targetUser || !amountStr) {
			return this.errorReply("Usage: /tcg setcurrency [user], [amount]");
		}

		const amount = parseInt(amountStr);
		if (isNaN(amount) || amount < 0 || amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
			return this.errorReply(`Amount must be between 0 and ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}.`);
		}

		const targetId = toID(targetUser);
		try {
			const success = await TCG_Economy.setCurrency(targetId, amount);

			if (success) {
				this.sendReply(`${targetUser}'s balance has been set to ${amount} Credits.`);
				const targetUserObj = Users.get(targetId);
				if (targetUserObj) targetUserObj.send(`|raw|Your credit balance was set to ${amount} by ${user.name}.`);
			} else {
				this.errorReply(`Failed to set currency for ${targetUser}.`);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async initseason(target, room, user) {
		this.checkCan('globalban');

		try {
			// Check if season already exists
			const existingSeason = await TCG_Ranking.getCurrentSeason();
			if (existingSeason) {
				return this.errorReply("A season is already active.");
			}
			// Initialize the season system
			await TCG_Ranking.initializeSeasonSystem();
	
			const newSeason = await TCG_Ranking.getCurrentSeason();
			if (newSeason) {
				this.sendReply(`Successfully initialized ${newSeason.name}! Duration: 30 days.`);
			} else {
				this.errorReply("Failed to initialize season.");
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
