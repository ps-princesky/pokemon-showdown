/**
 * TCG UI Module
 * Contains reusable functions for generating HTML displays for the TCG plugin.
 */

import { TCGCard } from './tcg_data'; 
import { getRarityColor, getSubtypeColor } from './tcg_data';

/**
 * Builds the main page wrapper for most TCG commands.
 * @param title The title to be displayed at the top of the box.
 * @param content The inner HTML content of the page.
 */
export function buildPage(title: string, content: string): string {
	return (
		`<div class="themed-table-container">` +
			`<h3 class="themed-table-title">${title}</h3>` +
			content +
		`</div>`
	);
}

// Defines the valid column keys that generateCardTable can accept.
type CardTableColumn = 'id' | 'name' | 'set' | 'rarity' | 'type' | 'subtypes' | 'hp' | 'quantity';

/**
 * Generates a themed HTML table for a list of cards.
 * @param cards An array of TCGCard objects to display.
 * @param columns An array of column keys to include in the table.
 * @param quantityMap An optional map to display card quantities, used by the /collection command.
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
