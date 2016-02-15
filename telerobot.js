'use strict'

const HOME_DIR = (_ => process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'])();
const MOVE_FORMAT = '+000';

const express = require('express');
const config = require(`${HOME_DIR}/.telerobot_conf.json`);
const net = require('net');
const https = require('https');
const bodyParser = require('body-parser');
const numbro = require('numbro');

var dirty = true;
var programExecuting = false;
var state = "+000+000";
var programCommands = [];

//Motion Server
var server = net.createServer(socket => {
    var clientReady = true;
    var timerHandle;

    var cleanup = _ => {
        if ( timerHandle ) {
             clearTimeout(timerHandle);
         }
         socket.end();
    };

    socket.setNoDelay();
    socket.on('end', _ => console.log('done!'));

    socket.on('error', error => {
        console.log(error);

        //Shutdown on any error
        cleanup();
    });

    var writeState = _ => {
        if ( clientReady && dirty ) {
            if ( !socket.write("[" + state) ) { //pause writing to the client if write fails
                clientReady = false;
            }
        }

        timerHandle = setTimeout(writeState, 250);
    }

    //Client has read the last message and is ready for more
    socket.on('drain', _ => clientReady = true);
    socket.on('disconnect', _ => cleanup());

    writeState();
});

server.listen(config.MotionServerPort, '0.0.0.0', _ => {
    var host = server.address().address
    var port = server.address().port
    console.log("Motion Server Listening at %s:%s", host, port)
});

var app = express();
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('static'));

//Get the status of the photon via the photon api
app.get('/status', (req, res) => {
    https.get({
        host: 'api.particle.io',
        path: `/v1/devices/${config.DeviceId}?access_token=${config.AccessToken}`
    },
    response => {
        var body = '';
        response.on('data', d => body += d);
        response.on('end', _ => {
            var parsed = JSON.parse(body);
            if ( parsed.connected ) {
                res.json({
                    Code: 200,
                    Message: "Success",
                    Body: "connected"
                });
            } else {
                res.json({
                    Code: 200,
                    Message: "Success",
                    Body: "not_connected"
                });
            }
            res.end();
        });
    }).on('error', e => {
        res.json({
            Code: 500,
            Message: "Failure",
            Body: e.message
        });
    });
});

//Handle move requests from joystick.js code (dx,dy)
app.post('/move', (req, res) => {
    if ( programExecuting ) {
        res.json({Code: 400, Message: "Failure", Body: "Program executing"});
    } else {
        updateState(parseInt(req.body.dx), parseInt(req.body.dy));
        res.json({Code: 200, Message: "Success", Body: state});
    }

    res.end();
});

function updateState(dx, dy) {
  var rightMagnitude = -dy
  var leftMagnitude = -dy

  //Set a deadzone between -15 and +15 to make driving straight easier
  if (dx > 15) {
    leftMagnitude = leftMagnitude * (1.0 - dx / 255.0)
  } else if (dx < -15) {
    rightMagnitude = rightMagnitude * (1.0 + dx / 255.0)
  }

  state = numbro(Math.floor(leftMagnitude)).format(MOVE_FORMAT) + numbro(Math.floor(rightMagnitude)).format(MOVE_FORMAT);
  if ( state === "000000" ) state = "+000+000"; //numbro fail?
  dirty = true;
}

//A program is a set of drive commands with a duration in milliseconds
// One command per line
// ex.
// +100 +100 1000
// +100 +000 2000
// +000 +000 1000
app.post('/executeProgram', (req, res) => {
    var commandSet = req.body.commandset.split('\n');

    if ( commandSet ) {
        for ( let command of commandSet ) {
            programCommands.push(command);
        }
        processNextCommand();
    }
    res.json({
        Code: 200,
        Message: "Success",
        Body: ""
    });
    res.end();
});

function processNextCommand() {
    if ( programCommands.length > 0 ) {
        programExecuting = true;

        var command = programCommands.shift();
        var pause = 100;
        if ( command && command.length > 0 ) {
            var parts = command.split(' ');
            if ( parts.length == 3 ) {
                state = parts[0] + parts[1];
                console.log(state);
                dirty = true;
                pause = parts[2];
            }
        }

        setTimeout(processNextCommand, pause);
    } else {
        programExecuting = false;
    }
}

var httpServer = app.listen(3000, '0.0.0.0', _ => {
  var host = httpServer.address().address
  var port = httpServer.address().port

  console.log("HTTP Server Listening at http://%s:%s", host, port)
});