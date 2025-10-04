/**
 * Information and search TCG commands
 */

import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
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
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!target) return this.errorReply("Please specify a card ID. Usage: /tcg card [cardId]");

		try {
			const card = await TCGCards.findOne({ cardId: target.trim() });
			if (!card) return this.errorReply(`Card with ID "${target}" not found.`);

			const rarityColorHex = getRarityColor(card.rarity);
			const startColor = hexToRgba(rarityColorHex, 0.25);
			const endColor = hexToRgba(rarityColorHex, 0.1);
			const backgroundStyle = `background: linear-gradient(135deg, ${startColor}, ${endColor});`;

			const cardNumber = card.cardId.split('-')[1] || '??';
			const points = getCardPoints(card);

			let borderColor = rarityColorHex;
			let glowEffect = '';
			const specialSubtype = card.subtypes.find(s => SPECIAL_SUBTYPES[s]);
			if (specialSubtype && SPECIAL_SUBTYPES[specialSubtype]) {
				borderColor = SPECIAL_SUBTYPES[specialSubtype].color;
				if (SPECIAL_SUBTYPES[specialSubtype].glow) {
					glowEffect = `box-shadow: 0 0 12px ${borderColor}50;`;
				}
			}
			
			const formattedSubtypes = card.subtypes.map(s => {
				const color = getSubtypeColor(s);
				return color ? `<strong style="color: ${color}">${s}</strong>` : s;
			}).join(', ');

			let output = `<div style="border: 2px solid ${borderColor}; ${glowEffect} border-radius: 8px; padding: 16px; overflow: hidden; ${backgroundStyle}">` +
				`<table style="width: 100%; border-collapse: collapse;"><tr>`;
			
			if (card.imageUrl) {
				output += `<td style="width: 210px; vertical-align: top; padding-right: 24px;">` +
					`<img src="${card.imageUrl}" alt="${card.name}" width="200" style="display: block; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">` +
					`</td>`;
			}

			output += `<td style="vertical-align: top; line-height: 1.7;">` +
				`<div style="font-size: 2em; font-weight: bold; margin-bottom: 8px;">${card.name}</div>` +
				`<div style="color: ${rarityColorHex}; font-weight: bold; font-size: 1.2em; margin-bottom: 20px;">${card.rarity}</div>` +
				`<div style="margin-bottom: 10px;"><strong>Set:</strong> ${card.set} #${cardNumber}</div>` +
				`<div style="margin-bottom: 10px;"><strong>ID:</strong> ${card.cardId}</div>` +
				`<div style="margin-bottom: 10px;"><strong>Type:</strong> ${card.type || card.supertype}</div>`;
			
			if (card.subtypes.length > 0) {
				output += `<div style="margin-bottom: 10px;"><strong>Subtypes:</strong> ${formattedSubtypes}</div>`;
			}
			if (card.hp) {
				output += `<div style="margin-bottom: 10px;"><strong>HP:</strong> ${card.hp}</div>`;
			}
			output += `<div style="margin-top: 16px; font-size: 1.1em;"><strong>Points:</strong> ${points}</div>` +
				`</td>` +
				`</tr></table>` +
				`</div>`;

			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async search(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		const CARDS_PER_PAGE = PAGINATION_CONFIG.CARDS_PER_PAGE;

		const filters = target.split(',').map(f => f.trim());
		const query: any = {};
		const searchTerms: string[] = [];
		let page = 1;

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
				default:
					return this.errorReply(`Invalid filter: "${key}".`);
			}
		}

		if (Object.keys(query).length === 0) {
			return this.errorReply('No valid filters provided.');
		}

		try {
			const { data: paginatedResults, total: totalResults, pages: totalPages } = await TCGCards.findWithPagination(
				query, { page, limit: CARDS_PER_PAGE }
			);

			if (totalResults === 0) {
				return this.sendReply(`No cards found matching your criteria.`);
			}

			paginatedResults.sort((a, b) => {
				const pointsDiff = getCardPoints(b) - getCardPoints(a);
				if (pointsDiff !== 0) return pointsDiff;
				return a.name.localeCompare(b.name);
			});

			let content = `<p><em>Searching for: ${searchTerms.join(', ')}</em></p>` +
				TCG_UI.generateCardTable(paginatedResults, ['id', 'name', 'set', 'rarity', 'type', 'subtypes', 'hp']) +
				`<p style="text-align:center; margin-top: 8px;">Showing ${paginatedResults.length} of ${totalResults} results.</p>`;
			
			const commandString = `/tcg search ${commandArgs.join(', ')}`;
			content += `<div style="text-align: center; margin-top: 5px;">`;
			if (page > 1) {
				content += `<button name="send" value="${commandString}, page:${page - 1}" style="margin-right: 5px;">&laquo; Previous</button>`;
			}
			content += `<strong>Page ${page} of ${totalPages}</strong>`;
			if ((page * CARDS_PER_PAGE) < totalResults) {
				content += `<button name="send" value="${commandString}, page:${page + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
			}
			content += `</div>`;

			const output = TCG_UI.buildPage('Search Results', content);
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async stats(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
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
			const totalUsers = await UserCollections.count({});
			const totalCardsInDb = await TCGCards.count({});

			const topCollectors = await UserCollections.findSorted({}, sortQuery, PAGINATION_CONFIG.LEADERBOARD_SIZE);
		
			let output = `<div class="infobox">` +
				`<h3>TCG Collection Statistics</h3>` +
				`<p><strong>Total Collectors:</strong> ${totalUsers} | <strong>Unique Cards in Database:</strong> ${totalCardsInDb}</p>` +
				`<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">`;
			
			if (topCollectors.length > 0) {
				output += `<h4>Top ${PAGINATION_CONFIG.LEADERBOARD_SIZE} Collectors by ${sortLabel}</h4>` +
					`<table class="themed-table">` +
					`<tr class="themed-table-header"><th>Rank</th><th>User</th><th>${sortLabel}</th></tr>`;

				topCollectors.forEach((collector, idx) => {
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
					output += `<tr class="themed-table-row">` +
						`<td>${idx + 1}</td>` +
						`<td>${Impulse.nameColor(collector.userId, true)}</td>` +
						`<td>${statValue}</td>` +
						`</tr>`;
				});
				output += `</table>`;
			}
			
			output += `</div>` +
				`</div>`;
			
			this.sendReplyBox(output);
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async sets(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		
		let output = `<div class="infobox">` +
			`<h3>Pokemon TCG Sets</h3>` +
			`<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">`;
		
		const seriesGroups = new Map<string, any[]>();
		POKEMON_SETS.forEach(set => {
			if (!seriesGroups.has(set.series)) {
				seriesGroups.set(set.series, []);
			}
			seriesGroups.get(set.series)!.push(set);
		});

		seriesGroups.forEach((sets, series) => {
			output += `<h4 style="margin-top: 10px; margin-bottom: 5px;">${series} Series</h4>` +
				`<table class="themed-table">` +
				`<tr class="themed-table-header"><th>Code</th><th>Name</th><th>Year</th></tr>`;
			sets.forEach(set => {
				output += `<tr class="themed-table-row">` +
					`<td>${set.code}</td>` +
					`<td><strong>${set.name}</strong></td>` +
					`<td>${set.year}</td>` +
					`</tr>`;
			});
			output += `</table>`;
		});
		output += `</div>` +
			`</div>`;
		this.sendReplyBox(output);
	},

	async rarities(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		let content = `<div style="max-height: ${PAGINATION_CONFIG.MAX_HEIGHT}; overflow-y: auto;">` +
			`<ul style="list-style: none; padding: 10px;">`;
		RARITIES.forEach(rarity => {
			content += `<li><span style="color: ${getRarityColor(rarity)}; font-weight: bold;">●</span> ${rarity}</li>`;
		});
		content += `</ul></div>`;
		this.sendReplyBox(TCG_UI.buildPage('Pokemon TCG Rarities', content));
	},

	async types(target, room, user) {
		await TCG_Ranking.getPlayerRanking(user.id);
		if (!this.runBroadcast()) return;
		let content = `<p><strong>Supertypes:</strong> ${SUPERTYPES.join(', ')}</p>` +
			`<p><strong>Pokemon Types:</strong> ${POKEMON_TYPES.join(', ')}</p>` +
			`<h4>Pokemon Subtypes</h4><p>${SUBTYPES.Pokemon.join(', ')}</p>` +
			`<h4>Trainer Subtypes</h4><p>${SUBTYPES.Trainer.join(', ')}</p>` +
			`<h4>Energy Subtypes</h4><p>${SUBTYPES.Energy.join(', ')}</p>`;
		this.sendReplyBox(TCG_UI.buildPage('Pokemon TCG Data', content));
	},

	// Add to tcg_commands/info.ts temporarily:
async testbattledata(target, room, user) {
	this.checkCan('globalban');
	
	try {
		// Get a random Pokemon with battle data
		const pokemon = await TCGCards.findOne({ 
			supertype: 'Pokémon',
			battleValue: { $exists: true },
			attacks: { $exists: true }
		});
		
		if (!pokemon) {
			return this.errorReply("No Pokemon found with battle data");
		}
		
		let output = `<div class="infobox">` +
			`<h3>🎮 Battle Data Test: ${pokemon.name}</h3>` +
			`<p><strong>Card ID:</strong> ${pokemon.cardId}</p>` +
			`<p><strong>HP:</strong> ${pokemon.hp || 'N/A'}</p>` +
			`<p><strong>Type:</strong> ${pokemon.type || 'N/A'}</p>`;
		
		if (pokemon.battleStats) {
			output += `<h4>Battle Stats:</h4>` +
				`<p>Attack Power: ${pokemon.battleStats.attackPower}</p>` +
				`<p>Defense: ${pokemon.battleStats.defensePower}</p>` +
				`<p>Speed: ${pokemon.battleStats.speed}</p>` +
				`<p>Energy Cost: ${pokemon.battleStats.energyCost}</p>` +
				`<p><strong>Battle Value: ${pokemon.battleValue}</strong></p>`;
		}
		
		if (pokemon.attacks && pokemon.attacks.length > 0) {
			output += `<h4>Attacks:</h4>`;
			pokemon.attacks.forEach(attack => {
				output += `<p><strong>${attack.name}</strong> (${attack.convertedEnergyCost} energy): ${attack.damageText} damage</p>`;
			});
		}
		
		if (pokemon.weaknesses && pokemon.weaknesses.length > 0) {
			output += `<h4>Weaknesses:</h4>`;
			pokemon.weaknesses.forEach(w => {
				output += `<p>${w.type} ${w.value}</p>`;
			});
		}
		
		output += `</div>`;
		this.sendReplyBox(output);
		
	} catch (e: any) {
		return this.errorReply(`Error: ${e.message}`);
	}
},
};
