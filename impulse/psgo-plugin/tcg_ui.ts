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

/**
 * Build a notification/alert box
 */
export function buildNotification(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): string {
	const colors = {
		success: { bg: 'rgba(46,204,113,0.1)', text: '#27ae60', border: '#27ae60' },
		info: { bg: 'rgba(52,152,219,0.1)', text: '#2980b9', border: '#2980b9' },
		warning: { bg: 'rgba(243,156,18,0.1)', text: '#f39c12', border: '#f39c12' },
		error: { bg: 'rgba(231,76,60,0.1)', text: '#e74c3c', border: '#e74c3c' }
	};
	
	const style = colors[type];
	return `<div style="text-align:center; color: ${style.text}; margin: 10px 0; padding: 8px; background: ${style.bg}; border: 1px solid ${style.border}; border-radius: 5px;">` +
		message +
		`</div>`;
}

// ==================== TABLE COMPONENTS ====================

type CardTableColumn = 'id' | 'name' | 'set' | 'rarity' | 'type' | 'subtypes' | 'hp' | 'quantity';

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
					cell += card.hp || 'N/A';
					break;
				case 'quantity':
					cell += quantityMap?.get(card.cardId) || 1;
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

// ==================== BATTLE RESULT COMPONENTS ====================

/**
 * Build pack display for battles
 */
export function buildPackDisplay(params: {
	playerName: string;
	pack: TCGCard[];
	totalValue: number;
	getCardPoints: (card: TCGCard) => number;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { playerName, pack, totalValue, getCardPoints, nameColor } = params;
	const sortedPack = [...pack].sort((a, b) => getCardPoints(b) - getCardPoints(a));
	
	const packHtml = sortedPack.map(c => 
		`<tr><td><button name="send" value="/tcg card ${c.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${c.name}</button></td>` +
		`<td><span style="color: ${getRarityColor(c.rarity)}">${c.rarity}</span></td></tr>`
	).join('');
	
	return `<td style="width:50%; vertical-align:top; padding-right:5px;">` +
		`<strong>${nameColor(playerName, true)}'s Pack (Total: ${totalValue} Points)</strong>` +
		`<table class="themed-table">${packHtml}</table>` +
		`</td>`;
}

/**
 * Build pack battle result display
 */
export function buildPackBattleResult(params: {
	challenger: { name: string; pack: TCGCard[]; points: number };
	acceptor: { name: string; pack: TCGCard[]; points: number };
	winner: { name: string; credits: number } | null;
	getCardPoints: (card: TCGCard) => number;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { challenger, acceptor, winner, getCardPoints, nameColor } = params;

	let output = `<div class="infobox">` +
		`<h2 style="text-align:center;">Pack Battle!</h2>` +
		`<table style="width:100%;"><tr>` +
		buildPackDisplay({ 
			playerName: challenger.name, 
			pack: challenger.pack, 
			totalValue: challenger.points, 
			getCardPoints, 
			nameColor 
		}) +
		buildPackDisplay({ 
			playerName: acceptor.name, 
			pack: acceptor.pack, 
			totalValue: acceptor.points, 
			getCardPoints, 
			nameColor 
		}) +
		`</tr></table><hr/>`;

	if (winner) {
		output += `<h3 style="text-align:center; color:#2ecc71;">${winner.name} wins ${winner.credits} Credits!</h3>`;
	} else {
		output += `<h3 style="text-align:center; color:#f1c40f;">It's a tie! Wagers have been refunded.</h3>`;
	}
	
	output += `</div>`;
	return output;
}
