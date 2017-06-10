package main

import (
	"encoding/json"
	"time"

	log "smithyOfGames/gamejam/consolelog"

	"github.com/googollee/go-socket.io"
)

const _GAME_ROOM = "game"

type Game struct {
	server  *socketio.Server
	players map[socketio.Socket]*Player
}

type Pos struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type PlayerInfo struct {
	Id  string `json:"id"`
	Pos Pos    `json:"pos"`
	//TargetY int
	//Vel int
}
type IslandInfo struct {
	Pos Pos    `json:"pos"`
}

type TickInfo struct {
	TickId  int64        `json:"tickId"` // time?
	Players []PlayerInfo `json:"players"`
	Islands []IslandInfo `json:"islands"`
}

func NewGame(server *socketio.Server) *Game {
	game := &Game{server: server, players: map[socketio.Socket]*Player{}}

	server.On("connection", func(so socketio.Socket) {
		log.Info("on connection")
		game.AddPlayer(so)
	})

	server.On("error", func(so socketio.Socket, err error) {
		log.Error("error:", err)
	})

	return game
}

func (self *Game) AddPlayer(so socketio.Socket) {
	player := Player{
		Id:      so.Id(),
		Vel:     Vec2{X: 250, Y: 0},
		Pos:     Vec2{X: 100, Y: 100},
		TargetY: 100,
	}
	log.Debug("set player id: ", so.Id())
	self.players[so] = &player

	so.Join(_GAME_ROOM)

	so.On("move", func(msg string) {
		//log.Info("emit:", so.Emit("chat message", msg))
		//so.BroadcastTo("chat", "chat message", msg)
		log.Infof("move cmd: %v", msg)
		p := self.players[so]

		switch msg {
		case "down":
			p.Vel.Y = 100
		case "up":
			p.Vel.Y = -100
		case "stop":
			p.Vel.Y = 0
		}
	})

	so.On("collision", func(msg string) {
		log.Infof("collision type: %v", msg)
		p := self.players[so]
		switch msg {
			case "barrel":
				go func() {
					<-time.After(1000 * time.Millisecond)
					p.Vel.X = 250
				}()
				p.Vel.X = 0
			case "island":
				p.Vel.X = 0
		}
	})

	so.On("setPlayerName", func(msg string) {
		//log.Info("emit:", so.Emit("chat message", msg))
		//so.BroadcastTo("chat", "chat message", msg)
		log.Infof("name cmd: %v", msg)

		self.players[so].Name = msg

		info := struct {
			Id string `json:"id"`
		}{so.Id()}

		buf, _ := json.Marshal(info)

		so.BroadcastTo(_GAME_ROOM, "playerConnected", string(buf))
	})

	so.On("disconnection", func() {
		log.Info("on disconnect")

		// TODO сделать безопасно (параллельный доступ!!!)
		player := self.players[so]
		delete(self.players, so)
		so.BroadcastTo(_GAME_ROOM, "playerDisconnected", player.Id)
	})
}

func (self *Game) Loop() {
	ticker := time.NewTicker(time.Millisecond * 100)

	prevTick := time.Now()

	players := []PlayerInfo{}

	for t := range ticker.C {

		deltaTime := float32(t.Sub(prevTick).Seconds())
		prevTick = t

		players = players[:0]

		for _, p := range self.players {
			p.Update(deltaTime)
		}

		//msg := fmt.Sprintf("%v", deltaTime)
		//log.Debugf("tick %v", msg)
		for _, p := range self.players {
			players = append(players, PlayerInfo{
				Id:  p.Id,
				Pos: Pos{int(p.Pos.X), int(p.Pos.Y)},
			})
		}

		msg, _ := json.Marshal(TickInfo{
			TickId:  0,
			Players: players,
			//Islands: islands
		})
		self.server.BroadcastTo(_GAME_ROOM, "tick", string(msg))

		//time.Sleep(300 * time.Millisecond)
	}
}
