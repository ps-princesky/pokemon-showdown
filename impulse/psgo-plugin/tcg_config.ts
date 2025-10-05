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
	BATTLE_COMPLETED: 'Battle completed',
} as const;

// ==================== FEATURE FLAGS ====================
export const FEATURE_FLAGS = {
	/** Enable daily pack claims */
	ENABLE_DAILY_PACKS: true,
	/** Enable shop system */
	ENABLE_SHOP: true,
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
} as const;

// ==================== CACHE CONFIGURATION ====================
export const CACHE_CONFIG = {
	/** Default cache TTL in milliseconds */
	DEFAULT_TTL_MS: 300000, // 5 minutes
	/** Shop stock cache TTL */
	SHOP_STOCK_TTL_MS: 3600000, // 1 hour
	/** User stats cache TTL */
	USER_STATS_TTL_MS: 300000, // 5 minutes
	/** Card search cache TTL */
	SEARCH_CACHE_TTL_MS: 600000, // 10 minutes
	/** Maximum cache entries */
	MAX_CACHE_ENTRIES: 100000,
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

// ==================== UTILITY FUNCTIONS ====================
export class ConfigUtils {
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
}
