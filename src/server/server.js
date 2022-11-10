import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Oracles from './oracles.json';
import Web3 from 'web3';
import express from 'express';
import cors from 'cors';



let config = Config['localhost'];
// let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let web3 = new Web3(config.url);
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let oracles = Oracles.oracles;
let num_oracles = Oracles.num_oracles;
let num_registered = 0;



// Start listener
listenForOracleRequests();

// Set up data
registerOracles();


// Get my indexes
async function getIndexes() {

  for (var i = 0 ; i < num_oracles ; i++) {
    oracles[i].indexes = await flightSuretyApp.methods
          .getMyIndexes()
          .call({
            from: oracles[i].account,
            gas: 4712388,
            gasPrice: 100000000000
          }, (error, result) => {
            if (error) {
              console.log("Error getting indexes: "+error);
            }
          });
  }
}


// Register oracles
async function registerOracles() {
  var numRegistered = 0;
  for (var i = 0; i < num_oracles; i++) {

    flightSuretyApp.methods
      .registerOracle()
      .send({
        from: oracles[i].account,
        value: web3.utils.toWei('1', 'ether'),
        gas: 4712388,
        gasPrice: 100000000000
      },
        (error, result) => {
          // Once all registrations are sent, get indexes
          numRegistered += 1;
          if (numRegistered == num_oracles) {
            getIndexes();
          }

        });
  }
}




// Listen for Oracle Requests
async function listenForOracleRequests() {
  console.log("Listening for OracleRequest");

  flightSuretyApp.events.OracleRequest({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error:");
      console.log(error);
    }
    // console.log("Event:");
    // console.log(event);


    let index = event.returnValues.index;
    let airline = event.returnValues.airline;
    let flight = event.returnValues.flight;
    let timestamp = event.returnValues.timestamp;

    console.log("Got an Oracle request");
    console.log("index: " + index);
    console.log("airline:" + airline);
    console.log("flight:" + flight);
    console.log("timestamp:" + timestamp);

    let flightStatuses = [0, 10, 20, 30, 40, 50];

    for (var j = 0; j < num_oracles; j++) {
      if (oracles[j].indexes) {
        if (oracles[j].indexes.includes(index)) {

          // Rubric says to return random status.  Use
          // current time in milliseconds.
          let curtime = new Date();
          let curTimestamp = curtime.getTime();
          let outcomeIndex = curTimestamp % 6;

          let flightStatus = flightStatuses[outcomeIndex];

          console.log("Oracle["+j+"] flight status is "+flightStatus);

          flightSuretyApp.methods
            .submitOracleResponse(
              index,
              airline,
              flight,
              timestamp,
              flightStatus)
            .send(
              {
                from: oracles[j].account,
                gas: 4712388,
                gasPrice: 100000000000
              }
            )
        }
      } else {
        console.log("Oracle[" + j + "]: I have no indexes!");
      }

    }
  });
}

// Web Services
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*'
}));

// REST interface : get flights
app.get('/api', (req, res) => {
  
  res.send({
    "message": "hello"
  })

});





export default app;


