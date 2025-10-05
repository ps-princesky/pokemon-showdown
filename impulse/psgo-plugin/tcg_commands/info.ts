/**
 * Information and search TCG commands
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

			// Use generateCardTable instead of manual table building
			const tableHtml = TCG_UI.generateCardTable(
				paginatedResults,
				['name', 'set', 'rarity', 'type', 'hp', 'battleValue']
			);

			let content = `<p><em>Searching for: ${searchTerms.join(', ')}</em>` +
				(sortBy !== 'name' ? ` | <strong>Sorted by: ${sortBy === 'battleValue' ? 'Battle Value' : sortBy.toUpperCase()}</strong>` : '') +
				`</p>` +
				tableHtml +
				`<p style="text-align:center; margin-top: 8px;">Showing ${paginatedResults.length} of ${totalResults} results.</p>`;
			
			const commandString = `/tcg search ${commandArgs.filter(arg => !arg.startsWith('page:')).join(', ')}`;
			content += `<div style="text-align: center; margin-top: 5px;">`;
			
			if (page > 1) {
				content += `<button name="send" value="${commandString}, page:${page - 1}" style="margin-right: 5px;">&laquo; Previous</button>`;
			}
			content += `<strong>Page ${page} of ${totalPages}</strong>`;
			if ((page * CARDS_PER_PAGE) < totalResults) {
				content += `<button name="send" value="${commandString}, page:${page + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
			}
			
			content += `<div style="margin-top: 8px;">` +
				`<strong style="font-size: 0.9em;">Sort by:</strong> ` +
				`<button name="send" value="${commandString}, sort:name">Name</button> ` +
				`<button name="send" value="${commandString}, sort:battleValue">Battle Value</button> ` +
				`<button name="send" value="${commandString}, sort:hp">HP</button> ` +
				`<button name="send" value="${commandString}, sort:rarity">Rarity</button>` +
				`</div>`;
			
			content += `</div>`;

			const output = TCG_UI.buildPage('🔍 Search Results', content);
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
