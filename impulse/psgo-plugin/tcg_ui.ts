/**
 * TCG UI Module
 * Contains reusable functions for generating HTML displays for the TCG plugin.
 * Uses unified components for consistent styling and maintainability.
 */

import { TCGCard } from './tcg_data'; 
import { getRarityColor, getSubtypeColor } from './tcg_data';
import { PAGINATION_CONFIG } from './tcg_config';

// ==================== CORE UI COMPONENTS ====================

/**
 * Builds the main page wrapper for most TCG commands.
 */
export function buildPage(title: string, content: string): string {
	return (
		`<div class="themed-table-container">` +
			`<h3 class="themed-table-title">${title}</h3>` +
			content +
		`</div>`
	);
}

/**
 * Build an info box container
 */
export function buildInfoBox(title: string, content: string): string {
	return `<div class="infobox">` +
		`<h3>${title}</h3>` +
		content +
		`</div>`;
}

/**
 * Build a scrollable container
 */
export function buildScrollableContainer(content: string, maxHeight: string = PAGINATION_CONFIG.MAX_HEIGHT): string {
	return `<div style="max-height: ${maxHeight}; overflow-y: auto;">${content}</div>`;
}

/**
 * Build a progress bar
 */
export function buildProgressBar(params: {
	current: number;
	total: number;
	color?: string;
	bgColor?: string;
	showText?: boolean;
	height?: string;
}): string {
	const { current, total, showText = true, height = '20px' } = params;
	const percent = Math.min(100, Math.round((current / total) * 100));
	
	let color = params.color || '#2ecc71';
	let bgColor = params.bgColor || '#ecf0f1';
	
	let output = `<div style="background: ${bgColor}; border-radius: 4px; overflow: hidden; border: 1px solid #bdc3c7; position: relative; height: ${height};">` +
		`<div style="width: ${percent}%; background: ${color}; height: 100%; transition: width 0.3s ease;"></div>`;
	
	if (showText) {
		const textColor = percent > 50 ? '#fff' : '#2c3e50';
		const textShadow = percent > 50 ? 'text-shadow: 1px 1px 1px rgba(0,0,0,0.3);' : '';
		
		output += `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: ${textColor}; ${textShadow}">` +
			`${current}/${total} (${percent}%)` +
			`</div>`;
	}
	
	output += `</div>`;
	return output;
}

// ==================== TABLE COMPONENTS ====================

type CardTableColumn = 'id' | 'name' | 'set' | 'rarity' | 'type' | 'subtypes' | 'hp' | 'quantity' | 'battleValue';

/**
 * Generate a themed table for cards
 */
export function generateCardTable(
	cards: TCGCard[],
	columns: CardTableColumn[],
	quantityMap?: Map<string, number>
): string {
	const headers: { [key in CardTableColumn]: string } = {
		id: 'Card ID',
		name: 'Name',
		set: 'Set',
		rarity: 'Rarity',
		type: 'Type',
		subtypes: 'Subtypes',
		hp: 'HP',
		quantity: 'Quantity',
		battleValue: '⚔️ BV',
	};

	let table = `<div style="max-height: 380px; overflow-y: auto;"><table class="themed-table">`;
	
	// Build headers
	table += `<tr class="themed-table-header">`;
	for (const col of columns) {
		table += `<th>${headers[col]}</th>`;
	}
	table += `</tr>`;

	// Build rows
	for (const card of cards) {
		table += `<tr class="themed-table-row">`;
		for (const col of columns) {
			let cell = '<td>';
			switch (col) {
				case 'id':
					cell += card.cardId;
					break;
				case 'name':
					cell += `<button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button>`;
					break;
				case 'set':
					cell += card.set;
					break;
				case 'rarity':
					cell += `<span style="color: ${getRarityColor(card.rarity)}">${card.rarity.toUpperCase()}</span>`;
					break;
				case 'type':
					cell += card.type || card.supertype;
					break;
				case 'subtypes':
					const formattedSubtypes = card.subtypes.map(s => {
						const color = getSubtypeColor(s);
						return color ? `<strong style="color: ${color}">${s}</strong>` : s;
					}).join(', ');
					cell += formattedSubtypes;
					break;
				case 'hp':
					cell += card.hp || '-';
					break;
				case 'quantity':
					cell += quantityMap?.get(card.cardId) || 1;
					break;
				case 'battleValue':
					if (card.battleValue) {
						let bvColor = '#95a5a6';
						if (card.battleValue >= 150) bvColor = '#e74c3c';
						else if (card.battleValue >= 100) bvColor = '#f39c12';
						else if (card.battleValue >= 70) bvColor = '#3498db';
						cell += `<strong style="color: ${bvColor}">${card.battleValue}</strong>`;
					} else {
						cell += '-';
					}
					break;
			}
			cell += '</td>';
			table += cell;
		}
		table += `</tr>`;
	}

	table += `</table></div>`;
	return table;
}

/**
 * Generic table builder
 */
export function buildTable(params: {
	headers: string[];
	rows: string[][];
	scrollable?: boolean;
	maxHeight?: string;
}): string {
	const { headers, rows, scrollable = true, maxHeight = PAGINATION_CONFIG.MAX_HEIGHT } = params;
	
	let table = scrollable ? `<div style="max-height: ${maxHeight}; overflow-y: auto;">` : '';
	table += `<table class="themed-table">` +
		`<tr class="themed-table-header">`;
	
	headers.forEach(header => {
		table += `<th>${header}</th>`;
	});
	table += `</tr>`;
	
	rows.forEach(row => {
		table += `<tr class="themed-table-row">`;
		row.forEach(cell => {
			table += `<td>${cell}</td>`;
		});
		table += `</tr>`;
	});
	
	table += `</table>`;
	if (scrollable) table += `</div>`;
	
	return table;
}

// ==================== CARD DETAIL DISPLAY ====================

/**
 * Build detailed card view with all information
 */
export function buildCardDetailView(params: {
	card: TCGCard;
	getCardPoints: (card: TCGCard) => number;
	hexToRgba: (hex: string, alpha: number) => string;
	SPECIAL_SUBTYPES: any;
}): string {
	const { card, getCardPoints, hexToRgba, SPECIAL_SUBTYPES } = params;
	
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

	// Helper function to get energy icon
	const getEnergyIcon = (energyType: string) => {
		const typeMap: {[key: string]: string} = {
			'Fighting': 'fighting', 'Psychic': 'psychic', 'Poison': 'poison', 'Dragon': 'dragon',
			'Ghost': 'ghost', 'Dark': 'dark', 'Darkness': 'dark', 'Ground': 'ground',
			'Fire': 'fire', 'Fairy': 'fairy', 'Water': 'water', 'Flying': 'flying',
			'Normal': 'normal', 'Colorless': 'normal', 'Rock': 'rock', 'Lightning': 'electric',
			'Electric': 'electric', 'Bug': 'bug', 'Grass': 'grass', 'Ice': 'ice',
			'Steel': 'steel', 'Metal': 'steel'
		};
		const iconName = typeMap[energyType] || energyType.toLowerCase();
		return `<img src="https://raw.githubusercontent.com/msikma/pokesprite/master/misc/types/masters/${iconName}.png" alt="${energyType}" style="width: 16px; height: 16px; vertical-align: middle;">`;
	};

	let output = `<div class="impulse-card">` +
		`<div class="impulse-card-container" style="border: 2px solid ${borderColor}; ${backgroundStyle}">` +
		`<table style="width: 100%; border-collapse: collapse;"><tr>`;

	if (card.imageUrl) {
		output += `<td style="width: 180px; vertical-align: top; padding-right: 16px;">` +
			`<img src="${card.imageUrl}" alt="${card.name}" width="170" style="display: block; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">`;
		
		if (card.battleValue) {
			output += `<div style="margin-top: 8px; text-align: center; padding: 6px; background: rgba(231,76,60,0.9); color: white; border-radius: 4px; font-weight: bold; font-size: 0.95em;">` +
				`<img src="https://raw.githubusercontent.com/msikma/pokesprite/master/misc/mark/vigor-mark.png" alt="Battle Value" style="width: 16px; height: 16px; vertical-align: middle;"> Battle Value: ${card.battleValue}` +
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
		infoRows.push(['Retreat', card.retreatCost.map(e => getEnergyIcon(e)).join(' ')]);
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

	// Attacks
	if (card.attacks && card.attacks.length > 0) {
		output += `<div style="margin-top: 12px;">` +
			`<strong class="impulse-card-section-title">⚔️ Attacks</strong>`;
		
		card.attacks.forEach(attack => {
			const energyCost = attack.cost && attack.cost.length > 0 
				? attack.cost.map(e => getEnergyIcon(e)).join(' ')
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

	// Abilities
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

	// Weakness & Resistance
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

	// Flavor text & Artist
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

	output += `</div></div>`;
	return output;
}

// ==================== PAGINATION & SORTING CONTROLS ====================

/**
 * Build pagination controls with page numbers and navigation
 */
export function buildPaginationControls(params: {
	commandString: string;
	currentPage: number;
	totalPages: number;
	totalResults: number;
	resultsPerPage: number;
	includeSortButtons?: boolean;
	sortOptions?: string[];
}): string {
	const { commandString, currentPage, totalPages, totalResults, resultsPerPage, includeSortButtons = false, sortOptions = [] } = params;
	
	let output = `<div style="text-align: center; margin-top: 5px;">`;
	
	// Previous button
	if (currentPage > 1) {
		output += `<button name="send" value="${commandString}, page:${currentPage - 1}" style="margin-right: 5px;">&laquo; Previous</button>`;
	}
	
	// Page indicator
	output += `<strong>Page ${currentPage} of ${totalPages}</strong>`;
	
	// Next button
	if ((currentPage * resultsPerPage) < totalResults) {
		output += `<button name="send" value="${commandString}, page:${currentPage + 1}" style="margin-left: 5px;">Next &raquo;</button>`;
	}
	
	// Sort buttons (optional)
	if (includeSortButtons && sortOptions.length > 0) {
		output += `<div style="margin-top: 8px;">` +
			`<strong style="font-size: 0.9em;">Sort by:</strong> `;
		
		sortOptions.forEach(option => {
			output += `<button name="send" value="${commandString}, sort:${option}">${option.charAt(0).toUpperCase() + option.slice(1)}</button> `;
		});
		
		output += `</div>`;
	}
	
	output += `</div>`;
	return output;
}

/**
 * Build sort controls for collection/search views
 */
export function buildSortControls(params: {
	baseCommand: string;
	sortOptions: { value: string; label: string }[];
}): string {
	const { baseCommand, sortOptions } = params;
	
	let output = `<div style="text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1);">` +
		`<strong style="font-size: 0.9em;">Sort by:</strong> `;
	
	sortOptions.forEach(option => {
		output += `<button name="send" value="${baseCommand}, sort:${option.value}">${option.label}</button> `;
	});
	
	output += `</div>`;
	return output;
}
