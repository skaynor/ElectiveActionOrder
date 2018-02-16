/* jshint -W132 */
var PopcornInitiative = PopcornInitiative || (function() {
	const DEBUG = true;
	const DEBUG_LOG = false;

	const COMMAND = '!pci';
	const CHAT_NAME = 'Initiative';

	const CHECK_OFF = '☐';
	const CHECK_PART = '▣';
	const CHECK_ON = '☑';

	const ENEMY_GROUP = 'Enemies';

	on('chat:message', messageHandler);

	on("change:graphic:status_dead", tokenDeadHandler);

	let config = {
		// In normal initiative, enemies on the GM layer are not shown to the players.
		// However, this can not be implemented in popcorn initiative: what happens when it's a player's turn and there are only hidden enemies left?
		// The only real solution is for the DM to only add tokens to initiative when they should be shown to the players, disabling the
		// possibility for hidden tokens, which is how it's implemented.
		groupEnemies: true
	};

	state.PopcornInitiative = state.PopcornInitiative || {};
	if (!state.PopcornInitiative.participantsVar) {
		state.PopcornInitiative.participantsVar = {};
		resetParticipants();
	}

	function participants() {
		return state.PopcornInitiative.participantsVar;
	}

	if (!state.PopcornInitiative.roundInfoVar) {
		state.PopcornInitiative.roundInfoVar = {};
		resetRoundInfo();
	}

	function roundInfo() {
		return state.PopcornInitiative.roundInfoVar;
	}


	state.PopcornInitiative.handleDeadToken = tokenDeadHandler;


	const handlers = {
		add: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}

			const selection = getCurrentSelection(msg);
			const tokens = selection.filter(selected => selected._type === 'graphic');
			if (tokens.length === 0) {
				send(msg.playerid, 'No token selected!');
				return;
			}
			const initiative = getOption(msg, 0);
			tokens.forEach(selectedToken => {
				const token = getObj('graphic', selectedToken._id);
				addToken(token, initiative).then(result => {
					const participant = result.result;
					if (result.errors.length > 0) {
						const errors = result.errors.join('<br />');
						const tokenName = (token && token.get) ? token.get('name') : token;
						send(msg.playerid, 'Could not add token ' + tokenName + ', error(s): <br />' + errors);
					} else if (result.warnings.length > 0) {
						const warnings = result.warnings.join('<br />');
						const content = 'Added ' + participant.name + ', initiative ' + participant.init + ' with warning(s): <br />' + warnings;
						send(msg.playerid, content);
					} else {
						send(msg.playerid, 'Added ' + participant.name + ' with initiative ' + participant.init + '.');
					}
				});
			});
		},
		remove: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}

			const id = getOption(msg, 0);

			if (id) {
				removeByID(id);
			} else {
				const selection = getCurrentSelection(msg);
				const selectionIDs = selection.map(graphic => graphic._id);
				selectionIDs.forEach(removeByTokenID);
			}

		},
		start: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}

			addTurnOrder(msg).then(() => {
				if (getAllParticipants().length === 0) {
					send(msg.playerid, 'Trying to start combat with no participants!');
					return;
				}
				debug('Starting new combat...');
				debug('Participants: ', participants());

				startCombat();
			});
		},
		stop: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}
			stopCombat();
		},
		giveturnAPI: msg => {
			const playerID = msg.playerid;
			if (!isPlayersTurn(playerID)) {
				debug('Player ', msg.who, ' tried to give turn over, but it\'s not his turn.');
				send(msg.playerid, 'It\'s not your turn!');
				return;
			}
			const option = getOption(msg, 0);
			let participant = (config.groupEnemies && option === ENEMY_GROUP) ? ENEMY_GROUP : getParticipant(option);
			if (!participant) {
				send(msg.playerid, 'You tried to give turn to ', option, ' but a participant with that ID does not exist!');
				return;
			}
			const result = giveTurn(participant);
			if (result.errors.length > 0) {
				const errors = result.errors.join('<br />');
				send(playerID, 'Can not give turn to ' + participant.name + ' : <br />' + errors);
			}
		},
		reset: msg => {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				send(playerID, 'Only the GM can reset the popcorn initiative.');
			}
			resetParticipants();
			resetRoundInfo();
			send(playerID, 'Popcorn initiative has been reset.');
		},
		status: msg => {
			const playerID = msg.playerid;
			if (isCombatRunning()) {
				sendStatus(playerID);
			} else {
				send(playerID, 'No combat running.');

				if (playerIsGM(playerID)) {
					sendParticipantsStatus(playerID);
				}
			}
		},
		menu: msg => {
			const playerID = msg.playerid;

			if (!isCombatRunning()) {
				send(playerID, 'No combat running, there is nothing you can do right now.');
			} else if (isPlayersTurn(playerID)) {
				resendCurrentChoice();
			} else {
					send(playerID, 'It\'s not your turn so there is no menu for you, but here\'s the current ' +
						'status (next time use "' + COMMAND + ' status"):');
					sendStatus(playerID);
			}
		}
	};

	function getOption(msg, idx) {
		let options = msg.content.split(' ');

		// skip command + sub command
		let realIndex = idx + 2;

		if (options.length < realIndex + 1) {
			return undefined;
		}

		return options[realIndex];
	}

	function getRemainingOptions(msg, idx) {
		const options = msg.content.split(' ');

		// skip command + sub command
		let realIndex = idx + 2;

		if (options.length < realIndex + 1) {
			return [];
		}

		return options.slice(realIndex);
	}

	function messageHandler(msg) {
		if (msg.who !== CHAT_NAME) {
			debug(msg);
		}
		if (msg.type !== 'api' || !msg.content.startsWith(COMMAND)) {
			return;
		}

		const options = msg.content.split(' ');
		if (options.length === 1) {
			sendHelp(msg.playerid);
			return;
		}

		const handler = handlers[options[1]];
		if (!handler) {
			sendHelp(msg.playerid, options);
			return;
		}

		handler(msg);
	}


	function debug(...args) {
		if (!DEBUG || !DEBUG_LOG) {
			return;
		}
		// for roll20: $('#consolepanel').before('<button onclick=ace.edit("apiconsole").setValue("")>Clear</button>')
		let message = '';
		if (args.length === 0) {
			message = 'Debug message missing!';
		} else {
			message = args.map(arg => (typeof arg === 'object') ? JSON.stringify(arg, null, 4) : arg)
				.reduce((message, arg) => message + arg)
				.replace(/\n/g, '<br/>');
		}

		send('-L5DOgB6lPNKGooiSHet', '<pre>' + message + '</pre>');
	}

	function send(playerID, content) {
		sendChat('Initiative', '/w ' + getPlayerName(playerID) + ' ' + content, null, {noarchive: true});
	}

	function sendHelp(playerID, options) {
		send(playerID, 'Unrecognized command');
	}

	function getPlayerName(playerID) {
		return playerID && playerID !== 'gm' ? '"' + getObj('player', playerID).get('displayname') + '"' : 'gm';
	}

	function startCombat() {
		const players = getPlayers().map(player => player.name + ' (Init: ' + player.init + ')');
		const playerMessage = 'Starting combat with ' + players.length + ' player' + ((players.length !== 1) ? 's' : '') + ': ' + players.join(', ');
		const hfgl = '! Have fun ;)';
		if (config.groupEnemies) {
			sendInfo(playerMessage + hfgl);
		} else {
			const enemies = getEnemies().map(enemy => enemy.name + ' (Init: ' + enemy.init + ')');
			const enemyMessage = enemies.length + ' enemy' + ((enemies.length !== 1) ? 's' : '') + ': ' + enemies.join(', ');
			sendInfo(playerMessage + ' and ' + enemyMessage + hfgl);
		}
		showTurnOrder();
		resetRoundInfo();
		startNewRound();
		const highestInit = getHighestInit();
		if (config.groupEnemies && isEnemy(highestInit)) {
			sendInfo('An enemy won initiative with a ' + highestInit.init + ' and will start the combat!');
		} else {
			sendInfo(highestInit.name + ' won initiative with a ' + highestInit.init + '!');
		}
		giveTurn(highestInit);
	}

	function getTurnOrder() {
		const turnorder = Campaign().get('turnorder');
		return turnorder ? JSON.parse(turnorder) : [];
	}

	function setTurnOrder(turnOrder) {
		Campaign().set('turnorder', JSON.stringify(turnOrder));
	}

	function buildTurnOrder() {
		const currentParticipant = getCurrentParticipant();

		let currentEntry;
		if (config.groupEnemies && isEnemy(currentParticipant)) {
			currentEntry = buildEnemiesTurnOrderEntry();
		} else {
			currentEntry = buildTurnOrderEntry(currentParticipant, true);
		}
		currentEntry.pr = '';

		let restTurnOrderEntries;
		if (config.groupEnemies) {
			restTurnOrderEntries = buildTurnOrderEntries(getPlayers());
			debug('Rest players: ', restTurnOrderEntries);
			if (isPlayer(currentParticipant)) {
				debug('Add enemies');
				restTurnOrderEntries.push(buildEnemiesTurnOrderEntry());
				debug('Rest players: ', restTurnOrderEntries);
			}
		} else {
			const allWithoutCurrent = getAllParticipants.filter(_.negate(participantHasID(currentParticipant.id)));
			restTurnOrderEntries = buildTurnOrderEntries(allWithoutCurrent);
		}
		return [currentEntry].concat(restTurnOrderEntries);
	}

	function buildTurnOrderEntries(participants) {
		let allWithActed = participants.map(participant => {
			return {
				obj: participant,
				hasActed: hasActed(participant)
			};
		});
		allWithActed.sort((p1, p2) => {
			if (p1.hasActed && !p2.hasActed) {
				return 1;
			} else if (!p1.hasActed && p2.hasActed) {
				return -1;
			} else {
				return p1.obj.name.localeCompare(p2.obj.name);
			}
		});

		return allWithActed.map(participant => {
			return buildTurnOrderEntry(participant.obj, participant.hasActed);
		});
	}

	function buildTurnOrderEntry(participant, hasActed) {
		const id = participant.token || '-1';
		const custom = participant.name;
		const pr = hasActed ? CHECK_ON : CHECK_OFF;
		return {
			id: id,
			custom: custom,
			pr: pr
		};
	}

	function buildEnemiesTurnOrderEntry() {
		const totalEnemyCount = getEnemies().length;
		const toActEnemyCount = roundInfo().toAct.filter(isEnemy).length;
		let pr;
		debug('ToActEnemyCount ', toActEnemyCount);
		if (toActEnemyCount === totalEnemyCount) {
			pr = CHECK_OFF;
		} else if (toActEnemyCount === 0) {
			pr = CHECK_ON;
		} else {
			pr = CHECK_PART;
		}
		return {
			id: '-1',
			custom: ENEMY_GROUP,
			pr: pr
		};
	}


	function syncTurnOrder() {
		if (!isCombatRunning()) {
			debug('Not syncing turnorder outside of combat.');
			return;
		}

		const turnOrder = buildTurnOrder();
		setTurnOrder(turnOrder);
	}

	function resetTurnOrder() {
		setTurnOrder([]);
	}

	function resetParticipants() {
		participants().players = [];
		participants().enemies = [];
		participants().enemyTokens = {};
		participants().GMs = findGMs();
	}

	function resetRoundInfo() {
		roundInfo().curRound = -1;
		roundInfo().curTurn = -1;
		roundInfo().curID = undefined;
		roundInfo().toAct = [];
	}

	function findGMs() {
		return findObjs({_type: 'player'})
			.map(player => player.get('_id'))
			.filter(playerIsGM);
	}

	function addTurnOrder(msg) {
		const isToken = entry => (entry.id !== -1 && entry.id !== '-1');
		const tokens = getTurnOrder().filter(isToken);
		debug('Turnorder contains tokens: ', tokens);

		const tokenPromises = tokens.map(token => {
			return addTokenID(token.id, token.pr).then(result => {
				const tokenString = token && token.JSON.stringify(token);
				if (result.errors.length > 0) {
					const errors = result.errors.map(messageToString).join('<br />');
					send(msg.playerid, 'Error(s) while adding token \'' + tokenString + '\': <br />' + errors);
				}
				if (result.warnings.length > 0) {
					const warnings = result.warnings.map(messageToString).join('<br />');
					send(msg.playerid, 'Warning(s) while adding token \'' + tokenString + '\': <br />' + warnings);
				}
			});
		});

		return Promise.all(tokenPromises);
	}

	function messageToString(message) {
		return message.msg;
	}

	function addName(name, initiative) {
		return addEnemy({
			id: name,
			playerIDs: [],
			token: undefined,
			name: name,
			init: initiative
		});
	}

	function addTokenID(id, initiative) {
		const token = getObj('graphic', id);
		return addToken(token, initiative);
	}

	function addToken(token, initiative) {
		if (!token || token.get('_subtype') !== 'token') {
			debug('Not a valid token: ', token);
			return Promise.resolve(buildResult(undefined, ['Not a valid token!']));
		}

		let result = buildResult();

		if (initiative === undefined) {
			const initResult = getInitiative(token);
			addMessagesFromResult(result, initResult);
			initiative = initResult.result;
		}

		let playerIDs;
		let addFunc;
		if (isPlayerControlled(token)) {
			playerIDs = getControllingPlayers(token);
			addFunc = addPlayer;
		} else {
			playerIDs = [];
			addFunc = addEnemy;
		}
		const id = token.get('_id');
		const addPromise = addFunc({
			id: id,
			playerIDs: playerIDs,
			token: id,
			name: token.get('name'),
			init: initiative
		});

		const addResults = addResult => {
			return addMessagesFromResult(addResult, result);
		};
		return addPromise.then(addResults, addResults);
	}

	function addMessagesFromResult(result, msgResult) {
		result.warnings.push(...msgResult.warnings);
		result.errors.push(...msgResult.errors);
		return result;
	}

	function getInitiative(token) {
		let result = buildMsgResult();
		let attrInitMod;
		const representedCharacter = token.get('represents');
		if (!representedCharacter) {
			result.warnings.push('Token ' + token.get('name') + ' represents no character, using 1d20+0 as initiative.');
		} else {
			attrInitMod = getAttrByName(representedCharacter, 'initiative');
			if (!attrInitMod) {
				result.warnings.push('Initiative modifier missing, falling back to +0!');
			}
		}
		const initMod = attrInitMod || '+0';
		result.result = 'd20' + initMod;
		return result;
	}


	function isPlayerControlled(token) {
		const playerIDs = getControllingPlayers(token);
		const noGm = playerIDs.filter(_.negate(playerIsGM));
		return noGm.length > 0;
	}

	function addPlayer(player) {
		return addParticipant(participants().players, player);
	}

	function addEnemy(enemy) {
		const result = addParticipant(participants().enemies, enemy);
		result.then(() => {
			if (enemy.token) {
				participants().enemyTokens[enemy.token] = true;
			}
		});
		return result;
	}

	function buildMsgResult(errors, warnings) {
		return {
			errors: errors || [],
			warnings: warnings || []
		};
	}

	function buildResult(value, errors, warnings) {
		const result = buildMsgResult(errors, warnings);
		result.result = value;
		return result;
	}

	function addParticipant(list, participant) {

		return new Promise((resolve) => {
			if (getParticipant(participant.id)) {
				resolve(buildMsgResult(['Participant already added']));
				return;
			}
			roll(participant.init, roll => {
				participant.init = roll;
				const insertIndex = _.sortedIndex(list, participant, 'name');
				list.splice(insertIndex, 0, participant);
				if (isCombatRunning()) {
					roundInfo().toAct.push(participant);
					participantsChanged();
				}
				debug('Added participant: "', participant, '"');
				const result = buildResult(participant);
				debug('addParticipant result: ', result);
				resolve(result);
			});
		});
	}

	function roll(query, callback) {
		sendChat(CHAT_NAME, '/r ' + query, msg => {
			const rollResult = JSON.parse(msg[0].content);
			callback(rollResult.total);
		});
	}

	function getControllingPlayers(token) {
		const represents = token.get('represents');
		if (!represents) {
			return [];
		}
		const char = getObj('character', represents);
		const controlledby = char.get('controlledby');
		if (!controlledby) {
			return [];
		}
		return controlledby.split(',');
	}

	function getCurrentSelection(msg) {
		return msg.selected || [];
	}

	function getParticipant(id) {
		let allParticipants = getAllParticipants();
		return allParticipants.find(participantHasID(id));
	}

	function getAllParticipants() {
		return getPlayers().concat(getEnemies());
	}

	function getHighestInit() {
		return getAllParticipants()
			.reduce((highest, current) => (current.init > highest.init) ? current : highest);
	}

	function startNewRound(playerID) {
		debug('Starting new Round...');
		roundInfo().curRound++;
		roundInfo().curID = playerID;
		debug('New round: ' + roundInfo().curRound);
		roundInfo().curTurn = -1;
		roundInfo().toAct = getAllParticipants();
	}

	function giveTurn(participant) {
		if (areAllTurnsDone()) {
			startNewRound();
		}

		debug('Giving turn to "', participant, '"...');

		if (participant === ENEMY_GROUP) {
			roundInfo().curID = ENEMY_GROUP;
			sendGMChooseEnemy();
			return buildResult();
		}

		if (hasActed(participant)) {
			debug(participant.name + ' already acted!');
			return buildMsgResult([participant.name + ' already acted during this turn!']);
		}

		roundInfo().curID = participant.id;
		roundInfo().curTurn++;
		debug('New turn: ' + roundInfo().curTurn);
		arrayRemove(roundInfo().toAct, participantHasID(participant.id));

		syncTurnOrder();

		const canGiveTurnTo = getPossibleSuccessors(participant);
		debug('Can give turn to: ', canGiveTurnTo);
		sendTurnInfo();
		sendChoice(participant, canGiveTurnTo);

		return buildResult();
	}

	function sendGMChooseEnemy() {
		const canGiveTurnTo = getPossibleSuccessors(ENEMY_GROUP);
		const buttons = buildGiveTurnButtons(canGiveTurnTo);
		const buttonsString = buttons.join(' ');
		send('gm', 'Choose an enemy to get the next turn: ' + buttonsString);
	}

	function getPossibleSuccessors(participant) {
		if (participant === ENEMY_GROUP) {
			if (roundInfo().toAct.length === 0) {
				return getEnemies();
			} else {
				return getEnemies().filter(enemy => {
					return roundInfo().toAct.some(participantHasID(enemy.id));
				});
			}
		}
		if (config.groupEnemies && isPlayer(participant)) {
			if (areAllTurnsDone()) {
				return getPlayers().concat([ENEMY_GROUP]);
			} else {
				const amountLeft = roundInfo().toAct.length;
				const playersToAct = roundInfo().toAct.filter(isPlayer);
				return amountLeft - playersToAct.length === 0 ? playersToAct : playersToAct.concat([ENEMY_GROUP]);
			}
		} else {
			return areAllTurnsDone() ? getAllParticipants() : roundInfo().toAct;
		}
	}

	function isPlayer(participant) {
		return _.negate(isEnemy)(participant);
	}

	function isEnemy(participant) {
		return participant.playerIDs.length === 0;
	}


	function sendChoice(participant, canGiveTurnTo) {
		const buttons = buildGiveTurnButtons(canGiveTurnTo);
		const buttonsString = buttons.join(' ');

		sendParticipant(participant, 'Give turn to <br />' + buttonsString);
	}

	function resendCurrentChoice() {
		const curParticipant = getCurrentParticipant();
		if (curParticipant.id === ENEMY_GROUP) {
			sendGMChooseEnemy();
		} else {
			sendChoice(curParticipant, getPossibleSuccessors(curParticipant));
		}
	}

	function sendParticipant(participant, message) {
		let recipients = participant.playerIDs.slice();
		if (recipients.length === 0 || (DEBUG && recipients.indexOf(participants().GMs) === -1)) {
			recipients = recipients.concat(participants().GMs);
		}

		recipients.forEach(recipient => {
			send(recipient, message);
		});
	}

	function buildGiveTurnButtons(canGiveTurnTo) {
		return canGiveTurnTo.map(participant => {
			let name;
			let id;
			if (participant === ENEMY_GROUP) {
				name = ENEMY_GROUP;
				id = ENEMY_GROUP;
			} else {
				name = participant.name;
				id = participant.id;
			}
			return '[' + name + '](' + COMMAND + ' giveturnAPI ' + id + ')';
		});
	}

	function getTurnInfo() {
		const curParticipant = getCurrentParticipant();
		let name = (config.groupEnemies && isEnemy(curParticipant)) ? 'the ' + ENEMY_GROUP : curParticipant.name;
		name = name.endsWith('s') ? name : (name + 's');
		return 'Round ' + (roundInfo().curRound + 1) + ', Turn ' + (roundInfo().curTurn + 1) + '<br/> It\'s ' + name + ' turn!';
	}

	function sendTurnInfo(playerID) {
		const turnInfo = getTurnInfo();
		if (playerID) {
			send(playerID, turnInfo);
		} else {
			sendInfo(turnInfo);
		}
	}

	function sendStatus(playerID) {
		sendParticipantsStatus(playerID);
		sendTurnInfo(playerID);
		sendActedStatus(playerID);
	}

	function getPlayers() {
		return participants().players.slice();
	}
	function getEnemies() {
		return participants().enemies.slice();
	}

	function sendParticipantsStatus(playerID) {
		let visibleParticipants = getPlayers();
		if (!config.groupEnemies || playerIsGM(playerID)) {
			visibleParticipants.push(...getEnemies());
		} else {
			visibleParticipants.push({name: 'a bunch of enemies'});
		}
		send(playerID, 'The following participants are in initiative: ' + '"' + visibleParticipants.map(p => p.name).join('", "') + '"');
	}

	function replaceWithGroupedEnemies(acted) {
		if (acted.some(isEnemy)) {
			acted = acted.filter(isPlayer);
			acted.push('a bunch of enemies');
		}
		return acted;
	}

	function sendActedStatus(playerID) {
		let acted = getAllParticipants().filter(hasActed);
		let toAct = roundInfo().toAct;
		if (config.groupEnemies && !playerIsGM(playerID)) {
			acted = replaceWithGroupedEnemies(acted);
			toAct = replaceWithGroupedEnemies(toAct);
		}


		send(playerID, 'These participants already acted this turn: ' + acted.map(p => p.name).join(', '));
		send(playerID, 'These participants still have to act during this turn: ' + toAct.map(p => p.name).join(', '));
	}

	function sendInfo(message) {
		sendChat(CHAT_NAME, message, null, {noarchive: true});
	}

	function hasActed(participant) {
		return !roundInfo().toAct.some(participantHasID(participant.id));
	}

	function arrayRemove(array, arg) {
		let pos;
		if (typeof arg === 'function') {
			pos = array.findIndex(arg);
		} else {
			pos = array.indexOf(arg);
		}
		return pos >= 0 ? array.splice(pos, 1) : array;
	}

	function isPlayersTurn(playerID) {
		const curParticipant = getCurrentParticipant();
		if (playerIsGM(playerID)) {
			return DEBUG || isEnemy(curParticipant);
		} else {
			return curParticipant.playerIDs.includes(playerID);
		}
	}

	function areAllTurnsDone() {
		return roundInfo().toAct.length === 0;
	}

	function isCombatRunning() {
		return roundInfo().curRound !== -1;
	}

	function tokenDeadHandler(graphic) {
		if (!graphic.get('status_dead')) {
			return;
		}
		const id = graphic.get('_id');
		const tokenIsEnemy = participants().enemyTokens[id];
		if (!tokenIsEnemy) {
			return;
		}
		const currentParticipant = getCurrentParticipant();
		const participant = getAllParticipants().find(participant => participant.token === id);
		if (!config.groupEnemies || isEnemy(currentParticipant)) {
			sendParticipant(currentParticipant, participant.name + ' died, these are the new choices:');
		}

		remove(participant);
	}

	function removeByTokenID(tokenID) {
		const participant = getAllParticipants().find(participant => participant.token === tokenID);
		remove(participant);
	}

	function participantHasID(id) {
		return participant => participant.id === id;
	}

	function removeByID(id) {
		const toRemove = getAllParticipants().find(participantHasID(id));
		if (!toRemove) {
			return;
		}
		remove(toRemove);
	}

	function remove(participant) {
		const shouldKeepParticipant = _.negate(participantHasID(participant.id));
		participants().players = participants().players.filter(shouldKeepParticipant);
		participants().enemies = participants().enemies.filter(shouldKeepParticipant);
		roundInfo().toAct = roundInfo().toAct.filter(shouldKeepParticipant);
		if (participants().enemyTokens[participant.tokenID]) {
			participants().enemyTokens[participant.tokenID] = false;
		}

		participantsChanged();
	}

	function participantsChanged() {
		if (getAllParticipants().length === 0) {
			stopCombat();
		} else if (!getCurrentParticipant()) {
			if (roundInfo().toAct.length > 0) {
				swapTurn(roundInfo().toAct[0]);
			} else {
				swapTurn(getHighestInit());
			}
		} else if (isCombatRunning()) {
			resendCurrentChoice();
		}

		syncTurnOrder();
	}

	function swapTurn(participant) {
		roundInfo().curTurn--;
		giveTurn(participant);
	}

	function getCurrentParticipant() {
		if (roundInfo().curID === ENEMY_GROUP) {
			return {
				id: ENEMY_GROUP,
				name: ENEMY_GROUP,
				playerIDs: [],
				token: undefined,
				init: 0
			};
		} else {
			return getParticipant(roundInfo().curID);
		}
	}

	function stopCombat() {
		sendInfo('Ending combat. Hopefully no player died!');
		resetParticipants();
		resetRoundInfo();
		resetTurnOrder();
		hideTurnOrder();
	}

	function showTurnOrder() {
		Campaign().set('initiativepage', true);
	}

	function hideTurnOrder() {
		Campaign().set('initiativepage', false);
	}

	on('ready', () => {
		log('Popcorn loaded');
	});
	return {};
})();

