/**
 * Collection-related TCG commands
 */

import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { POKEMON_SETS } from '../../../impulse/psgo-plugin/tcg_data';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { getCardPoints } from './shared';

export const collectionCommands: Chat.ChatCommands = {
	async collection(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		const parts = target.split(',').map(p => p.trim());
		const targetUsername = parts[0] || user.name;
		const targetId = toID(targetUsername);

		const query: any = {};

		if (parts.length > 1) {
			const filters = parts.slice(1);
			for (const filter of filters) {
				const [key, ...valueParts] = filter.split(':');
				const value = valueParts.join(':').trim();
				if (!key || !value) continue;
				switch (toID(key)) {
					case 'name': case 'set': case 'rarity': case 'supertype': case 'stage':
						query[toID(key)] = { $regex: value, $options: 'i' };
						break;
					case 'type':
						query.type = value;
						break;
					case 'subtype':
						query.subtypes = { $regex: value, $options: 'i' };
						break;
					case 'hp':
						const match = value.match(/([<>=]+)?\s*(\d+)/);
						if (match) {
							const operator = match[1] || '=';
							const amount = parseInt(match[2]);
							if (isNaN(amount)) break;
							if (operator === '>') query.hp = { $gt: amount };
							else if (operator === '>=') query.hp = { $gte: amount };
							else if (operator === '<') query.hp = { $lt: amount };
							else if (operator === '<=') query.hp = { $lte: amount };
							else query.hp = amount;
						}
						break;
				}
			}
		}

		try {
			const collection = await UserCollections.findOne({ userId: targetId });
			if (!collection || !collection.cards || collection.cards.length === 0) {
				this.sendReplyBox(TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`, `${targetUsername} doesn't have any cards in their collection yet!`));
				return;
			}

			query.cardId = { $in: collection.cards.map(c => c.cardId) };
			
			const allOwnedCards = await TCGCards.find(query);
			const cardMap = new Map(allOwnedCards.map(c => [c.cardId, c]));

			let totalPoints = 0;
			for (const item of collection.cards) {
				const card = cardMap.get(item.cardId);
				if (card) {
					totalPoints += getCardPoints(card) * item.quantity;
				}
			}

			const filteredUserCards = collection.cards.filter(item => cardMap.has(item.cardId));

			filteredUserCards.sort((a, b) => {
				const cardA = cardMap.get(a.cardId);
				const cardB = cardMap.get(b.cardId);
				if (!cardA || !cardB) return 0;
				const pointsDiff = getCardPoints(cardB) - getCardPoints(cardA);
				if (pointsDiff !== 0) return pointsDiff;
				return cardA.rarity.localeCompare(cardB.rarity);
			});

			const topCards = filteredUserCards.slice(0, PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT);
			const cardsToDisplay = topCards.map(item => cardMap.get(item.cardId)).filter((c): c is TCGCard => !!c);
			const quantityMap = new Map(topCards.map(item => [item.cardId, item.quantity]));
			
			let content = `<p><strong>Total Cards:</strong> ${collection.stats?.totalCards || 0} | <strong>Unique Cards:</strong> ${collection.stats?.uniqueCards || 0} | <strong>Total Points:</strong> ${totalPoints}</p>`;
			content += TCG_UI.generateCardTable(cardsToDisplay, ['name', 'set', 'rarity', 'type', 'quantity'], quantityMap);

			if (filteredUserCards.length > PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT) {
				content += `<p style="text-align:center; margin-top: 8px;"><em>Showing top ${PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT} of ${filteredUserCards.length} matching cards.</em></p>`;
			}
			
			const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`, content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async setprogress(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const parts = target.split(',').map(p => p.trim());
		const targetUsername = parts[0] || user.name;
		const setId = parts[1];

		if (!setId) {
			return this.errorReply("Usage: /tcg setprogress [user], [set ID]");
		}
		const targetId = toID(targetUsername);
		const cleanSetId = toID(setId);
		
		try {
			const setInfo = POKEMON_SETS.find(s => toID(s.code) === cleanSetId);
			const displaySetName = setInfo ? setInfo.name : setId;

			const [userCollection, allSetCards] = await Promise.all([
				UserCollections.findOne({ userId: targetId }),
				TCGCards.find({ set: cleanSetId }),
			]);

			if (allSetCards.length === 0) {
				return this.errorReply(`No cards found for the set "${displaySetName}". Make sure cards are imported for this set.`);
			}
			
			const ownedCardIds = new Set(userCollection?.cards?.map(c => c.cardId) || []);
			const missingCards: TCGCard[] = [];
			let ownedCount = 0;

			for (const card of allSetCards) {
				if (ownedCardIds.has(card.cardId)) {
					ownedCount++;
				} else {
					missingCards.push(card);
				}
			}

			const totalInSet = allSetCards.length;
			const percentage = totalInSet > 0 ? Math.round((ownedCount / totalInSet) * 100) : 0;
			
			let content = `<p><strong>Collector:</strong> ${Impulse.nameColor(targetUsername, true)} | <strong>Completion:</strong> ${ownedCount} / ${totalInSet} cards</p>`;
			content += `<div style="background: #555; border-radius: 4px; overflow: hidden;"><div style="width:${percentage}%; background: #2ecc71; padding: 4px 0; text-align: center; color: #fff; font-weight: bold;">${percentage}%</div></div>`;

			if (missingCards.length > 0) {
				content += `<h4 style="margin-top: 15px;">Missing Cards:</h4>`;
				missingCards.sort((a, b) => getCardPoints(a) - getCardPoints(b));
				const missingCardsTable = TCG_UI.generateCardTable(missingCards, ['name', 'rarity']);
				content += missingCardsTable;
			} else {
				content += `<p style="text-align:center; font-weight:bold; color:#2ecc71; margin-top:15px;">🎉 Set Complete! 🎉</p>`;
			}

			const output = TCG_UI.buildPage(`Set Progress for ${displaySetName}`, content);
			this.sendReplyBox(output);

		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async wishlist(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const parts = target.split(',').map(p => p.trim());
		const action = parts.length > 1 ? toID(parts[0]) : 'view';
		
		try {
			if (action === 'add' || action === 'remove') {
				const cardId = parts[1];
				if (!cardId) return this.errorReply(`You must specify a card ID.`);
				const card = await TCGCards.findOne({ cardId: cardId });
				if (!card) return this.errorReply(`Card with ID "${cardId}" not found.`);

				if (action === 'add') {
					await UserCollections.updateOne({ userId: user.id }, { $addToSet: { wishlist: card.cardId } });
					return this.sendReply(`Added ${card.name} to your wishlist.`);
				} else { // remove
					await UserCollections.updateOne({ userId: user.id }, { $pull: { wishlist: card.cardId } });
					return this.sendReply(`Removed ${card.name} from your wishlist.`);
				}
			} else { // view
				const targetUsername = parts[0] || user.name;
				const targetId = toID(targetUsername);
				const collection = await UserCollections.findOne({ userId: targetId });
				
				if (!collection?.wishlist?.length) {
					return this.sendReplyBox(`${targetUsername} does not have a wishlist.`);
				}

				const cards = await TCGCards.find({ cardId: { $in: collection.wishlist } });
				cards.sort((a, b) => getCardPoints(b) - getCardPoints(a));

				const tableHtml = TCG_UI.generateCardTable(cards, ['name', 'set', 'rarity']);
				const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s Wishlist`, tableHtml);
				this.sendReplyBox(output);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
