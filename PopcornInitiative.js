/* jshint -W132 */
var PopcornInitiative = PopcornInitiative || (function() {
	const DEBUG = true;

	const COMMAND = DEBUG ? '!pc' : '!popcorn';

	const CHECK_OFF = '☐';
	const CHECK_PART = '▣';
	const CHECK_ON = '☑';

	on('chat:message', messageHandler);

	on("change:graphic:status_dead", tokenDeadHandler);

	let config = {
		groupMonsters: true
	};

	state.PopcornInitiative = {};
	state.PopcornInitiative.participantsVar = {};

	function participants() {
		return state.PopcornInitiative.participantsVar;
	}

	resetParticipants();


	state.PopcornInitiative.roundInfoVar = {};

	function roundInfo() {
		return state.PopcornInitiative.roundInfoVar;
	}

	resetRoundInfo();

	state.PopcornInitiative.handleDeadToken = tokenDeadHandler;

	const handlers = {
		add: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}
			const names = getRemainingOptions(msg, 0);
			if (names.length !== 0) {
				addToParticipants(names);
			} else {
				addToParticipants(getCurrentSelection(msg));
			}
		},
		remove: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}

			const id = getOption(msg, 0);

			if (id) {
				removeById(id);
			} else {
				const selection = getCurrentSelection(msg);
				const selectionIds = selection.map(graphic => graphic._id);
				selectionIds.forEach(removeByTokenId);
			}

		},
		start: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}
			participants().gm = msg.playerid;

			// TODO add from turn tracker

			if (getAllParticipants().length === 0) {
				debug('Trying to start combat with no participants!');
				// TODO error
				return;
			}
			debug('Starting new combat...');
			debug('Participants: ', participants());
			resetRoundInfo();
			startNewRound();
			giveTurn(getHighestInit());
		},
		stop: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}
			stopCombat();
		},
		giveturn: msg => {
			const playerId = msg.playerid;
			if (!playerIsGM(playerId) && !isPlayersTurn(playerId)) {
				debug('Player ', msg.who, ' tried to give turn over, but is not GM or it\'s not his turn.');
				// TODO error
				return;
			}
			const id = getOption(msg, 0);
			const participant = getParticipant(id);
			if (!participant) {
				debug('Tried to give turn to ', id, ' but that\'s not a valid participant');
				// TODO error
				return;
			}
			giveTurn(participant);
		},
		status: msg => {
			// TODO pretty print
			debug('Current participants: ', participants());
			debug('Current round status: ', roundInfo());
		},
		debug: msg => {
			if (!playerIsGM(msg.playerid)) {
				return;
			}
			const id = getOption(msg, 0);
			if (!id) {
				return;
			}

			debug(findObjs({
				_id: id
			}));
		}
	};

	function getOption(msg, idx) {
		let options = msg.content.split(' ');

		// skip command + sub command
		let realIdx = idx + 2;

		if (options.length < realIdx + 1) {
			return undefined;
		}

		return options[realIdx];
	}

	function getRemainingOptions(msg, idx) {
		const options = msg.content.split(' ');

		// skip command + sub command
		let realIdx = idx + 2;

		if (options.length < realIdx + 1) {
			return [];
		}

		return options.slice(realIdx);
	}

	function messageHandler(msg) {
		if (msg.who !== 'Initiative') {
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

	function debug() {
		if (!DEBUG) {
			return;
		}
		// for roll20: $('#consolepanel').before('<button onclick=ace.edit("apiconsole").setValue("")>Clear</button>')
		const args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
		let message = '';
		if (arguments.length === 0) {
			message = 'Debug message missing!';
		} else {
			message = args.map(arg => (typeof arg === 'object') ? JSON.stringify(arg, null, 4) : arg)
				.reduce((message, arg) => message + arg)
				.replace(/\n/g, '<br/>');
		}

		send('-L5DOgB6lPNKGooiSHet', '<pre>' + message + '</pre>');
	}

	function send(playerId, content) {
		sendChat('Initiative', '/w ' + getPlayerName(playerId) + ' ' + content, null, {noarchive: true});
	}

	function sendHelp(playerId, options) {
		send(playerId, 'Unrecognized command');
	}

	function getPlayerName(playerId) {
		return playerId ? '"' + getObj("player", playerId).get("displayname") + '"' : "gm";
	}

	function getTurnOrder() {
		const turnorder = Campaign().get('turnorder');
		return turnorder ? JSON.parse(turnorder) : [];
	}

	function resetParticipants() {
		participants().players = [];
		participants().monsters = [];
		participants().monsterTokens = {};
		participants().gm = [];
	}

	function resetRoundInfo() {
		roundInfo().curRound = -1;
		roundInfo().curTurn = -1;
		roundInfo().curId = undefined;
		roundInfo().toAct = [];
	}

	function addToParticipants(newParticipants) {
		// TODO if running, reprint turn info
		debug('Adding participants...: ', newParticipants);
		newParticipants.forEach(newParticipant => {
			if (typeof newParticipant === 'object') {
				addToken(newParticipant._id);
			} else if (typeof newParticipant === 'string') {
				addMonster(newParticipant);
			}
		});
		debug('Added participants, participants now: ', participants());
	}

	function addToken(id) {
		const token = getObj('graphic', id);
		if (token.get('_subtype') !== 'token') {
			return;
		}
		if (isPlayerControlled(token)) {
			addPlayer(token);
		} else {
			addMonster(token);
		}
	}

	function isPlayerControlled(token) {
		const playerIds = getControllingPlayers(token);
		const noGm = playerIds.filter(_.negate(playerIsGM));
		return noGm.length > 0;
	}

	function addPlayer(token) {
		const player = buildParticipantFromTokenOrString(token);
		if (getParticipant(player.id)) {
			debug('Player already added, skipping.');
			return;
		}
		participants().players.push(player);
		debug('Added player: "', player, '"');
	}

	function addMonster(obj) {
		const monster = buildParticipantFromTokenOrString(obj);
		if (getParticipant(monster.id)) {
			debug('Monster already added, skipping.');
			return;
		}
		participants().monsters.push(monster);
		if (monster.token) {
			participants().monsterTokens[monster.token] = true;
		}
		debug('Added monster: "', monster, '"');
	}

	function buildParticipantFromTokenOrString(obj) {
		if (typeof obj === 'object' && obj.get('subtype') === 'token') {
			const token = obj;
			const playerIds = isPlayerControlled(token) ? getControllingPlayers(token) : [];
			const id = token.get('_id');
			return {
				id: id,
				playerIds: playerIds,
				token: id,
				name: token.get('name'),
				init: 0 // TODO set correct initiative
			};
		} else {
			const name = '' + obj;
			return {
				id: name,
				playerIds: [],
				token: undefined,
				name: name,
				init: 0 // TODO set correct initiative
			};
		}
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
		return allParticipants.find(participant => participant.id === id);
	}

	function getAllParticipants() {
		return participants().players.concat(participants().monsters);
	}

	function getHighestInit() {
		return getAllParticipants()
			.reduce((highest, current) => (current.init > highest.init) ? current : highest);
	}

	function startNewRound(playerId) {
		debug('Starting new Round...');
		roundInfo().curRound++;
		roundInfo().curId = playerId;
		debug('New round: ' + roundInfo().curRound);
		roundInfo().curTurn = -1;
		roundInfo().toAct = getAllParticipants();
	}

	function giveTurn(participant) {
		if (areAllTurnsDone()) {
			startNewRound();
		}

		debug('Giving turn to "', participant.name, '"...');

		if (hasActed(participant)) {
			debug(participant.name + ' already acted!');
			// TODO error
			return;
		}

		roundInfo().curId = participant.id;
		roundInfo().curTurn++;
		debug('New turn: ' + roundInfo().curTurn);
		arrayRemove(roundInfo().toAct, participant);

		const canGiveTurnTo = getPossibleSuccessors();
		debug('Can give turn to: ', canGiveTurnTo);
		sendTurnInfo(participant, roundInfo().curRound, roundInfo().curTurn);
		sendChoice(participant, canGiveTurnTo);
	}

	function getPossibleSuccessors() {
		return areAllTurnsDone() ? getAllParticipants() : roundInfo().toAct;
	}

	function sendChoice(participant, canGiveTurnTo) {
		let recipients = participant.playerIds;
		if (recipients.length === 0) {
			recipients.push(participants().gm);
		}
		if (DEBUG) {
			recipients = [participants().gm];
		}
		const buttons = buildGiveTurnButtons(canGiveTurnTo);
		const buttonsString = buttons.join(' ');
		recipients.forEach(recipient => {
			send(recipient, 'Give turn to <br />' + buttonsString);
		});
	}

	function buildGiveTurnButtons(canGiveTurnTo) {
		return canGiveTurnTo.map(participant => '[' + participant.name + '](' + COMMAND + ' giveturn ' + participant.id + ')');
	}

	function sendTurnInfo(participant, round, turn) {
		sendInfo('Round ' + (round + 1) + ', Turn ' + (turn + 1) + '<br/> It\'s ' + participant.name + 's turn!');
	}

	function sendInfo(message) {
		sendChat('Initiative', message, null, {noarchive: true});
	}

	function hasActed(participant) {
		return !roundInfo().toAct.some(toAct => toAct.id === participant.id);
	}

	function arrayRemove(array, elem) {
		const pos = array.indexOf(elem);
		return pos >= 0 ? array.splice(pos, 1) : array;
	}

	function isPlayersTurn(playerId) {
		const curParticipant = getParticipant(roundInfo().curId);
		return curParticipant.playerIds.includes(playerId);
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
		const tokenIsMonsterParticipant = participants().monsterTokens[id];
		if (!tokenIsMonsterParticipant) {
			return;
		}

		removeByTokenId(id);
	}

	function removeByTokenId(tokenId) {
		const participant = getAllParticipants().find(participant => participant.token === tokenId);
		removeById(participant.id);
	}

	function removeById(id) {
		const shouldKeepParticipant = participant => participant.id !== id;
		const toRemove = getAllParticipants().find(_.negate(shouldKeepParticipant));
		if (!toRemove) {
			return;
		}
		participants().players = participants().players.filter(shouldKeepParticipant);
		participants().monsters = participants().monsters.filter(shouldKeepParticipant);
		roundInfo().toAct = roundInfo().toAct.filter(shouldKeepParticipant);
		if (participants().monsterTokens[toRemove.tokenId]) {
			participants().monsterTokens[toRemove.tokenId] = false;
		}
		if (getAllParticipants().length === 0) {
			stopCombat();
		} else if (roundInfo().curId === id) {
			if (roundInfo().toAct.length > 0) {
				swapTurn(roundInfo().toAct[0]);
			} else {
				swapTurn(getHighestInit());
			}
		} else if (isCombatRunning()) {
			sendChoice(getCurrentParticipant(), getPossibleSuccessors());
		}
	}

	function swapTurn(participant) {
		roundInfo().curTurn--;
		giveTurn(participant);
	}

	function getCurrentParticipant() {
		return getParticipant(roundInfo().curId);
	}

	function stopCombat() {
		resetParticipants();
		resetRoundInfo();
	}

	on('ready', () => {
		log('Popcorn loaded');
	});
	return {
	};
})();

