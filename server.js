const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');
const { rooms } = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {

  console.log(`${req.method}, ${req.url}`);

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, value.replace(/\+/g, " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if (req.method === "GET" && req.url === "/") {
      let htmlPage = fs.readFileSync("./views/new-player.html", "utf-8");
      let roomsList = world.availableRoomsToString();
      let newPlayerPage = htmlPage.replace(/#{availableRooms}/g, roomsList);

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html");
      return res.end(newPlayerPage);
    }

    // Phase 2: POST /player
    if (req.method === "POST" && req.url === "/player") {
      let {name, roomId} = req.body;
      player = new Player(name, world.rooms[roomId]);

      res.statusCode = 302;
      res.setHeader("Location", `/rooms/${roomId}`);
      res.setHeader("Content-Type", "text/html");
      return res.end();
    }

    if (!player) {
      res.statusCode = 302;
      res.setHeader("Location", "/");
      return res.end();
    }

    // Phase 3: GET /rooms/:roomId
    if (req.method === "GET" && req.url.startsWith("/rooms/") && req.url.length <= 10) {
      let urlPath = req.url.split("/");
      let roomId = urlPath[2]; let room = world.rooms[roomId];

      if (!room || room.name !== player.currentRoom.name) {
        let currentId;

        for(let id in world.rooms) {
          if (world.rooms[id]["name"] === player.currentRoom["name"]) {
            currentId = world.rooms[id]["id"];
          }
        }

        res.statusCode = 302;
        res.setHeader("location", `/rooms/${currentId}`);
        return res.end();
      }

      let baseRoom = fs.readFileSync("./views/room.html", "utf-8");

      let roomInfo = baseRoom.replace(/#{roomName}/g, room.name)
                      .replace(/#{roomItems}/g, room.itemsToString())
                      .replace(/#{exits}/g, room.exitsToString())
                      .replace(/#{inventory}/g, player.inventoryToString());

      return res.end(roomInfo);
    }

    // Phase 4: GET /rooms/:roomId/:direction
    if (req.method === "GET" && req.url.startsWith("/rooms/")) {
      let urlPath = req.url.split("/");
      let direction = urlPath[3];

      console.log(player.currentRoom);
      console.log("\n---------\n");

      try {
        player.move(direction[0]);
      } catch {
        console.log("error here!");
        res.statusCode = 302;
        res.setHeader("Location", "/rooms/1");
        return res.end();
      }

      console.log(player.currentRoom);

      res.statusCode = 302;
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Location", "/rooms/1");
      return res.end();
    }

    // Phase 5: POST /items/:itemId/:action
    if (req.method === "POST" && req.url.startsWith("/items/")) {
      let urlPath = req.url.split("/");
      let itemId = urlPath[2]; let action = urlPath[3];

      try {
        switch(action) {
          case "eat":
          player.eatItem(itemId);
          break;
          case "take":
          player.takeItem(itemId);
          break;
          case "drop":
          player.dropItem(itemId);
          break;
        }
      } catch(error) {
        console.log("error here!");
        res.statusCode = 404;
        let errorTemp = fs.readFileSync("./views/error.html", "utf-8");
        let errorPage = errorTemp.replace(/#{errorMessage}/g, error);
        return res.end(errorPage);
      }

      res.statusCode = 302;
      res.setHeader("Location", "/rooms/1");
      return res.end();
    }

    // Phase 6: Redirect if no matching route handlers
    res.statusCode = 302;
    res.setHeader("Location", "/rooms/1");
    return res.end();
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
