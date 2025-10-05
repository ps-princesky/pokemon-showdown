/**
 * Collection-related TCG commands
 * UPDATED: Enhanced to show battle data in collections
 */

import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { POKEMON_SETS, getRarityColor, getSubtypeColor } from '../../../impulse/psgo-plugin/tcg_data';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { getCardPoints } from './shared';

export const collectionCommands: Chat.ChatCommands = {
	async collection(target, room, user) {
		if (!this.runBroadcast()) return;
		const parts = target.split(',').map(p => p.trim());
		const targetUsername = parts[0] || user.name;
		const targetId = toID(targetUsername);

		const query: any = {};
		let sortBy: 'rarity' | 'battleValue' | 'hp' | 'name' = 'rarity'; // Default sort by rarity
		let page = 1; // NEW: Pagination
		const CARDS_PER_PAGE = 50; // NEW: Cards per page

		const commandArgs = []; // NEW: Track filters for pagination

		if (parts.length > 1) {
			const filters = parts.slice(1);
			for (const filter of filters) {
				const [key, ...valueParts] = filter.split(':');
				const value = valueParts.join(':').trim();
				if (!key || !value) continue;
				
				// Handle page parameter
				if (toID(key) === 'page') {
					const pageNum = parseInt(value);
					if (!isNaN(pageNum) && pageNum > 0) page = pageNum;
					continue;
				}
				
				// Handle sort parameter
				if (toID(key) === 'sort') {
					if (['rarity', 'battlevalue', 'hp', 'name'].includes(toID(value))) {
						sortBy = toID(value) === 'battlevalue' ? 'battleValue' : toID(value) as any;
					}
					commandArgs.push(filter);
					continue;
				}
				
				commandArgs.push(filter);
				
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
					// NEW: Battle value filter
					case 'battlevalue':
					case 'bv':
						const bvMatch = value.match(/([<>=]+)?\s*(\d+)/);
						if (bvMatch) {
							const operator = bvMatch[1] || '=';
							const amount = parseInt(bvMatch[2]);
							if (isNaN(amount)) break;
							if (operator === '>') query.battleValue = { $gt: amount };
							else if (operator === '>=') query.battleValue = { $gte: amount };
							else if (operator === '<') query.battleValue = { $lt: amount };
							else if (operator === '<=') query.battleValue = { $lte: amount };
							else query.battleValue = amount;
						}
						break;
				}
			}
		}

		try {
			const collection = await UserCollections.findOne({ userId: targetId });
			if (!collection || !collection.cards || collection.cards.length === 0) {
				const output = TCG_UI.buildPage(
					`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`,
					`${targetUsername} doesn't have any cards in their collection yet!`
				);
				this.sendReplyBox(output);
				return;
			}

			query.cardId = { $in: collection.cards.map(c => c.cardId) };
			
			const allOwnedCards = await TCGCards.find(query).toArray();
			const cardMap = new Map(allOwnedCards.map(c => [c.cardId, c]));

			let totalPoints = 0;
			let totalBattleValue = 0;
			for (const item of collection.cards) {
				const card = cardMap.get(item.cardId);
				if (card) {
					totalPoints += getCardPoints(card) * item.quantity;
					if (card.battleValue) {
						totalBattleValue += card.battleValue * item.quantity;
					}
				}
			}

			const filteredUserCards = collection.cards.filter(item => cardMap.has(item.cardId));

			// Enhanced sorting
			filteredUserCards.sort((a, b) => {
				const cardA = cardMap.get(a.cardId);
				const cardB = cardMap.get(b.cardId);
				if (!cardA || !cardB) return 0;
				
				switch (sortBy) {
					case 'battleValue':
						return (cardB.battleValue || 0) - (cardA.battleValue || 0);
					case 'hp':
						return (cardB.hp || 0) - (cardA.hp || 0);
					case 'name':
						return cardA.name.localeCompare(cardB.name);
					case 'rarity':
					default:
						const pointsDiff = getCardPoints(cardB) - getCardPoints(cardA);
						if (pointsDiff !== 0) return pointsDiff;
						return cardA.rarity.localeCompare(cardB.rarity);
				}
			});

			// Pagination logic
			const totalCards = filteredUserCards.length;
			const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
			const startIndex = (page - 1) * CARDS_PER_PAGE;
			const endIndex = startIndex + CARDS_PER_PAGE;
			const paginatedCards = filteredUserCards.slice(startIndex, endIndex);

			const cardsToDisplay = paginatedCards.map(item => cardMap.get(item.cardId)).filter((c): c is TCGCard => !!c);
			const quantityMap = new Map(paginatedCards.map(item => [item.cardId, item.quantity]));
			
			// Stats summary above table
			let content = `<p style="text-align: center; font-size: 1.1em; margin-bottom: 15px;">` +
				`<strong>Total Cards:</strong> ${collection.stats?.totalCards || 0} | ` +
				`<strong>Total Points:</strong> ${totalPoints} | ` +
				`<strong>Unique Cards:</strong> ${collection.stats?.uniqueCards || 0} | ` +
				`<strong>Total Battle Value:</strong> ${totalBattleValue}` +
				`</p>`;
			
			// Use generateCardTable instead of manual table building
			content += TCG_UI.generateCardTable(
				cardsToDisplay,
				['name', 'set', 'rarity', 'type', 'hp', 'battleValue', 'quantity'],
				quantityMap
			);

			if (filteredUserCards.length > PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT) {
				content += `<p style="text-align:center; margin-top: 8px;"><em>Showing top ${PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT} of ${filteredUserCards.length} matching cards.</em></p>`;
			}
			
			// Sort controls
			content += `<div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">` +
				`<strong style="font-size: 0.9em;">Sort by:</strong> ` +
				`<button name="send" value="/tcg collection ${targetUsername}, sort:rarity">Rarity</button> ` +
				`<button name="send" value="/tcg collection ${targetUsername}, sort:battleValue">Battle Value</button> ` +
				`<button name="send" value="/tcg collection ${targetUsername}, sort:hp">HP</button> ` +
				`<button name="send" value="/tcg collection ${targetUsername}, sort:name">Name</button>` +
				`</div>`;
			
			const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s TCG Collection`, content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async setprogress(target, room, user) {
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
				TCGCards.find({ set: cleanSetId }).toArray(),
			]);

			if (allSetCards.length === 0) {
				return this.errorReply(`No cards found for the set "${displaySetName}". Make sure cards are imported for this set.`);
			}
			
			const ownedCardIds = new Set(userCollection?.cards?.map(c => c.cardId) || []);
			const missingCards: TCGCard[] = [];
			let ownedCount = 0;
			let totalBattleValue = 0;

			for (const card of allSetCards) {
				if (ownedCardIds.has(card.cardId)) {
					ownedCount++;
				} else {
					missingCards.push(card);
					if (card.battleValue) {
						totalBattleValue += card.battleValue;
					}
				}
			}

			const totalInSet = allSetCards.length;
			const percentage = totalInSet > 0 ? Math.round((ownedCount / totalInSet) * 100) : 0;
			
			let content = `<p><strong>Collector:</strong> ${Impulse.nameColor(targetUsername, true)} | <strong>Completion:</strong> ${ownedCount} / ${totalInSet} cards (${percentage}%)</p>`;
			
			if (totalBattleValue > 0 && missingCards.length > 0) {
				content += `<p style="color: #e74c3c; font-weight: bold;">⚔️ Missing Battle Value: ${totalBattleValue}</p>`;
			}
			
			content += TCG_UI.buildProgressBar({
				current: ownedCount,
				total: totalInSet,
				showText: true
			});

			if (missingCards.length > 0) {
				content += `<h4 style="margin-top: 15px;">Missing Cards:</h4>`;
				
				// Sort by battle value (highest first)
				missingCards.sort((a, b) => {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
					return getCardPoints(b) - getCardPoints(a);
				});
				
				// Use generateCardTable instead of manual table building
				content += TCG_UI.generateCardTable(
					missingCards,
					['name', 'rarity', 'battleValue']
				);
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
					await UserCollections.updateOne(
						{ userId: user.id },
						{ $addToSet: { wishlist: card.cardId } }
					);
					return this.sendReply(`Added ${card.name} to your wishlist.`);
				} else {
					await UserCollections.updateOne(
						{ userId: user.id },
						{ $pull: { wishlist: card.cardId } }
					);
					return this.sendReply(`Removed ${card.name} from your wishlist.`);
				}
			} else {
				const targetUsername = parts[0] || user.name;
				const targetId = toID(targetUsername);
				const collection = await UserCollections.findOne({ userId: targetId });
				
				if (!collection?.wishlist?.length) {
					return this.sendReplyBox(`${targetUsername} does not have a wishlist.`);
				}

				const cards = await TCGCards.find({ cardId: { $in: collection.wishlist } }).toArray();
				
				// Sort by battle value (highest first)
				cards.sort((a, b) => {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
					return getCardPoints(b) - getCardPoints(a);
				});

				// Calculate total battle value
				const totalBattleValue = cards.reduce((sum, card) => sum + (card.battleValue || 0), 0);
				
				let content = '';
				if (totalBattleValue > 0) {
					content += `<p style="text-align: center; color: #e74c3c; font-weight: bold; margin-bottom: 10px;">⚔️ Total Wishlist Battle Value: ${totalBattleValue}</p>`;
				}
				
				// Use generateCardTable instead of manual table building
				content += TCG_UI.generateCardTable(
					cards,
					['name', 'set', 'rarity', 'battleValue']
				);
				
				const output = TCG_UI.buildPage(`${Impulse.nameColor(targetUsername, true)}'s Wishlist`, content);
				this.sendReplyBox(output);
			}
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},
};
