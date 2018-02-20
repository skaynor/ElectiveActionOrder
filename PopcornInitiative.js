var PopcornInitiative = PopcornInitiative || (function() {
	'use strict';

	class Messages {
		static sendRaw(playerID, msg) {
			Messages._sendChatNoArchive('/w ' + Messages._getPlayerName(playerID) + ' ' + msg);
		}

		static getSelection(msg) {
			return msg.selected || [];
		}

		static getSelectedTokens(msg) {
			return SelectionToken.getSelectedTokens(Messages.getSelection(msg));
		}

		static _sendChatNoArchive(msg) {
			const msgWithoutLinebreaks = msg.replace(/\n/g, '<br/>');
			Messages._sendChat(msgWithoutLinebreaks, null, {noarchive: true});
		}

		static _getPlayerName(playerID) {
			return playerID && playerID !== 'gm' ? '"' + getObj('player', playerID).get('displayname') + '"' : 'gm';
		}

		static _sendChat(msg, callback, options) {
			const msgWithoutLinebreaks = msg.replace(/\n/g, '<br/>');
			sendChat(Messages.CHAT_NAME, msgWithoutLinebreaks, callback, options);
		}

		static sendInfoParticipant(participant, message) {
			let recipients = participant.playerIDs.slice();
			if (recipients.length === 0 || (Initiative.DEBUG && recipients.indexOf(Messages.GAME_MASTERS) === -1)) {
				recipients = recipients.concat(Messages.GAME_MASTERS);
			}

			recipients.forEach(recipient => {
				Messages.sendInfo(recipient, message);
			});
		}

		static sendError(playerID, message, errors) {
			Messages.sendRaw(playerID, Messages._createResultMessage('error', message, errors));
		}

		static sendWarning(playerID, message, warnings) {
			Messages.sendRaw(playerID, Messages._createResultMessage('warning', message, warnings));
		}

		static _createResultMessage(type, message, extraMessages) {
			let msgBuilder = new HtmlBuilder('div.message ' + type, message);
			if (extraMessages && extraMessages.length !== 0) {
				msgBuilder.append('div', Util.capitalizeFirstLetter(type) + '(s):', {
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
					'padding': '5px'
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

		static sendHelp(playerID, helpTarget) {
			const isGM = playerIsGM(playerID);

			const htmlBuilder = new HtmlBuilder();
			const addMessage = (msg) => {
				htmlBuilder.append('div', msg, {
					style: {
						'margin-left': '-43px',
						'padding': '5px',
						'font-family': 'Menlo,Monaco,Courier New,monospace',
						'background-color': '#f5f5f5',
						'border': '1px solid #ccc',
						'border-radius': '5px',
						'white-space': 'pre-wrap',
						'font-size': '0.90em',
						'line-height': '1.2em',
					}
				});
			};

			const teamParam = '[team]: Can be either "e", "enemies" for the enemy team or "p", "players" for the player team.\n' +
				'If the team parameter is missing, the token will be added as player if the token represents a character that can be edited & ' +
				'controlled by a player in this game, or as an enemy otherwise.\n';
			const initParam = '[initiative]: Can be any valid roll20 dice expression. Must be enclosed in quotes (") if it contains spaces.\n' +
				'If the initiative is missing, will attempt to read the initiative modifier of the character the token represents and roll ' +
				'1d20+&lt;init-modifier&gt;, or fall back to using a single d20.\n';

			const handlers = {
				'add': () => {
					addMessage('Adds the tokens that you have currently selected on the board to initiative.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' add [team] [initiative]\n' +
						'\n' +
						teamParam +
						'\n' +
						initParam);
				},
				'add-name': () => {
					addMessage('Adds a participant to initiative by name.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' add-name &lt;name&gt; [team] [initiative]\n' +
						'\n' +
						'&lt;name&gt;:  The name that should be added to initiative. Must be enclosed in quotes (") if it contains spaces.\n' +
						'\n' +
						teamParam +
						'\n' +
						initParam);
				},
				'menu': () => {
					addMessage('Shows you the current menu which allows you to choose the next one to give the turn to. Useful if there were many ' +
						'chat lines since the last menu was posted.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' menu');
				},
				'remove': () => {
					addMessage('Removes the selected token or given name.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' remove [name]\n' +
						'  \n' +
						'[name]:  The name that should be removed from initiative. Must be enclosed in quotes (") if it contains spaces.\n' +
						'If it is empty, will remove the currently selected tokens on the board from initiative.');
				},
				'reset': () => {
					addMessage('Resets the entirety of PopcornInitiatives data. Everything will be lost, use with caution!\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' reset');
				},
				'start': () => {
					addMessage('Starts combat with the previously added participants (using "' + CommandLineInterface.COMMAND + ' add" or "' +
						CommandLineInterface.COMMAND + ' add-name"). Will also ' +
						'automatically add any tokens that are currently in the roll20 turn tracker.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' start');
				},
				'status': () => {
					addMessage('Prints the current status of PopcornInitiative.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' status');
				},
				'stop': () => {
					addMessage('Stops the combat and removes all participants.\n' +
						'\n' +
						'Usage:\n' +
						'  ' + CommandLineInterface.COMMAND + ' stop');
				},
				'tac': () => {
					if (isGM) {
						addMessage('Shows tactical dice status or uses, adds or sets tactical dice for a team.\n' +
							'\n' +
							'Usage:\n' +
							'  ' + CommandLineInterface.COMMAND + ' tac [use|add|set] [team] [amount]\n' +
							'  \n' +
							'no parameters: Shows the amount of tactical dice each team has.\n' +
							'  \n' +
							'use: Uses a single tactical die for the given team, or, if the team is empty, for the enemy team.\n' +
							'  \n' +
							'add: Adds the given amount to the given teams tactical dice pool.\n' +
							'  \n' +
							'set: Sets the amount of tactical dice the given team has.\n' +
							'  \n' +
							teamParam +
							'\n' +
							'[amount]: Has to be a positive whole number. Can be negative for &lt;add&gt;.');
					} else {
						addMessage('Shows tactical dice status or uses a tactical die for your team.\n' +
							'\n' +
							'Usage:\n' +
							'  ' + CommandLineInterface.COMMAND + ' [use]\n' +
							'  \n' +
							'no parameters: Shows the amount of tactical dice each team has.\n' +
							'\n' +
							'[use]: Uses a single tactical die for the player team.');
					}
				},
				'express': () => {
					addMessage('Choo chooo! The PCI express is getting ready to leave at x16:00!');
				}
			};

			const handler = handlers[helpTarget];
			if (!handler) {
				let message;
				if (helpTarget) {
					message = 'Unrecognized help option: ' + helpTarget + '\n\n';
				} else {
					message = '';
				}

				message += 'Popcorn Initiative\n' +
					'\n' +
					'Usage:\n' +
					'  ' + CommandLineInterface.COMMAND + ' &lt;command&gt; [further options]\n' +
					'  \n' +
					'&lt;&gt; signifies required parameters, [] signifies optional ones.\n' +
					'You\'re a ' + (isGM ? 'GM' : 'player') + ', so you can use the following commands:\n' +
					'\n' +
					'  ' + (isGM ? 'add, add-name, help, menu, remove, reset, start, status, stop, tac' : 'help, menu, status, tac') + '\n' +
					'\n' +
					'For further info, type "' + CommandLineInterface.COMMAND + ' help &lt;command&gt;"';
				if (isGM) {
					message += '\n' +
						'\n' +
						'The basic workflow is creating enemy tokens on the board, selecting them, adding them to initiative using "' +
						CommandLineInterface.COMMAND + ' add" and ' +
						'then starting the combat using "' + CommandLineInterface.COMMAND + ' start".\n' +
						'Tokens will be removed automatically from initiative when you add the dead marker to them (the big red cross) or can be ' +
						'removed manually using "' + CommandLineInterface.COMMAND + ' remove".\n' +
						'If no enemy tokens remain, the combat will automatically stop, or it can be stopped manually using "' +
						CommandLineInterface.COMMAND + ' stop".';
				}
				addMessage(message);
			} else {
				handler();
			}

			Messages.sendRaw(playerID, htmlBuilder.toString());
		}

		static sendActedStatus(playerID) {
			let acted = CombatParticipants.findAll().filter(RoundInfo.hasActed);
			let toAct = RoundInfo.findAllToAct();
			if (config.groupEnemies && !playerIsGM(playerID)) {
				acted = Messages._replaceWithGroupedEnemies(acted);
				toAct = Messages._replaceWithGroupedEnemies(toAct);
			}

			if (acted.length === 0) {
				Messages.sendInfo(playerID, 'Noone acted this turn yet.');
			} else {
				Messages.sendInfo(playerID, 'These participants already acted this turn: ' + acted.map(p => p.name).join(', '));
			}

			if (toAct.length === 0) {
				Messages.sendInfo(playerID, 'Everyone acted already.');
			} else {
				Messages.sendInfo(playerID, 'These participants still have to act during this turn: ' + toAct.map(p => p.name).join(', '));
			}
		}

		static _replaceWithGroupedEnemies(participantList) {
			if (participantList.some(Participant.isEnemy)) {
				participantList = participantList.filter(Participant.isFriendly);
				participantList.push({
					name: 'a bunch of enemies'
				});
			}
			return participantList;
		}

		static postInfo(message) {
			Messages.postRaw(Messages._createResultMessage('info', message));
		}

		static postRaw(message) {
			Messages._sendChat(message);
		}

		static sendInfo(playerID, message) {
			Messages.sendRaw(playerID, Messages._createResultMessage('info', message));
		}

		static sendChoice(participant, canGiveTurnTo) {
			const canGiveTurnToGrouped = _.groupBy(canGiveTurnTo, participant => participant.isEnemy() ? 'enemies' : 'players');
			const playerButtons = Messages._buildGiveTurnButtons(canGiveTurnToGrouped.players || []).join(' ');
			const enemyButtons = Messages._buildGiveTurnButtons(canGiveTurnToGrouped.enemies || []).join(' ');

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
					'color': Messages._getTeamColor(participant.team)
				}
			});
			yourTurn.append('span', '!');
			Messages._appendHR(htmlBuilder);

			const giveTurnMessage = (RoundInfo.areAllTurnsDone() ? 'This is the last turn of the round! Start the new round with:' : 'Give turn to:');
			htmlBuilder.append('div', giveTurnMessage, {
				style: {
					'margin': '9px 0'
				}
			});

			if (participant.isFriendly() && playerButtons.length > 0) {
				Messages._addTacDiceWarning(htmlBuilder, Initiative.PLAYER_TEAM);
			}
			htmlBuilder.append('div', playerButtons);
			if (participant.isEnemy() && enemyButtons.length > 0) {
				Messages._addTacDiceWarning(htmlBuilder, Initiative.ENEMY_TEAM);
			}
			htmlBuilder.append('div', enemyButtons);

			Messages.sendInfoParticipant(participant, htmlBuilder.toString());
		}

		static _getTeamColor(team) {
			return team === Initiative.PLAYER_TEAM ? config.colors.players : config.colors.enemies;
		}

		static _addTacDiceWarning(htmlBuilder, team) {
			if (TacticalDice.wouldGiveTacDice(team)) {
				const wouldGiveTacDiceAmount = TacticalDice.wouldGiveTacDiceAmount(team);
				const otherTeam = Util.getOtherTeam(team);
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

		static sendCurrentChoice() {
			if (!RoundInfo.isCombatRunning()) {
				return;
			}
			const curParticipant = RoundInfo.findCurrentParticipant();
			if (curParticipant.id === Initiative.ENEMY_TEAM) {
				Messages.sendGMChooseEnemy();
			} else {
				Messages.sendChoice(curParticipant, RoundInfo.findCurrentPossibleSuccessors());
			}
		}

		static _buildGiveTurnButtons(canGiveTurnTo) {
			return canGiveTurnTo.map(participant => {
				Util.debug('Participant type: ', typeof participant);
				Util.debug('Participant correct class? ', participant instanceof Participant);
				const bgColor = Messages._getTeamColor(participant.team);
				return Messages._buildButton(participant.name, CommandLineInterface.COMMAND + ' giveTurnAPI ' + participant.id, bgColor);
			});
		}

		static _buildButton(label, link, style) {
			if (typeof style === 'string') {
				style = {
					'background-color': style,
					'font-weight': 'bold',
					'border-radius': '6px',
					'border-size': '0',
				};
			}
			return new HtmlBuilder('a', label, {
				href: link,
				style: style
			}).toString();
		}

		static sendGMChooseEnemy() {
			const canGiveTurnTo = RoundInfo.findPossibleSuccessors(Initiative.ENEMY_TEAM_PARTICIPANT);
			const buttons = Messages._buildGiveTurnButtons(canGiveTurnTo);
			const buttonsString = buttons.join(' ');
			Messages.sendInfo('gm', 'Choose an enemy to get the next turn: ' + buttonsString);
		}

		static sendStatus(playerID) {
			Messages.sendParticipantsStatus(playerID);
			Messages.sendTurnInfo(playerID);
			Messages.sendActedStatus(playerID);
		}

		static sendParticipantsStatus(playerID) {
			let visibleParticipants = CombatParticipants.findPlayers();
			if (!config.groupEnemies || playerIsGM(playerID)) {
				visibleParticipants.push(...CombatParticipants.findEnemies());
			} else {
				visibleParticipants.push({name: 'a bunch of enemies'});
			}
			Messages.sendInfo(playerID, 'The following participants are in initiative: ' + '"' + visibleParticipants.map(p => p.name).join('", "') +
				'"');
		}

		static sendTurnInfo(playerID) {
			Messages.sendInfo(playerID, Messages._getTurnInfo());
		}

		static postTurnInfo() {
			Messages.postInfo(Messages._getTurnInfo());
		}


		static _getTurnInfo() {
			const curParticipant = RoundInfo.findCurrentParticipant();
			Util.debug('cur participant: ', curParticipant);
			let name = (config.groupEnemies && curParticipant.isEnemy()) ? 'The enemies' : curParticipant.name;

			const htmlBuilder = new HtmlBuilder();
			htmlBuilder.append('div', 'Round ' + RoundInfo.getCurrentRound() + ', Turn ' + RoundInfo.getCurrentTurn(), {
				style: {
					'font-variant': 'small-caps',
					'font-weight': 'bold',
					'font-size': '1.3em',
				}
			});
			if (config.tacticalDice.enabled) {
				Messages._appendHR(htmlBuilder);
				htmlBuilder.append('div', Messages._getTacticalDiceInfo());
			}
			Messages._appendHR(htmlBuilder);
			const nowActing = htmlBuilder.append('div', 'Now acting: ');
			nowActing.append('span', name, {
				style: {
					'font-size': '1.1em',
					'font-weight': 'bold',
					'color': Messages._getTeamColor(curParticipant.team)
				}
			});
			return htmlBuilder.toString();
		}

		static sendTacticalDiceStatus(playerID) {
			Messages.sendInfo(playerID, Messages._getTacticalDiceInfo());
		}

		static postTacticalDiceStatus() {
			Messages.postInfo(Messages._getTacticalDiceInfo());
		}

		static _getTacticalDiceInfo() {
			const htmlBuilder = new HtmlBuilder();
			const heading = htmlBuilder.append('p', 'Tactical dice', {
				style: {
					'font-weight': 'bold'
				}
			});
			heading.append('span', ' (' + Messages._buildButton('Use one', CommandLineInterface.COMMAND + ' tac use', {
				'color': '#4273e7',
				'background-color': 'transparent',
				'text-decoration': 'underline',
				'padding': '0'
			}) + ')');
			htmlBuilder.append('p', 'Players: ' + TacticalDice.getDice(Initiative.PLAYER_TEAM));
			htmlBuilder.append('p', 'Enemies: ' + TacticalDice.getDice(Initiative.ENEMY_TEAM));
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

	class Participant {

		constructor(id, name, token, team, init, playerIDs) {
			if (!id) {
				throw new Error('Participant created without ID!');
			}
			if (playerIDs && playerIDs.length === undefined) {
				throw new Error('Tried to create participant where playerIDs is not an array: ' + playerIDs);
			}
			this.id = id;
			this.name = name;
			this.token = token;
			this.team = team;
			this.init = init;
			this.playerIDs = playerIDs || [];
		}

		static fromObj(obj) {
			return new Participant(obj.id, obj.name, obj.token, obj.team, obj.init, obj.playerIDs);
		}

		static toObj(participant) {
			return participant.toObj();
		}

		static isPlayer(participant) {
			return participant.isPlayer();
		}

		static isNPC(participant) {
			return participant.isNPC();
		}

		static isFriendly(participant) {
			return participant.isFriendly();
		}

		static isEnemy(participant) {
			return participant.isEnemy();
		}

		static hasID(id) {
			return participant => participant.id === id;
		}

		static addToParticipantList(list, participant) {
			const participantObj = participant.toObj();
			const insertIndex = _.sortedIndex(list, participantObj, 'name');
			list.splice(insertIndex, 0, participantObj);
		}

		isNPC() {
			return this.playerIDs.length === 0;
		}

		isPlayer() {
			return this.playerIDs.length !== 0;
		}

		isFriendly() {
			return this.team === Initiative.PLAYER_TEAM;
		}

		isEnemy() {
			return this.team === Initiative.ENEMY_TEAM;
		}

		toObj() {
			return {
				id: this.id,
				name: this.name,
				token: this.token,
				team: this.team,
				init: this.init,
				playerIDs: this.playerIDs
			};
		}

	}

	class CombatParticipants {

		static get _players() {
			return CombatParticipants._stateVar.players.map(Participant.fromObj);
		}

		static set _players(players) {
			CombatParticipants._stateVar.players = players.map(Participant.toObj);
		}

		static get _enemies() {
			return CombatParticipants._stateVar.enemies.map(Participant.fromObj);
		}

		static set _enemies(enemies) {
			CombatParticipants._stateVar.enemies = enemies.map(Participant.toObj);
		}

		static get _enemyTokens() {
			return CombatParticipants._stateVar.enemyTokens;
		}

		static set _enemyTokens(enemyTokens) {
			CombatParticipants._stateVar.enemyTokens = enemyTokens;
		}

		static get _stateVar() {
			return state.PopcornInitiative.participantsVar;
		}

		static set _stateVar(val) {
			state.PopcornInitiative.participantsVar = val;
		}

		static initializeStateVars() {
			if (!CombatParticipants._stateVar) {
				CombatParticipants._stateVar = {};
				CombatParticipants.reset();
			}
		}

		static _addAsPlayer(participant) {
			return CombatParticipants._add(CombatParticipants._addToPlayers, participant);
		}

		static _addAsEnemy(participant) {
			const result = CombatParticipants._add(CombatParticipants._addToEnemies, participant);
			result.then(() => {
				if (participant.token) {
					CombatParticipants._enemyTokens[participant.token] = true;
				}
			});
			return result;
		}

		static addName(name, team, initiative) {
			team = team ? team : Initiative.ENEMY_TEAM;
			const participant = new Participant(name, name, undefined, team, initiative, []);
			const addFunc = (team && team === Initiative.PLAYER_TEAM) ? CombatParticipants._addAsPlayer : CombatParticipants._addAsEnemy;
			return addFunc(participant);
		}

		static addFromTurnOrder() {
			const turnOrderTokens = TurnOrder.getTokens();
			Util.debug('Turnorder contains tokens: ', turnOrderTokens);

			return turnOrderTokens.map(turnOrderToken => {
				return CombatParticipants._addTokenID(turnOrderToken.id, turnOrderToken.pr);
			});
		}

		static _addTokenID(id, initiative) {
			const result = Token.findByID(id);
			if (result.hasErrors()) {
				return Promise.resolve(result);
			} else {
				return CombatParticipants.addToken(result.val, null, initiative);
			}
		}

		static addToken(token, team, initiative) {
			let result = Result.create();
			Util.debug('Adding token ', token);

			if (!team) {
				team = token.isPlayerControlled() ? Initiative.PLAYER_TEAM : Initiative.ENEMY_TEAM;
			}

			if (initiative === undefined) {
				const clacInitResult = token.calcInitiative();
				result.addMessagesFrom(clacInitResult);
				initiative = clacInitResult.val;
			}

			let playerIDs;
			let addFunc;
			if (team === Initiative.PLAYER_TEAM) {
				playerIDs = token.getControllingPlayers();
				addFunc = CombatParticipants._addAsPlayer;
			} else {
				playerIDs = [];
				addFunc = CombatParticipants._addAsEnemy;
			}
			const id = token.id;
			const addPromise = addFunc(new Participant(id, token.name, id, team, initiative, playerIDs));

			const addResults = addResult => {
				Util.debug('Adding result from token add: ', addResult);
				addResult.addMessagesFrom(result);
				return addResult;
			};
			return addPromise.then(addResults, addResults);
		}

		static _doesEnemyWithTokenIDExist(tokenID) {
			return CombatParticipants._enemyTokens[tokenID];
		}

		static findPlayers() {
			return CombatParticipants._players;
		}

		static findEnemies() {
			return CombatParticipants._enemies;
		}

		static findByID(id) {
			return CombatParticipants.findAll().find(Participant.hasID(id));
		}

		static findAll() {
			return CombatParticipants.findPlayers().concat(CombatParticipants.findEnemies());
		}

		static getByTeam(team) {
			return team === Initiative.ENEMY_TEAM ? CombatParticipants.findEnemies() : CombatParticipants.findPlayers();
		}

		static findParticipantWithHighestInit() {
			return CombatParticipants.findAll()
				.reduce((highest, current) => (current.init > highest.init) ? current : highest);
		}

		static removeByTokenID(tokenID) {
			const participant = CombatParticipants.findAll().find(participant => participant.token === tokenID);
			if (!participant) {
				// TODO error
				return;
			}
			CombatParticipants.remove(participant);
		}

		static removeByID(id) {
			const toRemove = CombatParticipants.findAll().find(Participant.hasID(id));
			if (!toRemove) {
				return;
			}
			CombatParticipants.remove(toRemove);
		}

		static remove(participant) {
			const currentParticipant = RoundInfo.findCurrentParticipant();
			const currentID = currentParticipant && currentParticipant.id;
			const toRemoveID = participant.id;

			const shouldKeepParticipant = _.negate(Participant.hasID(toRemoveID));

			CombatParticipants._players = CombatParticipants._players.filter(shouldKeepParticipant);

			CombatParticipants._enemies = CombatParticipants._enemies.filter(shouldKeepParticipant);
			if (CombatParticipants._enemyTokens[participant.token]) {
				CombatParticipants._enemyTokens[participant.token] = false;
			}

			if (toRemoveID === currentID) {
				const newCurrent = RoundInfo.areTurnsRemaining() ?
					CombatParticipants._toAct[0] : CombatParticipants.findParticipantWithHighestInit();
				CombatParticipants.setCurrentParticipant(newCurrent);
				Messages.postTurnInfo();
			} else if (RoundInfo.hasToAct(participant) || RoundInfo.areAllTurnsDone()) {
				RoundInfo.removeParticipantToActByID(toRemoveID);
				Messages.sendCurrentChoice();
			}

			if (CombatParticipants.findEnemies().length === 0 && RoundInfo.isCombatRunning()) {
				Initiative.stopCombat();
			}


			TurnOrderSynchronizer.sync();
		}

		static tokenDeadHandler(graphic) {
			Util.reportErrors(() => {
				if (!graphic.get('status_dead')) {
					return;
				}
				const id = graphic.get('_id');
				if (!CombatParticipants._doesEnemyWithTokenIDExist(id)) {
					return;
				}
				const currentParticipant = RoundInfo.findCurrentParticipant();
				const participant = CombatParticipants.findAll().find(participant => participant.token === id);
				if ((RoundInfo.hasToAct(participant) || RoundInfo.areAllTurnsDone())) {
					const name = (!config.groupEnemies || currentParticipant.isEnemy()) ? participant.name : 'An enemy';
					Messages.sendInfoParticipant(currentParticipant, name + ' died, these are the new choices:');
				}

				CombatParticipants.remove(participant);
			}, 'tokenDeadHandler');
		}

		static _countParticipants() {
			return CombatParticipants._players.length + CombatParticipants._enemies.length;
		}

		static reset() {
			CombatParticipants._players = [];
			CombatParticipants._enemies = [];
			CombatParticipants._enemyTokens = {};
		}

		static _add(addFunc, participant) {

			return new ReportingPromise((resolve) => {
				if (CombatParticipants.findByID(participant.id)) {
					resolve(Result.createError('Participant already added'));
					return;
				}
				Util.roll(participant.init).then(roll => {
					participant.init = roll;
					addFunc(participant);
					if (RoundInfo.isCombatRunning()) {
						RoundInfo.addParticipantToAct(participant);
						Messages.sendCurrentChoice();
						TurnOrderSynchronizer.sync();
					}
					Util.debug('Added participant: "', participant, '"');
					const result = Result.create(participant);
					Util.debug('addParticipant result: ', result);
					resolve(result);
				}).catch(reason => {
					resolve(Result.createError('Error while rolling: ' + reason));
				});
			}, 'CombatParticipants._add');
		}

		static _addToPlayers(participant) {
			Participant.addToParticipantList(CombatParticipants._stateVar.players, participant);
		}

		static _addToEnemies(participant) {
			Participant.addToParticipantList(CombatParticipants._stateVar.enemies, participant);
		}
	}

	class RoundInfo {
		static get _toAct() {
			return RoundInfo._stateVar.toAct.map(Participant.fromObj);
		}

		static set _toAct(toAct) {
			RoundInfo._stateVar.toAct = toAct.map(Participant.toObj);
		}

		static get _curTurn() {
			return RoundInfo._stateVar.curTurn;
		}

		static set _curTurn(curTurn) {
			RoundInfo._stateVar.curTurn = curTurn;
		}

		static get _curID() {
			return RoundInfo._stateVar.curID;
		}

		static set _curID(curID) {
			RoundInfo._stateVar.curID = curID;
		}

		static get _curRound() {
			return RoundInfo._stateVar.curRound;
		}

		static set _curRound(curRound) {
			RoundInfo._stateVar.curRound = curRound;
		}

		static get _stateVar() {
			return state.PopcornInitiative.roundInfoVar;
		}

		static set _stateVar(val) {
			state.PopcornInitiative.roundInfoVar = val;
		}

		static initializeStateVars() {
			if (!RoundInfo._stateVar) {
				RoundInfo._stateVar = {};
				RoundInfo.reset();
			}
		}

		static findAllToAct() {
			return RoundInfo._toAct.map(Participant.fromObj);
		}

		static hasToAct(participant) {
			return this.findAllToAct().some(Participant.hasID(participant.id));
		}

		static _findToAct(team) {
			const filterFunc = (team === Initiative.ENEMY_TEAM) ? Participant.isEnemy : Participant.isFriendly;
			return RoundInfo.findAllToAct().filter(filterFunc);
		}

		static findEnemiesToAct() {
			return RoundInfo._findToAct(Initiative.ENEMY_TEAM);
		}

		static findPlayersToAct() {
			return RoundInfo._findToAct(Initiative.PLAYER_TEAM);
		}

		static addParticipantToAct(participant) {
			Participant.addToParticipantList(RoundInfo._stateVar.toAct, participant);
		}

		static hasActed(participant) {
			return !RoundInfo.findAllToAct().some(Participant.hasID(participant.id));
		}

		static reset() {
			RoundInfo._curRound = -1;
			RoundInfo._curTurn = -1;
			RoundInfo._curID = undefined;
			RoundInfo._toAct = [];
		}

		static startNewRound(playerID) {
			Util.debug('Starting new Round...');
			RoundInfo._curRound++;
			RoundInfo._curID = playerID;
			Util.debug('New round: ' + RoundInfo._curRound);
			RoundInfo._curTurn = -1;
			RoundInfo._toAct = CombatParticipants.findAll();

			if (config.tacticalDice.enabled) {
				TacticalDice.newRound();
			}
		}

		static giveTurn(participant) {
			const result = RoundInfo.setCurrentParticipant(participant);

			Util.debug('giveTurn set current result:', result);

			if (!result.hasMessages()) {
				RoundInfo._curTurn += 1;
				Util.debug('New turn: ' + RoundInfo._curTurn);

				if (config.tacticalDice.enabled) {
					TacticalDice.addTurn(participant.team);
				}

				Messages.postTurnInfo();
				Messages.sendCurrentChoice();

				TurnOrderSynchronizer.sync();
			}

			return result;
		}

		static findCurrentParticipant() {
			if (RoundInfo._curID === Initiative.ENEMY_TEAM) {
				return Initiative.ENEMY_TEAM_PARTICIPANT;
			} else {
				return CombatParticipants.findByID(RoundInfo._curID);
			}
		}

		static setCurrentParticipant(participant) {
			if (RoundInfo.areAllTurnsDone()) {
				RoundInfo.startNewRound();
			}

			Util.debug('Giving turn to "', participant, '"...');

			if (participant.id === Initiative.ENEMY_TEAM) {
				RoundInfo._curID = Initiative.ENEMY_TEAM;
				const enemies = RoundInfo.findPossibleSuccessors(participant).filter(Participant.isEnemy);
				if (enemies.length === 1) {
					return RoundInfo.setCurrentParticipant(enemies[0]);
				} else {
					Messages.sendGMChooseEnemy();
					return Result.createWarning('No participant set, the GM will be choosing the participant.');
				}
			}

			if (RoundInfo.hasActed(participant)) {
				Util.debug(participant.name + ' already acted!');
				return Result.createError(participant.name + ' already acted during this turn!');
			}

			RoundInfo._curID = participant.id;
			RoundInfo.removeParticipantToActByID(participant.id);

			return Result.create();
		}

		static removeParticipantToActByID(id) {
			Util.arrayRemove(RoundInfo._stateVar.toAct, Participant.hasID(id));
		}

		static areTurnsRemaining() {
			return RoundInfo._toAct.length > 0;
		}

		static areAllTurnsDone() {
			return RoundInfo._toAct.length === 0;
		}

		static isPlayersTurn(playerID) {
			const curParticipant = RoundInfo.findCurrentParticipant();

			return curParticipant &&
				(
					(playerIsGM(playerID) && (Initiative.DEBUG || curParticipant.isNPC())) ||
					(!playerIsGM(playerID) && curParticipant.playerIDs.includes(playerID))
				);
		}

		static isCombatRunning() {
			return RoundInfo._curRound !== -1;
		}

		static getCurrentRound() {
			return RoundInfo._curRound + 1;
		}

		static getCurrentTurn() {
			return RoundInfo._curTurn + 1;
		}

		static findCurrentPossibleSuccessors() {
			return RoundInfo.findPossibleSuccessors(RoundInfo.findCurrentParticipant());
		}

		static findPossibleSuccessors(participant) {
			if (participant.id === Initiative.ENEMY_TEAM) {
				if (RoundInfo.areAllTurnsDone()) {
					return CombatParticipants.findEnemies();
				} else {
					return CombatParticipants.findEnemies().filter(enemy => {
						return RoundInfo._toAct.some(Participant.hasID(enemy.id));
					});
				}
			}
			if (config.groupEnemies && participant.isPlayer()) {
				if (RoundInfo.areAllTurnsDone()) {
					return CombatParticipants.findPlayers().concat([Initiative.ENEMY_TEAM_PARTICIPANT]);
				} else {
					const amountLeft = RoundInfo._toAct.length;
					const playersToAct = RoundInfo.findPlayersToAct();
					return ((amountLeft - playersToAct.length) === 0) ? playersToAct : playersToAct.concat([Initiative.ENEMY_TEAM_PARTICIPANT]);
				}
			} else {
				return RoundInfo.areAllTurnsDone() ? CombatParticipants.findAll() : RoundInfo.findAllToAct();
			}
		}
	}

	class TacticalDice {

		static get _consecutiveTurns() {
			return TacticalDice._stateVar.consecutiveTurns;
		}

		static set _consecutiveTurns(turns) {
			TacticalDice._stateVar.consecutiveTurns = turns;
		}

		static get _lastTeam() {
			return TacticalDice._stateVar.lastTeam;
		}

		static set _lastTeam(team) {
			TacticalDice._stateVar.lastTeam = team;
		}

		static get _stateVar() {
			return state.PopcornInitiative.tacticalDiceVar;
		}

		static set _stateVar(val) {
			state.PopcornInitiative.tacticalDiceVar = val;
		}

		static initializeStateVars() {
			if (!TacticalDice._stateVar) {
				TacticalDice._stateVar = {};
				TacticalDice.fullReset();
			}
		}

		static reset() {
			if (!config.tacticalDice.persist) {
				TacticalDice._resetDice();
			}
			TacticalDice._consecutiveTurns = 0;
			TacticalDice._lastTeam = '';
		}

		static _resetDice() {
			TacticalDice.setDice(Initiative.ENEMY_TEAM, 0);
			TacticalDice.setDice(Initiative.PLAYER_TEAM, 0);
		}

		static fullReset() {
			TacticalDice.reset();
			TacticalDice._resetDice();
		}

		static getDice(team) {
			return TacticalDice._stateVar[team] + config.tacticalDice.die;
		}

		static getDiceAmount(team) {
			return TacticalDice._stateVar[team];
		}

		static setDice(team, count) {
			TacticalDice._stateVar[team] = count;
		}

		static addDice(team, count) {
			TacticalDice._stateVar[team] += count;
		}

		static addTurn(team) {
			if (team === TacticalDice._lastTeam) {
				if (TacticalDice.wouldGiveTacDice(team)) {
					TacticalDice.addDice(Util.getOtherTeam(team), TacticalDice._wouldGiveTacDiceAmount(team));
				}
				TacticalDice._consecutiveTurns++;
			} else {
				TacticalDice._consecutiveTurns = 1;
				TacticalDice._lastTeam = team;
			}
		}

		static newRound() {
			TacticalDice._consecutiveTurns = 0;
		}

		static wouldGiveTacDice(team) {
			return TacticalDice._hasTeamStayedTheSame(team) &&
				TacticalDice._willMaxTurnsBeExceeded(team) &&
				!RoundInfo.areAllTurnsDone() &&
				TacticalDice._areMembersOfTheOtherTeamLeftInRound(team);
		}

		static _hasTeamStayedTheSame(team) {
			return team === TacticalDice._lastTeam;
		}

		static _willMaxTurnsBeExceeded(team) {
			return TacticalDice._consecutiveTurns >= TacticalDice._getMaxConsecutiveTurns(team);
		}

		static _getMaxConsecutiveTurns(team) {
			const configuredValue = config.tacticalDice.maxConsecutiveTurns;

			if (!config.tacticalDice.teamSizeAdjustment) {
				return configuredValue;
			}

			const teamSize = CombatParticipants.getByTeam(team).length;
			const otherTeamSize = CombatParticipants.getByTeam(Util.getOtherTeam(team)).length;
			let maxConsecutiveTurns;
			if (otherTeamSize >= teamSize) {
				maxConsecutiveTurns = configuredValue;
			} else {
				maxConsecutiveTurns = Math.floor(teamSize / otherTeamSize * configuredValue);
			}
			Util.debug('maxConsecutiveTurns for team ', team, ': ', maxConsecutiveTurns);
			return maxConsecutiveTurns;
		}

		static _areMembersOfTheOtherTeamLeftInRound(team) {
			const possibleSuccessors = RoundInfo.findCurrentPossibleSuccessors();
			Util.debug('_areMembersOfTheOtherTeamLeftInRound possibleSuccessors', possibleSuccessors);
			const isOfOtherTeam = (team === Initiative.ENEMY_TEAM) ? Participant.isFriendly : Participant.isEnemy;
			const membersOfOtherTeam = possibleSuccessors.filter(isOfOtherTeam);
			Util.debug('_areMembersOfTheOtherTeamLeftInRound membersOfOtherTeam', membersOfOtherTeam);
			return membersOfOtherTeam.length > 0;
		}

		static _wouldGiveTacDiceAmount(team) {
			if (!TacticalDice.wouldGiveTacDice(team)) {
				return 0;
			}

			if (config.tacticalDice.amountIncreasingPerTurn) {
				return TacticalDice._consecutiveTurns - TacticalDice._getMaxConsecutiveTurns(team) + 1;
			} else {
				return 1;
			}
		}

		static wouldGiveTacDiceAmount(team) {
			return TacticalDice._wouldGiveTacDiceAmount(team) + config.tacticalDice.die;
		}

		static useDie(team) {
			return new ReportingPromise(resolve => {
				const dice = TacticalDice.getDiceAmount(team);
				if (dice === 0) {
					resolve(Result.createError('The ' + team + ' do not currently have any tactical dice.'));
					return;
				}
				TacticalDice.setDice(team, dice - 1);
				Util.roll(1 + config.tacticalDice.die).then(roll => {
					resolve(Result.create(roll));
				}).catch(reason => {
					resolve(Result.createError('Error while rolling: ' + reason));
				});
			}, 'TacticalDice.useDie(team)');
		}
	}

	class CommandLineInterface {

		static create() {
			CommandLineInterface._handlers = {
				'add': CommandLineInterface.add,
				'add-name': CommandLineInterface.addName,
				'giveTurnAPI': CommandLineInterface.giveTurn,
				'help': CommandLineInterface.help,
				'menu': CommandLineInterface.menu,
				'remove': CommandLineInterface.remove,
				'reset': CommandLineInterface.reset,
				'start': CommandLineInterface.start,
				'status': CommandLineInterface.status,
				'stop': CommandLineInterface.stop,
				'tac': CommandLineInterface.tacticalDice,
				'express': (msg) => {
					Messages.sendInfo(msg.playerid, 'Choo chooo! The PCI express is getting ready to leave at x16:00!');
				}
			};

			on('chat:message', CommandLineInterface._messageHandler);
		}

		static _getOption(msg, idx) {
			let options = msg.content.split(' ');

			// skip command + sub command
			let realIndex = idx + 2;

			if (options.length < realIndex + 1) {
				return undefined;
			}

			return options[realIndex];
		}

		static _getRemainingOptions(msg, idx) {
			const options = msg.content.split(' ');

			// skip command + sub command
			let realIndex = idx + 2;

			if (options.length < realIndex + 1) {
				return [];
			}

			return options.slice(realIndex);
		}

		static _getOptions(msg) {
			return this._getRemainingOptions(msg, 0);
		}

		static _messageHandler(msg) {
			if (msg.who !== Messages.CHAT_NAME) {
				Util.debug(msg);
			}
			if (msg.type !== 'api' || !msg.content.startsWith(CommandLineInterface.COMMAND)) {
				return;
			}

			const options = msg.content.split(' ');
			if (options.length === 1) {
				Messages.sendHelp(msg.playerid);
				return;
			}

			const handlerName = options[1];
			const handler = CommandLineInterface._handlers[handlerName];
			if (!handler) {
				Messages.sendHelp(msg.playerid);
				return;
			}

			Util.reportErrors(() => handler(msg), handlerName, msg.playerid);
		}

		static _isEnemyTeam(option) {
			return option === 'e' || option === Initiative.ENEMY_TEAM;
		}

		static _isPlayerTeam(option) {
			return option === 'p' || option === Initiative.PLAYER_TEAM;
		}

		static _isTeam(option) {
			return this._isEnemyTeam(option) || this._isPlayerTeam(option);
		}

		static _getTeam(option) {
			if (!CommandLineInterface._isTeam(option)) {
				return undefined;
			}

			return CommandLineInterface._isPlayerTeam(option) ? Initiative.PLAYER_TEAM : Initiative.ENEMY_TEAM;
		}

		static add(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can add participants to initiative.');
				return;
			}

			const options = CommandLineInterface._getOptions(msg);
			if (CommandLineInterface._isTeam(options[0])) {
				const initiative = options[1];
				const team = CommandLineInterface._getTeam(options[0]);
				Initiative.addSelection(playerID, Messages.getSelectedTokens(msg), team, initiative);
			} else if (options.length < 2) {
				Initiative.addSelection(playerID, Messages.getSelectedTokens(msg), null, options[0]);
			} else {
				const options = CommandLineInterface._getRemainingOptions(msg, 0).join(' ');
				Messages.sendError(playerID, 'Unrecognized set of options for adding: "' + options +
					'". Try "' + CommandLineInterface.COMMAND + ' help"');
			}
		}

		static addName(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can add participants to initiative.');
				return;
			}

			const options = CommandLineInterface._getOptions(msg);
			if (options.length === 0) {
				Messages.sendError(playerID, 'No name given to add.');
			}

			const name = options[0];
			const team = CommandLineInterface._getTeam(options[1]);
			const initiative = CommandLineInterface._isTeam(options[1]) ? options[2] : options[1];

			Initiative.add(playerID, name, team, initiative);
		}

		static remove(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can remove combat participants.');
				return;
			}

			const id = CommandLineInterface._getOption(msg, 0);

			if (id) {
				CombatParticipants.removeByID(id);
				// TODO errors
			} else {
				const tokens = Messages.getSelectedTokens(msg);
				const selectionIDs = tokens.map(token => token.id);
				selectionIDs.forEach(CombatParticipants.removeByTokenID);
				// TODO errors
			}

		}

		static start(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can start fights.');
				return;
			}

			if (RoundInfo.isCombatRunning()) {
				Messages.sendError(playerID, 'A combat is already going on.');
				return;
			}

			const tokenPromises = CombatParticipants.addFromTurnOrder();
			tokenPromises.forEach(promise => {
				promise.then(result => {
					Util.debug('Turnorder addTokenID result ', result);
					if (result.hasErrors()) {
						Messages.sendError(playerID, 'Could not add token', result.errors);
					}
					if (result.hasWarnings()) {
						Messages.sendWarning(playerID, 'Warning(s) while adding token', result.warnings);
					}
				});
			});

			Promise.all(tokenPromises).then(() => {
				if (CombatParticipants.findAll().length === 0) {
					Messages.sendError(playerID, 'Trying to start combat with no participants!');
					return;
				}
				Util.debug('Starting new combat...');
				Util.debug('Participants: ', CombatParticipants._stateVar);

				Initiative.startCombat();
			});
		}

		static stop(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can stop fights.');
				return;
			}

			if (!RoundInfo.isCombatRunning()) {
				Messages.sendError(playerID, 'There is no fight going on.');
				return;
			}

			Initiative.stopCombat();
		}

		static giveTurn(msg) {
			const playerID = msg.playerid;
			if (!RoundInfo.isCombatRunning()) {
				Util.debug('Player ', msg.who, ' tried to give turn over, but no combat is running.');
				Messages.sendError(playerID, 'Can\'t give turn, no combat running!');
				return;
			}
			if (!RoundInfo.isPlayersTurn(playerID)) {
				Util.debug('Player ', msg.who, ' tried to give turn over, but it\'s not his turn.');
				Messages.sendError(playerID, 'It\'s not your turn!');
				return;
			}
			const id = CommandLineInterface._getOption(msg, 0);
			let participant = (config.groupEnemies && id === Initiative.ENEMY_TEAM) ? Initiative.ENEMY_TEAM_PARTICIPANT :
				CombatParticipants.findByID(id);
			if (!participant) {
				Messages.sendError(playerID, 'You tried to give turn to ', id, ' but a participant with that ID does not exist!');
				return;
			}
			const result = RoundInfo.giveTurn(participant);
			if (result.hasErrors()) {
				Messages.sendError(playerID, 'Can not give turn to ' + participant.name, result.errors);
			} else {
				Messages.sendInfo(playerID, 'You successfully gave the turn to "' + participant.name + '".');
			}
		}

		static reset(msg) {
			const playerID = msg.playerid;
			if (!playerIsGM(playerID)) {
				Messages.sendError(playerID, 'Only the GM can reset the popcorn initiative.');
				return;
			}
			CombatParticipants.reset();
			RoundInfo.reset();
			TacticalDice.fullReset();
			Messages.sendInfo(playerID, 'Popcorn initiative has been reset.');
		}

		static status(msg) {
			Util.debug('Participants:', state.PopcornInitiative.participantsVar);
			Util.debug('RoundInfo:', state.PopcornInitiative.roundInfoVar);
			Util.debug('TacDice:', state.PopcornInitiative.tacticalDiceVar);

			const playerID = msg.playerid;
			if (RoundInfo.isCombatRunning()) {
				Messages.sendStatus(playerID);
			} else {
				Messages.sendInfo(playerID, 'No combat running.');

				Messages.sendTacticalDiceStatus(playerID);

				if (playerIsGM(playerID)) {
					Messages.sendParticipantsStatus(playerID);
				}
			}
		}

		static menu(msg) {
			const playerID = msg.playerid;

			if (!RoundInfo.isCombatRunning()) {
				Messages.sendError(playerID, 'No combat running, there is nothing you can do right now.');
			} else if (RoundInfo.isPlayersTurn(playerID)) {
				Messages.sendCurrentChoice();
			} else {
				Messages.sendWarning(playerID, 'It\'s not your turn so there is no menu for you, but here\'s the current ' +
					'status (next time use "' + CommandLineInterface.COMMAND + ' status"):');
				Messages.sendStatus(playerID);
			}
		}

		static tacticalDice(msg) {
			const playerID = msg.playerid;
			if (!config.tacticalDice.enabled) {
				Messages.sendError(playerID, 'Tactical dice are not enabled.');
				return;
			}

			const handlers = {
				undefined: () => {
					Messages.sendTacticalDiceStatus(playerID);
				},
				'use': (options) => {
					let team = CommandLineInterface._getTeam(options[0]);
					if (!team) {
						team = playerIsGM(playerID) ? Initiative.ENEMY_TEAM : Initiative.PLAYER_TEAM;
					}
					TacticalDice.useDie(team).then(result => {
						if (result.hasErrors()) {
							Messages.sendError(playerID, 'Could not use tactical die.', result.errors);
							return;
						}
						const roll = result.val;
						const remaining = TacticalDice.getDice(team);
						Messages.postInfo('"' + msg.who + '" used a tactical die for the ' + team +
							' (' + remaining + ' remaining).\n\nRoll result (1' + config.tacticalDice.die + '): ' + roll);
					});
				},
				'add': (options) => {
					if (!playerIsGM(playerID)) {
						Messages.sendError(playerID, 'Only the GM can add tactical dice!');
						return;
					}
					const team = CommandLineInterface._getTeam(options[0]);
					if (!team) {
						Messages.sendError(playerID, 'The given option does not represent a valid team (enemies/players): ' + team);
						return;
					}

					let amount = options[1] || 1;
					if (isNaN(amount)) {
						Messages.sendError(playerID, 'Can not add tactical dice to team ' + team +
							', the given amount is not a number: "' + amount + '"!');
						return;
					}
					amount = Number(amount);
					if (!Number.isInteger(amount)) {
						Messages.sendError(playerID, 'Can not add tactical dice to team ' + team +
							', the given amount is not a whole number: "' + amount + '"!');
						return;
					} else if ((TacticalDice.getDiceAmount(team) + amount) < 0) {
						Messages.sendInfo(playerID, 'The amount to add will set the tactical dice amount of team ' + team + ' to 0.');
						amount = -TacticalDice.getDiceAmount(team);
					}

					TacticalDice.addDice(team, amount);
					Messages.postInfo('Successfully added ' + amount + ' tactical dice to team ' + team + '.');
					Messages.postTacticalDiceStatus();
				},
				'set': (options) => {
					if (!playerIsGM(playerID)) {
						Messages.sendError(playerID, 'Only the GM can set tactical dice!');
						return;
					}

					const team = CommandLineInterface._getTeam(options[0]);
					if (!team) {
						Messages.sendError(playerID, 'The given option does not represent a valid team (enemies/players): ' + team);
						return;
					}

					let amount = options[1];
					if (amount === undefined) {
						Messages.sendError(playerID, 'Could not find an amount to set tactical dice of team ' + team + ' to!');
						return;
					} else if (isNaN(amount)) {
						Messages.sendError(playerID, 'Can not set the amount of tactical dice of team ' + team +
							', the given amount is not a number: "' + amount + '"!');
						return;
					}
					amount = Number(amount);
					if (!Number.isInteger(amount)) {
						Messages.sendError(playerID, 'Can not set the amount of tactical dice of team ' + team +
							', the given amount is not a whole number: "' + amount + '"!');
						return;
					} else if (amount < 0) {
						Messages.sendError(playerID, 'Can not set the amount of tactical dice of team ' + team + ' to something negative (' +
							amount + ')!');
						return;
					}

					TacticalDice.setDice(team, Math.round(amount));
					Messages.postInfo('Successfully set the amount tactical dice of team ' + team + ' to ' + amount + '.');
					Messages.postTacticalDiceStatus();
				}
			};

			const options = CommandLineInterface._getOptions(msg);
			const handleFunc = handlers[options[0]];
			if (!handleFunc) {
				Messages.sendError(playerID, 'Unrecognized option "' + options[0] + '"');
			} else {
				handleFunc(options.slice(1));
			}
		}

		static help(msg) {
			const playerID = msg.playerid;
			const helpTarget = CommandLineInterface._getOption(msg, 0);

			Messages.sendHelp(playerID, helpTarget);
		}
	}

	class TurnOrder {

		static _get() {
			const turnorder = Campaign().get('turnorder');
			return turnorder ? JSON.parse(turnorder) : [];
		}

		static set(turnOrder) {
			Util.debug('Setting turnorder:', turnOrder);
			Campaign().set('turnorder', JSON.stringify(turnOrder, (key, value) => {
				return (value instanceof TurnOrderToken) ? value.toObject() : value;
			}));
		}

		static getTokens() {
			const tokens = TurnOrder._get().filter(TurnOrderToken.isTurnOrderToken);
			return tokens.filter(TurnOrderSynchronizer.isGenerated).map(TurnOrderToken.fromRoll20);
		}

		static buildTurnOrderEntry(participant, pr) {
			const id = participant.token || '-1';
			const custom = participant.name;
			return new TurnOrderToken(id, custom, pr);
		}

		static reset() {
			TurnOrder.set([]);
		}

		static show() {
			Campaign().set('initiativepage', true);
		}

		static hide() {
			Campaign().set('initiativepage', false);
		}
	}

	class SelectionToken {

		constructor(id, type) {
			this.id = id;
			this.type = type;
		}

		static getSelectedTokens(selection) {
			return selection.filter(selected => selected._type === 'graphic').map(SelectionToken._fromRoll20);
		}

		static _fromRoll20(selectionToken) {
			return new SelectionToken(selectionToken._id, selectionToken._type);
		}
	}

	class TurnOrderToken {

		constructor(id, custom, pr) {
			this.id = id;
			this.custom = custom;
			this.pr = pr;
		}

		static isTurnOrderToken(object) {
			return object.id !== -1 && object.id !== '-1';
		}

		static fromRoll20(turnOrderToken) {
			return new TurnOrderToken(turnOrderToken.id, turnOrderToken.custom, turnOrderToken.pr);
		}

		toObject() {
			return {
				id: this.id,
				custom: this.custom,
				pr: this.pr
			};
		}
	}

	class TurnOrderSynchronizer {

		static _buildTurnOrder() {
			const currentParticipant = RoundInfo.findCurrentParticipant();

			let currentEntry;
			if (config.groupEnemies && currentParticipant.isEnemy()) {
				currentEntry = TurnOrderSynchronizer._buildEnemiesTurnOrderEntry();
			} else {
				currentEntry = TurnOrder.buildTurnOrderEntry(currentParticipant);
			}

			currentEntry.pr = '';

			const filterCurrent = participants => participants.filter(_.negate(Participant.hasID(currentParticipant.id)));

			let restTurnOrderEntries;
			if (config.groupEnemies) {
				restTurnOrderEntries = TurnOrderSynchronizer._buildTurnOrderEntries(filterCurrent(CombatParticipants.findPlayers()));
				Util.debug('Rest players: ', restTurnOrderEntries);
				if (currentParticipant.isFriendly()) {
					Util.debug('Add enemies');
					restTurnOrderEntries.push(TurnOrderSynchronizer._buildEnemiesTurnOrderEntry());
					Util.debug('Rest players: ', restTurnOrderEntries);
				}
			} else {
				const allWithoutCurrent = filterCurrent(CombatParticipants.findAll());
				restTurnOrderEntries = TurnOrderSynchronizer._buildTurnOrderEntries(allWithoutCurrent);
			}
			return [currentEntry].concat(restTurnOrderEntries);
		}

		static _buildTurnOrderEntries(participants) {
			let allWithActed = participants.map(participant => {
				return [
					participant,
					RoundInfo.hasActed(participant)
				];
			});
			allWithActed.sort(([obj1, hasActed1], [obj2, hasActed2]) => {
				if (hasActed1 && !hasActed2) {
					return 1;
				} else if (!hasActed1 && hasActed2) {
					return -1;
				} else {
					return obj1.name.localeCompare(obj2.name);
				}
			});

			const buildParams = allWithActed.map(([obj, hasActed]) => [
				obj,
				hasActed ? TurnOrderSynchronizer.CHECK_ON : TurnOrderSynchronizer.CHECK_OFF
			]);

			return buildParams.map(params => TurnOrder.buildTurnOrderEntry(...params));
		}

		static _buildEnemiesTurnOrderEntry() {
			const totalEnemyCount = CombatParticipants.findEnemies().length;
			const toActEnemyCount = RoundInfo.findEnemiesToAct().length;
			let pr;
			Util.debug('ToActEnemyCount ', toActEnemyCount);
			if (toActEnemyCount === totalEnemyCount) {
				pr = TurnOrderSynchronizer.CHECK_OFF;
			} else if (toActEnemyCount === 0) {
				pr = TurnOrderSynchronizer.CHECK_ON;
			} else {
				pr = TurnOrderSynchronizer.CHECK_PART;
			}
			return {
				id: '-1',
				custom: Util.capitalizeFirstLetter(Initiative.ENEMY_TEAM),
				pr: pr
			};
		}


		static sync() {
			if (!RoundInfo.isCombatRunning()) {
				Util.debug('Not syncing turnorder outside of combat.');
				return;
			}

			TurnOrder.set(TurnOrderSynchronizer._buildTurnOrder());
		}

		static isGenerated(turnOrderToken) {
			return turnOrderToken.pr !== '' &&
				turnOrderToken.pr !== TurnOrderSynchronizer.CHECK_OFF &&
				turnOrderToken.pr !== TurnOrderSynchronizer.CHECK_PART &&
				turnOrderToken.pr !== TurnOrderSynchronizer.CHECK_ON &&
				turnOrderToken.custom !== Util.capitalizeFirstLetter(Initiative.ENEMY_TEAM);
		}
	}

	class Token {

		constructor(obj) {
			this._backingObj = obj;
		}

		get represents() {
			return this._backingObj.get('represents');
		}

		get name() {
			return this._backingObj.get('name');
		}

		get id() {
			return this._backingObj.get('_id');
		}

		static fromSelectionToken(selectionToken) {
			return Token.findByID(selectionToken.id);
		}

		static findByID(id) {
			const roll20Object = getObj('graphic', id);
			if (!roll20Object || roll20Object.get('_subtype') !== 'token') {
				const tokenString = roll20Object && JSON.stringify(roll20Object);
				Util.debug('Not a valid token: ', tokenString);
				return Result.createError('Not a valid token (' + tokenString + ')!');
			}
			return Result.create(Token.fromRoll20(roll20Object));
		}

		static fromRoll20(obj) {
			return new Token(obj);
		}

		calcInitiative() {
			let result = Result.create();
			let attrInitMod;
			const representedCharacter = this.represents;
			if (!representedCharacter) {
				result.addWarning('Token ' + this.name + ' represents no character, using 1d20+0 as initiative.');
			} else {
				attrInitMod = getAttrByName(representedCharacter, 'initiative');
				if (!attrInitMod) {
					result.addWarning('Initiative modifier missing, falling back to +0!');
				}
			}
			const initMod = attrInitMod || '+0';
			result.val = 'd20' + initMod;
			return result;
		}

		isPlayerControlled() {
			const playerIDs = this.getControllingPlayers();
			return playerIDs.length > 0;
		}

		getControllingPlayers() {
			const represents = this.represents;
			if (!represents) {
				return [];
			}
			const char = getObj('character', represents);
			const controlledby = char.get('controlledby');
			if (!controlledby) {
				return [];
			}

			return controlledby.split(',').filter(_.negate(playerIsGM));
		}
	}

	class Result {
		constructor(value, errors, warnings) {
			this.val = value;
			this._errors = errors || [];
			this._warnings = warnings || [];
		}

		get errors() {
			return this._errors.slice();
		}

		set errors(errors) {
			if (!errors || !errors.length) {
				throw new Error('Tried to set result.errors to something not array-like: ' + errors);
			}
			this._errors = errors || [];
		}

		get warnings() {
			return this._warnings.slice();
		}

		set warnings(warnings) {
			if (!warnings || !warnings.length) {
				throw new Error('Tried to set result.warnings to something not array-like: ' + warnings);
			}
			this._warnings = warnings;
		}

		static createMessage(errors, warnings) {
			return new Result(undefined, errors, warnings);
		}

		static createError(error) {
			return new Result(undefined, [error], []);
		}

		static createWarning(warning) {
			return new Result(undefined, [], [warning]);
		}

		static create(...args) {
			return new Result(...args);
		}

		addWarning(warning) {
			this._warnings.push(warning);
		}

		addError(error) {
			this._errors.push(error);
		}

		addMessagesFrom(otherResult) {
			this._warnings.push(...otherResult._warnings);
			this._errors.push(...otherResult._errors);
		}

		hasMessages() {
			return this.hasWarnings() || this.hasErrors();
		}

		hasWarnings() {
			return this._warnings.length !== 0;
		}

		hasErrors() {
			return this._errors.length !== 0;
		}

	}

	class Util {
		static reportErrors(func, funcName, playerID) {
			try {
				func();
			} catch (e) {
				const message = e instanceof Error ? e.message : e;
				const error = JSON.stringify(message);
				const stacktrace = e instanceof Error ? e.stack : '';

				const errorMessage = 'An unexpected error occured while running PopcornInitiative. Please send the contents ' +
					'of the following box to https://app.roll20.net/users/2153524/timo . You can try "' + CommandLineInterface.COMMAND +
					' reset" to reset all data. ' +
					'I\'m sorry for any inconvenience caused :( <br/>' +
					'<pre>Error while executing "' + funcName + '": ' + error + '\nStacktrace: ' + stacktrace + '</pre>';
				if (playerID) {
					Messages.sendRaw(playerID, errorMessage);
				} else {
					Messages.postRaw(errorMessage);
				}
			}
		}

		static debug(...args) {
			if (!Initiative.DEBUG || !Messages.DEBUG_LOG) {
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

		static getOtherTeam(team) {
			return Initiative.ENEMY_TEAM === team ? Initiative.PLAYER_TEAM : Initiative.ENEMY_TEAM;
		}

		static roll(query) {
			return new ReportingPromise(resolve => {
				sendChat(Messages.CHAT_NAME, '/r ' + query, msg => {
					const rollResult = JSON.parse(msg[0].content);
					resolve(rollResult.total);
				});
			}, 'Util.roll(query)');
		}

		static findGMsInGame() {
			return findObjs({_type: 'player'})
				.map(player => player.get('_id'))
				.filter(playerIsGM);
		}

		static arrayRemove(array, arg) {
			let pos;
			if (typeof arg === 'function') {
				pos = array.findIndex(arg);
			} else {
				pos = array.indexOf(arg);
			}
			return pos >= 0 ? array.splice(pos, 1) : array;
		}

		static capitalizeFirstLetter(string) {
			return string.charAt(0).toUpperCase() + string.slice(1);
		}
	}

	class Initiative {


		static initializeStateVars() {
			state.PopcornInitiative = state.PopcornInitiative || {};

			CombatParticipants.initializeStateVars();
			RoundInfo.initializeStateVars();
			TacticalDice.initializeStateVars();
		}


		static startCombat() {
			const players = CombatParticipants.findPlayers().map(player => player.name + ' (Init: ' + player.init + ')');
			const playerMessage = 'Starting combat with ' + players.length + ' player' + ((players.length !== 1) ? 's' : '') + ': ' +
				players.join(', ');
			const hfgl = '! Have fun ;)';
			if (config.groupEnemies) {
				Messages.postInfo(playerMessage + hfgl);
			} else {
				const enemies = CombatParticipants.findEnemies().map(enemy => enemy.name + ' (Init: ' + enemy.init + ')');
				const enemyMessage = enemies.length + ' ' + ((enemies.length === 1) ? 'enemy' : 'enemies') + ': ' + enemies.join(', ');
				Messages.postInfo(playerMessage + ' and ' + enemyMessage + hfgl);
			}
			TurnOrder.show();
			RoundInfo.reset();
			if (config.tacticalDice.enabled) {
				TacticalDice.reset();
			}
			RoundInfo.startNewRound();
			const highestInit = CombatParticipants.findParticipantWithHighestInit();
			Util.debug('startCombat highest init: ', highestInit);
			if (config.groupEnemies && highestInit.isEnemy()) {
				Messages.postInfo('An enemy won initiative with a ' + highestInit.init + ' and will start the combat!');
			} else {
				Messages.postInfo(highestInit.name + ' won initiative with a ' + highestInit.init + '!');
			}
			RoundInfo.giveTurn(highestInit);
		}

		static stopCombat() {
			Messages.postInfo('Ending combat. Hopefully no player died!');
			CombatParticipants.reset();
			RoundInfo.reset();
			if (config.tacticalDice.enabled) {
				TacticalDice.reset();
			}
			TurnOrder.reset();
			TurnOrder.hide();
		}

		static add(playerID, name, team, initiative) {
			CombatParticipants.addName(name, team, initiative);
		}

		static addSelection(playerID, tokens, team, initiative) {
			if (tokens.length === 0) {
				Messages.sendError(playerID, 'No token selected!');
				return;
			}
			tokens.forEach(selectedToken => {
				const tokenResult = Token.fromSelectionToken(selectedToken);
				if (tokenResult.hasErrors()) {
					Messages.sendError(playerID, 'Could not find token ' + selectedToken.id, tokenResult.errors);
					return;
				}
				const token = tokenResult.val;
				CombatParticipants.addToken(token, team, initiative).then(result => {
					const participant = result.val;
					if (result.hasErrors()) {
						Messages.sendError(playerID, 'Could not add token ' + token.name, result.errors);
					} else if (result.hasWarnings()) {
						const content = 'Added ' + participant.name + ', initiative ' + participant.init;
						Messages.sendWarning(playerID, content, result.warnings);
					} else {
						Messages.sendInfo(playerID, 'Added ' + participant.name + ' with initiative ' + participant.init +
							' to team ' + participant.team + '.');
					}
				});
			});
		}

	}

	class ReportingPromise extends Promise {
		constructor(executor, funcName, playerID) {
			const wrappedExecutor = (resolve, reject) => {
				Util.reportErrors(executor.bind(null, resolve, reject), funcName + ' promise', playerID);
			};

			super(wrappedExecutor);
		}

		static get [Symbol.species]() { return Promise; }
	}

	function createConstants() {
		CommandLineInterface.COMMAND = '!pci';

		Messages.CHAT_NAME = 'Initiative';
		on('ready', () => Messages.GAME_MASTERS = Util.findGMsInGame());

		TurnOrderSynchronizer.CHECK_OFF = '☐';
		TurnOrderSynchronizer.CHECK_PART = '▣';
		TurnOrderSynchronizer.CHECK_ON = '☑';

		Initiative.PLAYER_TEAM = 'players';
		Initiative.ENEMY_TEAM = 'enemies';
		Initiative.ENEMY_TEAM_PARTICIPANT =
			new Participant(Initiative.ENEMY_TEAM, Util.capitalizeFirstLetter(Initiative.ENEMY_TEAM), undefined, Initiative.ENEMY_TEAM, 0, []);

		Initiative.DEBUG = true;
		Messages.DEBUG_LOG = false;
	}

	createConstants();

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
		colors: {
			players: '#117412',
			enemies: '#a12313'
		}
	};

	on("change:graphic:status_dead", CombatParticipants.tokenDeadHandler);

	Initiative.initializeStateVars();

	CommandLineInterface.create();

	on('ready', () => {
		log('PopcornInitiative loaded');
	});

	return {
		handleDeadToken: CombatParticipants.tokenDeadHandler
	};
})();