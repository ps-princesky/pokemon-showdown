/**
 * TCG Economy Module
 * Handles all currency operations for the TCG plugin.
 */

import { MongoDB } from '../../impulse/mongodb_module';

// A simplified interface for type safety within this module.
interface UserCollection {
	userId: string;
	currency?: number;
}

const UserCollections = MongoDB<UserCollection>('tcg_user_collections');

/**
 * Gets the currency balance for a specific user.
 * @param userId The user's ID.
 * @returns The user's currency balance, or 0 if they have none.
 */
export async function getUserBalance(userId: string): Promise<number> {
	const collection = await UserCollections.findOne({ userId });
	return collection?.currency || 0;
}

/**
 * Grants a specified amount of currency to a user.
 * This operation is atomic and will create a collection for the user if one doesn't exist.
 * @param userId The user's ID.
 * @param amount The amount of currency to grant.
 * @returns True if the operation was successful.
 */
export async function grantCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	const result = await UserCollections.updateOne(
		{ userId },
		{ $inc: { currency: amount } },
		{ upsert: true }
	);
	return result.modifiedCount > 0 || result.upsertedCount > 0;
}

/**
 * Deducts a specified amount of currency from a user.
 * This operation is atomic and will fail if the user does not have enough currency.
 * @param userId The user's ID.
 * @param amount The amount of currency to deduct.
 * @returns True if the currency was successfully deducted, false otherwise.
 */
export async function deductCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	const result = await UserCollections.updateOne(
		{ userId, currency: { $gte: amount } },
		{ $inc: { currency: -amount } }
	);
	return result.modifiedCount > 0;
}

/**
 * Sets a user's currency balance to a specific amount. (Admin)
 * @param userId The user's ID.
 * @param amount The new balance.
 * @returns True if the operation was successful.
 */
export async function setCurrency(userId: string, amount: number): Promise<boolean> {
	if (amount < 0) return false;
	const result = await UserCollections.updateOne(
		{ userId },
		{ $set: { currency: amount } },
		{ upsert: true }
	);
	return result.modifiedCount > 0 || result.upsertedCount > 0;
}

/**
 * Transfers currency from one user to another.
 * This is safe for most use cases, as the critical deduction step is atomic.
 * @param fromUserId The sender's user ID.
 * @param toUserId The receiver's user ID.
 * @param amount The amount to transfer.
 * @returns True if the transfer was successful, false if the sender had insufficient funds.
 */
export async function transferCurrency(fromUserId: string, toUserId: string, amount: number): Promise<boolean> {
	if (amount <= 0) return false;
	
	const didDeduct = await deductCurrency(fromUserId, amount);

	if (didDeduct) {
		// If deduction was successful, grant the currency to the receiver.
		await grantCurrency(toUserId, amount);
		return true;
	} else {
		// If deduction failed, the transfer fails.
		return false;
	}
}
