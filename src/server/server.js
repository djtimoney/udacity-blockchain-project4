import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Oracles from './oracles.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let oracles = Oracles.oracles;
let num_oracles = Oracles.num_oracles;


// Register oracles
for (var i = 0 ; i < num_oracles ; i++) {
  flightSuretyApp.methods
  .registerOracle()
  .send({
     from: oracles[i].account,
     value: web3.utils.toWei('1', 'ether'),
     gas: 4712388,             
     gasPrice: 100000000000 
    },
   (error, result) => {

   })
}


flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, function (error, event) {
  if (error)
  {
    console.log("Error:");
    console.log(error);
  } 
  console.log("Event:");
  console.log(event);

  console.log("Airline: " +event.returnValues.airline);

  let index = event.returnValues.index;
  let airline = event.returnValues.airline;
  let flight = event.returnValues.flight;
  let timestamp = event.returnValues.timestamp;

  for (var j = 0 ; j < num_oracles ; j++) {
    if (!oracles[j].indexes) {
      // Get indexes
    }

    // Check 
  }
});




const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


