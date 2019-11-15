/*

*/

// Include dependencies.
const http = require('http')
const fs = require('fs')
const Arweave = require('arweave/node')
const argv = require('yargs').argv
const IPFS = require('ipfs')

// Set Arweave parameters from commandline or defaults.
const arweave_port = argv.arweavePort ? argv.arweavePort : 443
const arweave_host = argv.arweaveHost ? argv.arweaveHost : 'arweave.net'
const arweave_protocol = argv.arweaveProtocol ? argv.arweaveProtocol : 'https'

// Set hooverd parameters.
const port = argv.port ? argv.port : 80

if(!argv.walletFile) {
    console.log("ERROR: Please specify a wallet file to load using argument " +
        "'--wallet-file <PATH>'.")
    process.exit()
}

const raw_wallet = fs.readFileSync(argv.walletFile);
const wallet = JSON.parse(raw_wallet);


const arweave = Arweave.init({
    host: arweave_host, // Hostname or IP address for a Arweave node
    port: arweave_port,
    protocol: arweave_protocol
})

async function handleRequest(request, response) {
    // Read all of the data out of the POST body.
    var dataString = ''
	request.on('data', function (data) { 
			dataString += data 
			console.log("data:" + data) 
	})
	
	request.on('end', async function () {
		console.log("hash is :" + dataString)
		const node = await IPFS.create()
		const fileBuffer = await node.cat('QmXgZAUWd8yo4tvjBETqzUy3wLx5YRzuDwUQnBwRGrAmAo')
			
		let tx = await arweave.createTransaction({ data: fileBuffer }, wallet)
		tx.addTag("IPFS-Add", dataString)
		
		dispatchTX(tx, res)

	})
	
}

async function dispatchTX(tx, response) {
    // Manually set the transaction anchor, for now.
    const anchor_id = await arweave.api.get('/tx_anchor').then(x => x.data)
    tx.last_tx = anchor_id
    
    // Sign and dispatch the TX, forwarding the response code as our own.
    await arweave.transactions.sign(tx, wallet)
    let resp = await arweave.transactions.post(tx);
    response.statusCode = resp.status

    let output = `Transaction ${tx.get('id')} dispatched to ` +
        `${arweave_host}:${arweave_port} with response: ${resp.status}.`
    console.log(output)
    response.end(output + "\n")
}

module.exports = async function startServer() {
    console.log("Welcome to hooverd! 👋\n\nWe are...")
    
    // Print introductory information to the console.
    console.log(`...starting a server at http://localhost:${port}.`)

    const address = await arweave.wallets.jwkToAddress(wallet)
    let balance = arweave.ar.winstonToAr(await arweave.wallets.getBalance(address))
    console.log(`...using wallet ${address} (balance: ${balance} AR).`)

    let net_info = await arweave.network.getInfo()
    console.log("...dispatching transactions to Arweave host at",
        `${arweave_host}:${arweave_port},`,
        `synchronised at block ${net_info.height}.`)

    // Start the server itself.
    const server = http.createServer(handleRequest)
    server.listen(port, (err) => {
        if (err) {
            return console.log('Server experienced error:', err)
        }

        console.log("...now ready to hoover data! 🚀🚀🚀\n")
    })

}
