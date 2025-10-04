/**
 * Pokemon TCG System Configuration
 * Centralized configuration file for all TCG system constants and settings
 * @license MIT
 */

// ==================== SHOP CONFIGURATION ====================
export const SHOP_CONFIG = {
	/** Price of each pack in the shop (in credits) */
	PACK_PRICE: 100,
	/** How often shop stock rotates (in hours) */
	ROTATION_HOURS: 24,
	/** Number of different packs available in shop at once */
	PACK_SLOTS: 5,
} as const;

// ==================== DAILY REWARDS ====================
export const DAILY_CONFIG = {
	/** Credits awarded for daily pack claim */
	CURRENCY_AWARD: 75,
	/** Cooldown between daily claims (in hours) */
	COOLDOWN_HOURS: 24,
} as const;

// ==================== PACK GENERATION ====================
export const PACK_CONFIG = {
	/** Default number of cards in a pack */
	PACK_SIZE: 10,
	/** Number of common cards in a pack */
	COMMONS_PER_PACK: 5,
	/** Number of uncommon cards in a pack */
	UNCOMMONS_PER_PACK: 3,
	/** Number of reverse holo slots */
	REVERSE_HOLO_SLOTS: 1,
	/** Number of rare/ultra rare slots */
	RARE_SLOTS: 1,
	/** Pack rarity distribution percentages */
	RARITY_RATES: {
		RARE: 50,           // 50% chance for basic rare
		RARE_HOLO: 25,      // 25% chance for rare holo  
		ULTRA_RARE: 15,     // 15% chance for ultra rare
		SECRET_RARE: 10,    // 10% chance for secret rare
	},
	/** Ultra rare pool */
	ULTRA_RARES: ['Rare Ultra', 'Illustration Rare', 'Rare Holo V', 'Rare Holo VMAX', 'Rare Holo VSTAR'],
	/** Secret rare pool */
	SECRET_RARES: ['Rare Secret', 'Special Illustration Rare', 'Hyper Rare', 'Rare Rainbow'],
	/** Maximum attempts to find unique cards in pack */
	MAX_UNIQUE_ATTEMPTS: 50,
	/** Minimum pack value variance percentage */
	MIN_VARIANCE: -0.15,
	/** Maximum pack value variance percentage */
	MAX_VARIANCE: 0.15,
	/** Minimum pack value floor */
	MIN_PACK_VALUE: 50,
} as const;

// ==================== BATTLE CONFIGURATION ====================
export const BATTLE_CONFIG = {
	/** Battle challenge timeout (in minutes) */
	TIMEOUT_MINUTES: 2,
	/** Maximum wager amount */
	MAX_WAGER: 10000,
	/** Minimum wager amount */
	MIN_WAGER: 1,

	// NEW: Battle simulator settings
	ENABLE_TYPE_EFFECTIVENESS: true,    // Use weakness/resistance
	ENABLE_ABILITIES: false,             // Abilities in Phase 2
	ENABLE_STATUS_CONDITIONS: false,     // Status in Phase 2
	
	// Battle simulation
	MAX_TURNS: 10,                       // Maximum turns per battle
	STARTING_ENERGY: 3,                  // Starting energy per Pokemon
	ENERGY_PER_TURN: 1,                  // Energy gained per turn
	
	// Type effectiveness multipliers
	WEAKNESS_MULTIPLIER: 2.0,            // ×2 damage
	RESISTANCE_REDUCTION: 20,            // -20 damage
	
	// Speed advantage
	SPEED_ADVANTAGE_THRESHOLD: 20,
} as const;

export const TYPE_CHART = {
	// Pokemon type names for matching
	TYPES: [
		'Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting',
		'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'
	],
} as const;

// ==================== RANKING SYSTEM ====================
export const RANKING_CONFIG = {
	/** Starting ELO for new players */
	DEFAULT_ELO: 1000,
	/** ELO calculation K-factor */
	K_FACTOR: 32,
	/** Number of daily ranked challenges allowed */
	DAILY_CHALLENGES_LIMIT: 10,
	/** Number of battles with full credit rewards */
	DAILY_CREDIT_BATTLES_LIMIT: 7,
	/** Credit multiplier for battles beyond the limit */
	REDUCED_REWARD_MULTIPLIER: 0.3,
	/** Season duration in days */
	SEASON_DURATION_DAYS: 30,
	/** ELO decay threshold (days of inactivity) */
	DECAY_THRESHOLD_DAYS: 14,
	/** ELO decay amount */
	DECAY_AMOUNT: 25,
	/** Challenge target search range */
	LEADERBOARD_CHALLENGE_RANGE: 50,
} as const;

// ==================== RANK THRESHOLDS ====================
export const RANK_THRESHOLDS = {
	'Bronze III': 0,
	'Bronze II': 800,
	'Bronze I': 900,
	'Silver III': 1000,
	'Silver II': 1100,
	'Silver I': 1200,
	'Gold III': 1300,
	'Gold II': 1400,
	'Gold I': 1500,
	'Platinum III': 1600,
	'Platinum II': 1700,
	'Platinum I': 1800,
	'Diamond III': 1900,
	'Diamond II': 2000,
	'Diamond I': 2100,
	'Master': 2200,
	'Grandmaster': 2400,
} as const;

// ==================== RANK COLORS ====================
export const RANK_COLORS = {
	'Bronze III': '#CD7F32', 'Bronze II': '#CD7F32', 'Bronze I': '#CD7F32',
	'Silver III': '#C0C0C0', 'Silver II': '#C0C0C0', 'Silver I': '#C0C0C0',
	'Gold III': '#FFD700', 'Gold II': '#FFD700', 'Gold I': '#FFD700',
	'Platinum III': '#E5E4E2', 'Platinum II': '#E5E4E2', 'Platinum I': '#E5E4E2',
	'Diamond III': '#B9F2FF', 'Diamond II': '#B9F2FF', 'Diamond I': '#B9F2FF',
	'Master': '#FF6B6B', 'Grandmaster': '#9B59B6',
} as const;

// ==================== BATTLE REWARDS ====================
export const RANKED_BATTLE_REWARDS = {
	/** Credits for winning a ranked battle */
	win: 8,
	/** Credits for losing a ranked battle */
	loss: 3,
	/** Credits for drawing a ranked battle */
	draw: 5,
} as const;

// ==================== SEASON REWARDS ====================
export const SEASON_REWARDS = {
	1: { credits: 500, title: 'Grandmaster Champion' },
	2: { credits: 400, title: 'Elite Duelist' },
	3: { credits: 325, title: 'Master Tactician' },
	4: { credits: 275, title: 'Legendary Trainer' },
	5: { credits: 225, title: 'Expert Battler' },
	6: { credits: 185, title: 'Skilled Challenger' },
	7: { credits: 150, title: 'Rising Star' },
	8: { credits: 125, title: 'Promising Duelist' },
	9: { credits: 100, title: 'Dedicated Trainer' },
	10: { credits: 75, title: 'Top Competitor' },
} as const;

// ==================== ELO MILESTONE REWARDS ====================
export const ELO_MILESTONE_REWARDS = {
	'silver_iii': { elo: 1000, reward: 100, name: 'Silver Promotion' },
	'silver_i': { elo: 1200, reward: 150, name: 'High Silver' },
	'gold_iii': { elo: 1300, reward: 200, name: 'Gold Promotion' },
	'gold_i': { elo: 1500, reward: 300, name: 'High Gold' },
	'platinum_iii': { elo: 1600, reward: 400, name: 'Platinum Promotion' },
	'platinum_i': { elo: 1800, reward: 600, name: 'High Platinum' },
	'diamond_iii': { elo: 1900, reward: 800, name: 'Diamond Promotion' },
	'diamond_i': { elo: 2100, reward: 1000, name: 'High Diamond' },
	'master': { elo: 2200, reward: 1500, name: 'Master Rank' },
	'grandmaster': { elo: 2400, reward: 2000, name: 'Grandmaster Rank' },
} as const;

// ==================== WEEKLY MILESTONES ====================
export const WEEKLY_MILESTONES = {
	// Battle Milestones
	battles_5: { 
		requirement: 5, 
		type: 'rankedBattles' as const, 
		reward: 50, 
		name: 'Battler', 
		description: 'Complete 5 ranked battles' 
	},
	battles_15: { 
		requirement: 15, 
		type: 'rankedBattles' as const, 
		reward: 100, 
		name: 'Warrior', 
		description: 'Complete 15 ranked battles' 
	},
	battles_30: { 
		requirement: 30, 
		type: 'rankedBattles' as const, 
		reward: 200, 
		name: 'Champion', 
		description: 'Complete 30 ranked battles' 
	},
	
	// Win Milestones
	wins_3: { 
		requirement: 3, 
		type: 'rankedWins' as const, 
		reward: 40, 
		name: 'Victor', 
		description: 'Win 3 ranked battles' 
	},
	wins_10: { 
		requirement: 10, 
		type: 'rankedWins' as const, 
		reward: 80, 
		name: 'Dominator', 
		description: 'Win 10 ranked battles' 
	},
	wins_20: { 
		requirement: 20, 
		type: 'rankedWins' as const, 
		reward: 150, 
		name: 'Unbeatable', 
		description: 'Win 20 ranked battles' 
	},
	
	// Pack Purchase Milestones
	packs_3: { 
		requirement: 3, 
		type: 'packsPurchased' as const, 
		reward: 30, 
		name: 'Collector', 
		description: 'Purchase 3 packs from shop' 
	},
	packs_7: { 
		requirement: 7, 
		type: 'packsPurchased' as const, 
		reward: 70, 
		name: 'Enthusiast', 
		description: 'Purchase 7 packs from shop' 
	},
	
	// Pack Opening Milestones
	opened_5: { 
		requirement: 5, 
		type: 'packsOpened' as const, 
		reward: 25, 
		name: 'Pack Hunter', 
		description: 'Open 5 packs' 
	},
	opened_15: { 
		requirement: 15, 
		type: 'packsOpened' as const, 
		reward: 75, 
		name: 'Pack Master', 
		description: 'Open 15 packs' 
	},
	
	// Credit Earning Milestones
	credits_200: { 
		requirement: 200, 
		type: 'creditsEarned' as const, 
		reward: 50, 
		name: 'Earner', 
		description: 'Earn 200 credits from battles' 
	},
	credits_500: { 
		requirement: 500, 
		type: 'creditsEarned' as const, 
		reward: 100, 
		name: 'Rich', 
		description: 'Earn 500 credits from battles' 
	},
} as const;

// ==================== PAGINATION SETTINGS ====================
export const PAGINATION_CONFIG = {
	/** Cards per page in search results */
	CARDS_PER_PAGE: 60,
	/** Default leaderboard size */
	LEADERBOARD_SIZE: 10,
	/** Default battle history size */
	BATTLE_HISTORY_SIZE: 10,
	/** Collection display limit */
	COLLECTION_DISPLAY_LIMIT: 100,
	/** Maximum scrollable container height */
	MAX_HEIGHT: '360px',
	/** Items per page for various listings */
	DEFAULT_PER_PAGE: 30,
	/** Maximum items per page */
	MAX_PER_PAGE: 100,
} as const;

// ==================== UI/UX CONFIGURATION ====================
export const UI_CONFIG = {
	/** Loading message timeout */
	LOADING_TIMEOUT_MS: 10000,
	/** Cache TTL for UI elements */
	CACHE_TTL_MS: 300000, // 5 minutes
	/** Animation durations */
	ANIMATION_DURATION_MS: 300,
	/** Progress bar colors */
	PROGRESS_COLORS: {
		DEFAULT: '#2ecc71',
		SUCCESS: '#27ae60',
		WARNING: '#f39c12',
		DANGER: '#e74c3c',
		INFO: '#3498db',
		CLAIMED: '#95a5a6',
	},
	/** Button styles */
	BUTTON_STYLES: {
		PRIMARY: 'background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;',
		SUCCESS: 'background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;',
		WARNING: 'background: #f39c12; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;',
		DANGER: 'background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;',
		DISABLED: 'background: #95a5a6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: not-allowed;',
	},
} as const;

// ==================== VALIDATION LIMITS ====================
export const VALIDATION_LIMITS = {
	/** Maximum card ID length */
	MAX_CARD_ID_LENGTH: 50,
	/** Maximum username length */
	MAX_USERNAME_LENGTH: 18,
	/** Maximum input length for sanitization */
	MAX_INPUT_LENGTH: 100,
	/** Maximum search query length */
	MAX_SEARCH_LENGTH: 200,
	/** Maximum currency amount */
	MAX_CURRENCY_AMOUNT: 1000000,
	/** Minimum currency amount */
	MIN_CURRENCY_AMOUNT: 1,
	/** Maximum description length */
	MAX_DESCRIPTION_LENGTH: 500,
	/** Maximum card name length */
	MAX_CARD_NAME_LENGTH: 100,
	/** Regular expressions for validation */
	REGEX: {
		CARD_ID: /^[a-zA-Z0-9\-_]+$/,
		USERNAME: /^[a-zA-Z0-9\-_]+$/,
		HEX_COLOR: /^#([A-Fa-f0-9]{3}){1,2}$/,
	},
} as const;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
	// Generic errors
	INVALID_INPUT: 'Invalid input provided',
	PERMISSION_DENIED: 'You do not have permission to perform this action',
	DATABASE_ERROR: 'A database error occurred. Please try again later',
	NETWORK_ERROR: 'Network error. Please check your connection',
	TIMEOUT_ERROR: 'Request timed out. Please try again',
	
	// User errors
	USER_NOT_FOUND: 'User not found',
	INVALID_USERNAME: 'Invalid username format',
	SELF_ACTION_ERROR: 'You cannot perform this action on yourself',
	
	// Currency errors
	INSUFFICIENT_CREDITS: 'Insufficient credits',
	INVALID_AMOUNT: 'Invalid amount specified',
	TRANSFER_FAILED: 'Currency transfer failed',
	
	// Card/Collection errors
	CARD_NOT_FOUND: 'Card not found',
	INVALID_CARD_ID: 'Invalid card ID format',
	COLLECTION_EMPTY: 'Collection is empty',
	SET_NOT_FOUND: 'Set not found',
	
	// Battle errors
	BATTLE_COOLDOWN: 'Please wait before challenging again',
	ALREADY_IN_BATTLE: 'Already in a battle or challenge',
	INVALID_WAGER: 'Invalid wager amount',
	NO_CHALLENGES_REMAINING: 'No challenges remaining today',
	TARGET_ALREADY_CHALLENGED: 'You have already challenged this player today',
	
	// Shop errors
	SHOP_EMPTY: 'Shop is currently empty',
	ITEM_NOT_IN_STOCK: 'Item not currently in stock',
	ALREADY_CLAIMED: 'Already claimed today',
	
	// Pack errors
	NO_PACKS: 'No unopened packs available',
	PACK_GENERATION_FAILED: 'Failed to generate pack',
	SET_UNAVAILABLE: 'Set is not available',
} as const;

// ==================== SUCCESS MESSAGES ====================
export const SUCCESS_MESSAGES = {
	// Generic success
	ACTION_COMPLETED: 'Action completed successfully',
	DATA_SAVED: 'Data saved successfully',
	DATA_UPDATED: 'Data updated successfully',
	
	// Currency messages
	CURRENCY_GRANTED: 'Credits granted successfully',
	CURRENCY_DEDUCTED: 'Credits deducted successfully',
	CURRENCY_TRANSFERRED: 'Credits transferred successfully',
	
	// Collection messages
	CARD_ADDED: 'Card added to collection',
	PACK_OPENED: 'Pack opened successfully',
	DAILY_CLAIMED: 'Daily pack claimed',
	
	// Battle messages
	CHALLENGE_SENT: 'Challenge sent successfully',
	BATTLE_COMPLETED: 'Battle completed',
	RANK_UPDATED: 'Rank updated',
	
	// Milestone messages
	MILESTONE_CLAIMED: 'Milestone reward claimed',
	ACHIEVEMENT_UNLOCKED: 'Achievement unlocked',
} as const;

// ==================== FEATURE FLAGS ====================
export const FEATURE_FLAGS = {
	/** Enable daily pack claims */
	ENABLE_DAILY_PACKS: true,
	/** Enable ranked battles */
	ENABLE_RANKED_BATTLES: true,
	/** Enable shop system */
	ENABLE_SHOP: true,
	/** Enable milestone system */
	ENABLE_MILESTONES: true,
	/** Enable ELO milestone rewards */
	ENABLE_ELO_MILESTONES: true,
	/** Enable season system */
	ENABLE_SEASONS: true,
	/** Enable pack battles (wager battles) */
	ENABLE_PACK_BATTLES: true,
	/** Enable wishlist system */
	ENABLE_WISHLIST: true,
	/** Enable debug commands */
	ENABLE_DEBUG: false,
	/** Enable caching system */
	ENABLE_CACHING: true,
	/** Enable logging */
	ENABLE_LOGGING: true,
	/** Enable automatic season management */
	ENABLE_AUTO_SEASONS: true,
	/** Enable ELO decay */
	ENABLE_ELO_DECAY: false,
} as const;

// ==================== CACHE CONFIGURATION ====================
export const CACHE_CONFIG = {
	/** Default cache TTL in milliseconds */
	DEFAULT_TTL_MS: 300000, // 5 minutes
	/** Shop stock cache TTL */
	SHOP_STOCK_TTL_MS: 3600000, // 1 hour
	/** Leaderboard cache TTL */
	LEADERBOARD_TTL_MS: 600000, // 10 minutes
	/** User stats cache TTL */
	USER_STATS_TTL_MS: 300000, // 5 minutes
	/** Card search cache TTL */
	SEARCH_CACHE_TTL_MS: 600000, // 10 minutes
	/** Maximum cache entries */
	MAX_CACHE_ENTRIES: 1000,
} as const;

// ==================== LOGGING CONFIGURATION ====================
export const LOGGING_CONFIG = {
	/** Log level (0=ERROR, 1=WARN, 2=INFO, 3=DEBUG) */
	LOG_LEVEL: 2,
	/** Enable console logging */
	CONSOLE_LOGGING: true,
	/** Enable file logging */
	FILE_LOGGING: false,
	/** Log file path */
	LOG_FILE_PATH: './logs/tcg.log',
	/** Maximum log file size in bytes */
	MAX_LOG_FILE_SIZE: 10485760, // 10MB
	/** Maximum number of log files to keep */
	MAX_LOG_FILES: 5,
} as const;

// ==================== TYPE DEFINITIONS ====================
export type MilestoneType = 'rankedBattles' | 'rankedWins' | 'packsPurchased' | 'packsOpened' | 'creditsEarned';
export type BattleResult = 'win' | 'loss' | 'draw';
export type SeasonRewardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type RankTier = keyof typeof RANK_THRESHOLDS;
export type EloMilestoneId = keyof typeof ELO_MILESTONE_REWARDS;
export type WeeklyMilestoneId = keyof typeof WEEKLY_MILESTONES;

// ==================== UTILITY FUNCTIONS ====================
export class ConfigUtils {
	/**
	 * Get all rank tiers in order
	 */
	static getRankTiers(): RankTier[] {
		return Object.keys(RANK_THRESHOLDS) as RankTier[];
	}
	
	/**
	 * Get rank color for a given tier
	 */
	static getRankColor(rank: RankTier): string {
		return RANK_COLORS[rank] || '#808080';
	}
	
	/**
	 * Check if a feature is enabled
	 */
	static isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
		return FEATURE_FLAGS[feature];
	}
	
	/**
	 * Get cache TTL for a specific cache type
	 */
	static getCacheTTL(cacheType: keyof typeof CACHE_CONFIG): number {
		return CACHE_CONFIG[cacheType] || CACHE_CONFIG.DEFAULT_TTL_MS;
	}
	
	/**
	 * Validate input against limits
	 */
	static validateInput(input: string, maxLength: number = VALIDATION_LIMITS.MAX_INPUT_LENGTH): boolean {
		return input.length > 0 && input.length <= maxLength;
	}
	
	/**
	 * Get milestone configuration by ID
	 */
	static getMilestone(milestoneId: WeeklyMilestoneId) {
		return WEEKLY_MILESTONES[milestoneId];
	}
	
	/**
	 * Get ELO milestone configuration by ID
	 */
	static getEloMilestone(milestoneId: EloMilestoneId) {
		return ELO_MILESTONE_REWARDS[milestoneId];
	}
}
