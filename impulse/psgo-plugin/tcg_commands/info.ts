/**
 * Information and search TCG commands
 * Includes: card details, search, collection viewing, stats, sets, rarities, types
 */

import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { 
	POKEMON_SETS, 
	getRarityColor, 
	getSubtypeColor,
	RARITIES, 
	SUBTYPES, 
	POKEMON_TYPES,
	SUPERTYPES, 
	SPECIAL_SUBTYPES 
} from '../../../impulse/psgo-plugin/tcg_data';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { getCardPoints, hexToRgba } from './shared';

export const infoCommands: Chat.ChatCommands = {

	async card(target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) return this.errorReply("Please specify a card ID. Usage: /tcg card [cardId]");

		try {
			const card = await TCGCards.findOne({ cardId: target.trim() });
			if (!card) return this.errorReply(`Card with ID "${target}" not found.`);

			// Use centralized card detail view builder
			const output = TCG_UI.buildCardDetailView({
				card,
				getCardPoints,
				hexToRgba,
				SPECIAL_SUBTYPES
			});

			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async search(target, room, user) {
		if (!this.runBroadcast()) return;
		const CARDS_PER_PAGE = PAGINATION_CONFIG.CARDS_PER_PAGE;

		const filters = target.split(',').map(f => f.trim());
		const query: any = {};
		const searchTerms: string[] = [];
		let page = 1;
		let sortBy: 'name' | 'battleValue' | 'hp' | 'rarity' = 'name';

		const commandArgs = [];
		for (const filter of filters) {
			const [key, ...valueParts] = filter.split(':');
			const value = valueParts.join(':').trim();
			if (!key || !value) continue;
			
			if (toID(key) === 'page') {
				const pageNum = parseInt(value);
				if (!isNaN(pageNum) && pageNum > 0) page = pageNum;
				continue; 
			}
			
			if (toID(key) === 'sort') {
				if (['name', 'battlevalue', 'hp', 'rarity'].includes(toID(value))) {
					sortBy = toID(value) === 'battlevalue' ? 'battleValue' : toID(value) as any;
				}
				commandArgs.push(filter);
				continue;
			}
			
			commandArgs.push(filter);
			searchTerms.push(`<strong>${key}</strong>: "${value}"`);
			
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
				default:
					return this.errorReply(`Invalid filter: "${key}".`);
			}
		}

		if (Object.keys(query).length === 0) {
			return this.errorReply('No valid filters provided. Usage: /tcg search name:Pikachu, sort:battleValue');
		}

		try {
			const totalResults = await TCGCards.countDocuments(query);
			const skip = (page - 1) * CARDS_PER_PAGE;
			const totalPages = Math.ceil(totalResults / CARDS_PER_PAGE);

			const paginatedResults = await TCGCards.find(query)
				.skip(skip)
				.limit(CARDS_PER_PAGE)
				.toArray();

			if (totalResults === 0) {
				return this.sendReply(`No cards found matching your criteria.`);
			}

			paginatedResults.sort((a, b) => {
				switch (sortBy) {
					case 'battleValue':
						return (b.battleValue || 0) - (a.battleValue || 0);
					case 'hp':
						return (b.hp || 0) - (a.hp || 0);
					case 'rarity':
						const pointsDiff = getCardPoints(b) - getCardPoints(a);
						if (pointsDiff !== 0) return pointsDiff;
						return a.name.localeCompare(b.name);
					case 'name':
					default:
						return a.name.localeCompare(b.name);
				}
			});

			const tableHtml = TCG_UI.generateCardTable(
				paginatedResults,
				['name', 'set', 'rarity', 'type', 'hp', 'battleValue']
			);

			let content = `<p><em>Searching for: ${searchTerms.join(', ')}</em>` +
				(sortBy !== 'name' ? ` | <strong>Sorted by: ${sortBy === 'battleValue' ? 'Battle Value' : sortBy.toUpperCase()}</strong>` : '') +
				`</p>` +
				tableHtml +
				`<p style="text-align:center; margin-top: 8px;">Showing ${paginatedResults.length} of ${totalResults} results.</p>`;
			
			// Use centralized pagination controls
			const commandString = `/tcg search ${commandArgs.filter(arg => !arg.startsWith('page:')).join(', ')}`;
			content += TCG_UI.buildPaginationControls({
				commandString,
				currentPage: page,
				totalPages,
				totalResults,
				resultsPerPage: CARDS_PER_PAGE,
				includeSortButtons: true,
				sortOptions: ['name', 'battleValue', 'hp', 'rarity']
			});

			const output = TCG_UI.buildPage('🔍 Search Results', content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async collection(target, room, user) {
		if (!this.runBroadcast()) return;
		const parts = target.split(',').map(p => p.trim());
		const targetUsername = parts[0] || user.name;
		const targetId = toID(targetUsername);

		const query: any = {};
		let sortBy: 'rarity' | 'battleValue' | 'hp' | 'name' = 'rarity';
		let page = 1;
		const CARDS_PER_PAGE = 50;

		const commandArgs = [];

		if (parts.length > 1) {
			const filters = parts.slice(1);
			for (const filter of filters) {
				const [key, ...valueParts] = filter.split(':');
				const value = valueParts.join(':').trim();
				if (!key || !value) continue;
				
				if (toID(key) === 'page') {
					const pageNum = parseInt(value);
					if (!isNaN(pageNum) && pageNum > 0) page = pageNum;
					continue;
				}
				
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

			const totalCards = filteredUserCards.length;
			const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
			const startIndex = (page - 1) * CARDS_PER_PAGE;
			const endIndex = startIndex + CARDS_PER_PAGE;
			const paginatedCards = filteredUserCards.slice(startIndex, endIndex);

			const cardsToDisplay = paginatedCards.map(item => cardMap.get(item.cardId)).filter((c): c is TCGCard => !!c);
			const quantityMap = new Map(paginatedCards.map(item => [item.cardId, item.quantity]));
			
			let content = `<p style="text-align: center; font-size: 1.1em; margin-bottom: 15px;">` +
				`<strong>Total Cards:</strong> ${collection.stats?.totalCards || 0} | ` +
				`<strong>Total Points:</strong> ${totalPoints} | ` +
				`<strong>Unique Cards:</strong> ${collection.stats?.uniqueCards || 0} | ` +
				`<strong>Total Battle Value:</strong> ${totalBattleValue}` +
				`</p>`;
			
			content += TCG_UI.generateCardTable(
				cardsToDisplay,
				['name', 'set', 'rarity', 'type', 'hp', 'battleValue', 'quantity'],
				quantityMap
			);

			if (filteredUserCards.length > PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT) {
				content += `<p style="text-align:center; margin-top: 8px;"><em>Showing top ${PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT} of ${filteredUserCards.length} matching cards.</em></p>`;
			}
			
			content += TCG_UI.buildSortControls({
				baseCommand: `/tcg collection ${targetUsername}`,
				sortOptions: [
					{ value: 'rarity', label: 'Rarity' },
					{ value: 'battleValue', label: 'Battle Value' },
					{ value: 'hp', label: 'HP' },
					{ value: 'name', label: 'Name' }
				]
			});
			
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
				
				missingCards.sort((a, b) => {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
					return getCardPoints(b) - getCardPoints(a);
				});
				
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

	async stats(target, room, user) {
		if (!this.runBroadcast()) return;
		const sortBy = toID(target) || 'total';
		let sortQuery: any = { 'stats.totalCards': -1 };
		let sortLabel = 'Total Cards';

		switch (sortBy) {
			case 'unique':
				sortQuery = { 'stats.uniqueCards': -1 };
				sortLabel = 'Unique Cards';
				break;
			case 'points':
				sortQuery = { 'stats.totalPoints': -1 };
				sortLabel = 'Total Points';
				break;
			case 'total':
				break;
			default:
				return this.errorReply(`Invalid sort type. Use: total, unique, or points.`);
		}

		try {
			const totalUsers = await UserCollections.countDocuments({});
			const totalCardsInDb = await TCGCards.countDocuments({});

			const topCollectors = await UserCollections.find({})
				.sort(sortQuery)
				.limit(PAGINATION_CONFIG.LEADERBOARD_SIZE)
				.toArray();
		
			let content = `<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Unique Cards in Database:</strong> ${totalCardsInDb}</p>`;
			
			if (topCollectors.length > 0) {
				const rows = topCollectors.map((collector, idx) => {
					let statValue = 0;
					switch (sortBy) {
						case 'unique':
							statValue = collector.stats.uniqueCards;
							break;
						case 'points':
							statValue = collector.stats.totalPoints || 0;
							break;
						default:
							statValue = collector.stats.totalCards;
							break;
					}
					return [
						`${idx + 1}`,
						Impulse.nameColor(collector.userId, true),
						`${statValue}`
					];
				});

				content += `<h4>Top ${PAGINATION_CONFIG.LEADERBOARD_SIZE} Collectors by ${sortLabel}</h4>` +
					TCG_UI.buildTable({
						headers: ['Rank', 'User', sortLabel],
						rows
					});
			}
			
			const output = TCG_UI.buildInfoBox('TCG Collection Statistics', content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async sets(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const seriesGroups = new Map<string, any[]>();
		POKEMON_SETS.forEach(set => {
			if (!seriesGroups.has(set.series)) {
				seriesGroups.set(set.series, []);
			}
			seriesGroups.get(set.series)!.push(set);
		});

		let content = '';
		seriesGroups.forEach((sets, series) => {
			const rows = sets.map(set => [
				set.code,
				`<strong>${set.name}</strong>`,
				`${set.year}`
			]);

			content += `<h4 style="margin-top: 10px; margin-bottom: 5px;">${series} Series</h4>` +
				TCG_UI.buildTable({
					headers: ['Code', 'Name', 'Year'],
					rows,
					scrollable: false
				});
		});

		const output = TCG_UI.buildInfoBox('Pokemon TCG Sets', TCG_UI.buildScrollableContainer(content));
		this.sendReplyBox(output);
	},

	async rarities(target, room, user) {
		if (!this.runBroadcast()) return;
		let content = `<ul style="list-style: none; padding: 10px;">`;
		RARITIES.forEach(rarity => {
			content += `<li><span style="color: ${getRarityColor(rarity)}; font-weight: bold;">●</span> ${rarity}</li>`;
		});
		content += `</ul>`;
		
		const output = TCG_UI.buildPage('Pokemon TCG Rarities', TCG_UI.buildScrollableContainer(content));
		this.sendReplyBox(output);
	},

	async types(target, room, user) {
		if (!this.runBroadcast()) return;
		let content = `<p><strong>Supertypes:</strong> ${SUPERTYPES.join(', ')}</p>` +
			`<p><strong>Pokemon Types:</strong> ${POKEMON_TYPES.join(', ')}</p>` +
			`<h4>Pokemon Subtypes</h4><p>${SUBTYPES.Pokemon.join(', ')}</p>` +
			`<h4>Trainer Subtypes</h4><p>${SUBTYPES.Trainer.join(', ')}</p>` +
			`<h4>Energy Subtypes</h4><p>${SUBTYPES.Energy.join(', ')}</p>`;
		
		const output = TCG_UI.buildPage('Pokemon TCG Data', content);
		this.sendReplyBox(output);
	},
};
