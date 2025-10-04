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
		const specialSubtype = card.subtypes.find(s => SPECIAL_SUBTYPES[s]);
		if (specialSubtype && SPECIAL_SUBTYPES[specialSubtype]) {
			borderColor = SPECIAL_SUBTYPES[specialSubtype].color;
		}
	
		const formattedSubtypes = card.subtypes.map(s => {
			const color = getSubtypeColor(s);
			return color ? `<strong style="color: ${color}">${s}</strong>` : s;
		}).join(', ');

		// Outer scrollable container
		let output = `<div class="impulse-card">` +
			`<div class="impulse-card-container" style="border: 2px solid ${borderColor}; ${backgroundStyle}">` +
			`<table style="width: 100%; border-collapse: collapse;"><tr>`;
	
		if (card.imageUrl) {
			output += `<td style="width: 180px; vertical-align: top; padding-right: 16px;">` +
				`<img src="${card.imageUrl}" alt="${card.name}" width="170" style="display: block; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">`;
		
			// Battle Value Badge (if available)
			if (card.battleValue) {
				output += `<div style="margin-top: 8px; text-align: center; padding: 6px; background: rgba(231,76,60,0.9); color: white; border-radius: 4px; font-weight: bold; font-size: 0.95em;">` +
					`⚡ Battle Value: ${card.battleValue}` +
					`</div>`;
			}
		
			output += `</td>`;
		}

		output += `<td style="vertical-align: top; line-height: 1.5;">` +
			`<div class="impulse-card-name">${card.name}</div>` +
			`<div class="impulse-card-rarity" style="color: ${rarityColorHex};">${card.rarity}</div>`;

		// Compact info table
		const infoRows = [];
		infoRows.push(['Set', `${card.set} #${cardNumber}`]);
		infoRows.push(['Type', card.type || card.supertype]);
		if (card.subtypes.length > 0) infoRows.push(['Subtypes', formattedSubtypes]);
		if (card.hp) infoRows.push(['HP', `<strong style="color: #e74c3c;">${card.hp}</strong>`]);
		if (card.evolvesFrom) infoRows.push(['Evolves From', card.evolvesFrom]);
		if (card.retreatCost && card.retreatCost.length > 0) {
			infoRows.push(['Retreat', card.retreatCost.map(() => '⚡').join('')]);
		}
		infoRows.push(['Points', `<strong>${points}</strong>`]);

		output += `<table style="width: 100%; font-size: 0.9em;">`;
		infoRows.forEach(([label, value]) => {
			output += `<tr><td class="impulse-card-info-label"><strong>${label}:</strong></td><td class="impulse-card-info-value">${value}</td></tr>`;
		});
		output += `</table>`;

		// Battle Stats
		if (card.battleStats) {
			output += `<div class="impulse-card-battle-stats">` +
				`<strong class="impulse-card-battle-stats-title">⚔️ Battle Stats</strong>` +
				`<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">`;
		
			const stats = [
				{ label: 'ATK', value: card.battleStats.attackPower, max: 300, color: '#e74c3c' },
				{ label: 'DEF', value: card.battleStats.defensePower, max: 340, color: '#3498db' },
				{ label: 'SPD', value: card.battleStats.speed, max: 100, color: '#f39c12' },
				{ label: 'Cost', value: card.battleStats.energyCost, max: 5, color: '#9b59b6' }
			];
			
			stats.forEach(stat => {
				const percent = Math.round((stat.value / stat.max) * 100);
				output += `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">` +
					`<span class="impulse-card-stat-label">${stat.label}:</span>` +
					`<span style="font-weight: bold; color: ${stat.color}; min-width: 32px; font-size: 1.05em;">${stat.value}</span>` +
					`<div class="impulse-card-stat-progress">` +
					`<div class="impulse-card-stat-progress-bar" style="background: ${stat.color}; width: ${percent}%;"></div>` +
					`</div>` +
					`</div>`;
			});
			output += `</div></div>`;
		}

		output += `</td></tr></table>`;

		// Attacks (Compact)
		if (card.attacks && card.attacks.length > 0) {
			output += `<div style="margin-top: 12px;">` +
				`<strong class="impulse-card-section-title">⚔️ Attacks</strong>`;
		
			card.attacks.forEach(attack => {
				const energyCost = attack.cost && attack.cost.length > 0 
					? attack.cost.map(e => `⚡`).join('')
					: '';
				
				output += `<div class="impulse-card-attack-container">` +
					`<div class="impulse-card-attack-name"><strong>${energyCost} ${attack.name}</strong>` +
					(attack.damageText ? ` <span style="color: #e74c3c; float: right;">${attack.damageText}</span>` : '') +
					`</div>`;
			
				if (attack.text) {
					output += `<div class="impulse-card-attack-text">${attack.text}</div>`;
				}
			
				output += `</div>`;
			});
			output += `</div>`;
		}

		// Abilities (Compact)
		if (card.abilities && card.abilities.length > 0) {
			output += `<div style="margin-top: 12px;">` +
				`<strong class="impulse-card-section-title">✨ Abilities</strong>`;
		
			card.abilities.forEach(ability => {
				output += `<div class="impulse-card-ability-container">` +
					`<div class="impulse-card-ability-name"><strong>${ability.name}</strong> <span style="color: #9b59b6; font-size: 0.9em;">(${ability.type})</span></div>`;
				
				if (ability.text) {
					output += `<div class="impulse-card-ability-text">${ability.text}</div>`;
				}
				output += `</div>`;
			});
			output += `</div>`;
		}

		// Weakness & Resistance (Compact inline)
		const hasWeaknessOrResistance = (card.weaknesses && card.weaknesses.length > 0) || (card.resistances && card.resistances.length > 0);
		if (hasWeaknessOrResistance) {
			output += `<div class="impulse-card-weakness-resistance">`;
			if (card.weaknesses && card.weaknesses.length > 0) {
				output += `<div style="flex: 1;">` +
				`<strong style="color: #e74c3c;">🔻 Weakness:</strong> `;
				output += card.weaknesses.map(w => `<span class="impulse-card-weakness-badge">${w.type} ${w.value}</span>`).join('');
				output += `</div>`;
			}

			if (card.resistances && card.resistances.length > 0) {
				output += `<div style="flex: 1;">` +
				`<strong style="color: #3498db;">🛡️ Resistance:</strong> `;
				output += card.resistances.map(r => `<span class="impulse-card-resistance-badge">${r.type} ${r.value}</span>`).join('');
				output += `</div>`;
			}

			output += `</div>`;
		}

		// Flavor text & Artist (Compact footer)
		if (card.cardText || card.artist) {
			output += `<div class="impulse-card-footer">`;
			
			if (card.cardText) {
				output += `<div class="impulse-card-flavor-text">"${card.cardText}"</div>`;
			}
		
			if (card.artist) {
				output += `<div class="impulse-card-artist">Illus. ${card.artist}</div>`;
			}
		
			output += `</div>`;
		}

		output += `</div></div>`; // Close inner container and scrollable container
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

			let tableHtml = `<div style="max-height: 380px; overflow-y: auto;"><table class="themed-table">`;
			
			tableHtml += `<tr class="themed-table-header">` +
				`<th>Name</th>` +
				`<th>Set</th>` +
				`<th>Rarity</th>` +
				`<th>Type</th>` +
				`<th>HP</th>` +
				`<th>⚔️ BV</th>` +
				`</tr>`;

			for (const card of paginatedResults) {
				const rarityColor = getRarityColor(card.rarity);
				
				tableHtml += `<tr class="themed-table-row">` +
					`<td><button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button></td>` +
					`<td>${card.set}</td>` +
					`<td><span style="color: ${rarityColor}">${card.rarity.toUpperCase()}</span></td>` +
					`<td>${card.type || card.supertype}</td>` +
					`<td>${card.hp || '-'}</td>`;
				
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
		await TCG_Ranking.getPlayerRanking(user.id);
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
		await TCG_Ranking.getPlayerRanking(user.id);
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
		await TCG_Ranking.getPlayerRanking(user.id);
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
