//BUILT-IN LIBS
const os = require('os')
const child_process = require('child_process')
const http = require('http')

//NPM PACKAGES

//CONSTANTS
const DEFAULT_ROUTER_IP = '192.168.1.1'

const HAMACHI_ADAPTER = 'Hamachi'
const ETHERNET_ADAPTER = 'Ethernet'

let HAMACHI_LOCATION = null

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

  cache[tracert.name] = result
  log('tracert done')
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
    host: 'icanhazip.com',
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
    TARGET_LAN_IP:  cache.ipconfig[ETHERNET_ADAPTER].address,
    TARGET_MASK:    cache.ipconfig[ETHERNET_ADAPTER].netmask,
    // https://www.npmjs.com/package/default-gateway
    TARGET_ROUTER:  DEFAULT_ROUTER_IP,
    target_NAT_IP:  null,
    target_VPN_IP:  null,
  }
}

async function main() {

  log(await getExternalIP())
  const interfaces = ipconfig()
  log(interfaces[HAMACHI_ADAPTER], interfaces[ETHERNET_ADAPTER])
  // log(tracert('ya.ru'))
  log(await getTargetConstants())
  pause()
}


main()