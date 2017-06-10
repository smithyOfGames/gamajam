'use strict';

class Game {
	constructor(contanerName, playerName) {
		log('constructor');

      this.initNetwork();

		this.pg = new Phaser.Game(
			800, 600,
			Phaser.AUTO,
			contanerName,
			{
				preload: ()=> this.preload(),
				create: ()=> this.create(),
				update: ()=> this.update(),
				render: ()=> this.render()
			}
		);

		this.playerName = playerName;
		this.player = null;
		this.playerRoad = null;
		this.joystick = null;
		this.buttonA = null;
		this.keyboard = null;
		this.fireButton = null;
		this.points = new Set();
		this.players = new Map();

		this.fireDelay = 1000;
	}

	initNetwork() {
		this.socket = io.connect(window.location.host, {path: "/ws/", transports: ['websocket']});
		this.socket.on('connect', () => this.onConnect());
		this.socket.on('tick', (msg)=>this.onTick(msg));
		this.socket.on('playerConnected', (msg)=>this.onPlayerConnected(msg));
		this.socket.on('playerDisconnected', (msg)=>this.onPlayerDisconnected(msg));
	}

	onConnect() {
		if (this.player) {
            this.player.id = this.socket.id;
        }
	}

	preload() {
		this.pg.time.advancedTiming = true;
		this.pg.time.desiredFps = 60;

      this.pg.load.atlas('gamepad', 'assets/virtualjoystick/atlas.png', 'assets/virtualjoystick/atlas.json');
		this.pg.load.image('barrel', 'assets/barrel.png');
		this.pg.load.image('water', 'assets/water.png');
		this.pg.load.image('ship', 'assets/ship2_red.png');
		this.pg.load.image('collision', 'assets/collision.png');

		this.pg.load.audio('taverna', ['assets/audio/taverna.mp3', 'assets/audio/taverna.ogg']);
		this.pg.load.audio('game', ['assets/audio/game.mp3', 'assets/audio/game.ogg']);
	}

	create() {
		let music = this.pg.add.audio('game');
		music.play();

        this.initVirtualGamepad();
		this.playerRoad = new Road(this.pg);
		this.player = new Player(this.pg, this.socket.id, this.playerName);

		this.socket.emit("setPlayerName", this.player.name);

		this.keyboard = this.pg.input.keyboard.createCursorKeys();
		this.fireButton = this.pg.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);
		this.fireButton.onDown.add(this.fire, this);

		let btnDown = this.pg.input.keyboard.addKey(Phaser.Keyboard.F);
		btnDown.onDown.add(()=>this.socket.emit("move", "down"), this);
		btnDown.onUp.add(()=>this.socket.emit("move", "stop"), this);

		let btnUp = this.pg.input.keyboard.addKey(Phaser.Keyboard.R);
		btnUp.onDown.add(()=>this.socket.emit("move", "up"), this);
		btnUp.onUp.add(()=>this.socket.emit("move", "stop"), this);

		log("game created");
	}

	update() {
      if (this.buttonA.isDown) {
		   this.fire();
      }

		this.player.update();
		let playerVel = this.player.vel;

		this.playerRoad.vel = playerVel;
		this.playerRoad.update();

		for (let p of this.points) {
			p.vel = playerVel; // все предметы на дороге (движутся со скоростью игрока ему навстресу)
			p.update(); // TODO передать скорость дороги
		}

		for (let p of this.players.values()) {
			p.update();
		}
	}

	render() {
		this.pg.debug.cameraInfo(this.pg.camera, 8, 500);
		this.pg.debug.text('fps: ' + (this.pg.time.fps || '--'), 700, 570, "#00ff00");
	}

    fire() {


        let msg = {
            x: 700,
            y: this.player.getTargetY()
        };
        log('click to ' + JSON.stringify(msg));

        this.addPoint(700, this.player.getTargetY());
	}

	onTick(msg) {
		log("tick " + msg);

		if (!this.player) {
			return;
		}

		let tickInfo = JSON.parse(msg);
		for (let p of tickInfo.players) {
			if (p.id === this.player.id) {
				this.player.posX = p.pos.x;
				this.player.sprite.y = p.pos.y;
			}
		}
	}

   initVirtualGamepad() {
		let gamepad = this.pg.plugins.add(Phaser.Plugin.VirtualGamepad);
		this.joystick = gamepad.addJoystick(90, this.pg.height - 90, 0.75, 'gamepad');
		this.buttonA = gamepad.addButton(this.pg.width - 90, this.pg.height - 90, 0.75, 'gamepad');
    }

	onPlayerConnected(msg) {
		log("connected player, id: " + msg);
		let info = JSON.parse(msg);
		let p = new Player(this.pg, info.id, "user");
		this.players.set(info.id, p);
	}

	onPlayerDisconnected(msg) {
		log("disconnected player, id: " + msg);
		this.players.delete(msg);
	}

	addPoint(x, y) {
		let p = new ClickPoint(this, x, y, this.player)
		this.points.add(p);
	}

	delPoint(p) {
		this.points.delete(p);
	}
}
