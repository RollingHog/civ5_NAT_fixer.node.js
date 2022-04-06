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
  // TODO save cache to file
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
    .map(e => ({name: e[0].toLowerCase(), ip: e[1].replace(/[[\]]/g,'')}) )

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

function getPublicIP() {
  // from https://github.com/sindresorhus/public-ip

  log('getting public IP')
  const options = {
    host: IP_DISCOVERY_SERVICE_ADDR,
    port: 80,
    path: '/'
  }

  return new Promise( (resolve, reject) => {
    http.get(options, function(res) {
      if(res.statusCode != 200) reject({status: res.statusCode})
      res.on("data", chunk => {
        log('getting public IP done')
        resolve(chunk.toString())
      })
    }).on('error', e => reject('cannot get public IP of current computer: ' + e))
  })
}

function findNAT(tracert_array) {
  let result = tracert_array.filter( e => e.name.includes('.nat'))
  if(result.length == 0) result = null
  if(result.length == 1) result = result[0]
  if(result.length > 1) throw new Error('more than one possible NAT detected')
  return result
}

async function getTargetConstants() {
  // this set of parameters can be used at any number of CALLER computers once obtained
  return {
    TARGET_LAN_IP:  cache.ipconfig[ETHERNET_ADAPTER][0].address,
    TARGET_MASK:    cache.ipconfig[ETHERNET_ADAPTER][0].netmask,
    // ip of first hop in tracert
    TARGET_ROUTER:  cache.tracert[0].ip,
    target_NAT_IP:  findNAT(cache.tracert).ip,
    target_VPN_IP:  null,
  }
}

async function main() {
  //ping (it does ICMP) to CALLER computer to check if redoing is nessesary
  // https://stackoverflow.com/questions/4737130/how-to-ping-from-a-node-js-app

  // https://stackoverflow.com/questions/20185548/how-do-i-read-a-single-character-from-stdin-synchronously

  await getPublicIP()
  const interfaces = ipconfig()
  // log(interfaces[HAMACHI_ADAPTER], interfaces[ETHERNET_ADAPTER])
  // at-home
  tracert('at-home.ru')
  log(await getTargetConstants())
  //form .bat files "set" and "clear" once parameters aquired
  pause()
}

main()
.catch( e => {
  console.log('FATAL ERROR: ' + e.message)
})