#v1.2.1
- Remove a participant from initiative when its token is deleted from the board, matching what the plain roll20 turn order does. Previously a deleted token stayed in the turn selector until the combat was stopped or it was removed by hand. Unlike the dead marker, this applies to both teams, since a deleted token cannot act either way
- Fix an error when the dead marker was added to a token while no combat was running

#v1.2.0
- Change "tacticalDice.teamSizeAdjustment" to scale both teams independently: each team may now let a percentage of its own members act in succession, instead of only the larger team getting a raised limit
- Fix participants not showing up in the turn order tracker: every turn order entry now carries the required "_pageid", without which the tracker cannot resolve the token an entry refers to and drops the row (only custom entries like the grouped "Enemies" remained visible)
- Fix showing the turn order tracker by setting "initiativepage" to the id of the page the participants are on instead of `true`
- Fix chat messages being unreadable in the new interface's dark mode: every element that renders text now sets its own colour instead of inheriting one, since dark mode recoloured the text but left the script's light message boxes alone
- Improve contrast of links, the tactical dice warning and the turn buttons so they pass WCAG AA in both light and dark mode
- Add command "tac clear" which sets the tactical dice of both teams to 0 without changing the config or anything else
- Add command "tac limit" which shows how many turns in a row each team may currently take before tactical dice are awarded to the opposition, and how many the acting team has taken so far
- Round the scaled consecutive turn limit in the players' favour: up for the player team, down for the enemy team
- Add config value "tacticalDice.teamSizeAdjustmentPercent" (default 35) which controls that percentage. "tacticalDice.maxConsecutiveTurns" is now used as the floor of the scaled value, so a team that has lost most of its members can still take that many turns in a row
- Fill in config values added by newer script versions instead of leaving them undefined in games that already have a saved config
- Add command "clear" which removes participants from initiative without touching tactical dice, config or anything else. Removes the enemy team by default, `!eao clear p` removes the player team and `!eao clear all` removes both. Can only be used while no combat is running
- Support the "D&D 2024 by Roll20" character sheet: the initiative modifier is now read via the async `getSheetItem` Mod API (requires the "Experimental" API sandbox version and the 2024 sheet as the game's primary sheet)
- Fix reading the initiative modifier on the "D&D 5E by Roll20" (2014) sheet: the attribute is called `initiative_bonus`, not `initiative` (the old name is still checked as a fallback for other sheets)
- Fix malformed initiative rolls when the modifier attribute did not include a sign (e.g. `d202` instead of `d20+2`)
- Update installation documentation for the current Roll20 interface ("Mod (API) Scripts", API sandbox version selection)
- Fix script.json metadata (script name/file mismatch)

#v1.1.2
- Change default of config value "showAllMenusToGM" to `true`
- Show error when adding a token without a nameplate

#v1.1.0
- Add config value "showAllMenusToGM" which shows all next turn selection menus for the players also to the GM
- Fix adding a X to a token not removing it from combat
- Fix sending messages to characters controlled by "All players"
