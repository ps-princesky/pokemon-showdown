/**
 * TCG UI Module
 * Contains reusable functions for generating HTML displays for the TCG plugin.
 */

import { TCGCard } from './tcg_data'; 
import { getRarityColor, getSubtypeColor } from './tcg_data';

// Import config values
import { 
	UI_CONFIG, 
	PAGINATION_CONFIG, 
	VALIDATION_LIMITS 
} from './tcg_config';

/**
 * Builds the main page wrapper for most TCG commands.
 * @param title The title to be displayed at the top of the box.
 * @param content The inner HTML content of the page.
 */
export function buildPage(title: string, content: string): string {
	// Validate and sanitize title
	const sanitizedTitle = title.substring(0, VALIDATION_LIMITS.MAX_CARD_NAME_LENGTH);
	
	return (
		`<div class="infobox">` +
			`<h3>${sanitizedTitle}</h3>` +
			content +
		`</div>`
	);
}

/**
 * Build a scrollable container with consistent styling
 */
export function buildScrollableContainer(content: string, maxHeight: string = PAGINATION_CONFIG.MAX_HEIGHT): string {
	return `<div style="max-height: ${maxHeight}; overflow-y: auto;">${content}</div>`;
}

/**
 * Build a progress bar with consistent styling
 */
export function buildProgressBar(
	progress: number, 
	total: number, 
	options: {
		color?: string;
		showPercentage?: boolean;
		showNumbers?: boolean;
		height?: string;
	} = {}
): string {
	const {
		color = UI_CONFIG.PROGRESS_COLORS.DEFAULT,
		showPercentage = true,
		showNumbers = true,
		height = '20px'
	} = options;
	
	const percentage = Math.min(100, Math.round((progress / total) * 100));
	const textColor = percentage > 50 ? '#fff' : '#2c3e50';
	const textShadow = percentage > 50 ? 'text-shadow: 1px 1px 1px rgba(0,0,0,0.3);' : '';
	
	let displayText = '';
	if (showNumbers && showPercentage) {
		displayText = `${progress}/${total} (${percentage}%)`;
	} else if (showNumbers) {
		displayText = `${progress}/${total}`;
	} else if (showPercentage) {
		displayText = `${percentage}%`;
	}
	
	return `` +
		`<div style="background: #ecf0f1; border-radius: 4px; overflow: hidden; border: 1px solid #bdc3c7; position: relative; height: ${height};">` +
			`<div style="width: ${percentage}%; background: ${color}; height: 100%; transition: width 0.3s ease;"></div>` +
			(displayText ? `` +
				`<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: ${textColor}; ${textShadow}">` +
					`${displayText}` +
				`</div>` +
			`` : '') +
		`</div>`;
}

/**
 * Build a button with consistent styling
 */
export function buildButton(
	text: string,
	command: string,
	style: 'primary' | 'success' | 'warning' | 'danger' | 'disabled' = 'primary',
	disabled: boolean = false
): string {
	const buttonStyle = disabled ? UI_CONFIG.BUTTON_STYLES.DISABLED : UI_CONFIG.BUTTON_STYLES[style.toUpperCase() as keyof typeof UI_CONFIG.BUTTON_STYLES];
	const disabledAttr = disabled ? 'disabled' : '';
	
	return `<button name="send" value="${command}" style="${buttonStyle}" ${disabledAttr}>${text}</button>`;
}

/**
 * Build a status indicator with color and text
 */
export function buildStatusIndicator(
	text: string,
	type: 'success' | 'warning' | 'error' | 'info' = 'info',
	options: {
		bold?: boolean;
		size?: string;
		icon?: string;
	} = {}
): string {
	const {
		bold = true,
		size = '12px',
		icon = ''
	} = options;
	
	const colors = {
		success: UI_CONFIG.PROGRESS_COLORS.SUCCESS,
		warning: UI_CONFIG.PROGRESS_COLORS.WARNING,
		error: UI_CONFIG.PROGRESS_COLORS.DANGER,
		info: UI_CONFIG.PROGRESS_COLORS.INFO
	};
	
	const fontWeight = bold ? 'font-weight: bold;' : '';
	const iconHtml = icon ? `${icon} ` : '';
	
	return `<span style="color: ${colors[type]}; ${fontWeight} font-size: ${size};">${iconHtml}${text}</span>`;
}

/**
 * Build an info box with consistent styling
 */
export function buildInfoBox(
	title: string,
	content: string,
	type: 'default' | 'success' | 'warning' | 'error' = 'default'
): string {
	const borderColors = {
		default: '#3498db',
		success: '#2ecc71',
		warning: '#f39c12',
		error: '#e74c3c'
	};
	
	const backgroundColors = {
		default: 'rgba(52, 152, 219, 0.1)',
		success: 'rgba(46, 204, 113, 0.1)',
		warning: 'rgba(243, 156, 18, 0.1)',
		error: 'rgba(231, 76, 60, 0.1)'
	};
	
	return `` +
		`<div style="border: 2px solid ${borderColors[type]}; background: ${backgroundColors[type]}; border-radius: 8px; padding: 15px; margin: 10px 0;">` +
			(title ? `<h4 style="margin-top: 0; color: ${borderColors[type]};">${title}</h4>` : '') +
			`${content}` +
		`</div>`;
}

/**
 * Build pagination controls
 */
export function buildPaginationControls(
	currentPage: number,
	totalPages: number,
	baseCommand: string,
	additionalParams: string = ''
): string {
	if (totalPages <= 1) return '';
	
	const params = additionalParams ? `, ${additionalParams}` : '';
	let pagination = `<div style="text-align: center; margin-top: 15px;">`;
	
	// Previous button
	if (currentPage > 1) {
		pagination += buildButton(
			'⮨ Previous',
			`${baseCommand}${params}, page:${currentPage - 1}`,
			'primary'
		);
		pagination += ' ';
	}
	
	// Page indicator
	pagination += `<span style="margin: 0 10px; font-weight: bold;">Page ${currentPage} of ${totalPages}</span>`;
	
	// Next button
	if (currentPage < totalPages) {
		pagination += ' ';
		pagination += buildButton(
			'Next ⮩',
			`${baseCommand}${params}, page:${currentPage + 1}`,
			'primary'
		);
	}
	
	pagination += `</div>`;
	return pagination;
}

// Defines the valid column keys that generateCardTable can accept.
type CardTableColumn = 'id' | 'name' | 'set' | 'rarity' | 'type' | 'subtypes' | 'hp' | 'quantity';

/**
 * Generates a themed HTML table for a list of cards.
 * @param cards An array of TCGCard objects to display.
 * @param columns An array of column keys to include in the table.
 * @param quantityMap An optional map to display card quantities, used by the /collection command.
 * @param options Additional options for table generation.
 */
export function generateCardTable(
	cards: TCGCard[],
	columns: CardTableColumn[],
	quantityMap?: Map<string, number>,
	options: {
		maxHeight?: string;
		showHeaders?: boolean;
		clickableNames?: boolean;
	} = {}
): string {
	const {
		maxHeight = PAGINATION_CONFIG.MAX_HEIGHT,
		showHeaders = true,
		clickableNames = true
	} = options;
	
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

	let table = `<div style="max-height: ${maxHeight}; overflow-y: auto;">` +
		`<table class="themed-table">`;
	
	// Build headers
	if (showHeaders) {
		table += `<tr class="themed-table-header">`;
		for (const col of columns) {
			table += `<th>${headers[col]}</th>`;
		}
		table += `</tr>`;
	}

	// Build rows
	for (const card of cards) {
		table += `<tr class="themed-table-row">`;
		for (const col of columns) {
			let cell = '<td>';
			switch (col) {
				case 'id':
					cell += card.cardId.substring(0, 20); // Limit ID length for display
					break;
				case 'name':
					if (clickableNames) {
						cell += `<button name="send" value="/tcg card ${card.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${card.name}</button>`;
					} else {
						cell += card.name;
					}
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
					const quantity = quantityMap?.get(card.cardId) || 1;
					cell += `<strong>${quantity}</strong>`;
					break;
			}
			cell += '</td>';
			table += cell;
		}
		table += `</tr>`;
	}

	table += `</table>` +
		`</div>`;
	return table;
}

/**
 * Build a responsive card grid for visual card display
 */
export function buildCardGrid(
	cards: TCGCard[],
	options: {
		maxHeight?: string;
		cardsPerRow?: number;
		showRarity?: boolean;
		clickable?: boolean;
	} = {}
): string {
	const {
		maxHeight = PAGINATION_CONFIG.MAX_HEIGHT,
		cardsPerRow = 4,
		showRarity = true,
		clickable = true
	} = options;
	
	const cardWidth = Math.floor(100 / cardsPerRow) - 2; // Account for margins
	
	let grid = `<div style="max-height: ${maxHeight}; overflow-y: auto;">` +
		`<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">`;
	
	for (const card of cards) {
		const rarityColor = getRarityColor(card.rarity);
		const cardStyle = `` +
			`width: ${cardWidth}%; ` +
			`min-width: 150px; ` +
			`border: 2px solid ${rarityColor}; ` +
			`border-radius: 8px; ` +
			`padding: 10px; ` +
			`background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(0,0,0,0.05)); ` +
			`text-align: center; ` +
			(clickable ? 'cursor: pointer;' : '');
		
		const cardElement = clickable 
			? `<button name="send" value="/tcg card ${card.cardId}" style="background: none; border: none; padding: 0; width: 100%;">`
			: '<div>';
		
		const cardCloseElement = clickable ? '</button>' : '</div>';
		
		grid += `` +
			cardElement +
			`<div style="${cardStyle}">` +
				`<div style="font-weight: bold; margin-bottom: 5px;">${card.name}</div>` +
				(showRarity ? `<div style="color: ${rarityColor}; font-size: 12px; margin-bottom: 5px;">${card.rarity}</div>` : '') +
				`<div style="font-size: 11px; color: #666;">${card.set}</div>` +
				(card.hp ? `<div style="font-size: 11px; margin-top: 3px;">HP: ${card.hp}</div>` : '') +
			`</div>` +
			cardCloseElement;
	}
	
	grid += `</div>` +
		`</div>`;
	return grid;
}

/**
 * Build a stats summary box
 */
export function buildStatsSummary(stats: {
	[key: string]: string | number;
}): string {
	let summary = `<div style="background: rgba(52, 152, 219, 0.1); border-radius: 8px; padding: 15px; margin: 10px 0;">` +
		`<div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">`;
	
	for (const [key, value] of Object.entries(stats)) {
		summary += `` +
			`<div style="text-align: center; min-width: 100px;">` +
				`<div style="font-size: 18px; font-weight: bold; color: #2c3e50;">${value}</div>` +
				`<div style="font-size: 12px; color: #7f8c8d; text-transform: uppercase;">${key.replace(/([A-Z])/g, ' $1').trim()}</div>` +
			`</div>`;
	}
	
	summary += `</div>` +
		`</div>`;
	return summary;
}

/**
 * Build a notification/alert box
 */
export function buildAlert(
	message: string,
	type: 'success' | 'warning' | 'error' | 'info' = 'info',
	dismissible: boolean = false
): string {
	const styles = {
		success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724', icon: '✅' },
		warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404', icon: '⚠️' },
		error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24', icon: '❌' },
		info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460', icon: 'ℹ️' }
	};
	
	const style = styles[type];
	
	return `` +
		`<div style="` +
			`background-color: ${style.bg}; ` +
			`border: 1px solid ${style.border}; ` +
			`color: ${style.text}; ` +
			`padding: 12px; ` +
			`border-radius: 6px; ` +
			`margin: 10px 0; ` +
			(dismissible ? 'position: relative;' : '') +
		`">` +
			`<strong>${style.icon} ${message}</strong>` +
			(dismissible ? `<span style="position: absolute; right: 10px; top: 8px; cursor: pointer;">&times;</span>` : '') +
		`</div>`;
}

/**
 * Utility function to escape HTML characters
 */
export function escapeHtml(text: string): string {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

/**
 * Utility function to truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number = 50): string {
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength - 3) + '...';
}

/**
 * Build a loading indicator
 */
export function buildLoadingIndicator(message: string = 'Loading...'): string {
	return `` +
		`<div style="text-align: center; padding: 20px;">` +
			`<div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>` +
			`<div style="margin-top: 10px; color: #666;">${message}</div>` +
		`</div>` +
		`<style>` +
			`@keyframes spin {` +
				`0% { transform: rotate(0deg); }` +
				`100% { transform: rotate(360deg); }` +
			`}` +
		`</style>`;
}

/**
 * Build a tooltip wrapper
 */
export function buildTooltip(content: string, tooltipText: string): string {
	return `<span title="${escapeHtml(tooltipText)}">${content}</span>`;
}
