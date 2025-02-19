const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");
const os = require("os");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Get local IP address
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (!iface.internal && iface.family === "IPv4") {
        return iface.address;
      }
    }
  }
  return "localhost";
};

const localIP = getLocalIP();

app.prepare().then(() => {
  const server = createServer(handle);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  let gameState = {
    players: [],
    deck: [],
    currentTurn: "",
    gameStarted: false,
    gameEnded: false,
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("gameAction", (action) => {
      switch (action.type) {
        case "JOIN":
          if (action.playerId && action.playerName) {
            const newPlayer = {
              id: action.playerId,
              name: action.playerName,
              hand: [],
              score: 0,
              isHouse: gameState.players.length === 0,
              isStanding: false,
            };
            gameState.players.push(newPlayer);
          }
          break;

        case "START":
          if (!gameState.gameStarted && gameState.players.length >= 2) {
            gameState.gameStarted = true;
            gameState.deck = createDeck();

            // Deal initial cards
            gameState.players.forEach((player) => {
              player.hand = [gameState.deck.pop(), gameState.deck.pop()];
              player.score = calculateHandValue(player.hand);
            });

            gameState.currentTurn =
              gameState.players.find((p) => !p.isHouse)?.id || "";
          }
          break;

        case "HIT":
          if (action.playerId === gameState.currentTurn) {
            const player = gameState.players.find(
              (p) => p.id === action.playerId
            );
            if (player && !player.isStanding) {
              const card = gameState.deck.pop();
              if (card) {
                player.hand.push(card);
                player.score = calculateHandValue(player.hand);

                if (player.score > 21) {
                  player.isStanding = true;
                  // Move to next player or end game
                  const nextPlayer = gameState.players.find(
                    (p) => !p.isStanding && p.id !== player.id
                  );
                  gameState.currentTurn = nextPlayer?.id || "";
                }
              }
            }
          }
          break;

        case "STAND":
          if (action.playerId === gameState.currentTurn) {
            const player = gameState.players.find(
              (p) => p.id === action.playerId
            );
            if (player) {
              player.isStanding = true;
              // Move to next player or end game
              const nextPlayer = gameState.players.find(
                (p) => !p.isStanding && p.id !== player.id
              );
              gameState.currentTurn = nextPlayer?.id || "";

              // If all players are standing, determine winner
              if (!gameState.players.find((p) => !p.isStanding)) {
                gameState.gameEnded = true;
                gameState.winner = determineWinner(gameState.players);
              }
            }
          }
          break;

        case "RESET":
          gameState = {
            players: [],
            deck: createDeck(),
            currentTurn: "",
            gameStarted: false,
            gameEnded: false,
          };
          break;
      }

      // Broadcast updated game state to all clients
      io.emit("gameStateUpdate", gameState);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      gameState.players = gameState.players.filter((p) => p.id !== socket.id);
      io.emit("gameStateUpdate", gameState);
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`> Server running on:`);
    console.log(`> Local: http://localhost:${PORT}`);
    console.log(`> Network: http://${localIP}:${PORT}`);
    console.log(
      `\n> Share the Network URL with users in your network to let them join!`
    );
  });
});

// Game utility functions
function createDeck() {
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const values = [
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
    "A",
  ];
  const deck = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({
        suit,
        value,
        code: `${value}${suit[0].toUpperCase()}`,
      });
    });
  });

  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  hand.forEach((card) => {
    if (card.value === "A") {
      aces += 1;
      value += 11;
    } else if (["K", "Q", "J"].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  });

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

function determineWinner(players) {
  const activePlayers = players.filter((p) => !p.isHouse && p.score <= 21);
  const house = players.find((p) => p.isHouse);

  if (!house) return undefined;

  if (house.score > 21) {
    // House busts, highest non-bust player wins
    return activePlayers.reduce(
      (prev, curr) => (!prev || curr.score > prev.score ? curr : prev),
      undefined
    );
  }

  // House doesn't bust, highest score under 21 wins
  const winner = activePlayers.find((p) => p.score > house.score) || house;
  return winner;
}
