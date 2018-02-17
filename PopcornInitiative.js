/* jshint -W132 */
var PopcornInitiative = PopcornInitiative || (function() {
	const DEBUG = true;
	const DEBUG_LOG = true;

	const COMMAND = '!pci';
	const CHAT_NAME = 'Initiative';

	const CHECK_OFF = '☐';
	const CHECK_PART = '▣';
	const CHECK_ON = '☑';

	const ENEMY_GROUP = 'Enemies';
	const ENEMY_GROUP_PARTICIPANT = {
		id: ENEMY_GROUP,
		name: ENEMY_GROUP,
		playerIDs: [],
		token: undefined,
		init: 0
	};

	class TacticalDice {

		static reset() {
			if (!config.tacticalDice.persist) {
				this._resetDice();
			}
			this._consecutiveTurns = 0;
			this._lastTeam = '';
		}

		static _resetDice() {
			this._setDice(this.ENEMIES, 0);
			this._setDice(this.PLAYERS, 0);
		}

		static fullReset() {
			this.reset();
			this._resetDice();
		}

		static getDice(team) {
			return this._state[team] + config.tacticalDice.die;
		}

		static _getDice(team) {
			return this._state[team];
		}

		static _setDice(team, count) {
			this._state[team] = count;
		}

		static _addDice(team, count) {
			this._state[team] += count;
		}

		static get _consecutiveTurns() {
			return this._state.consecutiveTurns;
		}

		static set _consecutiveTurns(turns) {
			this._state.consecutiveTurns = turns;
		}

		static get _lastTeam() {
			return this._state.lastTeam;
		}

		static set _lastTeam(team) {
			this._state.lastTeam = team;
		}

		static get _state() {
			return state.PopcornInitiative.tacticalDiceVar;
		}

		static addTurn(team) {
			if (team === this._lastTeam) {
				if (this.wouldGiveTacDice(team)) {
					this._addDice(this.getOtherTeam(team), this._wouldGiveTacDiceAmount(team));
				}
				this._consecutiveTurns++;
			} else {
				this._consecutiveTurns = 1;
				this._lastTeam = team;
			}
		}

		static newRound() {
			this._consecutiveTurns = 0;
		}

		static wouldGiveTacDice(team) {
			return this._hasTeamStayedTheSame(team) &&
				this._willMaxTurnsBeExceeded(team) &&
				!areAllTurnsDone() &&
				this._areMembersOfTheOtherTeamLeftInRound(team);
		}

		static _hasTeamStayedTheSame(team) {
			return team === this._lastTeam;
		}

		static _willMaxTurnsBeExceeded(team) {
			return this._consecutiveTurns >= this._getMaxConsecutiveTurns(team);
		}

		static _getMaxConsecutiveTurns(team) {
			const configuredValue = config.tacticalDice.maxConsecutiveTurns;
			const teamSize = this._getTeamParticipants(team).length;
			const otherTeamSize = this._getTeamParticipants(this.getOtherTeam(team)).length;
			let maxConsecutiveTurns;
			if (otherTeamSize >= teamSize) {
				maxConsecutiveTurns = configuredValue;
			} else {
				maxConsecutiveTurns = Math.floor(teamSize / otherTeamSize * configuredValue);
			}
			debug('maxConsecutiveTurns for team ', team, ': ', maxConsecutiveTurns);
			return maxConsecutiveTurns;
		}

		static getOtherTeam(team) {
			return TacticalDice.ENEMIES === team ? TacticalDice.PLAYERS : TacticalDice.ENEMIES;
		}

		static _getTeamParticipants(team) {
			return team === TacticalDice.ENEMIES ? getEnemies() : getPlayers();
		}

		static _areMembersOfTheOtherTeamLeftInRound(team) {
			const possibleSuccessors = getPossibleSuccessors(getCurrentParticipant());
			debug('_areMembersOfTheOtherTeamLeftInRound possibleSuccessors', possibleSuccessors);
			const isOfOtherTeam = (team === TacticalDice.ENEMIES) ? isPlayer : isEnemy;
			const membersOfOtherTeam = possibleSuccessors.filter(isOfOtherTeam);
			debug('_areMembersOfTheOtherTeamLeftInRound membersOfOtherTeam', membersOfOtherTeam);
			return membersOfOtherTeam.length > 0;
		}

		static _wouldGiveTacDiceAmount(team) {
			if (!this.wouldGiveTacDice(team)) {
				return 0;
			}

			if (config.tacticalDice.amountIncreasingPerTurn) {
				return this._consecutiveTurns - this._getMaxConsecutiveTurns(team) + 1;
			} else {
				return 1;
			}
		}

		static wouldGiveTacDiceAmount(team) {
			return this._wouldGiveTacDiceAmount(team) + config.tacticalDice.die;
		}

		static useDie(team) {
			return new Promise(resolve => {
				const dice = TacticalDice._getDice(team);
				if (dice === 0) {
					resolve(buildMsgResult(['The ' + team + ' do not currently have any tactical dice.']));
					return;
				}
				TacticalDice._setDice(team, dice - 1);
				roll(1 + config.tacticalDice.die).then(roll => {
					resolve(buildResult(roll));
				}).catch(reason => {
					resolve(buildMsgResult(['Error while rolling: ' + reason]));
				});
			});
		}
	}

	TacticalDice.ENEMIES = 'enemies';
	TacticalDice.PLAYERS = 'players';

	on('chat:message', messageHandler);

	on("change:graphic:status_dead", tokenDeadHandler);

	let config = {
		// In normal initiative, enemies on the GM layer are not shown to the players.
		// However, this can not be implemented in popcorn initiative: what happens when it's a player's turn and there are only hidden enemies left?
		// The only real solution is for the DM to only add tokens to initiative when they should be shown to the players, disabling the
		// possibility for hidden tokens, which is how it's implemented.
		groupEnemies: true,
		tacticalDice: {
			enabled: true,
			persist: true,
			maxConsecutiveTurns: 2,
			teamSizeAdjustment: true,
			die: 'd6',
			amountIncreasingPerTurn: true
		},
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

	if (!state.PopcornInitiative.tacticalDiceVar) {
		state.PopcornInitiative.tacticalDiceVar = {};
		TacticalDice.fullReset();
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
				Messages.sendError(msg.playerid, 'No token selected!');
				return;
			}
			const initiative = getOption(msg, 0);
			tokens.forEach(selectedToken => {
				const token = getObj('graphic', selectedToken._id);
				addToken(token, initiative).then(result => {
					const participant = result.result;
					if (result.errors.length > 0) {
						const tokenName = (token && token.get) ? token.get('name') : token;
						Messages.sendError(msg.playerid, 'Could not add token ' + tokenName, result.errors);
					} else if (result.warnings.length > 0) {
						const content = 'Added ' + participant.name + ', initiative ' + participant.init;
						Messages.sendWarning(msg.playerid, content, result.warnings);
					} else {
						Messages.sendInfo(msg.playerid, 'Added ' + participant.name + ' with initiative ' + participant.init + '.');
					}
				});
			});
		},
		remove: msg => {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can remove combat participants.');
				return;
			}

			const id = getOption(msg, 0);

			if (id) {
				removeByID(id);
				// TODO errors
			} else {
				const selection = getCurrentSelection(msg);
				const selectionIDs = selection.map(graphic => graphic._id);
				selectionIDs.forEach(removeByTokenID);
				// TODO errors
			}

		},
		start: msg => {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can start fights.');
				return;
			}

			if (isCombatRunning()) {
				Messages.sendError(playerID, 'A combat is already going on.');
				return;
			}

			addTurnOrder(msg).then(() => {
				if (getAllParticipants().length === 0) {
					Messages.sendError(msg.playerid, 'Trying to start combat with no participants!');
					return;
				}
				debug('Starting new combat...');
				debug('Participants: ', participants());

				startCombat();
			});
		},
		stop: msg => {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can stop fights.');
				return;
			}

			if (!isCombatRunning()) {
				Messages.sendError(playerID, 'There is no fight going on.');
				return;
			}

			stopCombat();
		},
		giveturnAPI: msg => {
			const playerID = msg.playerid;
			if (!isCombatRunning()) {
				debug('Player ', msg.who, ' tried to give turn over, but no combat is running.');
				Messages.sendError(playerID, 'Can\'t give turn, no combat running!');
				return;
			}
			if (!isPlayersTurn(playerID)) {
				debug('Player ', msg.who, ' tried to give turn over, but it\'s not his turn.');
				Messages.sendError(msg.playerid, 'It\'s not your turn!');
				return;
			}
			const option = getOption(msg, 0);
			let participant = (config.groupEnemies && option === ENEMY_GROUP) ? ENEMY_GROUP_PARTICIPANT : getParticipant(option);
			if (!participant) {
				Messages.sendError(msg.playerid, 'You tried to give turn to ', option, ' but a participant with that ID does not exist!');
				return;
			}
			const result = giveTurn(participant);
			if (result.errors.length > 0) {
				Messages.sendError(playerID, 'Can not give turn to ' + participant.name, result.errors);
			} else {
				Messages.sendInfo(playerID, 'You successfully gave the turn to "' + participant.name + '".');
			}
		},
		reset: msg => {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can reset the popcorn initiative.');
				return;
			}
			resetParticipants();
			resetRoundInfo();
			TacticalDice.fullReset();
			Messages.sendInfo(playerID, 'Popcorn initiative has been reset.');
		},
		status: msg => {
			debug('Participants:', state.PopcornInitiative.participantsVar);
			debug('RoundInfo:', state.PopcornInitiative.roundInfoVar);
			debug('TacDice:', state.PopcornInitiative.tacticalDiceVar);

			const playerID = msg.playerid;
			if (isCombatRunning()) {
				Messages.sendStatus(playerID);
			} else {
				Messages.sendInfo(playerID, 'No combat running.');

				Messages.sendTacticalDiceStatus(playerID);

				if (playerIsGM(playerID)) {
					Messages.sendParticipantsStatus(playerID);
				}
			}
		},
		menu: msg => {
			const playerID = msg.playerid;

			if (!isCombatRunning()) {
				Messages.sendError(playerID, 'No combat running, there is nothing you can do right now.');
			} else if (isPlayersTurn(playerID)) {
				Messages.resendCurrentChoice();
			} else {
				Messages.sendWarning(playerID, 'It\'s not your turn so there is no menu for you, but here\'s the current ' +
					'status (next time use "' + COMMAND + ' status"):');
				Messages.sendStatus(playerID);
			}
		},
		tac: msg => {
			const playerID = msg.playerid;
			if (!config.tacticalDice.enabled) {
				Messages.sendError(playerID, 'Tactical dice are not enabled.');
				return;
			}

			const option1 = getOption(msg, 0);
			switch (option1) {
				case undefined:
					Messages.sendTacticalDiceStatus(playerID);
					break;
				case 'use':
					const team = playerIsGM(playerID) ? TacticalDice.ENEMIES : TacticalDice.PLAYERS;
					TacticalDice.useDie(team).then(result => {
						if (result.errors.length > 0) {
							Messages.sendError(playerID, 'Could not use tactical die.', result.errors);
							return;
						}
						const roll = result.result;
						const remaining = TacticalDice.getDice(team);
						Messages.postInfo('"' + msg.who + '" used a tactical die for the ' + team +
							' (' + remaining + ' remaining).\n\nResult: ' + roll);
					});
					break;
				default:
					Messages.sendError(playerID, 'Unrecognized option "' + option1 + '"');
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
			Messages.sendHelp(msg.playerid);
			return;
		}

		const handler = handlers[options[1]];
		if (!handler) {
			Messages.sendHelp(msg.playerid);
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
				.reduce((message, arg) => message + arg);
		}

		const htmlBuilder = new HtmlBuilder('pre', message);

		Messages.sendRaw('-L5DOgB6lPNKGooiSHet', htmlBuilder.toString());
	}


	function getPlayerName(playerID) {
		return playerID && playerID !== 'gm' ? '"' + getObj('player', playerID).get('displayname') + '"' : 'gm';
	}

	function startCombat() {
		const players = getPlayers().map(player => player.name + ' (Init: ' + player.init + ')');
		const playerMessage = 'Starting combat with ' + players.length + ' player' + ((players.length !== 1) ? 's' : '') + ': ' + players.join(', ');
		const hfgl = '! Have fun ;)';
		if (config.groupEnemies) {
			Messages.postInfo(playerMessage + hfgl);
		} else {
			const enemies = getEnemies().map(enemy => enemy.name + ' (Init: ' + enemy.init + ')');
			const enemyMessage = enemies.length + ' enemy' + ((enemies.length !== 1) ? 's' : '') + ': ' + enemies.join(', ');
			Messages.postInfo(playerMessage + ' and ' + enemyMessage + hfgl);
		}
		showTurnOrder();
		resetRoundInfo();
		if (config.tacticalDice.enabled) {
			TacticalDice.reset();
		}
		startNewRound();
		const highestInit = getHighestInit();
		if (config.groupEnemies && isEnemy(highestInit)) {
			Messages.postInfo('An enemy won initiative with a ' + highestInit.init + ' and will start the combat!');
		} else {
			Messages.postInfo(highestInit.name + ' won initiative with a ' + highestInit.init + '!');
		}
		setCurrentParticipant(highestInit);
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

		const filterCurrent = participants => participants.filter(_.negate(participantHasID(currentParticipant.id)));

		let restTurnOrderEntries;
		if (config.groupEnemies) {
			restTurnOrderEntries = buildTurnOrderEntries(filterCurrent(getPlayers()));
			debug('Rest players: ', restTurnOrderEntries);
			if (isPlayer(currentParticipant)) {
				debug('Add enemies');
				restTurnOrderEntries.push(buildEnemiesTurnOrderEntry());
				debug('Rest players: ', restTurnOrderEntries);
			}
		} else {
			const allWithoutCurrent = filterCurrent(getAllParticipants());
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
		roundInfo().curTurn = 0;
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
				debug('Turnorder addTokenID result ', result);
				const tokenString = token && JSON.stringify(token);
				if (result.errors.length > 0) {
					Messages.sendError(msg.playerid, 'Error(s) while adding token \'' + tokenString + '\'', result.errors);
				}
				if (result.warnings.length > 0) {
					Messages.sendWarning(msg.playerid, 'Warning(s) while adding token \'' + tokenString + '\'', result.warnings);
				}
			});
		});

		return Promise.all(tokenPromises);
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
		debug('Adding token ', token);

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
			debug('Adding result from token add: ', addResult);
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
			roll(participant.init).then(roll => {
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
			}).catch(reason => {
				resolve(buildMsgResult(['Error while rolling: ' + reason]));
			});
		});
	}

	function roll(query) {
		return new Promise(resolve => {
			sendChat(CHAT_NAME, '/r ' + query, msg => {
				const rollResult = JSON.parse(msg[0].content);
				resolve(rollResult.total);
			});
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
		roundInfo().curTurn = 0;
		roundInfo().toAct = getAllParticipants();

		if (config.tacticalDice.enabled) {
			TacticalDice.newRound();
		}
	}

	function giveTurn(participant) {
		const result = setCurrentParticipant(participant);

		if (result.errors.length === 0 && result.warnings.length === 0) {
			roundInfo().curTurn++;
			debug('New turn: ' + roundInfo().curTurn);
		}

		return result;
	}

	function setCurrentParticipant(participant) {
		if (areAllTurnsDone()) {
			startNewRound();
		}

		debug('Giving turn to "', participant, '"...');

		if (participant.id === ENEMY_GROUP) {
			roundInfo().curID = ENEMY_GROUP;
			const enemies = getPossibleSuccessors(participant).filter(isEnemy);
			if (enemies.length === 1) {
				return setCurrentParticipant(enemies[0]);
			} else {
				Messages.sendGMChooseEnemy();
				return buildMsgResult(undefined, ['No participant set, the GM will be choosing the participant.']);
			}
		}

		if (hasActed(participant)) {
			debug(participant.name + ' already acted!');
			return buildMsgResult([participant.name + ' already acted during this turn!']);
		}

		roundInfo().curID = participant.id;
		arrayRemove(roundInfo().toAct, participantHasID(participant.id));

		if (config.tacticalDice.enabled) {
			TacticalDice.addTurn(isEnemy(participant) ? TacticalDice.ENEMIES : TacticalDice.PLAYERS);
		}

		syncTurnOrder();

		const possibleSuccessors = getPossibleSuccessors(participant);
		debug('Can give turn to: ', possibleSuccessors);
		Messages.postTurnInfo();
		Messages.sendChoice(participant, possibleSuccessors);

		return buildResult();
	}


	function getPossibleSuccessors(participant) {
		if (participant.id === ENEMY_GROUP) {
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
				return getPlayers().concat([ENEMY_GROUP_PARTICIPANT]);
			} else {
				const amountLeft = roundInfo().toAct.length;
				const playersToAct = roundInfo().toAct.filter(isPlayer);
				return ((amountLeft - playersToAct.length) === 0) ? playersToAct : playersToAct.concat([ENEMY_GROUP_PARTICIPANT]);
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

	function getPlayers() {
		return participants().players.slice();
	}

	function getEnemies() {
		return participants().enemies.slice();
	}

	function replaceWithGroupedEnemies(acted) {
		if (acted.some(isEnemy)) {
			acted = acted.filter(isPlayer);
			acted.push('a bunch of enemies');
		}
		return acted;
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
		if (!curParticipant) {
			return false;
		} else if (playerIsGM(playerID)) {
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
			Messages.sendParticipant(currentParticipant, participant.name + ' died, these are the new choices:');
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
				setCurrentParticipant(roundInfo().toAct[0]);
			} else {
				setCurrentParticipant(getHighestInit());
			}
		} else if (isCombatRunning()) {
			Messages.resendCurrentChoice();
		}

		syncTurnOrder();
	}

	function getCurrentParticipant() {
		if (roundInfo().curID === ENEMY_GROUP) {
			return ENEMY_GROUP_PARTICIPANT;
		} else {
			return getParticipant(roundInfo().curID);
		}
	}

	function stopCombat() {
		Messages.postInfo('Ending combat. Hopefully no player died!');
		resetParticipants();
		resetRoundInfo();
		if (config.tacticalDice.enabled) {
			TacticalDice.reset();
		}
		resetTurnOrder();
		hideTurnOrder();
	}

	function tacConfig(variable) {
		return config.tacticalDice.enabled && config.tacticalDice[variable];
	}

	function showTurnOrder() {
		Campaign().set('initiativepage', true);
	}

	function hideTurnOrder() {
		Campaign().set('initiativepage', false);
	}

	class Messages {
		static sendRaw(playerID, msg) {
			this._sendChatNoArchive('/w ' + getPlayerName(playerID) + ' ' + msg);
		}

		static _sendChatNoArchive(msg) {
			const msgWithoutLinebreaks = msg.replace(/\n/g, '<br/>');
			this._sendChat(msgWithoutLinebreaks, null, {noarchive: true});
		}

		static _sendChat(msg, callback, options) {
			const msgWithoutLinebreaks = msg.replace(/\n/g, '<br/>');
			sendChat(CHAT_NAME, msgWithoutLinebreaks, callback, options);
		}

		static sendError(playerID, message, errors) {
			this.sendRaw(playerID, this.createResultMessage('error', message, errors));
		}

		static sendWarning(playerID, message, warnings) {
			this.sendRaw(playerID, this.createResultMessage('warning', message, warnings));
		}

		static createResultMessage(type, message, extraMessages) {
			let msgBuilder = new HtmlBuilder('div.message ' + type, message);
			if (extraMessages && extraMessages.length !== 0) {
				msgBuilder.append('div', type + '(s):', {
					style: {
						'margin-top': '9px'
					}
				});
				let ul = msgBuilder.append('ul.extras');
				extraMessages.forEach(extra => ul.append('li', extra));
			}
			msgBuilder.setCss({
				'extras': {
					'margin-bottom': '0',
					'margin-top': '9px'
				},
				'message': {
					'border-style': 'solid',
					'border-width': '1px',
					'border-radius': '6px',
					'padding': '4px'
				},
				'info': {
					'background-color': '#fff',
					'border-color': '#000',
				},
				'error': {
					'background-color': '#ffd6d6',
					'border-color': '#f00',
				},
				'warning': {
					'background-color': '#ffe199',
					'border-color': '#c87f00',
				}
			});
			return msgBuilder.toString();
		}

		static sendHelp(playerID) {
			this.sendInfo(playerID, 'Unrecognized command');

			// TODO better help
		}

		static sendActedStatus(playerID) {
			let acted = getAllParticipants().filter(hasActed);
			let toAct = roundInfo().toAct;
			if (config.groupEnemies && !playerIsGM(playerID)) {
				acted = replaceWithGroupedEnemies(acted);
				toAct = replaceWithGroupedEnemies(toAct);
			}

			if (acted.length === 0) {
				this.sendInfo(playerID, 'Noone acted this turn yet.');
			} else {
				this.sendInfo(playerID, 'These participants already acted this turn: ' + acted.map(p => p.name).join(', '));
			}

			if (toAct.length === 0) {
				this.sendInfo(playerID, 'Everyone acted already.');
			} else {
				this.sendInfo(playerID, 'These participants still have to act during this turn: ' + toAct.map(p => p.name).join(', '));
			}
		}

		static postInfo(message) {
			this.postRaw(this.createResultMessage('info', message));
		}

		static postRaw(message) {
			this._sendChat(message);
		}

		static sendInfo(playerID, message) {
			this.sendRaw(playerID, this.createResultMessage('info', message));
		}

		static sendChoice(participant, canGiveTurnTo) {
			const canGiveTurnToGrouped = _.groupBy(canGiveTurnTo, participant => isEnemy(participant) ? 'enemies' : 'players');
			const playerButtons = this.buildGiveTurnButtons(canGiveTurnToGrouped.players || []).join(' ');
			const enemyButtons = this.buildGiveTurnButtons(canGiveTurnToGrouped.enemies || []).join(' ');

			const htmlBuilder = new HtmlBuilder();
			const yourTurn = htmlBuilder.append('div', 'It\'s your turn, ', {
				style: {
					'font-weight': 'bold',
					'font-size': '1.3em'
				}
			});
			yourTurn.append('span', participant.name, {
				style: {
					'font-weight': 'bold',
					'color': '#117412'
				}
			});
			yourTurn.append('span', '!');
			this._appendHR(htmlBuilder);
			htmlBuilder.append('div', 'Give turn to:', {
				style: {
					'margin': '9px 0'
				}
			});

			if (isPlayer(participant) && playerButtons.length > 0) {
				this._addTacDiceWarning(htmlBuilder, TacticalDice.PLAYERS);
			}
			htmlBuilder.append('div', playerButtons);
			if (isEnemy(participant) && enemyButtons.length > 0) {
				this._addTacDiceWarning(htmlBuilder, TacticalDice.ENEMIES);
			}
			htmlBuilder.append('div', enemyButtons);

			this.sendParticipant(participant, htmlBuilder.toString());
		}

		static _addTacDiceWarning(htmlBuilder, team) {
			if (TacticalDice.wouldGiveTacDice(team)) {
				const wouldGiveTacDiceAmount = TacticalDice.wouldGiveTacDiceAmount(team);
				const otherTeam = TacticalDice.getOtherTeam(team);
				const message = 'Warning! Giving the turn to your team again would give the ' + otherTeam + ' ' + wouldGiveTacDiceAmount +
					' tactical dice!';
				htmlBuilder.append('div', message, {
					style: {
						'color': '#F00',
						'margin': '9px 0'
					}
				});
			}
		}

		static resendCurrentChoice() {
			const curParticipant = getCurrentParticipant();
			if (curParticipant.id === ENEMY_GROUP) {
				this.sendGMChooseEnemy();
			} else {
				this.sendChoice(curParticipant, getPossibleSuccessors(curParticipant));
			}
		}

		static sendParticipant(participant, message) {
			let recipients = participant.playerIDs.slice();
			if (recipients.length === 0 || (DEBUG && recipients.indexOf(participants().GMs) === -1)) {
				recipients = recipients.concat(participants().GMs);
			}

			recipients.forEach(recipient => {
				this.sendInfo(recipient, message);
			});
		}

		static buildGiveTurnButtons(canGiveTurnTo) {
			return canGiveTurnTo.map(participant => {
				const bgColor = isEnemy(participant) ? '#a12313' : '#117412';
				return this.buildButton(participant.name, COMMAND + ' giveturnAPI ' + participant.id, bgColor);
			});
		}

		static buildButton(label, link, style) {
			if (typeof style === 'string') {
				style = {
					'background-color': style,
					'font-weight': 'bold',
					'border-radius': '6px',
				};
			}
			return new HtmlBuilder('a', label, {
				href: link,
				style: style
			}).toString();
		}

		static sendGMChooseEnemy() {
			const canGiveTurnTo = getPossibleSuccessors(ENEMY_GROUP_PARTICIPANT);
			const buttons = this.buildGiveTurnButtons(canGiveTurnTo);
			const buttonsString = buttons.join(' ');
			this.sendInfo('gm', 'Choose an enemy to get the next turn: ' + buttonsString);
		}

		static sendStatus(playerID) {
			this.sendParticipantsStatus(playerID);
			this.sendTurnInfo(playerID);
			this.sendActedStatus(playerID);
		}

		static sendParticipantsStatus(playerID) {
			let visibleParticipants = getPlayers();
			if (!config.groupEnemies || playerIsGM(playerID)) {
				visibleParticipants.push(...getEnemies());
			} else {
				visibleParticipants.push({name: 'a bunch of enemies'});
			}
			this.sendInfo(playerID, 'The following participants are in initiative: ' + '"' + visibleParticipants.map(p => p.name).join('", "') + '"');
		}

		static sendTurnInfo(playerID) {
			this.sendInfo(playerID, this._getTurnInfo());
		}

		static postTurnInfo() {
			this.postInfo(this._getTurnInfo());
		}


		static _getTurnInfo() {
			const curParticipant = getCurrentParticipant();
			let name = (config.groupEnemies && isEnemy(curParticipant)) ? 'The enemies' : curParticipant.name;

			const htmlBuilder = new HtmlBuilder();
			htmlBuilder.append('div', 'Round ' + (roundInfo().curRound + 1) + ', Turn ' + (roundInfo().curTurn + 1), {
				style: {
					'font-variant': 'small-caps',
					'font-weight': 'bold',
					'font-size': '1.3em',
				}
			});
			if (config.tacticalDice.enabled) {
				this._appendHR(htmlBuilder);
				htmlBuilder.append('div', this._getTacticalDiceInfo());
			}
			this._appendHR(htmlBuilder);
			const nowActing = htmlBuilder.append('div', 'Now acting: ');
			const color = isEnemy(curParticipant) ? '#a12313' : '#117412';
			nowActing.append('span', name, {
				style: {
					'font-size': '1.1em',
					'font-weight': 'bold',
					'color': color
				}
			});
			return htmlBuilder.toString();
		}

		static sendTacticalDiceStatus(playerID) {
			this.sendInfo(playerID, this._getTacticalDiceInfo());
		}

		static _getTacticalDiceInfo() {
			const htmlBuilder = new HtmlBuilder();
			const heading = htmlBuilder.append('p', 'Tactical dice', {
				style: {
					'font-weight': 'bold'
				}
			});
			heading.append('span', ' (' + this.buildButton('Use one', COMMAND + ' tac use', {
				'color': '#4273e7',
				'background-color': 'transparent',
				'text-decoration': 'underline',
				'padding': '0'
			}) + ')');
			htmlBuilder.append('p', 'Players: ' + TacticalDice.getDice(TacticalDice.PLAYERS));
			htmlBuilder.append('p', 'Enemies: ' + TacticalDice.getDice(TacticalDice.ENEMIES));
			return htmlBuilder.toString();
		}

		static _appendHR(htmlBuilder) {
			htmlBuilder.append('hr', null, {
				style: {
					'margin': '9px 0'
				}
			});
		}

	}

	on('ready', () => {
		log('Popcorn loaded');
	});
	return {};
})();
