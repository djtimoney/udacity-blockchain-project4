import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Oracles from './oracles.json';
import FlightInfo from './flightinfo.json';
import Web3 from 'web3';
import express from 'express';
import cors from 'cors';



let config = Config['localhost'];
// let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let web3 = new Web3(config.url);
// web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress); 
let oracles = Oracles.oracles;
let num_oracles = Oracles.num_oracles;
let flightinfo = FlightInfo.flightinfo;
let flightsByAirline = [];
let registered_flights = [];
let num_registered = 0;



// Start listeners
listenForPendingAirlineRegistrations();
listenForAirlineRegistrations();
listenForOracleRequests();
listenForPayableFlightDelayed();
listenForPolicyPurchased();
listenForFlightKeyGenerated();
listenForPayouts();


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

    let curtime = new Date();
    let curTimestamp = curtime.getTime() / 1000;

    for (var j = 0; j < num_oracles; j++) {
      if (oracles[j].indexes) {
        if (oracles[j].indexes.includes(index)) {

          let flightStatus = 10;

          if (curTimestamp > timestamp) {
            flightStatus = oracles[j].return_status;
          }

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

// Listen for airline registrations
async function listenForPendingAirlineRegistrations() {
  console.log("Listening for AirlineRegistrationPending events");

  flightSuretyApp.events.AirlineRegistrationPending({
     fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error:");
      console.log(error);
    }
    if (event) {
      // If airline is approved, send ante
      console.log("Got an AirlineRegistrationPending event");
      console.log(event);
      if (event.returnValues.approved) {
        console.log("Sending ante for airline " + event.returnValues.airline);
        let airline = event.returnValues.airline;

        web3.eth.sendTransaction(
          {
            from: event.returnValues.airline,
            to: config.appAddress,
            value: web3.utils.toWei('10', 'ether')
          }, (error, result) => {
            if (error) {
              console.log("Error sending ante : " + error);
            }

          }
        );
      }
    } else {
      console.log("Got AirlineRegistered event with null result!");
    }
  });
}

async function listenForAirlineRegistrations() {
  console.log("Listening for AirlineRegistered events");

  flightSuretyApp.events.AirlineRegistered({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error on AirlineRegistered :" + error);
    }

    console.log("Got an AirlineRegistered event");
    console.log(event);

    let airline = event.returnValues.airline;
    let canParticipate = event.returnValues.canParticipate;


    if (canParticipate && flightsByAirline[airline]) {
      for (var j = 0; j < flightsByAirline[airline].length; j++) {
        let registered_flight = {};
        let flight_time = new Date();
        flight_time.setSeconds(flight_time.getSeconds() + flightsByAirline[airline][j].seconds_offset);
        flight_time.setDate(flight_time.getDate() + flightsByAirline[airline][j].days_offset);
        let timestamp = Math.floor(flight_time.getTime() / 1000);

        registered_flight.airline = airline;
        registered_flight.flight = flightsByAirline[airline][j].flight;
        registered_flight.timestamp = timestamp;
        registered_flights.push(registered_flight);

        console.log("Registering flight "+flightsByAirline[airline][j].flight+" at timestamp "+timestamp);
        flightSuretyApp.methods
          .registerFlight(flightsByAirline[airline][j].flight, timestamp)
          .send({
            from: airline,
            gas: 4712388,
            gasPrice: 100000000000
          })
      }
    }
  });
}

async function listenForPayouts() {
  console.log("Listening for PolicyPaidOut events");

  flightSuretyData.events.PolicyPaidOut({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error on PolicyPaidOut :" + error);
    }

    console.log("Got a PolicyPaidOut event");
    console.log(event);
  });
}

async function listenForPolicyPurchased() {
  console.log("Listening for PolicyPurchased events");

  flightSuretyData.events.PolicyPurchased({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error on PolicyPurchased :" + error);
    }

    console.log("Got a PolicyPurchased event");
    console.log(event);
  });
}

async function listenForPayableFlightDelayed() {
  console.log("Listening for PayableFlightDelayed events");

  flightSuretyData.events.PayableFlightDelayed({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error on PayableFlightDelayed :" + error);
    }

    console.log("Got a PayableFlightDelayed event");
    console.log(event);
  });
}

async function listenForFlightKeyGenerated() {
  console.log("Listening for FlightKeyGenerated events");

  flightSuretyData.events.FlightKeyGenerated({
    fromBlock: 0
  }, function (error, event) {
    if (error) {
      console.log("Error on FlightKeyGenerated :" + error);
    }

    console.log("Got a FlightKeyGenerated event");
    console.log(event);
  });
}


// Web Services
const app = express();
app.use(express.json());
app.use(cors({
  origin: '*'
}));

// REST interface : get flights
app.get('/getFlights', (req, res) => {
  
  res.send({
    "flights": registered_flights
  })

});

// REST interface : register airline
app.post('/registerAirline', (req, res) => {
  let registrar = req.body.registrar;
  let airline = req.body.airline;
  console.log("Got an airline reservation request : " + JSON.stringify(req.body, null, 4));
  let index = num_registered;
  num_registered += 1;
  if (!flightsByAirline[airline]) {
    if (flightinfo[index]) {
      console.log("Assigning flight info for "+flightinfo[index].airline_name+" to airline "+airline);
      flightsByAirline[airline] = flightinfo[index].flights;
    }
  } 



  try {
    flightSuretyApp.methods
      .registerAirline(airline)
      .send({
        from: registrar,
        gas: 4712388,
        gasPrice: 100000000000
      }, (error, result) => {
        if (error) {
          console.log("Registration error: " + error);
        }
      });
  } catch (ex) {
    console.log("Caught exception on registration:" + ex);
  }

  res.send({
    message: "Registration sent for airline " + airline
  })
});




export default app;


