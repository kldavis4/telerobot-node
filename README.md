# telerobot
Telepresence robot server prototype written in Node. This is a port of the Go version (https://github.com/kldavis4/telerobot). To be used in conjunction with a differential wheeled robot powered by a Particle Photon (or Core) microcontroller. This version requires slightly different code on the client. The client does not send ACK responses back to the server and expects every message to start with a '[' symbol for framing the messages.

## Configuration
Copy `telerobot_conf.json.sample` to `~/.telerobot_conf.json` and update with the device id and access token of the particle microcontroller.

### Start the web server and motion server:

    node telerobot.js

### Go to http://localhost:3000/

This page allows control via the virtual joystick. There is a device status indicator at the top left (green = connected, red = not connected, purple = web application error).

### Got to http://localhost:3000/program.html

This page allows control via a list of motion commands.

