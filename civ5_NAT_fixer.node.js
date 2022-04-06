//BUILT-IN LIBS
const os = require('os')
const child_process = require('child_process')
const http = require('http')

//NPM PACKAGES

//CONSTANTS
const IP_DISCOVERY_SERVICE_ADDR = 'icanhazip.com'

const HAMACHI_ADAPTER = 'Hamachi'
const ETHERNET_ADAPTER = 'Ethernet'

let HAMACHI_EXEC_LOCATION = null

const cache = {
  tracert: null,
  ipconfig: null,
}

// MISC
const log = console.log

function pause(prompt = 'Press any key...') {
  log(prompt)
  process.stdin.setRawMode( true )
  process.stdin.resume()
  process.stdin.on( 'data', () => process.stdin.pause())
}

// MAIN THINGS

function tracert(dest) {
  log('doing traceroute; this is long process')
  // try {
  // } catch(e) {
  //   autoenc.detectEncoding(e.stderr).text
  // }
  const result = child_process.execSync('tracert ' + dest).toString()
    .replace(/\r/g,'')
    .split('\n')
    .filter(e => e.match(/^( +\d+)/g))
    .map(e => e.trim().split(' ').slice(-2))
    .map(e => ({name: e[0], ip: e[1].replace(/[[\]]/g,'')}) )

  cache[tracert.name] = result
  log('traceroute done')
  return result
}

function ipconfig() {
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

  cache[ipconfig.name] = result
  return result
}

function getExternalIP() {
  // from https://github.com/sindresorhus/public-ip
  const options = {
    host: IP_DISCOVERY_SERVICE_ADDR,
    port: 80,
    path: '/'
  }

  return new Promise( (resolve, reject) => {
    http.get(options, function(res) {
      if(res.statusCode != 200) reject({status: res.statusCode})
      res.on("data", chunk => resolve(chunk.toString()))
    }).on('error', e => reject(e))
  })
}

async function getTargetConstants() {
  return {
    TARGET_LAN_IP:  cache.ipconfig[ETHERNET_ADAPTER][0].address,
    TARGET_MASK:    cache.ipconfig[ETHERNET_ADAPTER][0].netmask,
    // ip of first hop in tracert
    TARGET_ROUTER:  cache.tracert[0].ip,
    target_NAT_IP:  null,
    target_VPN_IP:  null,
  }
}

async function main() {
  //ping (it does ICMP) to CALLER computer to check if redoing is nessesary
  // https://stackoverflow.com/questions/4737130/how-to-ping-from-a-node-js-app

  // https://stackoverflow.com/questions/20185548/how-do-i-read-a-single-character-from-stdin-synchronously

  await getExternalIP()
  const interfaces = ipconfig()
  // log(interfaces[HAMACHI_ADAPTER], interfaces[ETHERNET_ADAPTER])
  // at-home
  log(tracert('at-home.ru'))
  log(await getTargetConstants())
  pause()
}


main()