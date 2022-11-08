//BUILT-IN LIBS
const fs = require('fs')
const os = require('os')
const child_process = require('child_process')
const http = require('http')

//NPM PACKAGES

//CONSTANTS
const TEST_MOCK = false

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

function pause(prompt = '\n\x1b[46mPress any key\x1b[0m') {
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

const funcStatus = {
  str: null,
  doing(str) {
    this.str = str
    process.stdout.write('\x1b[43mdoing\x1b[0m ' + str)
  },
  done() {
    process.stdout.write(`\r\x1b[42mdone\x1b[0m  ${this.str}\n`)
  }
}

// MAIN THINGS

function tracert(dest) {
  // TODO save cache to file
  funcStatus.doing('traceroute (this will take a while)')

  let result
  
  if(!TEST_MOCK) {
    try {
      result = child_process.execSync('tracert ' + dest).toString()
    } catch(e) {
      throw new Error('tracert failed\n'+JSON.stringify(e.stdout.toString()))
    }
  } else {
    result = `  1    <1 мс    <1 мс    <1 мс  192.168.1.1
    2     1 ms    <1 мс     1 ms  10.82.96.5
    3     2 ms     2 ms     1 ms  v235.3550.gra128-2.at-home.ru [212.232.64.22]
    4     1 ms     1 ms     1 ms  v230.460.kir2.at-home.ru [212.232.64.17]
    5     1 ms    16 ms    22 ms  v257.670.pis25.at-home.ru [212.232.66.65]
    6     1 ms     1 ms     1 ms  v1783.7280-2.bm18.at-home.ru [212.232.64.10]
    7     1 ms     1 ms     1 ms  v416.7150-1.cv19.at-home.ru [212.232.64.162]
    8     1 ms     1 ms     1 ms  v304.670.cv19.at-home.ru [212.232.64.85]
    9     1 ms     1 ms     1 ms  v382.670-2.cv19.at-home.ru [212.232.66.214]
   10     1 ms     1 ms     1 ms  v181.nat7.cv19.at-home.ru [188.65.69.72]`
  }

  result = result.replace(/\r/g,'')
    .split('\n')
    .filter(e => e.match(/^( +\d+)/g))
    .map(e => e.trim().split(' ').slice(-2))
    .map(e => ({name: e[0].toLowerCase(), ip: e[1].replace(/[[\]]/g,'')}) )

  cache[tracert.name] = result
  funcStatus.done()
  return result
}

function ipconfig() {
  funcStatus.doing('ipconfig')
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
  funcStatus.done()
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
  funcStatus.doing('parcing tracert for NAT')
  let result = tracert_array.filter( e => e.name.includes('.nat'))
  if(result.length == 0) result = null
  if(result.length == 1) result = result[0]
  if(result.length > 1) throw new Error('more than one possible NAT detected')
  funcStatus.done()
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
  funcStatus.doing('getting VPN IP from Hamachi')
  // FIXME this is NOT usual hamachi installation way!
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

  funcStatus.done()
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
    TARGET_NAT_IP:  findNAT(cache.tracert).ip,
    CALLER_VPN_IP:  getVPNData().address,
  }
}

const OUT_DIR = 'out'
async function createOutDir() {
  funcStatus.doing(`creating "/${OUT_DIR}" directory`)
  const exists = await fs.promises.access(OUT_DIR)
    .then(_ => true)
    .catch(_ => false)
  if(!exists) await fs.promises.mkdir().catch(e => {
    throw e
  })
  funcStatus.done()
}

async function createBatFilesFromTargetVars(vars) {

  await createOutDir()

  funcStatus.doing('creating .bat files')
  // FIXME tracert for TARGET_NAT_IP should be ran on CALLER computer!

  //form .bat files "set" and "clear" once parameters aquired
  //it works without PC reset
  const BAT_MAIN_FILENAME = e => `${OUT_DIR}/civ5_routes_${e}.bat`
  
  const ROUTE_ADDER_FILENAME = BAT_MAIN_FILENAME('add')
  const adderText = `@echo off
route add ${vars.TARGET_LAN_IP.padEnd(14, ' ')} mask 255.255.255.0 ${vars.CALLER_VPN_IP}
route add ${vars.TARGET_ROUTER.padEnd(14, ' ')} mask 255.255.255.0 ${vars.TARGET_LAN_IP}
route add ${vars.TARGET_NAT_IP.padEnd(14, ' ')} mask ${vars.TARGET_MASK} ${vars.TARGET_ROUTER}
pause
`

  const ROUTE_DELETER_FILENAME = BAT_MAIN_FILENAME('delete')
  const deleterText = `@echo off
route add ${vars.TARGET_LAN_IP.padEnd(14, ' ')}
route add ${vars.TARGET_ROUTER.padEnd(14, ' ')}
route add ${vars.TARGET_NAT_IP.padEnd(14, ' ')}
pause
`

  Promise.all([
    fs.promises.writeFile(ROUTE_ADDER_FILENAME, adderText, { encoding:'ascii' }),
    fs.promises.writeFile(ROUTE_DELETER_FILENAME, deleterText, { encoding:'ascii' }),
  ])
  funcStatus.done()
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
  log(e.stack)
  console.log('\x1b[41mFATAL:\x1b[0m ' + e.message)
  pause()
})