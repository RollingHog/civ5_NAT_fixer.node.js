const os = require('os')
const child_process = require('child_process')

// MISC
const log = console.log

function pause() {
  process.stdin.setRawMode( true )
  process.stdin.resume()
  process.stdin.on( 'data', () => process.stdin.pause())
}

// MAIN THINGS

function tracert(dest) {
  log('doing tracert; this is long process')
  // try {
  // } catch(e) {
  //   autoenc.detectEncoding(e.stderr).text
  // }
  const result = child_process.execSync('tracert ' + dest).toString()
    .split('\n')
    .filter(e => e.match(/^( +\d+)/g))
    .map(e => e.split(' ').slice(-2))
    .map(e => ([e[0], e[1].replace(/[[\]]/g,'')]) )
  log('tracert done')
  return result
}

function ipconfig_() {
  const nets = os.networkInterfaces()
  const result = {}

  for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
              if (!result[name]) {
                  result[name] = []
              }
              result[name].push(net)
          }
      }
  }
  return result
}

async function main() {

  const interfaces = ipconfig_()
  log(interfaces['Hamachi'], interfaces['Ethernet'])
  // log(tracert('ya.ru'))
  pause()
}


main()