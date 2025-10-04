/**
 * TCG Economy Module
 * Handles all currency operations for the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';
import { UserCollection } from './tcg_data';
import { UserCollections } from './tcg_collections';

// Import config values
import { 
	VALIDATION_LIMITS, 
	ERROR_MESSAGES,
	SUCCESS_MESSAGES,
	FEATURE_FLAGS 
} from './tcg_config';

/**
 * Validate currency amount
 */
function validateCurrencyAmount(amount: number): { valid: boolean; error?: string } {
	if (isNaN(amount)) {
		return { valid: false, error: ERROR_MESSAGES.INVALID_AMOUNT };
	}
	if (amount < VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT) {
		return { valid: false, error: `Amount must be at least ${VALIDATION_LIMITS.MIN_CURRENCY_AMOUNT}` };
	}
	if (amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
		return { valid: false, error: `Amount cannot exceed ${VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT}` };
	}
	return { valid: true };
}

/**
 * Validate user ID format
 */
function validateUserId(userId: string): boolean {
	return userId && userId.length > 0 && userId.length <= VALIDATION_LIMITS.MAX_USERNAME_LENGTH;
}

/**
 * Gets the currency balance for a specific user.
 */
export async function getUserBalance(userId: string): Promise<number> {
	if (!validateUserId(userId)) {
		throw new Error(ERROR_MESSAGES.INVALID_USERNAME);
	}
	
	try {
		const collection = await UserCollections.findOne({ userId });
		return collection?.currency || 0;
	} catch (error) {
		console.error(`Error getting balance for ${userId}:`, error);
		throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
	}
}

/**
 * Alias for getUserBalance for backward compatibility
 */
export const getCurrency = getUserBalance;


/**
 * Grants a specified amount of currency to a user.
 */
export async function grantCurrency(userId: string, amount: number): Promise<boolean> {
	// Validate inputs
	if (!validateUserId(userId)) {
		console.error(`Invalid userId in grantCurrency: ${userId}`);
		return false;
	}
	
	const validation = validateCurrencyAmount(amount);
	if (!validation.valid) {
		console.error(`Invalid amount in grantCurrency: ${amount} - ${validation.error}`);
		return false;
	}
	
	try {
		await UserCollections.updateOne(
			{ userId },
			{ $inc: { currency: amount } },
			{ upsert: true }
		);
		
		console.log(`Granted ${amount} credits to ${userId}`);
		return true;
	} catch (error) {
		console.error(`Error granting currency to ${userId}:`, error);
		return false;
	}
}

/**
 * Deducts a specified amount of currency from a user.
 */
export async function deductCurrency(userId: string, amount: number): Promise<boolean> {
	// Validate inputs
	if (!validateUserId(userId)) {
		console.error(`Invalid userId in deductCurrency: ${userId}`);
		return false;
	}
	
	const validation = validateCurrencyAmount(amount);
	if (!validation.valid) {
		console.error(`Invalid amount in deductCurrency: ${amount} - ${validation.error}`);
		return false;
	}
	
	try {
		const result = await UserCollections.updateOne(
			{ userId, currency: { $gte: amount } },
			{ $inc: { currency: -amount } }
		);
		
		const success = result > 0;
		if (success) {
			console.log(`Deducted ${amount} credits from ${userId}`);
		} else {
			console.log(`Failed to deduct ${amount} credits from ${userId} - insufficient balance`);
		}
		
		return success;
	} catch (error) {
		console.error(`Error deducting currency from ${userId}:`, error);
		return false;
	}
}

/**
 * Sets a user's currency balance to a specific amount. (Admin)
 */
export async function setCurrency(userId: string, amount: number): Promise<boolean> {
	// Validate inputs
	if (!validateUserId(userId)) {
		console.error(`Invalid userId in setCurrency: ${userId}`);
		return false;
	}
	
	if (amount < 0) {
		console.error(`Invalid amount in setCurrency: ${amount} - cannot be negative`);
		return false;
	}
	
	if (amount > VALIDATION_LIMITS.MAX_CURRENCY_AMOUNT) {
		console.error(`Invalid amount in setCurrency: ${amount} - exceeds maximum`);
		return false;
	}
	
	try {
		await UserCollections.updateOne(
			{ userId },
			{ $set: { currency: amount } },
			{ upsert: true }
		);
		
		console.log(`Set currency for ${userId} to ${amount} credits`);
		return true;
	} catch (error) {
		console.error(`Error setting currency for ${userId}:`, error);
		return false;
	}
}

/**
 * Transfers currency from one user to another.
 */
export async function transferCurrency(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
	// Validate inputs
	if (!validateUserId(fromUserId) || !validateUserId(toUserId)) {
		console.error(`Invalid userIds in transferCurrency: from=${fromUserId}, to=${toUserId}`);
		return false;
	}
	
	if (fromUserId === toUserId) {
		console.error(`Cannot transfer currency to self: ${fromUserId}`);
		return false;
	}
	
	const validation = validateCurrencyAmount(amount);
	if (!validation.valid) {
		console.error(`Invalid amount in transferCurrency: ${amount} - ${validation.error}`);
		return false;
	}
	
	try {
		// Check sender's balance first
		const senderBalance = await getUserBalance(fromUserId);
		if (senderBalance < amount) {
			console.log(`Transfer failed - insufficient balance. ${fromUserId} has ${senderBalance}, needs ${amount}`);
			return false;
		}
		
		// Perform the transfer atomically
		const didDeduct = await deductCurrency(fromUserId, amount);

		if (didDeduct) {
			const didGrant = await grantCurrency(toUserId, amount);
			if (didGrant) {
				console.log(`Transferred ${amount} credits from ${fromUserId} to ${toUserId}`);
				return true;
			} else {
				// Rollback - grant the money back to sender
				await grantCurrency(fromUserId, amount);
				console.error(`Transfer failed - could not grant to recipient, rolled back`);
				return false;
			}
		} else {
			console.log(`Transfer failed - could not deduct from sender`);
			return false;
		}
	} catch (error) {
		console.error(`Error in transferCurrency from ${fromUserId} to ${toUserId}:`, error);
		return false;
	}
}

/**
 * Get currency statistics for admin purposes
 */
export async function getCurrencyStats(): Promise<{
	totalUsers: number;
	totalCurrency: number;
	averageBalance: number;
	topHolders: Array<{ userId: string; currency: number }>;
}> {
	try {
		const allCollections = await UserCollections.find({ currency: { $gt: 0 } });
		const totalUsers = allCollections.length;
		const totalCurrency = allCollections.reduce((sum, c) => sum + (c.currency || 0), 0);
		const averageBalance = totalUsers > 0 ? Math.round(totalCurrency / totalUsers) : 0;
		
		const topHolders = allCollections
			.sort((a, b) => (b.currency || 0) - (a.currency || 0))
			.slice(0, 10)
			.map(c => ({ userId: c.userId, currency: c.currency || 0 }));
		
		return {
			totalUsers,
			totalCurrency,
			averageBalance,
			topHolders
		};
	} catch (error) {
		console.error('Error getting currency stats:', error);
		throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
	}
}

/**
 * Check if a user can afford a specific amount
 */
export async function canAfford(userId: string, amount: number): Promise<boolean> {
	if (!validateUserId(userId)) return false;
	
	const validation = validateCurrencyAmount(amount);
	if (!validation.valid) return false;
	
	try {
		const balance = await getUserBalance(userId);
		return balance >= amount;
	} catch (error) {
		console.error(`Error checking affordability for ${userId}:`, error);
		return false;
	}
}

/**
 * Get currency transaction history for a user (if implementing transaction logging)
 */
export async function getUserTransactionHistory(userId: string, limit: number = 10): Promise<Array<{
	type: 'grant' | 'deduct' | 'transfer_in' | 'transfer_out' | 'set';
	amount: number;
	timestamp: number;
	details?: string;
}>> {
	// This would require implementing a transaction log collection
	// For now, return empty array
	return [];
}

/**
 * Batch currency operations for better performance
 */
export async function batchCurrencyOperations(operations: Array<{
	userId: string;
	operation: 'grant' | 'deduct' | 'set';
	amount: number;
}>): Promise<{ successful: number; failed: number; errors: string[] }> {
	let successful = 0;
	let failed = 0;
	const errors: string[] = [];
	
	for (const op of operations) {
		try {
			let result = false;
			
			switch (op.operation) {
				case 'grant':
					result = await grantCurrency(op.userId, op.amount);
					break;
				case 'deduct':
					result = await deductCurrency(op.userId, op.amount);
					break;
				case 'set':
					result = await setCurrency(op.userId, op.amount);
					break;
			}
			
			if (result) {
				successful++;
			} else {
				failed++;
				errors.push(`Failed to ${op.operation} ${op.amount} for ${op.userId}`);
			}
		} catch (error: any) {
			failed++;
			errors.push(`Error processing ${op.operation} for ${op.userId}: ${error.message}`);
		}
	}
	
	return { successful, failed, errors };
}

/**
 * Emergency currency reset function (admin only, use with caution)
 */
export async function resetAllCurrency(): Promise<{ success: boolean; usersReset: number }> {
	try {
		const result = await UserCollections.updateMany(
			{},
			{ $unset: { currency: "" } }
		);
		
		console.log(`Reset currency for ${result} users`);
		return { success: true, usersReset: result };
	} catch (error) {
		console.error('Error resetting all currency:', error);
		return { success: false, usersReset: 0 };
	}
}
															
