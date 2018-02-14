var PopcornInitiative = PopcornInitiative || (function() {

	const CHECK_OFF = '☐';
	const CHECK_PART = '▣';
	const CHECK_ON = '☑';

	on('chat:message', messageHandler);

	let participantsVar = {};
	function participants() {
		return participantsVar;
	}

	resetParticipants();


	let roundInfoVar = {};
	function roundInfo() {
		return roundInfoVar;
	}

	resetRoundInfo();


	const handlers = {
		add: msg => {
		const names = getRemainingOptions(msg, 0);
	if (names.length !== 0) {
		addToParticipants(names);
	} else {
		addToParticipants(getCurrentSelection(msg));
	}
},
	start: msg => {
		if (!playerIsGM(msg.playerid)) {
			return;
		}
		// TODO add turn tracker
		if (getAllParticipants().length === 0) {
			debug('Trying to start combat with no participants!');
			// TODO error
			return;
		}
		debug('Starting new combat...');
		debug('Participants: ', participants());
		startNewRound();
		giveTurn(getHighestInit());
	},
	stop: msg => {
		resetParticipants();
	},
	debug: msg => {
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

		// skip command + subcommand
		let realIdx = idx + 2;

		if (options.length < realIdx + 1) {
			return undefined;
		}

		return options[realIdx];
	}

	function getRemainingOptions(msg, idx) {
		const options = msg.content.split(' ');

		// skip command + subcommand
		let realIdx = idx + 2;

		if (options.length < realIdx + 1) {
			return [];
		}

		return options.slice(realIdx);
	}

	function messageHandler(msg) {
		if (msg.who !== 'Popcorn') {
			debug(msg);
		}
		if (msg.type !== 'api' || msg.content.indexOf("!popcorn") === -1) {
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
		sendChat('Popcorn', '/w ' + getPlayerName(playerId) + ' ' + content, null, { noarchive: true });
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
	}

	function resetRoundInfo() {
		roundInfo().curRound = -1;
		roundInfo().curTurn = -1;
		roundInfo().curId = undefined;
		roundInfo().toAct = [];
	}

	function addToParticipants(newParticipants) {
		debug(newParticipants);
		newParticipants.forEach(newParticipant => {
			debug(newParticipant);
		if (typeof newParticipant === 'object') {
			addToken(newParticipant._id);
		} else if (typeof newParticipant === 'string') {
			addMonster(newParticipant);
		}
	});
		debug(participantsVar);
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
		const represents = token.get('represents');
		if (!represents) {
			return false;
		}
		const char = getObj('character', represents);
		const controlledby = char.get('controlledby');
		if (!controlledby) {
			return false;
		}
		const playerIds = controlledby.split(',');
		const noGm = playerIds.filter(_.negate(playerIsGM));
		return noGm.length > 0;
	}

	function addPlayer(token) {
		const player = buildParticipantFromTokenOrString(token);
		participants().players.push(player);
		debug('Added player: "', player, '"');
	}

	function addMonster(obj) {
		const monster = buildParticipantFromTokenOrString(obj);
		participants().monsters.push(monster);
		debug('Added monster: "', monster, '"');
	}

	function buildParticipantFromTokenOrString(obj) {
		if (typeof obj === 'object' && obj.get('subtype') === 'token') {
			const token = obj;
			const id = token.get('_id');
			return {
				id: id,
				token: id,
				name: token.get('name'),
				init: 0 // TODO set correct initiative
			};
		} else {
			const name = '' + obj;
			return {
				id: name,
				token: undefined,
				name: name,
				init: 0 // TODO set correct initiative
			};
		}
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

	function startNewRound() {
		debug('Starting new Round...');
		roundInfo().curRound++;
		debug('New round: ' + roundInfo().curRound);
		roundInfo().curTurn = -1;
		roundInfo().toAct = getAllParticipants();
	}

	function giveTurn(participant) {
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
	}

	function hasActed(participant) {
		return roundInfo().toAct.indexOf(participant) === -1;
	}

	function arrayRemove(array, elem) {
		const pos = array.indexOf(elem);
		return pos >= 0 ? array.splice(pos, 1) : array;
	}

	return {};
})();

on('ready', function() {
	log('Popcorn loaded');
});