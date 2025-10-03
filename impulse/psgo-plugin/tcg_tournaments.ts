/**
 * TCG Tournament Module
 * Handles tournament creation, management, and bracket-style elimination battles.
 * Modified to support a single active tournament at a time.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import * as TCG_Economy from './tcg_economy';
import * as TCG_UI from './tcg_ui';
import { TCGCards } from './tcg_collections';
import { TCGCard, POKEMON_SETS } from './tcg_data';
import { getRarityColor } from './tcg_data';

// --- STATE & CONSTANTS ---
const matchTimers = new Map<string, NodeJS.Timeout>();

// --- TYPE INTERFACES ---

export interface TournamentParticipant {
	userId: string;
	username: string;
	joinedAt: number;
	eliminated: boolean;
	placement?: number;
}

export interface TournamentMatch {
	matchId: string;
	player1: string;
	player2: string;
	player1Ready?: boolean;
	player2Ready?: boolean;
	timeRemaining?: number;
	timerStarted?: number;
	winner?: string;
	player1Pack?: string[];
	player2Pack?: string[];
	player1Points?: number;
	player2Points?: number;
	completedAt?: number;
}

export interface Tournament {
	_id?: any;
	name: string;
	host: string;
	entryFee: number;
	setId: string;
	maxParticipants: number;
	participants: TournamentParticipant[];
	prizePool: number;
	status: 'registration' | 'in_progress' | 'completed';
	currentRound: number;
	matches: TournamentMatch[];
	bracketHistory: TournamentMatch[][];
	winner?: string;
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
}

// MongoDB Collection
export const Tournaments = MongoDB<Tournament>('tcg_tournaments');

// --- HELPER FUNCTIONS ---

function generateMatchId(round: number, matchNum: number): string {
	// FIX: Standardize to lowercase to prevent case-sensitivity issues with toID()
	return `r${round}m${matchNum}`;
}

function isPowerOfTwo(n: number): boolean {
	return n > 0 && (n & (n - 1)) === 0;
}

function getCardPoints(card: TCGCard): number {
	switch (card.rarity) {
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
		case 'Rare ex': return 60;
		case 'Radiant Rare': return 60;
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

async function generatePack(setId: string): Promise<TCGCard[] | null> {
	const setCards = await TCGCards.find({ set: setId });
	if (setCards.length === 0) return null;

	const commons = setCards.filter(c => c.rarity === 'Common');
	const uncommons = setCards.filter(c => c.rarity === 'Uncommon');
	const raresPool = setCards.filter(c => c.rarity.includes('Rare'));

	const pack: TCGCard[] = [];
	const usedCardIds = new Set<string>();

	const pickRandom = (pool: TCGCard[]): TCGCard => {
		let attempts = 0;
		while (attempts < 50) {
			const randomCard = pool[Math.floor(Math.random() * pool.length)];
			if (!pool.length || !randomCard) break;
			if (!usedCardIds.has(randomCard.cardId)) {
				usedCardIds.add(randomCard.cardId);
				return randomCard;
			}
			attempts++;
		}
		return pool[Math.floor(Math.random() * pool.length)];
	};

	if (commons.length === 0 || uncommons.length === 0 || raresPool.length === 0) {
		if (setCards.length < 10) return setCards;
		for (let i = 0; i < 10; i++) pack.push(pickRandom(setCards));
		return pack;
	}
	
	const reverseHoloPool = [...commons, ...uncommons];

	for (let i = 0; i < 5; i++) pack.push(pickRandom(commons));
	for (let i = 0; i < 3; i++) pack.push(pickRandom(uncommons));
	pack.push(pickRandom(reverseHoloPool));

	const hitRoll = Math.random() * 100;
	let chosenRarityTier: string;

	if (hitRoll <= 50) chosenRarityTier = 'Rare';
	else if (hitRoll <= 75) chosenRarityTier = 'Rare Holo';
	else if (hitRoll <= 90) {
		const ultraRares = ['Rare Ultra', 'Illustration Rare', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR'];
		chosenRarityTier = ultraRares[Math.floor(Math.random() * ultraRares.length)];
	} else {
		const secretRares = ['Rare Secret', 'Special Illustration Rare', 'Hyper Rare', 'Rare Rainbow'];
		chosenRarityTier = secretRares[Math.floor(Math.random() * secretRares.length)];
	}

	let hitPool = raresPool.filter(c => c.rarity === chosenRarityTier);
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare Holo');
	if (hitPool.length === 0) hitPool = raresPool.filter(c => c.rarity === 'Rare');
	if (hitPool.length === 0) hitPool = raresPool;

	pack.push(pickRandom(hitPool));
	return pack;
}

// --- TOURNAMENT MANAGEMENT FUNCTIONS ---

export async function createTournament(
	name: string,
	host: string,
	entryFee: number,
	setId: string,
	maxParticipants: number,
	prizePool?: number,
): Promise<{ success: boolean; error?: string }> {
	const existingTournament = await Tournaments.findOne({ 
		status: { $in: ['registration', 'in_progress'] } 
	});

	if (existingTournament) {
		return { success: false, error: 'There is already an active tournament. Please wait for it to finish.' };
	}

	if (!name || name.length < 3) {
		return { success: false, error: 'Tournament name must be at least 3 characters.' };
	}

	if (entryFee < 0) {
		return { success: false, error: 'Entry fee cannot be negative.' };
	}

	if (!isPowerOfTwo(maxParticipants) || maxParticipants < 4 || maxParticipants > 64) {
		return { success: false, error: 'Max participants must be a power of 2 (4, 8, 16, 32, or 64).' };
	}

	const setCards = await TCGCards.find({ set: setId });
	if (setCards.length === 0) {
		return { success: false, error: `Set "${setId}" not found or has no cards.` };
	}

	const tournament: Tournament = {
		name,
		host,
		entryFee,
		setId,
		maxParticipants,
		participants: [],
		prizePool: (entryFee === 0 && prizePool) ? prizePool : 0,
		status: 'registration',
		currentRound: 0,
		matches: [],
		bracketHistory: [],
		createdAt: Date.now(),
	};

	await Tournaments.insertOne(tournament);

	return { success: true };
}

export async function joinTournament(
	userId: string,
	username: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ status: 'registration' });

	if (!tournament) {
		return { success: false, error: 'No tournament registration is currently open.' };
	}

	if (tournament.participants.some(p => p.userId === userId)) {
		return { success: false, error: 'You are already registered for this tournament.' };
	}

	if (tournament.participants.length >= tournament.maxParticipants) {
		return { success: false, error: 'Tournament is full.' };
	}

	if (tournament.entryFee > 0) {
		const canAfford = await TCG_Economy.deductCurrency(userId, tournament.entryFee);
		if (!canAfford) {
			return { success: false, error: `You need ${tournament.entryFee} Credits to join this tournament.` };
		}
		tournament.prizePool += tournament.entryFee;
	}

	tournament.participants.push({
		userId,
		username,
		joinedAt: Date.now(),
		eliminated: false,
	});

	await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });

	return { success: true };
}

export async function leaveTournament(
	userId: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ status: 'registration' });

	if (!tournament) {
		return { success: false, error: 'No tournament registration is currently open.' };
	}

	const participant = tournament.participants.find(p => p.userId === userId);
	if (!participant) {
		return { success: false, error: 'You are not in this tournament.' };
	}

	tournament.participants = tournament.participants.filter(p => p.userId !== userId);
	
	if (tournament.entryFee > 0) {
		tournament.prizePool -= tournament.entryFee;
		await TCG_Economy.grantCurrency(userId, tournament.entryFee);
	}

	await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });

	return { success: true };
}

export async function startTournament(
	hostId: string,
	room: any
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ status: 'registration' });

	if (!tournament) {
		return { success: false, error: 'No tournament registration is currently open.' };
	}

	if (tournament.host !== hostId) {
		return { success: false, error: 'Only the tournament host can start the tournament.' };
	}

	if (!isPowerOfTwo(tournament.participants.length)) {
		return { success: false, error: `Need a power of 2 participants. Currently: ${tournament.participants.length}` };
	}

	if (tournament.participants.length < 2) {
		return { success: false, error: 'Need at least 2 participants to start.' };
	}

	tournament.status = 'in_progress';
	tournament.startedAt = Date.now();
	tournament.currentRound = 1;

	// Shuffle participants
	const shuffled = [...tournament.participants];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	// Create first round matches
	const matches: TournamentMatch[] = [];
	for (let i = 0; i < shuffled.length; i += 2) {
		matches.push({
			matchId: generateMatchId(1, Math.floor(i / 2) + 1),
			player1: shuffled[i].userId,
			player2: shuffled[i + 1].userId,
		});
	}

	tournament.matches = matches;
	tournament.bracketHistory = [matches];

	await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });
	await startMatchTimers(tournament, room);

	return { success: true };
}

async function playMatch(
	matchId: string,
	room: any,
): Promise<void> {
	let tournament = await getActiveTournament();
	if (!tournament || tournament.status !== 'in_progress') return;

	const match = tournament.matches.find(m => m.matchId === matchId);
	if (!match || match.winner) return;

	const [pack1, pack2] = await Promise.all([
		generatePack(tournament.setId),
		generatePack(tournament.setId),
	]);

	if (!pack1 || !pack2) {
		console.error(`Failed to generate packs for match ${matchId}`);
		// In case of pack generation failure, disqualify a random player to not stall the tour
		match.winner = Math.random() < 0.5 ? match.player1 : match.player2;
	} else {
		const points1 = pack1.reduce((sum, card) => sum + getCardPoints(card), 0);
		const points2 = pack2.reduce((sum, card) => sum + getCardPoints(card), 0);
	
		match.player1Pack = pack1.map(c => c.cardId);
		match.player2Pack = pack2.map(c => c.cardId);
		match.player1Points = points1;
		match.player2Points = points2;
	
		if (points1 > points2) {
			match.winner = match.player1;
		} else if (points2 > points1) {
			match.winner = match.player2;
		} else {
			match.winner = Math.random() < 0.5 ? match.player1 : match.player2;
		}
	}

	match.completedAt = Date.now();
	const loserId = match.winner === match.player1 ? match.player2 : match.player1;
	const loser = tournament.participants.find(p => p.userId === loserId);
	if (loser) loser.eliminated = true;

	await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });

	const allMatchesComplete = tournament.matches.every(m => m.winner);
	if (allMatchesComplete) {
		await advanceRound(room);
	}
}

/**
 * Marks a player as ready. If both players become ready, it automatically simulates the match.
 * This is the new, robust function that prevents race conditions.
 */
export async function processPlayerReady(matchId: string, userId: string, room: any): Promise<{
	success: boolean;
	error?: string;
	matchStarted: boolean;
}> {
	// 1. Find the tournament first to get its ID and check state
	const tournament = await getActiveTournament();
	if (!tournament || tournament.status !== 'in_progress') {
		return { success: false, error: 'No active tournament found.', matchStarted: false };
	}

	// 2. Find the specific match in memory to perform initial checks
	const match = tournament.matches.find(m => m.matchId === matchId);
	if (!match) {
		return { success: false, error: 'Match not found.', matchStarted: false };
	}
	if (match.winner) {
		return { success: false, error: 'Match already completed.', matchStarted: false };
	}
	if (match.player1 !== userId && match.player2 !== userId) {
		return { success: false, error: 'You are not in this match.', matchStarted: false };
	}
	
	// Check if player is already marked as ready
	const isPlayer1 = match.player1 === userId;
	if ((isPlayer1 && match.player1Ready) || (!isPlayer1 && match.player2Ready)) {
		return { success: true, matchStarted: false }; // Already ready, do nothing
	}

	// 3. Create an atomic update query for the specific player
	const updateField = isPlayer1 ? "matches.$.player1Ready" : "matches.$.player2Ready";
	
	await Tournaments.updateOne(
		{ _id: tournament._id, "matches.matchId": matchId },
		{ $set: { [updateField]: true } }
	);

	// 4. After updating, re-fetch the tournament to get the latest state for our check
	const updatedTournament = await getActiveTournament();
	if (!updatedTournament) {
		return { success: false, error: 'Tournament disappeared after update.', matchStarted: false };
	}

	const updatedMatch = updatedTournament.matches.find(m => m.matchId === matchId);
	if (!updatedMatch) {
		return { success: false, error: 'Match disappeared after update.', matchStarted: false };
	}

	// 5. Now, perform the check on the guaranteed latest data
	const bothReady = !!(updatedMatch.player1Ready && updatedMatch.player2Ready);

	if (bothReady) {
		// Clear the match timeout timer
		const timerKey = `${tournament._id}-${matchId}`;
		const timer = matchTimers.get(timerKey);
		if (timer) {
			clearTimeout(timer);
			matchTimers.delete(timerKey);
		}
		// Simulate the match
		await playMatch(matchId, room);
		return { success: true, matchStarted: true };
	}
	
	return { success: true, matchStarted: false };
}


async function advanceRound(room: any): Promise<void> {
	const tournament = await getActiveTournament();
	if (!tournament || tournament.status !== 'in_progress') return;

	const winners = tournament.matches
		.filter(m => m.winner)
		.map(m => m.winner!);

	if (winners.length === 1) {
		tournament.status = 'completed';
		tournament.winner = winners[0];
		tournament.completedAt = Date.now();
		await distributePrizes(tournament);
	} else {
		tournament.currentRound++;
		const nextMatches: TournamentMatch[] = [];

		for (let i = 0; i < winners.length; i += 2) {
			nextMatches.push({
				matchId: generateMatchId(tournament.currentRound, Math.floor(i / 2) + 1),
				player1: winners[i],
				player2: winners[i + 1],
			});
		}

		tournament.matches = nextMatches;
		tournament.bracketHistory.push(nextMatches);
		await startMatchTimers(tournament, room);
	}

	await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });
}

async function distributePrizes(tournament: Tournament): Promise<void> {
	if (!tournament.winner || tournament.prizePool <= 0) return;

	// Prize distribution: 60% to winner, 30% to runner-up, 10% to semi-finalists
	const winnerPrize = Math.floor(tournament.prizePool * 0.6);
	const runnerUpPrize = Math.floor(tournament.prizePool * 0.3);
	const semiFinalistPrize = Math.floor(tournament.prizePool * 0.05);

	await TCG_Economy.grantCurrency(tournament.winner, winnerPrize);

	// Find runner-up (loser of final match)
	const finalMatch = tournament.bracketHistory[tournament.bracketHistory.length - 1][0];
	const runnerUp = finalMatch.winner === finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;
	await TCG_Economy.grantCurrency(runnerUp, runnerUpPrize);

	// Find semi-finalists
	if (tournament.bracketHistory.length >= 2) {
		const semiMatches = tournament.bracketHistory[tournament.bracketHistory.length - 2];
		for (const match of semiMatches) {
			if (match.winner) {
				const loser = match.winner === match.player1 ? match.player2 : match.player1;
				if (loser !== runnerUp) {
					await TCG_Economy.grantCurrency(loser, semiFinalistPrize);
				}
			}
		}
	}
}

export async function cancelTournament(
	userId: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await getActiveTournament();
	if (!tournament) {
		return { success: false, error: 'No active tournament found.' };
	}

	if (tournament.host !== userId) {
		return { success: false, error: 'Only the host can cancel the tournament.' };
	}

	for (const match of tournament.matches) {
		const timerKey = `${tournament._id}-${match.matchId}`;
		const timer = matchTimers.get(timerKey);
		if (timer) {
			clearTimeout(timer);
			matchTimers.delete(timerKey);
		}
	}

	for (const participant of tournament.participants) {
		if (tournament.entryFee > 0) {
			await TCG_Economy.grantCurrency(participant.userId, tournament.entryFee);
		}
	}

	await Tournaments.deleteOne({ _id: tournament._id });

	return { success: true };
}

export async function getActiveTournament(): Promise<Tournament | null> {
	return await Tournaments.findOne({ 
		status: { $in: ['registration', 'in_progress'] } 
	});
}

export async function getUserTournamentHistory(userId: string): Promise<Tournament[]> {
	return await Tournaments.find({
		'participants.userId': userId,
		status: 'completed'
	});
}

// --- TIMER & TIMEOUT LOGIC ---

async function startMatchTimers(tournament: Tournament, room: any): Promise<void> {
	for (const match of tournament.matches) {
		const timerKey = `${tournament._id}-${match.matchId}`;
		match.timerStarted = Date.now();
		match.timeRemaining = 60000; // 1 minute
		
		const timer = setTimeout(() => {
			void handleMatchTimeout(tournament._id, match.matchId, room);
		}, 60000);
		
		matchTimers.set(timerKey, timer);
	}
	await Tournaments.updateOne({ _id: tournament._id }, { $set: { matches: tournament.matches } });
}

async function handleMatchTimeout(tournamentId: any, matchId: string, room: any): Promise<void> {
	const tournament = await Tournaments.findById(tournamentId);
	if (!tournament || tournament.status !== 'in_progress') return;

	const match = tournament.matches.find(m => m.matchId === matchId);
	if (!match || match.winner) return;

	let winner: string | undefined;
	let disqualified: string | undefined;
	
	if (match.player1Ready && !match.player2Ready) {
		winner = match.player1;
		disqualified = match.player2;
	} else if (match.player2Ready && !match.player1Ready) {
		winner = match.player2;
		disqualified = match.player1;
	} else {
		winner = Math.random() < 0.5 ? match.player1 : match.player2;
		disqualified = winner === match.player1 ? match.player2 : match.player1;
	}

	if (winner) {
		match.winner = winner;
		match.completedAt = Date.now();
		
		const loserId = winner === match.player1 ? match.player2 : match.player1;
		const loser = tournament.participants.find(p => p.userId === loserId);
		if (loser) loser.eliminated = true;

		await Tournaments.updateOne({ _id: tournament._id }, { $set: tournament });

		const disqualifiedParticipant = tournament.participants.find((p: any) => p.userId === disqualified);
		const winnerParticipant = tournament.participants.find((p: any) => p.userId === winner);
		
		room.add(`|html|<div class="infobox"><strong>Match Timeout:</strong> ${disqualifiedParticipant?.username} was disqualified for inactivity. ${winnerParticipant?.username} advances!</div>`).update();
		
		const allMatchesComplete = tournament.matches.every(m => m.winner);
		if (allMatchesComplete) {
			await advanceRound(room);
		}
		
		const updatedTournament = await Tournaments.findById(tournamentId);
		if (updatedTournament) {
			const updatedHtml = await generateTournamentHTML(updatedTournament);
			room.add(`|uhtmlchange|tournament-active|${updatedHtml}`).update();
		}
	}
}

// --- UI GENERATION ---

export async function generateTournamentHTML(tournament: Tournament): Promise<string> {
	const setInfo = POKEMON_SETS.find(s => toID(s.code) === toID(tournament.setId));
	const displaySetName = setInfo ? setInfo.name : tournament.setId;

	let content = `<div style="margin-bottom: 10px;">`;
	content += `<strong>Host:</strong> ${Impulse.nameColor(tournament.host, true)} | `;
	content += `<strong>Entry Fee:</strong> ${tournament.entryFee} Credits | `;
	content += `<strong>Prize Pool:</strong> ${tournament.prizePool} Credits<br/>`;
	content += `<strong>Set:</strong> ${displaySetName} | `;
	content += `<strong>Status:</strong> ${tournament.status.toUpperCase()} | `;
	content += `<strong>Participants:</strong> ${tournament.participants.length}/${tournament.maxParticipants}`;
	content += `</div>`;

	if (tournament.status === 'registration') {
		content += `<h4>Registered Players:</h4>`;
		if (tournament.participants.length === 0) {
			content += `<p><em>No players registered yet.</em></p>`;
		} else {
			const playerList = tournament.participants.map(p => Impulse.nameColor(p.username, true)).join(', ');
			content += `<p>${playerList}</p>`;
		}

		// This block now contains only static, instructional text for all users.
		content += `<div style="margin-top: 10px;">`;
		content += `<i>Use commands to interact: <code>/tcg tournament join</code>, <code>/tcg tournament leave</code>. The host can use <code>/tcg tournament start</code>.</i>`;
		content += `</div>`;
	}

	if (tournament.status === 'in_progress' || tournament.status === 'completed') {
		content += `<h4>Round ${tournament.currentRound} Matches:</h4>`;
		content += `<table class="themed-table">`;
		content += `<tr class="themed-table-header"><th>Match</th><th>Player 1</th><th>Player 2</th><th>Status</th></tr>`;

		for (const match of tournament.matches) {
			const p1 = tournament.participants.find((p: any) => p.userId === match.player1);
			const p2 = tournament.participants.find((p: any) => p.userId === match.player2);

			content += `<tr class="themed-table-row">`;
			content += `<td>${match.matchId.toUpperCase()}</td>`; // Display as uppercase for readability
			content += `<td>${p1 ? Impulse.nameColor(p1.username, true) : 'Unknown'}</td>`;
			content += `<td>${p2 ? Impulse.nameColor(p2.username, true) : 'Unknown'}</td>`;

			if (match.winner) {
				const winner = tournament.participants.find((p: any) => p.userId === match.winner);
				content += `<td><button name="send" value="/tcg tournament match, ${match.matchId}">Winner: ${winner ? winner.username : 'Unknown'}</button></td>`;
			} else {
				// The status is now the same for everyone, instructing players to use the command.
				content += `<td>In Progress</td>`;
			}
			content += `</tr>`;
		}
		content += `</table>`;
		content += `<div style="margin-top: 5px; text-align: center;"><i>Players in a match use <code>/tcg tournament ready, [match ID]</code> to play.</i></div>`;


		if (tournament.status === 'completed' && tournament.winner) {
			const winner = tournament.participants.find((p: any) => p.userId === tournament.winner);
			content += `<div style="margin-top: 15px; padding: 10px; background: #2ecc7140; border-radius: 5px; text-align: center;">`;
			content += `<h3 style="color: #2ecc71; margin: 0;">Tournament Winner: ${winner ? Impulse.nameColor(winner.username, true) : 'Unknown'}</h3>`;
			content += `</div>`;
		}
	}

	return TCG_UI.buildPage(tournament.name, content);
}

export async function generateMatchResultHTML(tournament: Tournament, matchId: string): Promise<string> {
    let match: TournamentMatch | undefined;
    for (const round of tournament.bracketHistory) {
        const foundMatch = round.find(m => m.matchId === matchId);
        if (foundMatch) {
            match = foundMatch;
            break;
        }
    }

    if (!match || !match.winner) {
        return TCG_UI.buildPage('Error', 'Match not found or not completed.');
    }

	const p1 = tournament.participants.find((p: any) => p.userId === match!.player1);
	const p2 = tournament.participants.find((p: any) => p.userId === match!.player2);
	const winner = tournament.participants.find((p: any) => p.userId === match!.winner);

	const p1Cards = await TCGCards.find({ cardId: { $in: match.player1Pack || [] } });
	const p2Cards = await TCGCards.find({ cardId: { $in: match.player2Pack || [] } });

	p1Cards.sort((a, b) => getCardPoints(b) - getCardPoints(a));
	p2Cards.sort((a, b) => getCardPoints(b) - getCardPoints(a));

	let output = `<div class="infobox">`;
	output += `<h2 style="text-align:center;">Match Results: ${match.matchId.toUpperCase()}</h2>`;
	output += `<table style="width:100%;"><tr>`;
	output += `<td style="width:50%; vertical-align:top; padding-right:5px;">`;
	output += `<strong>${p1 ? Impulse.nameColor(p1.username, true) : 'Player 1'}'s Pack (${match.player1Points} Points)</strong>`;
	output += `<table class="themed-table">`;
	p1Cards.forEach(c => {
		output += `<tr><td><button name="send" value="/tcg card ${c.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${c.name}</button></td><td><span style="color: ${getRarityColor(c.rarity)}">${c.rarity}</span></td></tr>`;
	});
	output += `</table></td>`;
	output += `<td style="width:50%; vertical-align:top; padding-left:5px;">`;
	output += `<strong>${p2 ? Impulse.nameColor(p2.username, true) : 'Player 2'}'s Pack (${match.player2Points} Points)</strong>`;
	output += `<table class="themed-table">`;
	p2Cards.forEach(c => {
		output += `<tr><td><button name="send" value="/tcg card ${c.cardId}" style="background:none; border:none; padding:0; font-weight:bold; color:inherit; text-decoration:underline; cursor:pointer;">${c.name}</button></td><td><span style="color: ${getRarityColor(c.rarity)}">${c.rarity}</span></td></tr>`;
	});
	output += `</table></td></tr></table><hr/>`;
	output += `<h3 style="text-align:center; color:#2ecc71;">${winner ? winner.username : 'Unknown'} wins and advances!</h3>`;
	output += `</div>`;

	return output;
}
