/**
 * Collection-related TCG commands
 */

import * as TCG_UI from '../tcg_ui';
import * as TCG_Ranking from '../tcg_ranking';
import { TCGCards, UserCollections } from '../tcg_collections';
import { TCGCard } from '../tcg_data';
import { PAGINATION_CONFIG, ERROR_MESSAGES } from '../tcg_config';
import { getCardPoints, getRarityColor, getTypeColor, formatCardName } from './shared';

export const collectionCommands: Chat.ChatCommands = {

	async collection(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		const parts = target.split(',').map(p => p.trim());
		const targetUsername = parts[0] || user.name;
		const targetId = toID(targetUsername);
		
		// Enhanced filtering system for new card structure
		const query: any = {};
		
		if (parts.length > 1) {
			const filters = parts.slice(1);
			for (const filter of filters) {
				const [key, ...valueParts] = filter.split(':');
				const value = valueParts.join(':').trim();
				if (!key || !value) continue;
				
				switch (toID(key)) {
					case 'name':
					case 'rarity':
					case 'supertype':
					case 'stage':
						query[toID(key)] = { $regex: value, $options: 'i' };
						break;
					case 'set':
						// Handle set as array or string
						query.$or = [
							{ set: { $regex: value, $options: 'i' } },
							{ set: { $in: [new RegExp(value, 'i')] } },
							{ cardId: { $regex: `^${value}-`, $options: 'i' } }
						];
						break;
					case 'type':
						// Handle type field (primary type)
						query.type = { $regex: value, $options: 'i' };
						break;
					case 'types':
						// Handle types array
						query.types = { $in: [new RegExp(value, 'i')] };
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
				const emptyContent = `<div style="text-align:center; padding:30px;">` +
					`<div style="font-size:1.2em; color:#666; margin-bottom:15px;">📦 No cards in collection</div>` +
					`<div style="color:#999;">Start collecting by opening packs with <code>/tcg open [pack]</code>!</div>` +
					`</div>`;
				
				this.sendReplyBox(`<div class="infobox">` +
					`<h2 style="text-align:center;">${Impulse.nameColor(targetUsername, true)}'s TCG Collection</h2>` +
					emptyContent +
					`</div>`);
				return;
			}
			
			// Add cardId filter
			query.cardId = { $in: collection.cards.map(c => c.cardId) };
			
			// FIX: Get all cards without chained methods
			const allOwnedCards = await TCGCards.find(query);
			const cardMap = new Map(allOwnedCards.map(c => [c.cardId, c]));
			
			// Calculate total points using new system
			let totalPoints = 0;
			let pokemonCount = 0;
			let trainerCount = 0;
			let energyCount = 0;
			
			for (const item of collection.cards) {
				const card = cardMap.get(item.cardId);
				if (card) {
					totalPoints += getCardPoints(card) * item.quantity;
					
					// Count by type
					if (card.supertype === 'Pokémon') pokemonCount += item.quantity;
					else if (card.supertype === 'Trainer') trainerCount += item.quantity;
					else if (card.supertype === 'Energy') energyCount += item.quantity;
				}
			}
			
			const filteredUserCards = collection.cards.filter(item => cardMap.has(item.cardId));
			
			// Enhanced sorting - battle value for Pokemon, points for others
			filteredUserCards.sort((a, b) => {
				const cardA = cardMap.get(a.cardId);
				const cardB = cardMap.get(b.cardId);
				if (!cardA || !cardB) return 0;
				
				// Sort Pokemon by battle value first
				if (cardA.supertype === 'Pokémon' && cardB.supertype === 'Pokémon') {
					const bvDiff = (cardB.battleValue || 0) - (cardA.battleValue || 0);
					if (bvDiff !== 0) return bvDiff;
				}
				
				// Then by points
				const pointsDiff = getCardPoints(cardB) - getCardPoints(cardA);
				if (pointsDiff !== 0) return pointsDiff;
				
				// Finally by rarity
				return cardA.rarity.localeCompare(cardB.rarity);
			});
			
			const topCards = filteredUserCards.slice(0, PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT || 50);
			const cardsToDisplay = topCards.map(item => cardMap.get(item.cardId)).filter((c): c is TCGCard => !!c);
			const quantityMap = new Map(topCards.map(item => [item.cardId, item.quantity]));
			
			// Enhanced card display
			let content = `<div class="infobox">` +
				`<h2 style="text-align:center;">${Impulse.nameColor(targetUsername, true)}'s TCG Collection</h2>`;
			
			// Collection stats header
			content += `<div style="display:flex; justify-content:space-around; margin:15px 0; padding:10px; background:#f5f5f5; border-radius:5px;">` +
				`<div style="text-align:center;">` +
				`<div style="font-size:1.2em; font-weight:bold;">${collection.stats?.totalCards || 0}</div>` +
				`<div style="font-size:0.9em; color:#666;">Total Cards</div>` +
				`</div>` +
				`<div style="text-align:center;">` +
				`<div style="font-size:1.2em; font-weight:bold;">${collection.stats?.uniqueCards || 0}</div>` +
				`<div style="font-size:0.9em; color:#666;">Unique Cards</div>` +
				`</div>` +
				`<div style="text-align:center;">` +
				`<div style="font-size:1.2em; font-weight:bold; color:#e74c3c;">${totalPoints}</div>` +
				`<div style="font-size:0.9em; color:#666;">Total Points</div>` +
				`</div>` +
				`</div>`;
			
			// Card type breakdown
			content += `<div style="display:flex; justify-content:space-around; margin:10px 0; padding:8px; background:#e8f4fd; border-radius:5px;">` +
				`<div style="text-align:center;">` +
				`<span style="color:#e74c3c; font-weight:bold;">${pokemonCount}</span> Pokémon` +
				`</div>` +
				`<div style="text-align:center;">` +
				`<span style="color:#3498db; font-weight:bold;">${trainerCount}</span> Trainers` +
				`</div>` +
				`<div style="text-align:center;">` +
				`<span style="color:#f39c12; font-weight:bold;">${energyCount}</span> Energy` +
				`</div>` +
				`</div>`;
			
			if (filteredUserCards.length > (PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT || 50)) {
				content += `<p style="text-align:center; color:#666; margin:10px 0;">` +
					`<em>Showing top ${PAGINATION_CONFIG.COLLECTION_DISPLAY_LIMIT || 50} of ${filteredUserCards.length} matching cards</em>` +
					`</p>`;
			}
			
			// Enhanced card grid display
			content += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:10px; margin:15px 0;">`;
			
			cardsToDisplay.forEach(card => {
				const quantity = quantityMap.get(card.cardId) || 1;
				const points = getCardPoints(card);
				
				content += `<div style="border:1px solid #ddd; border-radius:8px; padding:10px; background:${getRarityColor(card.rarity)}08;">`;
				
				// Card header
				content += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">` +
					`<div style="font-weight:bold; color:${getRarityColor(card.rarity)};">${card.name}</div>`;
				
				if (quantity > 1) {
					content += `<div style="background:${getRarityColor(card.rarity)}; color:white; padding:2px 6px; border-radius:3px; font-size:0.8em;">×${quantity}</div>`;
				}
				
				content += `</div>`;
				
				// Card details
				content += `<div style="font-size:0.9em; color:#666; margin-bottom:5px;">` +
					`${card.rarity} ${card.supertype}`;
				
				if (card.subtypes && card.subtypes.length > 0) {
					content += ` - ${card.subtypes.join(', ')}`;
				}
				
				content += `</div>`;
				
				// Pokemon-specific info
				if (card.supertype === 'Pokémon') {
					content += `<div style="margin:5px 0;">`;
					
					if (card.hp) {
						content += `<span style="background:#e74c3c; color:white; padding:1px 4px; border-radius:2px; font-size:0.8em; margin-right:3px;">HP ${card.hp}</span>`;
					}
					
					if (card.type) {
						content += `<span style="background:${getTypeColor(card.type)}; color:white; padding:1px 4px; border-radius:2px; font-size:0.8em; margin-right:3px;">${card.type}</span>`;
					}
					
					if (card.battleValue) {
						content += `<span style="background:#f39c12; color:white; padding:1px 4px; border-radius:2px; font-size:0.8em;">BV ${card.battleValue}</span>`;
					}
					
					content += `</div>`;
					
					// Battle stats preview
					if (card.battleStats) {
						content += `<div style="font-size:0.8em; color:#666; margin-top:5px;">` +
							`ATK: ${card.battleStats.attackPower} | DEF: ${card.battleStats.defensePower} | SPD: ${card.battleStats.speed}` +
							`</div>`;
					}
				}
				
				// Point value
				content += `<div style="text-align:right; margin-top:8px; font-size:0.9em; color:#999;">` +
					`${points} pts` + (quantity > 1 ? ` (${points * quantity} total)` : '') +
					`</div>`;
				
				content += `</div>`;
			});
			
			content += `</div>`;
			
			// Filtering help
			if (parts.length === 1) {
				content += `<details style="margin-top:15px;">` +
					`<summary style="cursor:pointer; color:#3498db;">🔍 Advanced Filtering</summary>` +
					`<div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:5px; font-size:0.9em;">` +
					`<strong>Usage:</strong> <code>/tcg collection [user], [filters...]</code><br/>` +
					`<strong>Filters:</strong><br/>` +
					`• <code>name:pikachu</code> - Card name contains "pikachu"<br/>` +
					`• <code>type:fire</code> - Fire-type cards<br/>` +
					`• <code>rarity:rare</code> - Rare cards<br/>` +
					`• <code>supertype:pokemon</code> - Only Pokemon cards<br/>` +
					`• <code>hp:>100</code> - Pokemon with HP over 100<br/>` +
					`• <code>bv:>=50</code> - Battle value 50 or higher<br/>` +
					`• <code>set:base1</code> - Cards from specific set<br/>` +
					`• <code>stage:basic</code> - Basic Pokemon only` +
					`</div>` +
					`</details>`;
			}
			
			content += `</div>`;
			
			this.sendReplyBox(content);
			
		} catch (e: any) {
			console.error('Collection error:', e);
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
			// FIX: Updated set finding for new card structure
			const [userCollection, allSetCards] = await Promise.all([
				UserCollections.findOne({ userId: targetId }),
				TCGCards.find({
					$or: [
						{ set: cleanSetId },
						{ set: { $in: [cleanSetId] } },
						{ cardId: { $regex: `^${cleanSetId}-` } }
					]
				})
			]);
			
			if (allSetCards.length === 0) {
				return this.errorReply(`No cards found for the set "${setId}". Make sure cards are imported for this set.`);
			}
			
			const ownedCardIds = new Set(userCollection?.cards?.map(c => c.cardId) || []);
			const missingCards: TCGCard[] = [];
			let ownedCount = 0;
			
			// Separate owned and missing cards
			for (const card of allSetCards) {
				if (ownedCardIds.has(card.cardId)) {
					ownedCount++;
				} else {
					missingCards.push(card);
				}
			}
			
			const totalInSet = allSetCards.length;
			const percentage = totalInSet > 0 ? Math.round((ownedCount / totalInSet) * 100) : 0;
			
			let content = `<div class="infobox">` +
				`<h2 style="text-align:center;">Set Progress: ${setId.toUpperCase()}</h2>`;
			
			// Progress header
			content += `<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.1em; margin-bottom:10px;">` +
				`<strong>${Impulse.nameColor(targetUsername, true)}</strong>` +
				`</div>` +
				`<div style="font-size:1.3em; font-weight:bold; color:${percentage === 100 ? '#2ecc71' : '#3498db'};">` +
				`${ownedCount} / ${totalInSet} cards (${percentage}%)` +
				`</div>`;
			
			// Progress bar
			content += `<div style="width:100%; background:#ddd; border-radius:10px; height:20px; margin:10px 0; overflow:hidden;">` +
				`<div style="width:${percentage}%; background:${percentage === 100 ? '#2ecc71' : '#3498db'}; height:100%; transition:width 0.3s;"></div>` +
				`</div>`;
			
			if (percentage === 100) {
				content += `<div style="color:#2ecc71; font-size:1.2em; margin-top:10px;">🎉 Set Complete! 🎉</div>`;
			}
			
			content += `</div>`;
			
			// Missing cards (if any)
			if (missingCards.length > 0 && missingCards.length <= 50) {
				content += `<h3>Missing Cards (${missingCards.length}):</h3>`;
				
				// Sort missing cards by rarity and points
				missingCards.sort((a, b) => {
					const pointsDiff = getCardPoints(b) - getCardPoints(a);
					if (pointsDiff !== 0) return pointsDiff;
					return a.rarity.localeCompare(b.rarity);
				});
				
				content += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:8px; margin:10px 0;">`;
				
				missingCards.slice(0, 20).forEach(card => {
					content += `<div style="border:1px solid #ddd; border-radius:5px; padding:8px; background:${getRarityColor(card.rarity)}08;">` +
						`<div style="font-weight:bold; color:${getRarityColor(card.rarity)};">${card.name}</div>` +
						`<div style="font-size:0.9em; color:#666;">${card.rarity} ${card.supertype}</div>`;
					
					if (card.supertype === 'Pokémon' && card.battleValue) {
						content += `<div style="font-size:0.8em; color:#999;">BV: ${card.battleValue}</div>`;
					}
					
					content += `<div style="text-align:right; font-size:0.8em; color:#999;">${getCardPoints(card)} pts</div>` +
						`</div>`;
				});
				
				content += `</div>`;
				
				if (missingCards.length > 20) {
					content += `<p style="text-align:center; color:#666; margin-top:10px;">` +
						`<em>... and ${missingCards.length - 20} more cards</em>` +
						`</p>`;
				}
			} else if (missingCards.length > 50) {
				content += `<p style="text-align:center; color:#666; margin:15px 0;">` +
					`<em>Too many missing cards to display (${missingCards.length} remaining)</em>` +
					`</p>`;
			}
			
			content += `</div>`;
			
			this.sendReplyBox(content);
			
		} catch (e: any) {
			console.error('Set progress error:', e);
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
					await UserCollections.updateOne(
						{ userId: user.id },
						{ $addToSet: { wishlist: card.cardId } },
						{ upsert: true }
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
				// View wishlist
				const targetUsername = parts[0] || user.name;
				const targetId = toID(targetUsername);
				
				const collection = await UserCollections.findOne({ userId: targetId });
				
				if (!collection?.wishlist?.length) {
					return this.sendReplyBox(`<div class="infobox">` +
						`<h2 style="text-align:center;">${Impulse.nameColor(targetUsername, true)}'s Wishlist</h2>` +
						`<p style="text-align:center; color:#666; margin:20px 0;">No cards in wishlist</p>` +
						`</div>`);
				}
				
				const cards = await TCGCards.find({ cardId: { $in: collection.wishlist } });
				cards.sort((a, b) => getCardPoints(b) - getCardPoints(a));
				
				let content = `<div class="infobox">` +
					`<h2 style="text-align:center;">${Impulse.nameColor(targetUsername, true)}'s Wishlist</h2>` +
					`<p style="text-align:center; color:#666; margin-bottom:15px;">${cards.length} cards</p>`;
				
				content += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:10px;">`;
				
				cards.forEach(card => {
					content += `<div style="border:1px solid #ddd; border-radius:5px; padding:10px; background:${getRarityColor(card.rarity)}08;">` +
						`<div style="font-weight:bold; color:${getRarityColor(card.rarity)};">${card.name}</div>` +
						`<div style="font-size:0.9em; color:#666; margin:3px 0;">${card.rarity} ${card.supertype}</div>`;
					
					if (card.supertype === 'Pokémon') {
						if (card.type) {
							content += `<div style="margin:3px 0;">` +
								`<span style="background:${getTypeColor(card.type)}; color:white; padding:1px 4px; border-radius:2px; font-size:0.8em;">${card.type}</span>`;
							
							if (card.hp) {
								content += ` <span style="background:#e74c3c; color:white; padding:1px 4px; border-radius:2px; font-size:0.8em;">HP ${card.hp}</span>`;
							}
							
							content += `</div>`;
						}
						
						if (card.battleValue) {
							content += `<div style="font-size:0.8em; color:#666; margin-top:3px;">Battle Value: ${card.battleValue}</div>`;
						}
					}
					
					content += `<div style="text-align:right; margin-top:8px; font-size:0.9em; color:#999;">${getCardPoints(card)} pts</div>` +
						`</div>`;
				});
				
				content += `</div>`;
				
				if (targetId === user.id) {
					content += `<div style="margin-top:15px; padding:10px; background:#f0f8ff; border-radius:5px; font-size:0.9em;">` +
						`<strong>Manage your wishlist:</strong><br/>` +
						`• Add card: <code>/tcg wishlist add, [card ID]</code><br/>` +
						`• Remove card: <code>/tcg wishlist remove, [card ID]</code>` +
						`</div>`;
				}
				
				content += `</div>`;
				
				this.sendReplyBox(content);
			}
		} catch (e: any) {
			console.error('Wishlist error:', e);
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

};
