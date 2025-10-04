/* TCG Card Display Styles */

/* Light Mode (Default) */
.impulse-card {
	max-height: 360px;
	overflow-y: auto;
}

.impulse-card-container {
	border-radius: 8px;
	padding: 12px;
	overflow: hidden;
}

.impulse-card-name {
	font-size: 1.5em;
	font-weight: bold;
	margin-bottom: 4px;
	color: #2c3e50;
}

.impulse-card-rarity {
	font-weight: bold;
	font-size: 1em;
	margin-bottom: 12px;
}

.impulse-card-info-label {
	padding: 2px 8px 2px 0;
	color: #666;
	width: 100px;
}

.impulse-card-info-value {
	padding: 2px 0;
	color: #2c3e50;
}

.impulse-card-battle-stats {
	margin-top: 12px;
	padding: 10px;
	background: rgba(255, 255, 255, 0.15);
	backdrop-filter: blur(10px);
	border: 2px solid rgba(255, 255, 255, 0.3);
	border-radius: 6px;
	font-size: 0.85em;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.impulse-card-battle-stats-title {
	display: block;
	margin-bottom: 8px;
	color: #2c3e50;
	text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
	font-size: 1.1em;
}

.impulse-card-stat-label {
	color: #2c3e50;
	text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
	min-width: 38px;
	font-weight: bold;
	font-size: 0.95em;
}

.impulse-card-stat-progress {
	flex: 1;
	background: rgba(255, 255, 255, 0.4);
	height: 8px;
	border-radius: 4px;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.2);
	box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
}

.impulse-card-stat-progress-bar {
	height: 100%;
	transition: width 0.3s ease;
}

.impulse-card-section-title {
	color: #2c3e50;
	font-size: 0.95em;
}

.impulse-card-attack-container,
.impulse-card-ability-container {
	margin: 6px 0;
	padding: 6px 8px;
	background: rgba(255, 255, 255, 0.4);
	border-radius: 4px;
	font-size: 0.85em;
}

.impulse-card-attack-container {
	border-left: 2px solid #e74c3c;
}

.impulse-card-ability-container {
	border-left: 2px solid #9b59b6;
}

.impulse-card-attack-name,
.impulse-card-ability-name {
	color: #2c3e50;
}

.impulse-card-attack-text,
.impulse-card-ability-text {
	margin-top: 3px;
	color: #666;
	font-size: 0.95em;
}

.impulse-card-weakness-resistance {
	margin-top: 12px;
	display: flex;
	gap: 12px;
	font-size: 0.85em;
}

.impulse-card-weakness-badge {
	background: rgba(231, 76, 60, 0.1);
	padding: 2px 6px;
	border-radius: 3px;
	margin-left: 4px;
	color: #2c3e50;
}

.impulse-card-resistance-badge {
	background: rgba(52, 152, 219, 0.1);
	padding: 2px 6px;
	border-radius: 3px;
	margin-left: 4px;
	color: #2c3e50;
}

.impulse-card-footer {
	margin-top: 12px;
	padding-top: 8px;
	border-top: 1px solid rgba(0, 0, 0, 0.1);
	font-size: 0.8em;
}

.impulse-card-flavor-text {
	font-style: italic;
	color: #777;
}

.impulse-card-artist {
	text-align: right;
	color: #999;
	margin-top: 4px;
}

/* Dark Mode */
.dark .impulse-card-name {
	color: #fff;
}

.dark .impulse-card-info-label {
	color: #bbb;
}

.dark .impulse-card-info-value {
	color: #eee;
}

.dark .impulse-card-battle-stats {
	background: rgba(0, 0, 0, 0.3);
	border: 2px solid rgba(255, 255, 255, 0.2);
}

.dark .impulse-card-battle-stats-title {
	color: #fff;
	text-shadow: none;
}

.dark .impulse-card-stat-label {
	color: #ccc;
	text-shadow: none;
}

.dark .impulse-card-stat-progress {
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .impulse-card-section-title {
	color: #fff;
}

.dark .impulse-card-attack-container,
.dark .impulse-card-ability-container {
	background: rgba(0, 0, 0, 0.3);
}

.dark .impulse-card-attack-name,
.dark .impulse-card-ability-name {
	color: #fff;
}

.dark .impulse-card-attack-text,
.dark .impulse-card-ability-text {
	color: #bbb;
}

.dark .impulse-card-weakness-badge {
	background: rgba(231, 76, 60, 0.2);
	color: #fff;
}

.dark .impulse-card-resistance-badge {
	background: rgba(52, 152, 219, 0.2);
	color: #fff;
}

.dark .impulse-card-footer {
	border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.dark .impulse-card-flavor-text {
	color: #bbb;
}
