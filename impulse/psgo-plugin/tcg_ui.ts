/**
 * TCG UI Module
 * Contains reusable functions for generating HTML displays for the TCG plugin.
 * Uses unified components for consistent styling and maintainability.
 */

import { TCGCard, PlayerRanking, SimulatedBattle, RankingSeason, SeasonReward } from './tcg_data'; 
import { getRarityColor, getSubtypeColor } from './tcg_data';
import { PAGINATION_CONFIG, SEASON_REWARDS } from './tcg_config';
import * as TCG_Ranking from './tcg_ranking';

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

// ==================== PLAYER STAT COMPONENTS ====================

/**
 * Build a player stat card (for battles)
 */
export function buildPlayerStatCard(params: {
	name: string;
	packValue: number;
	rank: string;
	elo: number;
	eloChange: number;
	credits: number;
	borderRight?: boolean;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { name, packValue, rank, elo, eloChange, credits, borderRight = false, nameColor } = params;
	const rankColor = TCG_Ranking.getRankColor(rank);
	const eloChangeStr = TCG_Ranking.formatEloChange(eloChange);
	const eloColor = eloChange >= 0 ? '#2ecc71' : '#e74c3c';
	const border = borderRight ? 'border-right: 1px solid #ddd;' : '';
	
	return `<td style="width:50%; text-align:center; padding:10px; ${border}">` +
		`<strong>${nameColor(name, true)}</strong><br/>` +
		`Pack Value: <strong>${packValue}</strong> pts<br/>` +
		`<span style="color: ${rankColor};">${rank}</span><br/>` +
		`<span style="color: ${eloColor};">${elo} (${eloChangeStr})</span><br/>` +
		`<span style="color: #f39c12;">+${credits} Credits</span>` +
		`</td>`;
}

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

// ==================== BATTLE RESULT COMPONENTS ====================

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

/**
 * Build ranked battle result display
 */
export function buildRankedBattleResult(params: {
	challengerName: string;
	targetName: string;
	battle: SimulatedBattle;
	challengerRanking: PlayerRanking;
	targetRanking: PlayerRanking;
	challengerPack: TCGCard[];
	targetPack: TCGCard[];
	challengerCredits: number;
	targetCredits: number;
	challengerId: string;
	player1EloMilestones?: { name: string; reward: number }[];
	player2EloMilestones?: { name: string; reward: number }[];
	challengesRemaining: number;
	getCardPoints: (card: TCGCard) => number;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const {
		challengerName, targetName, battle, challengerRanking, targetRanking,
		challengerPack, targetPack, challengerCredits, targetCredits, challengerId,
		player1EloMilestones, player2EloMilestones, challengesRemaining,
		getCardPoints, nameColor
	} = params;

	// Determine result
	let resultText = 'Draw!';
	let resultColor = '#f1c40f';
	if (battle.winner === challengerId) {
		resultText = 'Victory!';
		resultColor = '#2ecc71';
	} else if (battle.winner) {
		resultText = 'Defeat!';
		resultColor = '#e74c3c';
	}

	let output = `<div class="infobox">` +
		`<h2 style="text-align:center;">⚔️ Ranked Challenge Battle</h2>` +
		`<div style="text-align:center; margin: 10px 0;">` +
		`<strong>${nameColor(challengerName, true)}</strong> challenged <strong>${nameColor(targetName, true)}</strong>` +
		`</div>`;

	// Player info cards
	output += `<table style="width:100%; margin: 10px 0;"><tr>` +
		buildPlayerStatCard({
			name: challengerName,
			packValue: battle.challengerPackValue,
			rank: challengerRanking.rank,
			elo: challengerRanking.elo,
			eloChange: battle.challengerEloChange,
			credits: challengerCredits,
			borderRight: true,
			nameColor
		}) +
		buildPlayerStatCard({
			name: targetName,
			packValue: battle.targetPackValue,
			rank: targetRanking.rank,
			elo: targetRanking.elo,
			eloChange: battle.targetEloChange,
			credits: targetCredits,
			nameColor
		}) +
		`</tr></table>`;

	// ELO milestone notifications
	if (player1EloMilestones && player1EloMilestones.length > 0) {
		output += buildNotification(
			`🎉 ${challengerName} achieved: ${player1EloMilestones.map(m => `${m.name} (+${m.reward} Credits)`).join(', ')}`,
			'warning'
		);
	}

	if (player2EloMilestones && player2EloMilestones.length > 0) {
		output += buildNotification(
			`🎉 ${targetName} achieved: ${player2EloMilestones.map(m => `${m.name} (+${m.reward} Credits)`).join(', ')}`,
			'warning'
		);
	}

	// Packs display
	output += `<hr/><table style="width:100%;"><tr>` +
		buildPackDisplay({ playerName: challengerName, pack: challengerPack, totalValue: battle.challengerPackValue, getCardPoints, nameColor }) +
		buildPackDisplay({ playerName: targetName, pack: targetPack, totalValue: battle.targetPackValue, getCardPoints, nameColor }) +
		`</tr></table><hr/>`;

	// Result
	output += `<div style="text-align:center; color: ${resultColor}; font-size: 1.3em; font-weight: bold; margin: 15px 0; padding: 10px; border: 2px solid ${resultColor}; border-radius: 8px;">` +
		resultText +
		`</div>`;

	// Challenge status
	output += `<div style="text-align:center; margin-top: 10px; font-size: 0.9em; color: #666;">` +
		`Challenges remaining today: <strong>${challengesRemaining}/10</strong>` +
		`</div></div>`;

	return output;
}

// ==================== RANKING DISPLAYS ====================

/**
 * Build challenge targets list
 */
export function buildChallengeTargets(params: {
	targets: PlayerRanking[];
	challengesRemaining: number;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { targets, challengesRemaining, nameColor } = params;
	
	let output = buildInfoBox(
		'Available Challenge Targets',
		`<p>Challenges remaining: <strong>${challengesRemaining}/10</strong></p>`
	);

	if (targets.length === 0) {
		return output.replace('</div>', '<p>No available targets. You may have challenged all eligible players today.</p></div>');
	}

	const rows = targets.slice(0, 20).map((target, index) => {
		const rankColor = TCG_Ranking.getRankColor(target.rank);
		const winRate = TCG_Ranking.getWinRate(target.wins, target.losses, target.draws);
		
		return [
			`${index + 1}`,
			nameColor(target.userId, true),
			`<span style="color: ${rankColor};">${target.elo} (${target.rank})</span>`,
			`${target.wins}-${target.losses}-${target.draws} (${winRate}%)`,
			`<button name="send" value="/tcg rankedbattle challenge, ${target.userId}">Challenge</button>`
		];
	});

	const table = buildTable({
		headers: ['Rank', 'Player', 'Rating', 'W-L-D', 'Action'],
		rows
	});

	let footer = targets.length > 20 ? 
		`<p style="text-align:center;">Showing top 20 of ${targets.length} available targets.</p>` : '';

	return output.replace('</div>', table + footer + '</div>');
}

/**
 * Build ranking display
 */
export function buildRankingDisplay(params: {
	username: string;
	ranking: PlayerRanking;
	position: number;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { username, ranking, position, nameColor } = params;
	const rankColor = TCG_Ranking.getRankColor(ranking.rank);
	const winRate = TCG_Ranking.getWinRate(ranking.wins, ranking.losses, ranking.draws);
	
	const rows = [
		['<strong>Rank:</strong>', `<span style="color: ${rankColor}; font-weight: bold;">${ranking.rank}</span>`],
		['<strong>ELO:</strong>', `${ranking.elo}`],
		['<strong>Position:</strong>', `#${position}`],
		['<strong>Win Rate:</strong>', `${winRate}%`],
		['<strong>Record:</strong>', `${ranking.wins}W - ${ranking.losses}L - ${ranking.draws}D`],
		['<strong>Win Streak:</strong>', `${ranking.winStreak} (Best: ${ranking.bestWinStreak})`],
		['<strong>Total Battles:</strong>', `${ranking.totalBattles}`],
		['<strong>Avg Pack Value:</strong>', `${ranking.averagePackValue} pts`],
	];
	
	const table = `<table style="width: 100%;">` +
		rows.map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('') +
		`</table>`;
	
	return buildInfoBox(`${nameColor(username, true)}'s Ranking`, table);
}

/**
 * Build leaderboard display
 */
export function buildLeaderboard(params: {
	leaderboard: PlayerRanking[];
	type: 'elo' | 'seasonal';
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { leaderboard, type, nameColor } = params;
	const title = type === 'seasonal' ? 'Seasonal Leaderboard (Wins)' : 'ELO Leaderboard';
	
	const rows = leaderboard.map((player, index) => {
		const rankColor = TCG_Ranking.getRankColor(player.rank);
		const winRate = TCG_Ranking.getWinRate(player.wins, player.losses, player.draws);
		const displayValue = type === 'seasonal' ? 
			`${player.seasonWins || 0} wins` : 
			`${player.elo} (${player.rank})`;
		
		return [
			`${index + 1}`,
			nameColor(player.userId, true),
			`<span style="color: ${rankColor};">${displayValue}</span>`,
			`${player.wins}W-${player.losses}L-${player.draws}D`,
			`${winRate}%`
		];
	});

	const table = buildTable({
		headers: ['Rank', 'Player', 'Rating/Rank', 'Record', 'Win Rate'],
		rows
	});

	const buttons = `<p style="text-align: center; margin-top: 10px;">` +
		`<button name="send" value="/tcg leaderboard elo">ELO</button> | ` +
		`<button name="send" value="/tcg leaderboard seasonal">Seasonal</button>` +
		`</p>`;
	
	return buildInfoBox(title, table + buttons);
}

/**
 * Build battle history display
 */
export function buildBattleHistory(params: {
	username: string;
	battles: SimulatedBattle[];
	userId: string;
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { username, battles, userId, nameColor } = params;
	
	if (battles.length === 0) {
		return buildInfoBox(
			`${nameColor(username, true)}'s Battle History`,
			`<p>${username} has no ranked battle history.</p>`
		);
	}

	const rows = battles.map(battle => {
		const isChallenger = battle.challengerId === userId;
		const opponent = isChallenger ? battle.targetId : battle.challengerId;
		const playerPackValue = isChallenger ? battle.challengerPackValue : battle.targetPackValue;
		const opponentPackValue = isChallenger ? battle.targetPackValue : battle.challengerPackValue;
		const eloChange = isChallenger ? battle.challengerEloChange : battle.targetEloChange;
		
		let result = 'Draw';
		let resultColor = '#f1c40f';
		if (battle.winner === userId) {
			result = 'Win';
			resultColor = '#2ecc71';
		} else if (battle.winner) {
			result = 'Loss';
			resultColor = '#e74c3c';
		}
		
		const eloChangeStr = TCG_Ranking.formatEloChange(eloChange);
		const eloColor = eloChange >= 0 ? '#2ecc71' : '#e74c3c';
		const date = new Date(battle.timestamp).toLocaleDateString();
		
		return [
			nameColor(opponent, true),
			`<span style="color: ${resultColor};">${result}</span>`,
			`<span style="color: ${eloColor};">${eloChangeStr}</span>`,
			`${playerPackValue} vs ${opponentPackValue}`,
			date
		];
	});

	const table = buildTable({
		headers: ['Opponent', 'Result', 'ELO Change', 'Pack Values', 'Date'],
		rows
	});

	return buildInfoBox(`${nameColor(username, true)}'s Battle History`, table);
}

// ==================== SEASON DISPLAYS ====================

/**
 * Build season info display
 */
export function buildSeasonInfo(params: {
	season: RankingSeason;
	daysRemaining: number;
	hoursRemaining: number;
}): string {
	const { season, daysRemaining, hoursRemaining } = params;
	
	const info = `<p><strong>Time Remaining:</strong> ${daysRemaining} days, ${hoursRemaining} hours</p>` +
		`<p><strong>Started:</strong> ${new Date(season.startTime).toLocaleDateString()}</p>` +
		`<p><strong>Ends:</strong> ${new Date(season.endTime).toLocaleDateString()}</p>`;
	
	const rows = Object.entries(SEASON_REWARDS).map(([rank, reward]) => [
		`#${rank}`,
		`${reward.credits}`,
		reward.title
	]);

	const table = `<h4>Season Rewards (Top 10)</h4>` + buildTable({
		headers: ['Rank', 'Credits', 'Title'],
		rows
	});

	return buildInfoBox(`🏆 ${season.name}`, info + buildScrollableContainer(table));
}

/**
 * Build season history display
 */
export function buildSeasonHistory(params: {
	username: string;
	seasonRewards: SeasonReward[];
	nameColor: (name: string, withLink: boolean) => string;
}): string {
	const { username, seasonRewards, nameColor } = params;
	
	if (seasonRewards.length === 0) {
		return buildInfoBox(
			`${nameColor(username, true)}'s Season History`,
			`<p>${username} has not received any season rewards yet.</p>`
		);
	}

	const rows = seasonRewards.map(reward => {
		const date = new Date(reward.claimedAt).toLocaleDateString();
		return [
			reward.seasonId.replace(/season_(\d+)_.*/, 'Season $1'),
			`#${reward.rank}`,
			`${reward.credits}`,
			reward.title || '-',
			date
		];
	});

	const table = buildTable({
		headers: ['Season', 'Rank', 'Credits', 'Title', 'Date'],
		rows
	});

	return buildInfoBox(`${nameColor(username, true)}'s Season History`, table);
}
