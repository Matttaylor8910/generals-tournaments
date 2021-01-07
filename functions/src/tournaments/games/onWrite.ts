import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

import {IGame, IGeneralsReplay, ITournament} from '../../../../types';
import {getLastReplayForUsername} from '../../util/api';
import * as simulator from '../../util/simulator';

try {
  admin.initializeApp();
} catch (e) {
  console.log(e);
}

export const onWriteGame =
    functions.firestore.document('tournaments/{tourneyId}/games/{gameId}')
        .onWrite(async (gameDoc, context) => {
          await checkReplay(gameDoc.before, gameDoc.after);
          await lookForFinishedGame(gameDoc.after);
          return 'Done';
        });

async function checkReplay(before: DocumentSnapshot, after: DocumentSnapshot) {
  const {replayId: beforeId} = before.data() || {} as IGame;
  const {replayId: afterId} = after.data() || {} as IGame;

  // get the replay info when a replay is added to the game
  if (beforeId !== afterId && afterId !== undefined) {
    const replay = await simulator.getReplay(afterId);
    await after.ref.update({replay});
    // TODO: add the latest scores to each of the players
  }
}

async function lookForFinishedGame(snapshot: DocumentSnapshot) {
  const game = snapshot.data() || {} as IGame;
  const {players} = game;

  // if we have a game with some players, and we haven't set a replayId yet,
  // find games for these players
  if (!game.replayId && players?.length) {
    // get list of tracked replays for a tournament
    const tournamentSnap = await snapshot.ref.parent.parent!.get();
    const tournament = tournamentSnap.data() || {} as ITournament;
    const trackedReplays = tournament.replays || [];

    console.log(`tracked replays for ${tournamentSnap.id}:`, trackedReplays);
    console.log('getting replays');

    // for each player, request their latest replay
    const replayPromises: Promise<IGeneralsReplay>[] =
        players.map((player: string) => getLastReplayForUsername(player));

    console.log('waiting for all promises');

    // wait for all of those replays to load so we can compare those replays to
    // see if they're the same
    const replays: IGeneralsReplay[] = await Promise.all(replayPromises);

    // build up a map of the present replayIds and their counts
    const replayCounts = new Map<string, number>();
    console.log(`loaded ${replays.length} replays`);
    replays
        .filter(replay => {
          // replays must exist, not already be tracked, and have to start
          // after this game was created in the database
          return replay && !trackedReplays.includes(replay.id) &&
              replay.started > game.started;
        })
        .map(replay => replay.id)
        .forEach(replayId => {
          replayCounts.set(replayId, (replayCounts.get(replayId) || 0) + 1);
        });

    console.log(replayCounts);

    // determine which replay has the most shared players
    let most = {count: 0, replayId: ''};
    for (const entry of replayCounts.entries()) {
      const [replayId, count] = entry;
      if (count > most.count) {
        most = {count, replayId};
      }
    }
    console.log(`${most.replayId} is shared by ${most.count} of the ${
        players.length} players`);

    // if over half (but not exactly half) of the og players were in this
    // game, and we have not tracked it already, count the game
    if (most.count > players.length / 2) {
      const batch = admin.firestore().batch();
      batch.update(snapshot.ref, {replayId: most.replayId});
      batch.update(tournamentSnap.ref, {
        replays: admin.firestore.FieldValue.arrayUnion(most.replayId),
      });
      await batch.commit();

      console.log(`committing ${most.replayId}`);
      return;
    }

    // if we made it this far, gotta keep looking, start in 10 seconds
    await keepLookingIn10Seconds(snapshot);
  }
}

function keepLookingIn10Seconds(snapshot: DocumentSnapshot): Promise<void> {
  return new Promise(resolve => {
    setTimeout(async () => {
      await snapshot.ref.update({lastChecked: Date.now()})
      resolve();
    }, 10000);
  });
}