/**
 * Main file
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * @license MIT
 */
try {
	require('source-map-support').install();
} catch (e) {
}

// NOTE: This file intentionally doesn't use too many modern JavaScript
// features, so that it doesn't crash old versions of Node.js, so we
// can successfully print the "We require Node.js 22+" message.

try {
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	fetch;
} catch (e) {
	throw new Error("We require Node.js version 22 or later; you're using " + process.version);
}

try {
	require.resolve('ts-chacha20');
} catch (e) {
	throw new Error("Dependencies are unmet; run `npm ci` before launching Pokemon Showdown again.");
}

import { FS, Repl } from '../lib';
// Import MongoDB module (but NOT TCG modules yet - those will be loaded after connection)
import { MongoDB } from '../impulse/mongodb_module';

/*********************************************************
 * Set up most of our globals
 *********************************************************/
function setupGlobals() {
	const ConfigLoader = require('./config-loader');
	global.Config = ConfigLoader.Config;

	const { Monitor } = require('./monitor');
	global.Monitor = Monitor;
	global.__version = { head: '' };
	void Monitor.version().then((hash: any) => {
		global.__version.tree = hash;
	});
	Repl.cleanup();

	if (Config.watchconfig) {
		FS('config/config.js').onModify(() => {
			try {
				global.Config = ConfigLoader.load(true);
				Chat.plugins['username-prefixes']?.prefixManager.refreshConfig(true);
				Monitor.notice('Reloaded ../config/config.js');
			} catch (e: any) {
				Monitor.adminlog("Error reloading ../config/config.js: " + e.stack);
			}
		});
	}

	/********************
	* Impulse Globals
	*********************/
	global.Impulse = {};

	const { Dex } = require('../sim/dex');
	global.Dex = Dex;
	global.toID = Dex.toID;

	const { Teams } = require('../sim/teams');
	global.Teams = Teams;

	const { LoginServer } = require('./loginserver');
	global.LoginServer = LoginServer;

	const { Ladders } = require('./ladders');
	global.Ladders = Ladders;

	const { Chat } = require('./chat');
	global.Chat = Chat;

	const { Users } = require('./users');
	global.Users = Users;

	const { Punishments } = require('./punishments');
	global.Punishments = Punishments;

	const { Rooms } = require('./rooms');
	global.Rooms = Rooms;
	Rooms.global = new Rooms.GlobalRoomState();

	const Verifier = require('./verifier');
	global.Verifier = Verifier;

	const { Tournaments } = require('./tournaments');
	global.Tournaments = Tournaments;

	const { IPTools } = require('./ip-tools');
	global.IPTools = IPTools;
	void IPTools.loadHostsAndRanges();
}

setupGlobals();

/**************************
* Initialize MongoDB
**************************/
async function initializeMongoDB() {
	if (!Config.mongodb) {
		Monitor.notice('MongoDB not configured - skipping initialization');
		return;
	}

	try {
		Monitor.notice('Connecting to MongoDB...');
		await MongoDB.connect(Config.mongodb);
		Monitor.notice(`MongoDB connected successfully to database: ${Config.mongodb.database}`);
	} catch (error) {
		Monitor.error('Failed to connect to MongoDB: ' + error);
		Monitor.warn('Server will continue without MongoDB support');
	}
}

/**************************
* Graceful Shutdown
**************************/
async function gracefulShutdown(signal: string) {
	Monitor.notice(`Received ${signal}, shutting down gracefully...`);
	
	try {
		if (MongoDB.isConnected()) {
			Monitor.notice('Closing MongoDB connection...');
			await MongoDB.disconnect();
			Monitor.notice('MongoDB connection closed');
		}
	} catch (error) {
		Monitor.error('Error closing MongoDB connection: ' + error);
	}
	
	process.exit(0);
}

process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

if (Config.crashguard) {
	process.on('uncaughtException', (err: Error) => {
		Monitor.crashlog(err, 'The main process');
	});

	process.on('unhandledRejection', err => {
		Monitor.crashlog(err as any, 'A main process Promise');
	});
}

/*********************************************************
 * Start networking processes
 *********************************************************/
const { Sockets } = require('./sockets');
global.Sockets = Sockets;

export function listen(port: number, bindAddress: string, workerCount: number) {
	Sockets.listen(port, bindAddress, workerCount);
}

/*********************************************************
 * Main startup sequence
 *********************************************************/
async function startServer() {
	// CRITICAL: Initialize MongoDB FIRST, before starting the server
	await initializeMongoDB();
	
	// Now start the server after MongoDB is ready
	if (require.main === module) {
		let port;
		for (const arg of process.argv) {
			if (/^[0-9]+$/.test(arg)) {
				port = parseInt(arg);
				break;
			}
		}
		Sockets.listen(port);
	}
	
	/*********************************************************
	 * Set up TeamValidatorAsync after server starts
	 *********************************************************/
	const TeamValidatorAsync = require('./team-validator-async');
	global.TeamValidatorAsync = TeamValidatorAsync;

	/*********************************************************
	 * Start up the REPL server
	 *********************************************************/
	// eslint-disable-next-line no-eval
	Repl.start('app', cmd => eval(cmd));

	/*********************************************************
	 * Fully initialized, run startup hook
	 *********************************************************/
	if (Config.startuphook) {
		process.nextTick(Config.startuphook);
	}

	if (Config.ofemain) {
		global.nodeOomHeapdump = (require as any)('node-oom-heapdump')({
			addTimestamp: true,
		});
	}
}

// Start the server with proper async handling
startServer().catch(err => {
	console.error('Failed to start server:', err);
	process.exit(1);
});
