/**
 * Core TCG commands - daily, currency, pay
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { UserCollections, TCGCards } from '../../../impulse/psgo-plugin/tcg_collections';
import { POKEMON_SETS, getRarityColor, SPECIAL_SUBTYPES } from '../../../impulse/psgo-plugin/tcg_data';
import { DAILY_CONFIG, ERROR_MESSAGES, VALIDATION_LIMITS } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints, ensureUserCollection, getValidPackSets } from './shared';

export const coreCommands: Chat.ChatCommands = {
	async daily(target, room, user) {
		if (!this.runBroadcast()) return;
		const userId = user.id;
		const twentyFourHours = DAILY_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;

		try {
			let collection = await UserCollections.findOne({ userId });

			if (collection?.lastDaily && (Date.now() - collection.lastDaily < twentyFourHours)) {
				const timeLeft = collection.lastDaily + twentyFourHours - Date.now();
				const hours = Math.floor(timeLeft / (1000 * 60 * 60));
				const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
				return this.sendReply(`You have already claimed your daily pack. Please wait ${hours}h ${minutes}m.`);
			}

			// Get valid sets only
			const availableSets = await getValidPackSets();
			if (availableSets.length === 0) {
				return this.errorReply(ERROR_MESSAGES.SET_UNAVAILABLE);
			}
			const randomSetId = availableSets[Math.floor(Math.random() * availableSets.length)];
			
			const pack = await generatePack(randomSetId);
			if (!pack) {
				return this.errorReply(`${ERROR_MESSAGES.PACK_GENERATION_FAILED} from set "${randomSetId}".`);
			}

			collection = await ensureUserCollection(userId);

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
			collection.currency = (collection.currency || 0) + DAILY_CONFIG.CURRENCY_AWARD;
			collection.lastUpdated = Date.now();
			collection.lastDaily = Date.now();

			await UserCollections.updateOne(
				{ userId },
				{ $set: collection },
				{ upsert: true }
			);

			const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(randomSetId));
			const displaySetName = setInfo ? setInfo.name : randomSetId;

			pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
			
			// Build table with battle value
			let tableHtml = `<p style="text-align:center;">You received a pack from <strong>${displaySetName}</strong> and <strong>${DAILY_CONFIG.CURRENCY_AWARD} Credits</strong>!</p><hr/>` +
				`<div style="max-height: 380px; overflow-y: auto;"><table class="themed-table">` +
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

			const output = TCG_UI.buildPage(`🎁 You claimed your daily pack!`, tableHtml);
			await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);
			TCG_Ranking.getPlayerRanking(user.id).catch(e => 
        console.error('Ranking update failed:', e)
    );
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async currency(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const targetUser = toID(target) || user.id;
		const targetUsername = target.trim() || user.name;
		
		try {
			const balance = await TCG_Economy.getUserBalance(targetUser);
			const content = `<strong>${Impulse.nameColor(targetUsername, true)}'s Balance:</strong> ${balance} Credits.`;
			this.sendReplyBox(content);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async pay(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		const [targetUser, amountStr] = target.split(',').map(p => p.trim());
		if (!targetUser || !amountStr) {
			return this.errorReply("Usage: /tcg pay [user], [amount]");
		}

		const amount = parseInt(amountStr);
		if (isNaN(amount) || amount < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT || amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
			return this.errorReply(`Amount must be between ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT} and ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}.`);
		}

		const fromUserId = user.id;
		const toUserId = toID(targetUser);

		if (fromUserId === toUserId) {
			return this.errorReply(ERROR_MESSAGES.SELF_ACTION_ERROR);
		}

		try {
			const success = await TCG_Economy.transferCurrency(fromUserId, toUserId, amount);

			if (success) {
				this.sendReply(`You have sent ${amount} Credits to ${targetUser}.`);
				const toUserObj = Users.get(toUserId);
				if (toUserObj) toUserObj.send(`|raw|You have received ${amount} Credits from ${user.name}.`);
			} else {
				this.errorReply(`Payment failed. ${ERROR_MESSAGES.INSUFFICIENT_CREDITS}.`);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
