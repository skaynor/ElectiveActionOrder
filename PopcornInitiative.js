/* jshint -W132 */
var PopcornInitiative = PopcornInitiative || (function() {
	const DEBUG = true;

	const COMMAND = '!pci';
	const CHAT_NAME = 'Initiative';

	const CHECK_OFF = '☐';
	const CHECK_PART = '▣';
	const CHECK_ON = '☑';

	const MONSTER_GROUP = 'Monsters';

	on('chat:message', messageHandler);

	on("change:graphic:status_dead", tokenDeadHandler);

	let config = {
		// NOT grouping the monsters currently does not make sense, and maybe will never. The problem that would have to be solved is
		// monsters on the GM layer.
		// Monsters on the GM layer are not shown to the players, and shouldn't be shown to the players for selecting in popcorn initiative.
		// But that's problematic: what happens when it's a player's turn and there are only hidden monsters left?
		// As such, thsi will probably remain "true" or may even be removed...
		groupMonsters: true
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
				debug('Add: no token selected!');
				// TODO error
				return;
			}
			const tokenIds = tokens.map(token => token._id);
			const initiative = getOption(msg, 0);
			tokenIds.forEach(id => addTokenId(id, initiative));
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

			addTurnOrder();

			if (getAllParticipants().length === 0) {
				debug('Trying to start combat with no participants!');
				// TODO error
				return;
			}
			debug('Starting new combat...');
			debug('Participants: ', participants());

			startCombat();
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
			const option = getOption(msg, 0);
			let participant = (config.groupMonsters && option === MONSTER_GROUP) ? MONSTER_GROUP : getParticipant(option);
			if (!participant) {
				debug('Tried to give turn to ', option, ' but that\'s not a valid participant');
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
		},
		selection: msg => {
			debug(getCurrentSelection(msg));
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
		return playerId && playerId !== 'gm' ? '"' + getObj('player', playerId).get('displayname') + '"' : 'gm';
	}

	function startCombat() {
		showTurnOrder();
		resetRoundInfo();
		startNewRound();
		giveTurn(getHighestInit());
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
		if (config.groupMonsters && isMonster(currentParticipant)) {
			currentEntry = buildMonstersTurnOrderEntry();
		} else {
			currentEntry = buildTurnOrderEntry(currentParticipant, true);
		}
		currentEntry.pr = '';

		let restTurnOrderEntries;
		if (config.groupMonsters) {
			restTurnOrderEntries = buildTurnOrderEntries(participants().players, currentParticipant);
			debug('Rest players: ', restTurnOrderEntries);
			if (isPlayer(currentParticipant)) {
				debug('Add monsters');
				restTurnOrderEntries.push(buildMonstersTurnOrderEntry());
				debug('Rest players: ', restTurnOrderEntries);
			}
		} else {
			restTurnOrderEntries = buildTurnOrderEntries(getAllParticipants(), currentParticipant);
		}
		return [currentEntry].concat(restTurnOrderEntries);
	}

	function buildTurnOrderEntries(participants, currentParticipant) {
		const allWithoutCurrent = participants.filter(_.negate(participantHasId(currentParticipant.id)));
		let allWithActed = allWithoutCurrent.map(participant => {
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

	function buildMonstersTurnOrderEntry() {
		const totalMonsterCount = participants().monsters.length;
		const toActMonsterCount = roundInfo().toAct.filter(isMonster).length;
		let pr;
		debug('ToActMonsterCount ', toActMonsterCount);
		if (toActMonsterCount === totalMonsterCount) {
			pr = CHECK_OFF;
		} else if (toActMonsterCount === 0) {
			pr = CHECK_ON;
		} else {
			pr = CHECK_PART;
		}
		return {
			id: '-1',
			custom: MONSTER_GROUP,
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
		participants().monsters = [];
		participants().monsterTokens = {};
		participants().gm = undefined;
	}

	function resetRoundInfo() {
		roundInfo().curRound = -1;
		roundInfo().curTurn = -1;
		roundInfo().curId = undefined;
		roundInfo().toAct = [];
	}

	function addTurnOrder() {
		const groupByToken = entry => (entry.id !== -1 && entry.id !== '-1') ? 'tokens' : 'customs';
		const turnOrder = _.groupBy(getTurnOrder(), groupByToken);
		debug('Turnorder contains: ', turnOrder);

		const tokens = turnOrder.tokens || [];
		tokens.forEach(token => addTokenId(token.id, token.pr));

		const customs = turnOrder.customs || [];
		customs.forEach(custom => addName(custom.custom, custom.pr));
	}

	function addName(name, initiative) {
		addMonster({
			id: name,
			playerIds: [],
			token: undefined,
			name: name,
			init: initiative
		});
	}

	function addTokenId(id, initiative) {
		const token = getObj('graphic', id);
		addToken(token, initiative);
	}

	function addToken(token, initiative) {
		if (!token || token.get('_subtype') !== 'token') {
			debug('Not a valid token: ', token);
			return;
		}

		if (initiative === undefined) {
			initiative = getInitiativeForToken(token, initiative);
		}

		let playerIds;
		let addFunc;
		if (isPlayerControlled(token)) {
			playerIds = getControllingPlayers(token);
			addFunc = addPlayer;
		} else {
			playerIds = [];
			addFunc = addMonster;
		}
		const id = token.get('_id');
		addFunc({
			id: id,
			playerIds: playerIds,
			token: id,
			name: token.get('name'),
			init: initiative
		});

	}

	function getInitiativeForToken(token) {
		const representedCharacter = token.get('represents');
		const attrInitMod = getAttrByName(representedCharacter, 'initiative');
		if (!attrInitMod) {
			debug('Initiative modifier (', attrInitMod, ') missing, falling back to +0!');
			// TODO error
		}
		const initMod = attrInitMod || '+0';
		return 'd20' + initMod;
	}


	function isPlayerControlled(token) {
		const playerIds = getControllingPlayers(token);
		const noGm = playerIds.filter(_.negate(playerIsGM));
		return noGm.length > 0;
	}

	function addPlayer(player) {
		addParticipant(participants().players, player);
	}

	function addMonster(monster) {
		const added = addParticipant(participants().monsters, monster, added => {
			if (added && monster.token) {
				participants().monsterTokens[monster.token] = true;
			}
		});
	}

	function addParticipant(list, participant, done) {
		if (getParticipant(participant.id)) {
			debug('participant already added, skipping.');
			(done || _.identity)(false);
		}
		roll(participant.init, result => {
			participant.init = result;
			const insertIdx = _.sortedIndex(list, participant, 'name');
			list.splice(insertIdx, 0, participant);
			if (isCombatRunning()) {
				roundInfo().toAct.push(participant);
				participantsChanged();
			}
			debug('Added participant: "', participant, '"');
			(done || _.identity)(participant);
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
		return allParticipants.find(participantHasId(id));
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

		debug('Giving turn to "', participant, '"...');

		if (participant === MONSTER_GROUP) {
			sendGMChooseMonster();
			return;
		}

		if (hasActed(participant)) {
			debug(participant.name + ' already acted!');
			// TODO error
			return;
		}

		roundInfo().curId = participant.id;
		roundInfo().curTurn++;
		debug('New turn: ' + roundInfo().curTurn);
		arrayRemove(roundInfo().toAct, participant);

		syncTurnOrder();

		const canGiveTurnTo = getPossibleSuccessors(participant);
		debug('Can give turn to: ', canGiveTurnTo);
		sendTurnInfo(participant, roundInfo().curRound, roundInfo().curTurn);
		sendChoice(participant, canGiveTurnTo);
	}

	function sendGMChooseMonster() {
		const canGiveTurnTo = getPossibleSuccessors(MONSTER_GROUP);
		const buttons = buildGiveTurnButtons(canGiveTurnTo);
		const buttonsString = buttons.join(' ');
		send('gm', 'Choose a monster to get the next turn: ' + buttonsString);
	}

	function getPossibleSuccessors(participant) {
		if (participant === MONSTER_GROUP) {
			return participants().monsters.filter(monster => {
				return roundInfo().toAct.some(participantHasId(monster.id));
			});
		}
		if (config.groupMonsters && isPlayer(participant)) {
			if (areAllTurnsDone()) {
				return participants().players.concat([MONSTER_GROUP]);
			} else {
				const amountLeft = roundInfo().toAct.length;
				const playersToAct = roundInfo().toAct.filter(isPlayer);
				return amountLeft - playersToAct.length === 0 ? playersToAct : playersToAct.concat([MONSTER_GROUP]);
			}
		} else {
			return areAllTurnsDone() ? getAllParticipants() : roundInfo().toAct;
		}
	}

	function isPlayer(participant) {
		return _.negate(isMonster)(participant);
	}

	function isMonster(participant) {
		return participant.playerIds.length === 0;
	}

	function sendChoice(participant, canGiveTurnTo) {
		let recipients = participant.playerIds.slice();
		if (recipients.length === 0 || (DEBUG && recipients.indexOf(participants().gm) === -1)) {
			recipients.push(participants().gm);
		}
		const buttons = buildGiveTurnButtons(canGiveTurnTo);
		const buttonsString = buttons.join(' ');
		recipients.forEach(recipient => {
			send(recipient, 'Give turn to <br />' + buttonsString);
		});
	}

	function buildGiveTurnButtons(canGiveTurnTo) {
		return canGiveTurnTo.map(participant => {
			let name;
			let id;
			if (participant === MONSTER_GROUP) {
				name = MONSTER_GROUP;
				id = MONSTER_GROUP;
			} else {
				name = participant.name;
				id = participant.id;
			}
			return '[' + name + '](' + COMMAND + ' giveturn ' + id + ')';
		});
	}

	function sendTurnInfo(participant, round, turn) {
		let name = (config.groupMonsters && isMonster(participant)) ? 'the ' + MONSTER_GROUP : participant.name;
		name = name.endsWith('s') ? name : (name + 's');
		sendInfo('Round ' + (round + 1) + ', Turn ' + (turn + 1) + '<br/> It\'s ' + name + ' turn!');
	}

	function sendInfo(message) {
		sendChat(CHAT_NAME, message, null, {noarchive: true});
	}

	function hasActed(participant) {
		return !roundInfo().toAct.some(participantHasId(participant.id));
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

	function participantHasId(id) {
		return participant => participant.id === id;
	}

	function removeById(id) {
		const shouldKeepParticipant = _.negate(participantHasId(id));
		const toRemove = getAllParticipants().find(participantHasId(id));
		if (!toRemove) {
			return;
		}
		participants().players = participants().players.filter(shouldKeepParticipant);
		participants().monsters = participants().monsters.filter(shouldKeepParticipant);
		roundInfo().toAct = roundInfo().toAct.filter(shouldKeepParticipant);
		if (participants().monsterTokens[toRemove.tokenId]) {
			participants().monsterTokens[toRemove.tokenId] = false;
		}

		participantsChanged();
	}

	function participantsChanged() {
		if (getAllParticipants().length === 0) {
			stopCombat();
		} else if (!getParticipant(roundInfo().curId)) {
			if (roundInfo().toAct.length > 0) {
				swapTurn(roundInfo().toAct[0]);
			} else {
				swapTurn(getHighestInit());
			}
		} else if (isCombatRunning()) {
			const curParticipant = getCurrentParticipant();
			sendChoice(curParticipant, getPossibleSuccessors(curParticipant));
		}

		syncTurnOrder();
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

