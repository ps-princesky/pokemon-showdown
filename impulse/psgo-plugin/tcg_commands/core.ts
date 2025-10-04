/**
 * Core TCG commands - daily, currency, pay
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { TCGCard } from '../../../impulse/psgo-plugin/tcg_data';
import { DAILY_CONFIG, ERROR_MESSAGES, VALIDATION_LIMITS } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints, ensureUserCollection, addCardToCollection, updateCollectionStats, formatPackCard, getRarityColor } from './shared';

export const coreCommands: Chat.ChatCommands = {

	async daily(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
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
			
			// Updated for new card structure - sets can be arrays
			const availableSets = await TCGCards.distinct('set');
			const flatSets = availableSets.flat().filter(Boolean); // Flatten arrays and remove nulls
			
			if (flatSets.length === 0) {
				return this.errorReply(ERROR_MESSAGES.SET_UNAVAILABLE);
			}
			
			const randomSetId = flatSets[Math.floor(Math.random() * flatSets.length)];
			const pack = await generatePack(randomSetId);
			
			if (!pack) {
				return this.errorReply(`${ERROR_MESSAGES.PACK_GENERATION_FAILED} from set "${randomSetId}".`);
			}
			
			collection = await ensureUserCollection(userId);
			let pointsGained = 0;
			
			// Use helper functions for adding cards
			for (const card of pack) {
				pointsGained += getCardPoints(card);
				addCardToCollection(collection, card.cardId, 1);
			}
			
			// Update stats using helper
			updateCollectionStats(collection);
			collection.stats.totalPoints = (collection.stats.totalPoints || 0) + pointsGained;
			collection.currency = (collection.currency || 0) + DAILY_CONFIG.CURRENCY_AWARD;
			collection.lastDaily = Date.now();
			
			await UserCollections.upsert({ userId }, collection);
			
			// Enhanced display for daily pack
			pack.sort((a, b) => getCardPoints(b) - getCardPoints(a));
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">🎁 Daily Pack Claimed!</h2>` +
				`<div style="text-align:center; margin:15px 0;">` +
				`<div style="font-size:1.1em; margin-bottom:10px;">` +
				`📦 Pack from <strong>${randomSetId.toUpperCase()}</strong>` +
				`</div>` +
				`<div style="color:#f39c12; font-size:1.1em; font-weight:bold;">` +
				`+${DAILY_CONFIG.CURRENCY_AWARD} Credits | +${pointsGained} Points` +
				`</div>` +
				`</div><hr/>`;
			
			// Enhanced card display
			pack.forEach(card => {
				output += formatPackCard(card, true);
			});
			
			// Highlight best card
			const bestCard = pack[0];
			if (bestCard) {
				output += `<hr/>` +
					`<div style="text-align:center; margin:15px 0; padding:10px; background:${getRarityColor(bestCard.rarity)}15; border-radius:5px;">` +
					`<strong>🌟 Best Card:</strong> ` +
					`<span style="color:${getRarityColor(bestCard.rarity)}; font-weight:bold;">${bestCard.name}</span>` +
					` (${getCardPoints(bestCard)} pts)` +
					`</div>`;
			}
			
			output += `<div style="text-align:center; margin-top:15px; font-size:0.9em; color:#666;">` +
				`Next daily pack in 24 hours` +
				`</div></div>`;
			
			await TCG_Ranking.updateMilestoneProgress(userId, 'packsOpened', 1);
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async currency(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		const targetUsername = target.trim() || user.name;
		const targetId = toID(targetUsername);
		
		try {
			const balance = await TCG_Economy.getCurrency(targetId);
			
			// Enhanced currency display
			let output = `<div class="infobox" style="text-align:center;">` +
				`<h2>💰 ${Impulse.nameColor(targetUsername, true)}'s Balance</h2>` +
				`<div style="font-size:2em; color:#f39c12; margin:20px 0; font-weight:bold;">` +
				`${balance.toLocaleString()} Credits` +
				`</div>`;
			
			if (targetId === user.id) {
				// Show personal stats
				const collection = await UserCollections.findOne({ userId: targetId });
				const totalPoints = collection?.stats?.totalPoints || 0;
				const totalCards = collection?.stats?.totalCards || 0;
				
				output += `<div style="display:flex; justify-content:space-around; margin:15px 0; padding:10px; background:#f5f5f5; border-radius:5px;">` +
					`<div>` +
					`<div style="font-size:1.2em; font-weight:bold; color:#e74c3c;">${totalPoints}</div>` +
					`<div style="font-size:0.9em; color:#666;">Total Points</div>` +
					`</div>` +
					`<div>` +
					`<div style="font-size:1.2em; font-weight:bold; color:#3498db;">${totalCards}</div>` +
					`<div style="font-size:0.9em; color:#666;">Total Cards</div>` +
					`</div>` +
					`</div>`;
				
				// Show daily status
				const now = Date.now();
				const twentyFourHours = DAILY_CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000;
				
				if (collection?.lastDaily && (now - collection.lastDaily < twentyFourHours)) {
					const timeLeft = collection.lastDaily + twentyFourHours - now;
					const hours = Math.floor(timeLeft / (1000 * 60 * 60));
					const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
					
					output += `<div style="margin:10px 0; padding:8px; background:#ffe6e6; border-radius:5px; color:#d63031;">` +
						`⏰ Daily pack available in ${hours}h ${minutes}m` +
						`</div>`;
				} else {
					output += `<div style="margin:10px 0;">` +
						`<button name="send" value="/tcg daily" style="background:#2ecc71; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">` +
						`🎁 Claim Daily Pack` +
						`</button>` +
						`</div>`;
				}
			}
			
			output += `</div>`;
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async pay(target, room, user) {
		if (!this.runBroadcast()) return;
		await TCG_Ranking.getPlayerRanking(user.id);
		
		const [targetUsername, amountStr] = target.split(',').map(p => p.trim());
		
		if (!targetUsername || !amountStr) {
			return this.errorReply("Usage: /tcg pay [user], [amount]");
		}
		
		const amount = parseInt(amountStr);
		if (isNaN(amount) || amount < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT || amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
			return this.errorReply(`Amount must be between ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT} and ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}.`);
		}
		
		const targetId = toID(targetUsername);
		if (targetId === user.id) {
			return this.errorReply("You cannot pay yourself.");
		}
		
		try {
			const senderBalance = await TCG_Economy.getCurrency(user.id);
			
			if (senderBalance < amount) {
				return this.errorReply(`You don't have enough Credits. Your balance: ${senderBalance}`);
			}
			
			const success = await TCG_Economy.transferCurrency(user.id, targetId, amount);
			
			if (success) {
				this.sendReply(`You paid ${amount} Credits to ${targetUsername}.`);
				
				const targetUser = Users.get(targetId);
				if (targetUser && targetUser.connected) {
					targetUser.sendTo(
						room,
						`|html|<div class="infobox" style="background:#d5f4e6; border:1px solid #27ae60; padding:10px; border-radius:5px;">` +
						`<strong>💰 Payment Received!</strong><br/>` +
						`You received <strong>${amount} Credits</strong> from ${user.name}` +
						`</div>`
					);
				}
			} else {
				this.errorReply("Payment failed. Please try again.");
			}
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async cardinfo(target, room, user) {
		if (!this.runBroadcast()) return;
		
		if (!target) {
			return this.errorReply("Usage: /tcg cardinfo [card ID or name]");
		}
		
		try {
			// Enhanced card search
			let card = await TCGCards.findOne({ cardId: toID(target) });
			
			if (!card) {
				// Try partial name search
				card = await TCGCards.findOne({ 
					name: { $regex: new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
				});
			}
			
			if (!card) {
				// Try fuzzy search
				const cards = await TCGCards.find({
					$or: [
						{ name: { $regex: target, $options: 'i' } },
						{ cardId: { $regex: target, $options: 'i' } }
					]
				}).limit(1);
				
				if (cards.length > 0) {
					card = cards[0];
				}
			}
			
			if (!card) {
				return this.errorReply(`Card not found: ${target}`);
			}
			
			// Comprehensive card info display
			let output = `<div class="infobox" style="max-width:600px;">`;
			
			// Header with card image
			output += `<div style="display:flex; gap:15px; margin-bottom:15px;">`;
			
			// Card image
			if (card.imageUrl) {
				output += `<div style="flex-shrink:0;">` +
					`<img src="${card.imageUrl}" alt="${card.name}" style="width:150px; height:auto; border-radius:8px; border:2px solid ${getRarityColor(card.rarity)};">` +
					`</div>`;
			}
			
			// Card details
			output += `<div style="flex-grow:1;">`;
			
			// Name and basic info
			output += `<h2 style="margin:0; color:${getRarityColor(card.rarity)};">${card.name}</h2>` +
				`<div style="margin:5px 0; font-size:1.1em;">` +
				`<strong>${card.rarity}</strong> ${card.supertype}`;
			
			if (card.subtypes && card.subtypes.length > 0) {
				output += ` - ${card.subtypes.join(', ')}`;
			}
			
			output += `</div>`;
			
			// Set and number info
			const setDisplay = Array.isArray(card.set) ? card.set.join(', ') : card.set;
			output += `<div style="margin:5px 0; color:#666;">` +
				`<strong>Set:</strong> ${setDisplay} | <strong>Number:</strong> ${card.number || 'N/A'}` +
				`</div>`;
			
			// Points value
			output += `<div style="margin:5px 0;">` +
				`<strong>Value:</strong> <span style="color:#e74c3c; font-weight:bold;">${getCardPoints(card)} points</span>` +
				`</div>`;
			
			output += `</div></div>`;
			
			// Pokemon-specific details
			if (card.supertype === 'Pokémon') {
				output += `<div style="margin:15px 0; padding:15px; background:#f5f5f5; border-radius:8px;">`;
				
				// Basic stats
				output += `<div style="margin-bottom:10px;">`;
				if (card.hp) {
					output += `<span style="background:#e74c3c; color:white; padding:3px 8px; border-radius:4px; margin-right:5px; font-weight:bold;">HP ${card.hp}</span>`;
				}
				if (card.type) {
					output += `<span style="background:${require('./shared').getTypeColor(card.type)}; color:white; padding:3px 8px; border-radius:4px; margin-right:5px;">${card.type}</span>`;
				}
				if (card.stage) {
					output += `<span style="background:#95a5a6; color:white; padding:3px 8px; border-radius:4px;">${card.stage}</span>`;
				}
				output += `</div>`;
				
				// Battle stats
				if (card.battleStats) {
					output += `<div style="margin:10px 0;">` +
						`<h4 style="margin:0 0 8px 0; color:#2c3e50;">Battle Stats</h4>` +
						`<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; text-align:center;">` +
						`<div style="padding:8px; background:white; border-radius:4px;">` +
						`<div style="font-weight:bold; color:#e74c3c;">${card.battleStats.attackPower}</div>` +
						`<div style="font-size:0.8em; color:#666;">Attack</div>` +
						`</div>` +
						`<div style="padding:8px; background:white; border-radius:4px;">` +
						`<div style="font-weight:bold; color:#3498db;">${card.battleStats.defensePower}</div>` +
						`<div style="font-size:0.8em; color:#666;">Defense</div>` +
						`</div>` +
						`<div style="padding:8px; background:white; border-radius:4px;">` +
						`<div style="font-weight:bold; color:#f39c12;">${card.battleStats.speed}</div>` +
						`<div style="font-size:0.8em; color:#666;">Speed</div>` +
						`</div>` +
						`<div style="padding:8px; background:white; border-radius:4px;">` +
						`<div style="font-weight:bold; color:#9b59b6;">${card.battleStats.energyCost}</div>` +
						`<div style="font-size:0.8em; color:#666;">Energy</div>` +
						`</div>` +
						`</div>`;
					
					if (card.battleValue) {
						output += `<div style="text-align:center; margin:10px 0; padding:8px; background:#fff3cd; border-radius:4px;">` +
							`<strong>Battle Value: <span style="color:#e74c3c; font-size:1.2em;">${card.battleValue}</span></strong>` +
							`</div>`;
					}
					
					output += `</div>`;
				}
				
				// Type effectiveness
				if (card.weaknesses && card.weaknesses.length > 0) {
					output += `<div style="margin:8px 0;">` +
						`<strong>Weakness:</strong> `;
					card.weaknesses.forEach(w => {
						output += `<span style="color:${require('./shared').getTypeColor(w.type)}; font-weight:bold;">${w.type} ${w.value}</span> `;
					});
					output += `</div>`;
				}
				
				if (card.resistances && card.resistances.length > 0) {
					output += `<div style="margin:8px 0;">` +
						`<strong>Resistance:</strong> `;
					card.resistances.forEach(r => {
						output += `<span style="color:${require('./shared').getTypeColor(r.type)}; font-weight:bold;">${r.type} ${r.value}</span> `;
					});
					output += `</div>`;
				}
				
				if (card.retreatCost && card.retreatCost.length > 0) {
					output += `<div style="margin:8px 0;">` +
						`<strong>Retreat Cost:</strong> ${card.convertedRetreatCost || card.retreatCost.length}` +
						`</div>`;
				}
				
				output += `</div>`;
				
				// Attacks
				if (card.attacks && card.attacks.length > 0) {
					output += `<div style="margin:15px 0;">` +
						`<h3 style="margin:0 0 10px 0; color:#2c3e50;">Attacks</h3>`;
					
					card.attacks.forEach(attack => {
						output += `<div style="margin:10px 0; padding:12px; background:#f9f9f9; border-radius:6px; border-left:4px solid #e74c3c;">` +
							`<div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">${attack.name}`;
						
						if (attack.damage) {
							output += ` - <span style="color:#e74c3c;">${attack.damageText || attack.damage} damage</span>`;
						}
						
						output += `</div>` +
							`<div style="font-size:0.9em; color:#666; margin-bottom:5px;">` +
							`Energy Cost: <strong>${attack.convertedEnergyCost}</strong>`;
						
						if (attack.cost && attack.cost.length > 0) {
							output += ` (${attack.cost.join(', ')})`;
						}
						
						output += `</div>`;
						
						if (attack.text) {
							output += `<div style="font-size:0.9em; margin-top:5px;">${attack.text}</div>`;
						}
						
						output += `</div>`;
					});
					
					output += `</div>`;
				}
				
				// Abilities
				if (card.abilities && card.abilities.length > 0) {
					output += `<div style="margin:15px 0;">` +
						`<h3 style="margin:0 0 10px 0; color:#2c3e50;">Abilities</h3>`;
					
					card.abilities.forEach(ability => {
						output += `<div style="margin:10px 0; padding:12px; background:#e8f5e8; border-radius:6px; border-left:4px solid #27ae60;">` +
							`<div style="font-weight:bold; font-size:1.1em; margin-bottom:5px;">${ability.name} ` +
							`<span style="font-size:0.9em; color:#666;">(${ability.type})</span></div>`;
						
						if (ability.text) {
							output += `<div style="font-size:0.9em;">${ability.text}</div>`;
						}
						
						output += `</div>`;
					});
					
					output += `</div>`;
				}
				
				// Evolution info
				if (card.evolvesFrom) {
					output += `<div style="margin:8px 0; font-size:0.9em; color:#666;">` +
						`<strong>Evolves from:</strong> ${card.evolvesFrom}` +
						`</div>`;
				}
				
				if (card.evolvesTo && card.evolvesTo.length > 0) {
					output += `<div style="margin:8px 0; font-size:0.9em; color:#666;">` +
						`<strong>Evolves to:</strong> ${card.evolvesTo.join(', ')}` +
						`</div>`;
				}
			}
			
			// Flavor text
			if (card.cardText) {
				output += `<div style="margin:15px 0; padding:12px; background:#f0f8ff; border-left:4px solid #3498db; font-style:italic;">` +
					`"${card.cardText}"` +
					`</div>`;
			}
			
			// Additional info
			output += `<div style="margin-top:15px; font-size:0.9em; color:#666; border-top:1px solid #ddd; padding-top:10px;">`;
			
			if (card.artist) {
				output += `<div><strong>Artist:</strong> ${card.artist}</div>`;
			}
			
			if (card.nationalPokedexNumbers && card.nationalPokedexNumbers.length > 0) {
				output += `<div><strong>Pokédex #:</strong> ${card.nationalPokedexNumbers.join(', ')}</div>`;
			}
			
			if (card.legalities) {
				output += `<div><strong>Legal in:</strong> `;
				Object.entries(card.legalities).forEach(([format, status]) => {
					if (status === 'Legal') {
						output += `<span style="color:#2ecc71; font-weight:bold;">${format}</span> `;
					}
				});
				output += `</div>`;
			}
			
			output += `<div><strong>Card ID:</strong> ${card.cardId}</div>`;
			output += `</div>`;
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async stats(target, room, user) {
		if (!this.runBroadcast()) return;
		
		try {
			// Database statistics
			const [totalCards, totalPokemon, totalTrainers, totalEnergy] = await Promise.all([
				TCGCards.countDocuments({}),
				TCGCards.countDocuments({ supertype: 'Pokémon' }),
				TCGCards.countDocuments({ supertype: 'Trainer' }),
				TCGCards.countDocuments({ supertype: 'Energy' })
			]);
			
			// Battle system stats
			const [cardsWithBattleValue, avgBattleValue] = await Promise.all([
				TCGCards.countDocuments({ battleValue: { $exists: true } }),
				TCGCards.aggregate([
					{ $match: { battleValue: { $exists: true } } },
					{ $group: { _id: null, avg: { $avg: '$battleValue' } } }
				])
			]);
			
			const avgBV = avgBattleValue.length > 0 ? Math.round(avgBattleValue.avg) : 0;
			
			// User statistics
			const [totalUsers, totalCollections] = await Promise.all([
				UserCollections.countDocuments({}),
				UserCollections.countDocuments({ 'cards.0': { $exists: true } })
			]);
			
			let output = `<div class="infobox">` +
				`<h2 style="text-align:center;">📊 TCG Database Statistics</h2>`;
			
			// Card statistics
			output += `<div style="margin:15px 0;">` +
				`<h3>🎴 Card Database</h3>` +
				`<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px;">` +
				`<div style="text-align:center; padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-size:1.5em; font-weight:bold; color:#2c3e50;">${totalCards.toLocaleString()}</div>` +
				`<div style="color:#666;">Total Cards</div>` +
				`</div>` +
				`<div style="text-align:center; padding:10px; background:#fff3cd; border-radius:5px;">` +
				`<div style="font-size:1.5em; font-weight:bold; color:#e74c3c;">${cardsWithBattleValue.toLocaleString()}</div>` +
				`<div style="color:#666;">Battle-Ready</div>` +
				`</div>` +
				`</div>`;
			
			// Card type breakdown
			output += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:10px 0;">` +
				`<div style="text-align:center; padding:8px; background:#ffe6e6; border-radius:4px;">` +
				`<div style="font-weight:bold; color:#e74c3c;">${totalPokemon.toLocaleString()}</div>` +
				`<div style="font-size:0.9em; color:#666;">Pokémon</div>` +
				`</div>` +
				`<div style="text-align:center; padding:8px; background:#e6f3ff; border-radius:4px;">` +
				`<div style="font-weight:bold; color:#3498db;">${totalTrainers.toLocaleString()}</div>` +
				`<div style="font-size:0.9em; color:#666;">Trainers</div>` +
				`</div>` +
				`<div style="text-align:center; padding:8px; background:#fff3e6; border-radius:4px;">` +
				`<div style="font-weight:bold; color:#f39c12;">${totalEnergy.toLocaleString()}</div>` +
				`<div style="font-size:0.9em; color:#666;">Energy</div>` +
				`</div>` +
				`</div>`;
			
			if (avgBV > 0) {
				output += `<div style="text-align:center; margin:10px 0; padding:8px; background:#e8f5e8; border-radius:5px;">` +
					`<strong>Average Battle Value:</strong> <span style="color:#27ae60; font-size:1.2em;">${avgBV}</span>` +
					`</div>`;
			}
			
			output += `</div>`;
			
			// User statistics
			output += `<div style="margin:15px 0;">` +
				`<h3>👥 Player Statistics</h3>` +
				`<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:15px;">` +
				`<div style="text-align:center; padding:10px; background:#f8f9fa; border-radius:5px;">` +
				`<div style="font-size:1.5em; font-weight:bold; color:#3498db;">${totalUsers.toLocaleString()}</div>` +
				`<div style="color:#666;">Registered Players</div>` +
				`</div>` +
				`<div style="text-align:center; padding:10px; background:#e8f5e8; border-radius:5px;">` +
				`<div style="font-size:1.5em; font-weight:bold; color:#27ae60;">${totalCollections.toLocaleString()}</div>` +
				`<div style="color:#666;">Active Collectors</div>` +
				`</div>` +
				`</div>` +
				`</div>`;
			
			output += `</div>`;
			
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

};
