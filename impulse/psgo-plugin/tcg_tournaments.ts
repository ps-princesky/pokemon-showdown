/**
 * TCG Tournament Module
 * Handles tournament creation, management, and bracket-style elimination battles.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import * as TCG_Economy from './tcg_economy';
import * as TCG_UI from './tcg_ui';
import { TCGCards } from './tcg_collections';
import { TCGCard } from './tcg_data';

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
	_id?: string;
	tournamentId: string;
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

function generateTournamentId(): string {
	return `TCGT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function generateMatchId(tournamentId: string, round: number, matchNum: number): string {
	return `${tournamentId}-R${round}-M${matchNum}`;
}

function isPowerOfTwo(n: number): boolean {
	return n > 0 && (n & (n - 1)) === 0;
}

export async function setPlayerReady(
	tournamentId: string,
	matchId: string,
	userId: string
): Promise<{ success: boolean; error?: string; bothReady?: boolean }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	const match = tournament.matches.find(m => m.matchId === matchId);
	if (!match) {
		return { success: false, error: 'Match not found.' };
	}

	if (match.winner) {
		return { success: false, error: 'Match already completed.' };
	}

	if (match.player1 !== userId && match.player2 !== userId) {
		return { success: false, error: 'You are not in this match.' };
	}

	if (match.player1 === userId) {
		match.player1Ready = true;
	} else {
		match.player2Ready = true;
	}

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });

	const bothReady = match.player1Ready && match.player2Ready;

	return { success: true, bothReady };
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
	maxParticipants: number
): Promise<{ success: boolean; tournamentId?: string; error?: string }> {
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

	const tournamentId = generateTournamentId();

	const tournament: Tournament = {
		tournamentId,
		name,
		host,
		entryFee,
		setId,
		maxParticipants,
		participants: [],
		prizePool: 0,
		status: 'registration',
		currentRound: 0,
		matches: [],
		bracketHistory: [],
		createdAt: Date.now(),
	};

	await Tournaments.insertOne(tournament);

	return { success: true, tournamentId };
}

export async function joinTournament(
	tournamentId: string,
	userId: string,
	username: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	if (tournament.status !== 'registration') {
		return { success: false, error: 'Tournament is not accepting registrations.' };
	}

	if (tournament.participants.some(p => p.userId === userId)) {
		return { success: false, error: 'You are already registered for this tournament.' };
	}

	if (tournament.participants.length >= tournament.maxParticipants) {
		return { success: false, error: 'Tournament is full.' };
	}

	const canAfford = await TCG_Economy.deductCurrency(userId, tournament.entryFee);
	if (!canAfford) {
		return { success: false, error: `You need ${tournament.entryFee} Credits to join this tournament.` };
	}

	tournament.participants.push({
		userId,
		username,
		joinedAt: Date.now(),
		eliminated: false,
	});

	tournament.prizePool += tournament.entryFee;

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });

	return { success: true };
}

export async function leaveTournament(
	tournamentId: string,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	if (tournament.status !== 'registration') {
		return { success: false, error: 'Cannot leave after tournament has started.' };
	}

	const participant = tournament.participants.find(p => p.userId === userId);
	if (!participant) {
		return { success: false, error: 'You are not in this tournament.' };
	}

	tournament.participants = tournament.participants.filter(p => p.userId !== userId);
	tournament.prizePool -= tournament.entryFee;

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });
	await TCG_Economy.grantCurrency(userId, tournament.entryFee);

	return { success: true };
}

export async function startTournament(
	tournamentId: string,
	hostId: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	if (tournament.host !== hostId) {
		return { success: false, error: 'Only the tournament host can start the tournament.' };
	}

	if (tournament.status !== 'registration') {
		return { success: false, error: 'Tournament has already started or is completed.' };
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
			matchId: generateMatchId(tournamentId, 1, Math.floor(i / 2) + 1),
			player1: shuffled[i].userId,
			player2: shuffled[i + 1].userId,
		});
	}

	tournament.matches = matches;
	tournament.bracketHistory = [matches];

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });

	return { success: true };
}

export async function playMatch(
	tournamentId: string,
	matchId: string
): Promise<{ success: boolean; error?: string; winner?: string; matchData?: TournamentMatch }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	if (tournament.status !== 'in_progress') {
		return { success: false, error: 'Tournament is not in progress.' };
	}

	const match = tournament.matches.find(m => m.matchId === matchId);
	if (!match) {
		return { success: false, error: 'Match not found.' };
	}

	if (match.winner) {
		return { success: false, error: 'Match has already been played.' };
	}

	// Generate packs for both players
	const [pack1, pack2] = await Promise.all([
		generatePack(tournament.setId),
		generatePack(tournament.setId),
	]);

	if (!pack1 || !pack2) {
		return { success: false, error: 'Failed to generate packs for the match.' };
	}

	const points1 = pack1.reduce((sum, card) => sum + getCardPoints(card), 0);
	const points2 = pack2.reduce((sum, card) => sum + getCardPoints(card), 0);

	match.player1Pack = pack1.map(c => c.cardId);
	match.player2Pack = pack2.map(c => c.cardId);
	match.player1Points = points1;
	match.player2Points = points2;
	match.completedAt = Date.now();

	// Determine winner (no ties in tournaments)
	if (points1 > points2) {
		match.winner = match.player1;
	} else if (points2 > points1) {
		match.winner = match.player2;
	} else {
		// Tiebreaker: coin flip
		match.winner = Math.random() < 0.5 ? match.player1 : match.player2;
	}

	// Mark loser as eliminated
	const loserId = match.winner === match.player1 ? match.player2 : match.player1;
	const loser = tournament.participants.find(p => p.userId === loserId);
	if (loser) loser.eliminated = true;

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });

	// Check if round is complete
	const allMatchesComplete = tournament.matches.every(m => m.winner);
	if (allMatchesComplete) {
		await advanceRound(tournamentId);
	}

	return { success: true, winner: match.winner, matchData: match };
}

async function advanceRound(tournamentId: string): Promise<void> {
	const tournament = await Tournaments.findOne({ tournamentId });
	if (!tournament) return;

	const winners = tournament.matches
		.filter(m => m.winner)
		.map(m => m.winner!);

	if (winners.length === 1) {
		// Tournament complete
		tournament.status = 'completed';
		tournament.winner = winners[0];
		tournament.completedAt = Date.now();

		// Distribute prizes
		await distributePrizes(tournament);
	} else {
		// Create next round
		tournament.currentRound++;
		const nextMatches: TournamentMatch[] = [];

		for (let i = 0; i < winners.length; i += 2) {
			nextMatches.push({
				matchId: generateMatchId(tournamentId, tournament.currentRound, Math.floor(i / 2) + 1),
				player1: winners[i],
				player2: winners[i + 1],
			});
		}

		tournament.matches = nextMatches;
		tournament.bracketHistory.push(nextMatches);
	}

	await Tournaments.updateOne({ tournamentId }, { $set: tournament });
}

async function distributePrizes(tournament: Tournament): Promise<void> {
	if (!tournament.winner) return;

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
	tournamentId: string,
	userId: string
): Promise<{ success: boolean; error?: string }> {
	const tournament = await Tournaments.findOne({ tournamentId });

	if (!tournament) {
		return { success: false, error: 'Tournament not found.' };
	}

	if (tournament.host !== userId) {
		return { success: false, error: 'Only the host can cancel the tournament.' };
	}

	if (tournament.status === 'completed') {
		return { success: false, error: 'Cannot cancel a completed tournament.' };
	}

	// Refund all participants
	for (const participant of tournament.participants) {
		await TCG_Economy.grantCurrency(participant.userId, tournament.entryFee);
	}

	await Tournaments.deleteOne({ tournamentId });

	return { success: true };
}

export async function getTournamentDetails(tournamentId: string): Promise<Tournament | null> {
	return await Tournaments.findOne({ tournamentId });
}

export async function listActiveTournaments(): Promise<Tournament[]> {
	return await Tournaments.find({
		status: { $in: ['registration', 'in_progress'] }
	});
}

export async function getUserTournamentHistory(userId: string): Promise<Tournament[]> {
	return await Tournaments.find({
		'participants.userId': userId,
		status: 'completed'
	});
}
