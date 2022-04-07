//BUILT-IN LIBS
const fs = require('fs')
const os = require('os')
const child_process = require('child_process')
const http = require('http')

//NPM PACKAGES

//CONSTANTS
const IP_DISCOVERY_SERVICE_ADDR = 'icanhazip.com'
let   TRACERT_PROBE_ADDR = 'ya.ru'

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

function getChar() {
  //from https://stackoverflow.com/questions/20185548/how-do-i-read-a-single-character-from-stdin-synchronously
  let buffer = Buffer.alloc(1)
  fs.readSync(0, buffer, 0, 1)
  return buffer.toString('utf8')
}

// MAIN THINGS

function tracert(dest) {
  // TODO save cache to file
  log('doing traceroute; this is long process')

  let result
  try {
    result = child_process.execSync('tracert ' + dest).toString()
  } catch(e) {
    throw new Error('tracert failed\n'+JSON.stringify(e.stdout.toString()))
  }

  result = result.replace(/\r/g,'')
    .split('\n')
    .filter(e => e.match(/^( +\d+)/g))
    .map(e => e.trim().split(' ').slice(-2))
    .map(e => ({name: e[0].toLowerCase(), ip: e[1].replace(/[[\]]/g,'')}) )

  cache[tracert.name] = result
  log('traceroute done')
  return result
}

function ipconfig() {
  log('doing ipconfig')
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
  log('ipconfig done')
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

const POSSIBLE_HAMACHI_LOCATIONS = [
  'C:\\Program Files\\LogMeIn Hamachi\\x64',
  'C:\\Program Files (x86)\\LogMeIn Hamachi\\x64',
  'D:\\Program Files\\LogMeIn Hamachi\\x64',
  'D:\\Program Files (x86)\\LogMeIn Hamachi\\x64',
]

function getVPNData() {
  let res

  HAMACHI_EXEC_LOCATION = POSSIBLE_HAMACHI_LOCATIONS[1]
  try {
    res = child_process.execSync(`"${HAMACHI_EXEC_LOCATION}\\hamachi-2.exe" --cli`).toString()
  } catch(e) {
    if(e.status == 1) {
      // Hamachi returns 1 as exitcode with this command, don't ask me why
      res = e.stdout.toString()
    } else {
      throw new Error(JSON.stringify(e))
    }
  }

  res = res.replace(/\r/g, '')

  const address = res.match('address *: *([^\n]+)')[1]
    .replace(/ +/g, ' ')
    .split(' ')[0]

  const nickname = res.match('nickname *: *([^\n]+)')[1]

  return { address, nickname }
}

async function getTargetVars() {
  // this set of parameters can be used at any number of CALLER computers once obtained
  ipconfig()
  tracert(TRACERT_PROBE_ADDR)
  return {
    TARGET_LAN_IP:  cache.ipconfig[ETHERNET_ADAPTER][0].address,
    TARGET_MASK:    cache.ipconfig[ETHERNET_ADAPTER][0].netmask,
    // ip of first hop in tracert
    TARGET_ROUTER:  cache.tracert[0].ip,
    target_NAT_IP:  findNAT(cache.tracert).ip,
    target_VPN_IP:  getVPNData().nickname,
  }
}

async function createBatFilesFromTargetVars(vars) {
  //form .bat files "set" and "clear" once parameters aquired
  const ROUTE_ADDER_FILENAME = 'civ5_routes_add.bat'
  const adderText = `@echo off
rem set /p=Run on CALLER computer only. Enter to proceed.
echo route add ${vars.TARGET_LAN_IP} mask 255.255.255.0       ${vars.TARGET_VPN_IP}
echo route add ${vars.TARGET_ROUTER} mask 255.255.255.0       ${vars.TARGET_LAN_IP}
echo route add ${vars.TARGET_NAT_IP} mask ${vars.TARGET_MASK} ${vars.TARGET_ROUTER}
rem delete ${ROUTE_ADDER_FILENAME}
  `
  await fs.promises.writeFile(ROUTE_ADDER_FILENAME, adderText, { encoding:'ascii' })
  log(`writing ${ROUTE_ADDER_FILENAME} done`)
}

async function main() {
  //ping (it does ICMP) to CALLER computer to check if redoing is nessesary
  // https://stackoverflow.com/questions/4737130/how-to-ping-from-a-node-js-app

  // await getPublicIP()
  const vars = await getTargetVars()
  await createBatFilesFromTargetVars(vars)
  pause()
}

main()
.catch( e => {
  console.log('FATAL: ' + e.message)
  pause()
})