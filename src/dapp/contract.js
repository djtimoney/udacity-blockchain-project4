import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import Flights from './flights.json';

export default class Contract {
    constructor(network, flightStatusCallback, callback) {

        let config = Config[network];
        // this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.web3 = new Web3(config.url);
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback, flightStatusCallback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = Flights.flights;
        this.num_registered = 0;
        this.flight_labels = [];
        this.flightStatusCallback = flightStatusCallback;

  
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

            // Populate dynamic flight info:
            //  * timestamp, relative to current time
            //  * airline account
            //  * index within array
            //  * insured flag, indicating whether insurance has been purchased


            console.log("Initializing flight info");
            console.log("Account owner is :"+this.owner);

            for (var i = 0 ; i < this.flights.length ; i++) {
                let flight_time = new Date();
                flight_time.setSeconds(flight_time.getSeconds() + this.flights[i].seconds_offset);
                flight_time.setDate(flight_time.getDate() + this.flights[i].days_offset);
                this.flights[i].timestamp = Math.floor(flight_time.getTime() / 1000);
                this.flights[i].index = i;
                this.flights[i].insured = false;
                this.flights[i].airline = this.airlines[this.flights[i].airline_index];
            }

            // Start listener for airline registration events
            console.log("Starting airline registration listener");
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

    // Get list of flights
    getFlights() {
        let retval = this.flights;
        return retval;
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, timestamp, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }


    async listenForAirlineRegistrations() {
        // Listen for airline registrations
        let self = this;
        self.flightSuretyApp.events.AirlineRegistered({
            fromBlock: 0
            }, function (error, result) {

                if (result) {
                    // If airline is approved, send ante
                    if (result.returnValues.approved) {
                         self.num_registered += 1;
                         self.web3.eth.sendTransaction(
                            {from: result.returnValues.airline,
                             value: self.web3.utils.toWei('10', 'ether')}
                         );
                    }   
                } else {
                    console.log("Got AirlineRegistered event with null result!");
                }


                
                // If all airlines are registered, register flights
                if (self.num_registered == self.airlines.length) {
                    registerFlights();

                }
            });
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

    async registerAirlines() {
        let self = this;

        for (var i = 1 ; i < self.airlines.length ; i++) {
            console.log("Registering airline["+i+"]:"+JSON.stringify(self.airlines[i]));
            console.log("Sending from: "+self.airlines[0]);
            
            // Register airline
            self.flightSuretyApp.methods
                .registerAirline(self.airlines[i])
                .send({from: self.airlines[0]}, (error, result) => {
                    console.log("Result: " +result);
                });

        }

    }

    async registerFlights() {
        var curtime = new Date();
        for (var i = 0 ; i < this.flights.length ; i++) {

            this.flightSuretyApp.methods
            .registerFlight(this.flights[i].flight, this.flights[i].timestamp)
            .send({from: this.flights[i].airline}, (error, result) => {
                console.log("Result: " +result);
            });
        }
    }


}
