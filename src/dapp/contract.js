import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import FlightInfo from './flightinfo.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, flightStatusCallback, flightInfoCallback, callback) {

        let config = Config[network];
        this.flightinfo = FlightInfo.flightinfo;
        // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.appAddress = config.appAddress;
        this.web3 = new Web3(config.url);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback, flightStatusCallback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.num_registered = 0;
        this.flightsByAirline = [];

        this.flight_labels = [];
        this.flightStatusCallback = flightStatusCallback;
        this.flightInfoCallback = flightInfoCallback;

  
    }

    initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];

            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            // Start listener for flight registration events
            console.log("Starting listener for pending airline registrations");
            this.listenForPendingAirlineRegistrations();

            console.log("Starting listener for approved airline registrations");
            this.listenForAirlineRegistrations();

            // Register airlines
            console.log("Registering airlines");
            this.registerAirlines();

            // Start listener for flight status events
            console.log("Starting flight status listener");
            this.listenForFlightStatus();

            console.log("Initialization complete");
            callback();
        });
    }

    getPassengers() {
        return this.passengers;
    }


    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    toggleOperStatus(operStatus, callback) {
        let self = this;
        let toggledStatus = true;
        if (operStatus == "true") {
            toggledStatus = false;
        }
        self.flightSuretyApp.methods
             .setOperatingStatus(toggledStatus)
             .send({from: self.owner}, (error, result) => {
                if (error) {
                    console.log("Error setting operating status: "+error);
                }
                this.isOperational(callback);
             });
    }

    fetchFlightStatus(airline, flight, timestamp, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flight,
            timestamp: timestamp
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    buyInsurance(airline, flight, timestamp, passenger, callback) {
        let self = this;
        let payload = {
            airline: airline,
            flight: flight,
            timestamp: timestamp,
            passenger: passenger
        }
        self.flightSuretyApp.methods
            .buy(airline, flight, timestamp)
            .send({ 
                from: passenger,
                value: this.web3.utils.toWei('1', 'ether'),
                gas: 4712388,
                gasPrice: 100000000000
            }, (error, result) => {
                callback(error, payload)
            });
    }

    collectPayout(passenger, callback) {
        let self = this;
        let payload = {
            passenger: passenger
        }
        self.flightSuretyApp.methods
            .pay()
            .send({ 
                from: passenger,
                gas: 4712388,
                gasPrice: 100000000000
            }, (error, result) => {
                callback(error, payload)
            });
    }


    fetchFlightList(callback) {
        let self = this;
        fetch("http://localhost:3000/getFlights/")
        .then(response => response.json())
        .then(data => callback(data.flights));
    }



    async listenForFlightStatus() {
        // Listen for flight status

        console.log("Listening for FlightStatus events");
        let self = this;
        self.flightSuretyApp.events.FlightStatusInfo({
            fromBlock: 0
            }, function (error, result) {

                if (error) {
                    console.log("Error from flight status event: " +error);
                }

                let info = {};
                if (result) {
                    console.log("Got FlightStatusInfo event: " +JSON.stringify(result, null, 4));

                    let flight_time = new Date();
                    flight_time.setTime(result.returnValues.timestamp * 1000);
                    info.airline = result.returnValues.airline;
                    info.flight = result.returnValues.flight;
                    info.timestamp = flight_time;
                    switch (result.returnValues.status) {
                        case "10":
                            info.statusCode = "ON TIME";
                            break;
                        case "20":
                            info.statusCode = "LATE (AIRLINE)";
                            break;
                        case "30":
                            info.statusCode = "LATE (WEATHER)";
                            break;
                        case "40":
                            info.statusCode = "LATE (TECHNICAL)";
                            break;
                        case "50":
                            info.statusCode = "LATE (OTHER)";
                            break;
                        default:
                            info.statusCode = "UNKNOWN ("+result.returnValues.status+")";
                            break;
                    }

                } else {
                    console.log("Got FlightStatusInfo event with no result!");
                }

                self.flightStatusCallback(error, info);
            });
    }

    async listenForPendingAirlineRegistrations() {
        let self = this;

        console.log("Listening for AirlineRegistrationPending events");

        self.flightSuretyApp.events.AirlineRegistrationPending({
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
      
              self.web3.eth.sendTransaction(
                {
                  from: event.returnValues.airline,
                  to: self.appAddress,
                  value: self.web3.utils.toWei('10', 'ether')
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

    async listenForAirlineRegistrations() {
        let self = this;

        console.log("Listening for AirlineRegistered events");

        self.flightSuretyApp.events.AirlineRegistered({
          fromBlock: 0
        }, function (error, event) {
          if (error) {
            console.log("Error on AirlineRegistered :" + error);
          }
      
          console.log("Got an AirlineRegistered event");
          console.log(event);
      
          let airline = event.returnValues.airline;
          let canParticipate = event.returnValues.canParticipate;
      
      
          if (canParticipate && self.flightsByAirline[airline]) {
            for (var j = 0; j < self.flightsByAirline[airline].length; j++) {
              let registered_flight = {};
              let flight_time = new Date();
              flight_time.setSeconds(flight_time.getSeconds() + self.flightsByAirline[airline][j].seconds_offset);
              flight_time.setDate(flight_time.getDate() + self.flightsByAirline[airline][j].days_offset);
              let timestamp = Math.floor(flight_time.getTime() / 1000);
      
              registered_flight.airline = airline;
              registered_flight.flight = self.flightsByAirline[airline][j].flight;
              registered_flight.timestamp = timestamp;
              self.flightInfoCallback(registered_flight);
      
              console.log("Registering flight "+self.flightsByAirline[airline][j].flight+" at timestamp "+timestamp);
              self.flightSuretyApp.methods
                .registerFlight(self.flightsByAirline[airline][j].flight, timestamp)
                .send({
                  from: airline,
                  gas: 4712388,
                  gasPrice: 100000000000
                })
            }
          }
        });
    }

    async registerAirlines() {
        let self = this;

        let registrar = self.airlines[0];
        for (var i = 1 ; i < self.airlines.length ; i++) {
            let airline = self.airlines[i];
            console.log("Registering airline["+i+"]:"+JSON.stringify(airline));
            console.log("Sending from: "+registrar);

            let index = self.num_registered;
            self.num_registered += 1;
            if (!self.flightsByAirline[airline]) {
              if (self.flightinfo[index]) {
                console.log("Assigning flight info for "+self.flightinfo[index].airline_name+" to airline "+airline);
                self.flightsByAirline[airline] = self.flightinfo[index].flights;
              }
            } 
          

            try {
                self.flightSuretyApp.methods
                  .registerAirline(self.airlines[i])
                  .send({
                    from: self.airlines[0],
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
            
            // Register airline
            // let req = {}
            // req.registrar = self.airlines[0];
            // req.airline = self.airlines[i];
            // const resp = await fetch("http://localhost:3000/registerAirline/", {
            //     method: "POST",
            //     body : JSON.stringify(req),
            //     headers : {
            //         'Content-Type': 'application/json'
            //     }

            // });

            // const respJson = await resp.json();

            // console.log("Registration response: "+JSON.stringify(respJson));

        }

    }


}
