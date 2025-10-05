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
	/** Number of common cards in a pack */
	COMMONS_PER_PACK: 5,
	/** Number of uncommon cards in a pack */
	UNCOMMONS_PER_PACK: 3,
	/** Number of reverse holo slots */
	REVERSE_HOLO_SLOTS: 1,
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
} as const;

// ==================== PAGINATION SETTINGS ====================
export const PAGINATION_CONFIG = {
	/** Cards per page in search results */
	CARDS_PER_PAGE: 100,
	/** Default leaderboard size */
	LEADERBOARD_SIZE: 100,
	/** Collection display limit */
	COLLECTION_DISPLAY_LIMIT: 100,
	/** Maximum scrollable container height */
	MAX_HEIGHT: '360px',
} as const;

// ==================== VALIDATION LIMITS ====================
export const VALIDATION_LIMITS = {
	/** Maximum card name length */
	MAX_CARD_NAME_LENGTH: 100,
	/** Minimum currency amount */
	MIN_CURRENCY_AMOUNT: 1,
	/** Maximum currency amount */
	MAX_CURRENCY_AMOUNT: 1000000,
} as const;

// ==================== ERROR MESSAGES ====================
export const ERROR_MESSAGES = {
	// Database errors
	DATABASE_ERROR: 'A database error occurred. Please try again later',
	
	// User errors
	SELF_ACTION_ERROR: 'You cannot perform this action on yourself',
	
	// Currency errors
	INSUFFICIENT_CREDITS: 'Insufficient credits',
	
	// Pack errors
	NO_PACKS: 'No unopened packs available',
	PACK_GENERATION_FAILED: 'Failed to generate pack',
	SET_UNAVAILABLE: 'Set is not available',
} as const;

// ==================== SUCCESS MESSAGES ====================
export const SUCCESS_MESSAGES = {
	// Collection messages
	CARD_ADDED: 'Card added to collection',
} as const;
