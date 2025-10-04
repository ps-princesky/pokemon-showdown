/**
 * Information and search TCG commands
 */

import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { TCGCard } from '../../../impulse/psgo-plugin/tcg_data';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { getCardPoints, getRarityColor, getTypeColor, hexToRgba } from './shared';

export const infoCommands: Chat.ChatCommands = {

	async search(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		if (!target) {
			return this.errorReply("Usage: /tcg search [name/type/rarity/set/etc...]");
		}
		
		const searchTerms = target.split(',').map(term => term.trim()).filter(Boolean);
		const query: any = {};
		
		// Enhanced search with new card structure
		for (const term of searchTerms) {
			if (term.includes(':')) {
				const [key, value] = term.split(':').map(s => s.trim());
				switch (toID(key)) {
					case 'name':
						query.name = { $regex: value, $options: 'i' };
						break;
					case 'type':
						query.type = { $regex: value, $options: 'i' };
						break;
					case 'rarity':
						query.rarity = { $regex: value, $options: 'i' };
						break;
					case 'supertype':
						query.supertype = { $regex: value, $options: 'i' };
						break;
					case 'subtype':
						query.subtypes = { $regex: value, $options: 'i' };
						break;
					case 'set':
						query.$or = [
							{ set: { $regex: value, $options: 'i' } },
							{ set: { $in: [new RegExp(value, 'i')] } },
							{ cardId: { $regex: `^${value}-`, $options: 'i' } }
						];
						break;
					case 'hp':
						const hpMatch = value.match(/([<>=]+)?\s*(\d+)/);
						if (hpMatch) {
							const operator = hpMatch[1] || '=';
							const amount = parseInt(hpMatch[2]);
							if (!isNaN(amount)) {
								if (operator === '>') query.hp = { $gt: amount };
								else if (operator === '>=') query.hp = { $gte: amount };
								else if (operator === '<') query.hp = { $lt: amount };
								else if (operator === '<=') query.hp = { $lte: amount };
								else query.hp = amount;
							}
						}
						break;
					case 'battlevalue':
					case 'bv':
						const bvMatch = value.match(/([<>=]+)?\s*(\d+)/);
						if (bvMatch) {
							const operator = bvMatch[1] || '=';
							const amount = parseInt(bvMatch[2]);
							if (!isNaN(amount)) {
								if (operator === '>') query.battleValue = { $gt: amount };
								else if (operator === '>=') query.battleValue = { $gte: amount };
								else if (operator === '<') query.battleValue = { $lt: amount };
								else if (operator === '<=') query.battleValue = { $lte: amount };
								else query.battleValue = amount;
							}
						}
						break;
				}
			} else {
				// General search across multiple fields
				query.$or = [
					{ name: { $regex: term, $options: 'i' } },
					{ rarity: { $regex: term, $options: 'i' } },
					{ supertype: { $regex: term, $options: 'i' } },
					{ subtypes: { $regex: term, $options: 'i' } },
					{ type: { $regex: term, $options: 'i' } }
				];
			}
		}
		
		try {
			const results = await TCGCards.find(query).limit(PAGINATION_CONFIG.SEARCH_RESULTS_LIMIT);
			
			if (results.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>🔍 Search Results</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No cards found matching: <em>${searchTerms.join(', ')}</em></p>` +
					`<div style="font-size:0.9em; color:#999; text-align:center;">` +
					`Try searching with: name:pikachu, type:fire, rarity:rare, set:base1, hp:>100, bv:>=50` +
					`</div>` +
					`</div>`);
			}
			
			// Sort results by battle value for Pokemon, then by points
			results.sort((a, b) => {
				if (a.supertype === 'Pokémon' && b.supertype === 'Pokémon') {
					const bvDiff = (b.battleValue || 0) - (a.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
				}
				return getCardPoints(b) - getCardPoints(a);
			});
			
			let output = `<div class="infobox">` +
				`<h3>🔍 Search Results (${results.length})</h3>` +
				`<div style="margin:10px 0; font-size:0.9em; color:#666;">` +
				`Searching for: <em>${searchTerms.join(', ')}</em>` +
				`</div>`;
			
			// Enhanced card grid display
			output += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:10px; margin:15px 0;">`;
			
			results.slice(0, 20).forEach(card => {
				const points = getCardPoints(card);
				
				output += `<div style="border:1px solid #ddd; border-radius:8px; padding:10px; background:${getRarityColor(card.rarity)}08;">`;
				
				// Card header
				output += `<div style="font-weight:bold; color:${getRarityColor(card.rarity)}; margin-bottom:5px;">${card.name}</div>`;
				
				// Card details
				output += `<div style="font-size:0.9em; color:#666; margin-bottom:8px;">` +
					`${card.rarity} ${card.supertype}`;
				
				if (card.subtypes && card.subtypes.length > 0) {
					output += ` - ${card.subtypes.slice(0, 2).join(', ')}`;
				}
				
				output += `</div>`;
				
				// Pokemon-specific info
				if (card.supertype === 'Pokémon') {
					output += `<div style="margin:5px 0;">`;
					
					if (card.hp) {
						output += `<span style="background:#e74c3c; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-right:3px;">HP ${card.hp}</span>`;
					}
					
					if (card.type) {
						output += `<span style="background:${getTypeColor(card.type)}; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em; margin-right:3px;">${card.type}</span>`;
					}
					
					if (card.battleValue) {
						output += `<span style="background:#f39c12; color:white; padding:2px 5px; border-radius:3px; font-size:0.8em;">BV ${card.battleValue}</span>`;
					}
					
					output += `</div>`;
				}
				
				// Set and points
				const setDisplay = Array.isArray(card.set) ? card.set[0] : card.set;
				output += `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.8em; color:#999;">` +
					`<span>${setDisplay || 'Unknown'}</span>` +
					`<span>${points} pts</span>` +
					`</div>`;
				
				output += `</div>`;
			});
			
			output += `</div>`;
			
			if (results.length > 20) {
				output += `<div style="text-align:center; margin-top:15px; color:#666;">` +
					`<em>Showing first 20 of ${results.length} results</em>` +
					`</div>`;
			}
			
			// Search help
			output += `<details style="margin-top:15px;">` +
				`<summary style="cursor:pointer; color:#3498db;">🔍 Advanced Search</summary>` +
				`<div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:5px; font-size:0.9em;">` +
				`<strong>Search Examples:</strong><br/>` +
				`• <code>name:pikachu</code> - Card name contains "pikachu"<br/>` +
				`• <code>type:fire</code> - Fire-type cards<br/>` +
				`• <code>rarity:rare</code> - Rare cards<br/>` +
				`• <code>supertype:pokemon</code> - Only Pokemon cards<br/>` +
				`• <code>hp:>100</code> - Pokemon with HP over 100<br/>` +
				`• <code>bv:>=50</code> - Battle value 50 or higher<br/>` +
				`• <code>set:base1</code> - Cards from specific set<br/>` +
				`• <code>subtype:basic</code> - Basic Pokemon only` +
				`</div>` +
				`</details>`;
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async sets(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			// Get unique sets from the database (handle array and string formats)
			const allSets = await TCGCards.distinct('set');
			const flatSets = allSets.flat().filter(Boolean);
			const uniqueSets = [...new Set(flatSets)];
			
			// Get set statistics
			const setStats: { [key: string]: any } = {};
			
			for (const setId of uniqueSets.slice(0, 50)) { // Limit to prevent timeout
				const [totalCards, pokemonCount, rarityBreakdown] = await Promise.all([
					TCGCards.countDocuments({
						$or: [
							{ set: setId },
							{ set: { $in: [setId] } }
						]
					}),
					TCGCards.countDocuments({
						$or: [
							{ set: setId },
							{ set: { $in: [setId] } }
						],
						supertype: 'Pokémon'
					}),
					TCGCards.aggregate([
						{
							$match: {
								$or: [
									{ set: setId },
									{ set: { $in: [setId] } }
								]
							}
						},
						{
							$group: {
								_id: '$rarity',
								count: { $sum: 1 }
							}
						}
					])
				]);
				
				setStats[setId] = {
					totalCards,
					pokemonCount,
					rarityBreakdown: rarityBreakdown.reduce((acc, item) => {
						acc[item._id] = item.count;
						return acc;
					}, {} as { [key: string]: number })
				};
			}
			
			// Sort sets by total cards (descending)
			const sortedSets = uniqueSets.sort((a, b) => 
				(setStats[b]?.totalCards || 0) - (setStats[a]?.totalCards || 0)
			);
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">📦 Pokemon TCG Sets</h2>` +
				`<div style="text-align:center; margin:15px 0; color:#666;">` +
				`${sortedSets.length} sets available in database` +
				`</div>`;
			
			// Set grid display
			output += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:15px; margin:20px 0;">`;
			
			sortedSets.slice(0, 24).forEach(setId => {
				const stats = setStats[setId];
				if (!stats) return;
				
				// Get predominant rarity color
				let mainRarity = 'Common';
				let maxCount = 0;
				Object.entries(stats.rarityBreakdown).forEach(([rarity, count]) => {
					if (count > maxCount) {
						maxCount = count;
						mainRarity = rarity;
					}
				});
				
				output += `<div style="border:1px solid #ddd; border-radius:8px; padding:15px; background:${getRarityColor(mainRarity)}05;">` +
					`<div style="font-weight:bold; font-size:1.1em; margin-bottom:8px; color:${getRarityColor(mainRarity)};">` +
					`${setId.toUpperCase()}` +
					`</div>` +
					`<div style="margin:8px 0; color:#666;">` +
					`<div>📊 ${stats.totalCards} total cards</div>` +
					`<div>🎮 ${stats.pokemonCount} Pokemon</div>` +
					`</div>`;
				
				// Rarity breakdown (top 3)
				const topRarities = Object.entries(stats.rarityBreakdown)
					.sort(([,a], [,b]) => b - a)
					.slice(0, 3);
				
				if (topRarities.length > 0) {
					output += `<div style="margin-top:10px; font-size:0.8em;">`;
					topRarities.forEach(([rarity, count]) => {
						output += `<div style="margin:2px 0; color:${getRarityColor(rarity)};">` +
							`${rarity}: ${count}` +
							`</div>`;
					});
					output += `</div>`;
				}
				
				// Quick actions
				output += `<div style="margin-top:10px; text-align:center;">` +
					`<button name="send" value="/tcg search set:${setId}" style="background:#3498db; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:0.8em;">` +
					`Browse Cards` +
					`</button>` +
					`</div>`;
				
				output += `</div>`;
			});
			
			output += `</div>`;
			
			if (sortedSets.length > 24) {
				output += `<div style="text-align:center; margin-top:15px; color:#666;">` +
					`<em>Showing first 24 of ${sortedSets.length} sets</em>` +
					`</div>`;
			}
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async topcollectors(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const sortBy = target ? toID(target) : 'points';
		
		try {
			let sortField: string;
			let sortLabel: string;
			
			switch (sortBy) {
				case 'cards':
					sortField = 'stats.totalCards';
					sortLabel = 'Total Cards';
					break;
				case 'unique':
					sortField = 'stats.uniqueCards';
					sortLabel = 'Unique Cards';
					break;
				case 'points':
				default:
					sortField = 'stats.totalPoints';
					sortLabel = 'Total Points';
					break;
			}
			
			const collectors = await UserCollections.find({
				'cards.0': { $exists: true }
			}).sort({ [sortField]: -1 }).limit(20);
			
			if (collectors.length === 0) {
				return this.sendReplyBox(`<div class="infobox">` +
					`<h3>🏆 Top Collectors</h3>` +
					`<p style="text-align:center; color:#666; margin:20px 0;">No collectors found</p>` +
					`</div>`);
			}
			
			// Calculate total points for each collector if needed
			for (const collector of collectors) {
				if (!collector.stats?.totalPoints && collector.cards?.length) {
					let totalPoints = 0;
					const cardIds = collector.cards.map(c => c.cardId);
					const cards = await TCGCards.find({ cardId: { $in: cardIds } });
					const cardMap = new Map(cards.map(c => [c.cardId, c]));
					
					for (const item of collector.cards) {
						const card = cardMap.get(item.cardId);
						if (card) {
							totalPoints += getCardPoints(card) * item.quantity;
						}
					}
					
					collector.stats = collector.stats || { totalCards: 0, uniqueCards: 0, totalPoints: 0 };
					collector.stats.totalPoints = totalPoints;
				}
			}
			
			// Re-sort after point calculation
			collectors.sort((a, b) => {
				const aValue = sortField === 'stats.totalPoints' ? (a.stats?.totalPoints || 0) :
							   sortField === 'stats.totalCards' ? (a.stats?.totalCards || 0) :
							   (a.stats?.uniqueCards || 0);
				const bValue = sortField === 'stats.totalPoints' ? (b.stats?.totalPoints || 0) :
							   sortField === 'stats.totalCards' ? (b.stats?.totalCards || 0) :
							   (b.stats?.uniqueCards || 0);
				return bValue - aValue;
			});
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🏆 Top Collectors</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<button name="send" value="/tcg topcollectors points" style="background:${sortBy === 'points' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Points</button>` +
				`<button name="send" value="/tcg topcollectors cards" style="background:${sortBy === 'cards' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Total Cards</button>` +
				`<button name="send" value="/tcg topcollectors unique" style="background:${sortBy === 'unique' ? '#e74c3c' : '#95a5a6'}; color:white; border:none; padding:5px 10px; border-radius:3px; margin:2px;">Unique Cards</button>` +
				`</div>`;
			
			// Leaderboard table
			output += `<table style="width:100%; margin:15px 0;">` +
				`<tr style="background:#f5f5f5;">` +
				`<th style="padding:8px; text-align:center;">Rank</th>` +
				`<th style="padding:8px; text-align:left;">Collector</th>` +
				`<th style="padding:8px; text-align:center;">${sortLabel}</th>` +
				`<th style="padding:8px; text-align:center;">Total Cards</th>` +
				`<th style="padding:8px; text-align:center;">Unique Cards</th>` +
				`</tr>`;
			
			collectors.slice(0, 15).forEach((collector, idx) => {
				const stats = collector.stats || { totalCards: 0, uniqueCards: 0, totalPoints: 0 };
				
				output += `<tr style="border-bottom:1px solid #ddd;">` +
					`<td style="padding:8px; text-align:center; font-weight:bold;">${idx + 1}</td>` +
					`<td style="padding:8px;">${Impulse.nameColor(collector.userId, true)}</td>` +
					`<td style="padding:8px; text-align:center; font-weight:bold; color:#e74c3c;">${stats.totalPoints.toLocaleString()}</td>` +
					`<td style="padding:8px; text-align:center;">${stats.totalCards.toLocaleString()}</td>` +
					`<td style="padding:8px; text-align:center;">${stats.uniqueCards.toLocaleString()}</td>` +
					`</tr>`;
			});
			
			output += `</table></div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async types(target, room, user) {
		if (!this.runBroadcast()) return;
		
		const pokemonTypes = [
			'Fire', 'Water', 'Grass', 'Lightning', 'Psychic', 'Fighting',
			'Darkness', 'Metal', 'Fairy', 'Dragon', 'Colorless'
		];
		
		const supertypes = ['Pokémon', 'Trainer', 'Energy'];
		
		const commonSubtypes = {
			'Pokémon': ['Basic', 'Stage 1', 'Stage 2', 'EX', 'GX', 'V', 'VMAX', 'VSTAR'],
			'Trainer': ['Supporter', 'Item', 'Stadium', 'Tool'],
			'Energy': ['Basic', 'Special']
		};
		
		const rarities = [
			'Common', 'Uncommon', 'Rare', 'Rare Holo', 'Rare Holo EX',
			'Rare Holo GX', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Secret',
			'Rare Rainbow', 'Amazing Rare', 'Full Art', 'Character Rare'
		];
		
		let output = `<div class="infobox">` +
			`<h2 style="text-align:center;">📋 TCG Data Reference</h2>`;
		
		// Pokemon Types
		output += `<div style="margin:20px 0;">` +
			`<h3>🎮 Pokémon Types</h3>` +
			`<div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">`;
		
		pokemonTypes.forEach(type => {
			output += `<span style="background:${getTypeColor(type)}; color:white; padding:4px 8px; border-radius:4px; font-size:0.9em;">${type}</span>`;
		});
		
		output += `</div></div>`;
		
		// Supertypes and Subtypes
		output += `<div style="margin:20px 0;">` +
			`<h3>📊 Card Categories</h3>`;
		
		supertypes.forEach(supertype => {
			output += `<div style="margin:10px 0; padding:10px; background:#f9f9f9; border-radius:5px;">` +
				`<h4 style="margin:0 0 8px 0; color:#2c3e50;">${supertype}</h4>` +
				`<div style="display:flex; flex-wrap:wrap; gap:5px;">`;
			
			if (commonSubtypes[supertype]) {
				commonSubtypes[supertype].forEach(subtype => {
					output += `<span style="background:#ecf0f1; color:#2c3e50; padding:2px 6px; border-radius:3px; font-size:0.8em;">${subtype}</span>`;
				});
			}
			
			output += `</div></div>`;
		});
		
		output += `</div>`;
		
		// Rarities
		output += `<div style="margin:20px 0;">` +
			`<h3>💎 Rarities</h3>` +
			`<div style="display:flex; flex-wrap:wrap; gap:8px; margin:10px 0;">`;
		
		rarities.forEach(rarity => {
			output += `<span style="background:${getRarityColor(rarity)}15; color:${getRarityColor(rarity)}; border:1px solid ${getRarityColor(rarity)}; padding:4px 8px; border-radius:4px; font-size:0.9em;">${rarity}</span>`;
		});
		
		output += `</div></div>`;
		
		// Search examples
		output += `<div style="margin:20px 0; padding:15px; background:#f0f8ff; border-radius:5px;">` +
			`<h3 style="margin:0 0 10px 0;">🔍 Search Examples</h3>` +
			`<div style="font-size:0.9em; line-height:1.6;">` +
			`• <code>/tcg search type:fire</code> - All Fire-type cards<br/>` +
			`• <code>/tcg search rarity:rare holo</code> - Rare Holo cards<br/>` +
			`• <code>/tcg search supertype:pokemon, hp:>100</code> - Pokemon with 100+ HP<br/>` +
			`• <code>/tcg search pikachu</code> - Cards with "pikachu" in name<br/>` +
			`• <code>/tcg search set:base1</code> - Cards from Base Set 1<br/>` +
			`• <code>/tcg search bv:>=50</code> - High battle value Pokemon` +
			`</div>` +
			`</div>`;
		
		output += `</div>`;
		
		this.sendReplyBox(output);
	},

};
