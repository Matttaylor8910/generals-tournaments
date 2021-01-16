const http = require('axios').default;
const io = require('socket.io-client');
const config = require('./config.js');
const Bot = require('./scripts/bot.js');

let socket = io('http://bot.generals.io');
const args = process.argv.slice(2);

const BASE_URL =
    'https://us-central1-generals-tournaments.cloudfunctions.net/webApi/api/v1';

let bot;
let playerIndex;
let replay_url = null;
let usernames;
let chatRoom;
let started = false;
let interval;

let tournamentId;
let lobbyId;
let botIndex = 0;

let last;
for (const arg of args) {
  if (last === '--tournament') {
    tournamentId = arg;
  } else if (last === '--lobby') {
    lobbyId = arg;
  } else if (last === '--bot') {
    botIndex = Number(arg);
  }
  last = arg;
}

if (args.length < 2) {
  help();
}

const {userId, name} = config.bots[botIndex];
const safeName = encodeURIComponent(name);
if (!userId) {
  throw `no bot for index ${botIndex}`;
}

socket.on('disconnect', function() {
  console.error('Disconnected from server.');

  // try to join tournament again if we disconnect
  // if the tournament is over, it will end the process
  loadTournament();
});

socket.on('connect', function() {
  console.log('Connected to server.');

  // if there is a lobby to join, joinCustomGameQueue();
  // else join tournament
  if (lobbyId) {
    joinCustomGameQueue(lobbyId);
  } else if (tournamentId) {
    loadTournament();
  } else {
    help();
  }
});

socket.on('game_start', function(data) {
  // Get ready to start playing the game.
  playerIndex = data.playerIndex;
  started = false;
  replay_url =
      'http://bot.generals.io/replays/' + encodeURIComponent(data.replay_id);
  usernames = data.usernames;
  chatRoom = data.chat_room;
  console.log(name + '\tgame starting! replay: ' + replay_url);
  socket.emit('chat_message', chatRoom, 'glhf');
  clearInterval(interval);
});

socket.on('game_update', function(data) {
  if (!started) {
    bot = new Bot(socket, playerIndex, data);
    started = true;
  }

  bot.update(data);
});

// win or lose, jump back in the queue
socket.on('game_lost', gameOver.bind(this));
socket.on('game_won', gameOver.bind(this));

function joinCustomGameQueue(lobbyId) {
  socket.emit('join_private', lobbyId, userId);
  interval = setInterval(() => {
    socket.emit('set_force_start', lobbyId, true);
  }, 5000);
  console.log(
      name + '\tjoining lobby: http://bot.generals.io/games/' +
      encodeURIComponent(lobbyId));
}

function gameOver() {
  socket.emit('chat_message', chatRoom, 'gg');
  socket.emit('leave_game');

  if (lobbyId) {
    joinCustomGameQueue(lobbyId);
  } else if (tournamentId) {
    joinTournamentQueue();
  }
}

function loadTournament() {
  console.log(`loading tournament ${tournamentId}`);
  http.get(`${BASE_URL}/tournaments/${tournamentId}`)
      .then(response => {
        if (response.data) {
          startTime = response.data.startTime;
          endTime = response.data.endTime;

          // endTime is in the future
          if (endTime > Date.now()) {
            joinTournament();
          } else {
            tournamentOver();
          }
        }
      })
      .catch(error => {
        console.log(`${name}\tcouldn't load tournament`);
        setTimeout(loadTournament.bind(this), 5000);
      });
}

function joinTournament() {
  console.log(`${name}\tjoining tournament ${tournamentId}`);
  http.post(`${BASE_URL}/tournaments/${tournamentId}/join/${safeName}`)
      .then(() => {
        joinTournamentQueue();
      })
      .catch(error => {
        console.log(`${name}\tcouldn't join tournament`);
        setTimeout(joinTournament.bind(this), 5000);
      });
}

function joinTournamentQueue() {
  const now = Date.now();
  if (startTime > now) {
    const difference = startTime - now;
    console.log(`tournament starts in ${difference / 1000} seconds`);
    setTimeout(joinTournamentQueue.bind(this), difference);
  } else if (endTime < now) {
    tournamentOver();
  } else {
    console.log(`joining queue as ${name}`);
    http.post(`${BASE_URL}/tournaments/${tournamentId}/queue/${safeName}`)
        .then(() => {
          pollLobby();
        })
        .catch(error => {
          console.log(`${name}\tcouldn't join queue`);
          setTimeout(joinTournamentQueue.bind(this), 3000);
        });
  }
}

function pollLobby() {
  if (endTime < Date.now()) {
    return tournamentOver();
  }
  http.get(`${BASE_URL}/tournaments/${tournamentId}/lobby/${safeName}`)
      .then(response => {
        if (response.data.lobby) {
          joinCustomGameQueue(response.data.lobby);
        } else {
          console.log(`${name}\twaiting for a lobby...`);
          setTimeout(pollLobby.bind(this), 1000);
        }
      })
      .catch(error => {
        console.log(`${name}\tget lobby failed`);
        setTimeout(pollLobby.bind(this), 1000);
      });
}

function tournamentOver() {
  console.log('tournament is over');
  process.exit();
}

function help() {
  console.log(`
    Error, please run like:\n
    node app.js --lobby [lobby_id]
    node app.js --tournament [tournament_id]
    node app.js --tournament [tournament_id] --bot [bot_index]
  `);
  process.exit();
}