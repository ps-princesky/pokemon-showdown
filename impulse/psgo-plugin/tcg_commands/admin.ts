/**
 * Admin-only TCG commands
 */

import * as TCG_Economy from '../../../impulse/psgo-plugin/tcg_economy';
import * as TCG_Ranking from '../../../impulse/psgo-plugin/tcg_ranking';
import * as TCG_UI from '../../../impulse/psgo-plugin/tcg_ui';
import { TCGCards, UserCollections } from '../../../impulse/psgo-plugin/tcg_collections';
import { VALIDATION_LIMITS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../../../impulse/psgo-plugin/tcg_config';
import { generatePack, getCardPoints, ensureUserCollection, formatPackCard, updateCollectionStats, addCardToCollection } from './shared';

export const adminCommands: Chat.ChatCommands = {

	async addcard(target, room, user) {
		this.checkCan('globalban');
		const parts = target.split(',').map(x => x.trim());
		
		if (parts.length < 6) {
			return this.errorReply('Usage: /tcg addcard [cardId], [name], [set], [rarity], [supertype], [subtypes], [type], [hp], [attacks], [abilities]');
		}

		const [cardId, name, set, rarity, supertype, subtypesStr, type, hp, attacksStr, abilitiesStr] = parts;
		
		try {
			const subtypes = subtypesStr ? subtypesStr.split('/').map(s => s.trim()) : [];
			
			// Parse attacks if provided
			let attacks = undefined;
			if (attacksStr && attacksStr.trim()) {
				try {
					// Simple format: "attack1:damage1,attack2:damage2"
					attacks = attacksStr.split(',').map(attackStr => {
						const [attackName, damageStr] = attackStr.split(':');
						const damage = parseInt(damageStr) || 0;
						return {
							name: attackName.trim(),
							cost: ['Colorless'],
							convertedEnergyCost: 1,
							damage: damage,
							damageText: damage.toString(),
							text: '',
						};
					});
				} catch (e) {
					// If parsing fails, ignore attacks
					attacks = undefined;
				}
			}
			
			// Parse abilities if provided
			let abilities = undefined;
			if (abilitiesStr && abilitiesStr.trim()) {
				try {
					// Simple format: "ability1:text1,ability2:text2"
					abilities = abilitiesStr.split(',').map(abilityStr => {
						const [abilityName, abilityText] = abilityStr.split(':');
						return {
							name: abilityName.trim(),
							type: 'Ability',
							text: abilityText ? abilityText.trim() : '',
						};
					});
				} catch (e) {
					abilities = undefined;
				}
			}
			
			// Calculate battle stats for Pokemon
			let battleStats = undefined;
			let battleValue = undefined;
			
			if (supertype === 'Pokémon') {
				const hpValue = hp ? parseInt(hp) : 60;
				const avgAttack = attacks ? attacks.reduce((sum, a) => sum + a.damage, 0) / attacks.length : 40;
				
				battleStats = {
					attackPower: Math.round(avgAttack),
					defensePower: hpValue,
					speed: 50, // Default speed
					energyCost: attacks ? Math.round(attacks.reduce((sum, a) => sum + a.convertedEnergyCost, 0) / attacks.length) : 2
				};
				
				// Calculate battle value
				battleValue = Math.round(
					hpValue * 0.3 + 
					battleStats.attackPower * 0.4 + 
					battleStats.speed * 0.15 + 
					(6 - battleStats.energyCost) * 10 * 0.1 + 
					getCardPointsFromRarity(rarity) * 0.05
				);
			}
			
			const cardData = {
				cardId,
				name: name.substring(0, VALIDATION_LIMITS.MAX_CARD_NAME_LENGTH),
				set: [set], // Store as array for new structure
				rarity,
				supertype,
				subtypes,
				type: type || undefined,
				types: type ? [type] : undefined,
				hp: hp ? parseInt(hp) : undefined,
				stage: subtypes.includes('Basic') ? 'basic' : 
					   subtypes.includes('Stage 1') ? 'stage1' : 
					   subtypes.includes('Stage 2') ? 'stage2' : undefined,
				attacks,
				abilities,
				battleStats,
				battleValue,
				importedAt: new Date().toISOString(),
				dataVersion: '2.0'
			};
			
			// Remove undefined values
			Object.keys(cardData).forEach(key => {
				if (cardData[key] === undefined) {
					delete cardData[key];
				}
			});
			
			await TCGCards.upsert({ cardId }, cardData);
			
			return this.sendReply(`${SUCCESS_MESSAGES.CARD_ADDED}: "${name}" (${cardId}) with battle value ${battleValue || 'N/A'}.`);
			
		} catch (e: any) {
			return this.errorReply(`${ERROR_MESSAGES.DATABASE_ERROR}: ${e.message}`);
		}
	},

	async testbattledata(target, room, user) {
		this.checkCan('globalban');
		
		try {
			// Get a random Pokemon with battle data - FIX: No .limit()
			const allPokemon = await TCGCards.find({ 
				supertype: 'Pokémon',
				battleValue: { $exists: true },
				attacks: { $exists: true }
			});
			
			if (allPokemon.length === 0) {
				return this.errorReply("No Pokemon found with battle data");
			}
			
			const pokemon = allPokemon[0]; // Take first one
			
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
			
			output += `</div>`;
			this.sendReplyBox(output);
			
		} catch (e: any) {
			return this.errorReply(`Error: ${e.message}`);
		}
	},

	async recalculatebattlevalues(target, room, user) {
		this.checkCan('globalban');
		
		try {
			this.sendReply("🔄 Starting battle value recalculation...");
			
			// FIX: No chained methods, get all Pokemon first
			const allPokemon = await TCGCards.find({ supertype: 'Pokémon' });
			let updated = 0;
			
			for (const card of allPokemon) {
				// Only update if missing battle value
				if (card.battleValue === undefined) {
					const hp = card.hp || 60;
					const avgAttack = card.attacks ? 
						card.attacks.reduce((sum, a) => sum + (a.damage || 0), 0) / card.attacks.length : 40;
					const speed = card.battleStats?.speed || 50;
					const energyCost = card.battleStats?.energyCost || 2;
					
					const battleStats = {
						attackPower: Math.round(avgAttack),
						defensePower: hp,
						speed: speed,
						energyCost: energyCost
					};
					
					const battleValue = Math.round(
						hp * 0.3 + 
						battleStats.attackPower * 0.4 + 
						speed * 0.15 + 
						(6 - energyCost) * 10 * 0.1 + 
						getCardPointsFromRarity(card.rarity) * 0.05
					);
					
					// FIX: Use upsert instead of updateOne
					await TCGCards.upsert(
						{ cardId: card.cardId },
						{ 
							...card,
							battleStats: battleStats,
							battleValue: battleValue,
							dataVersion: '2.0'
						}
					);
					
					updated++;
				}
			}
			
			this.sendReply(`✅ Updated battle values for ${updated} Pokemon cards.`);
			
		} catch (e: any) {
			return this.errorReply(`Error: ${e.message}`);
		}
	},

};

// Helper function for rarity-based points
function getCardPointsFromRarity(rarity: string): number {
	switch (rarity) {
		case 'Common': case '1st Edition': case 'Shadowless': return 5;
		case 'Uncommon': return 10;
		case 'Reverse Holo': return 15;
		case 'Rare': return 20;
		case 'Double Rare': case 'Promo': case 'Black Star Promo': return 25;
		case 'Rare Holo': case 'Classic Collection': return 30;
		case 'Rare Holo 1st Edition': return 35;
		case 'Rare SP': return 40;
		case 'Rare Holo EX': case 'Rare Holo GX': case 'Rare Holo V': return 45;
		case 'Rare BREAK': case 'Rare Prime': case 'LEGEND': case 'Prism Star': return 50;
		case 'Rare Holo VMAX': case 'Rare Holo VSTAR': return 55;
		case 'Rare ex': case 'Radiant Rare': return 60;
		case 'Amazing Rare': case 'Shining': return 65;
		case 'ACE SPEC Rare': case 'Rare ACE': return 70;
		case 'Full Art': case 'Rare Ultra': return 75;
		case 'Rare Shiny': case 'Shiny Rare': return 80;
		case 'Trainer Gallery': case 'Character Rare': case 'Rare Shiny GX': case 'Shiny Ultra Rare': return 85;
		case 'Illustration Rare': return 90;
		case 'Rare Holo LV.X': return 95;
		case 'Rare Holo Star': return 100;
		case 'Character Super Rare': return 110;
		case 'Rare Secret': return 120;
		case 'Special Illustration Rare': return 150;
		case 'Rare Rainbow': return 160;
		case 'Gold Full Art': case 'Rare Gold': case 'Hyper Rare': return 175;
		case 'Gold Star': return 200;
		default: return 5;
	}
}
