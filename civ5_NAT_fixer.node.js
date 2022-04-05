const { networkInterfaces } = require('os')

// misc
const log = console.log

function pause() {
  process.stdin.setRawMode( true )
  process.stdin.resume()
  process.stdin.on( 'data', () => process.stdin.pause())
}

const nets = networkInterfaces()
const results = {}

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
            if (!results[name]) {
                results[name] = []
            }
            results[name].push(net)
        }
    }
}

log(results['Hamachi'], results['Ethernet'])
pause()

