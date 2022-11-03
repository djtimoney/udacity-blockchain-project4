import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import Flights from './flights.json';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = Flights.flights;
        this.num_registered = 0;
        this.flight_labels = [];

  
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

            const curtime = new Date();
            console.log("Initializing flight info");
            for (var i = 0 ; i < this.flights.length ; i++) {
                const flight_time = curtime;
                flight_time.setSeconds(flight_time.getSeconds() + this.flights[i].seconds_offset);
                flight_time.setDate(flight_time.getDate() + this.flights[i].days_offset);
                this.flights[i].timestamp = flight_time.getMilliseconds();
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

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
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

                // If airline is approved, send ante
                if (result.returnValues.approved) {
                    this.num_registered += 1;
                    self.web3.eth.sendTransaction(
                        {from: result.returnValues.airline,
                         value: self.web3.utils.toWei('10', 'ether')}
                    );
                }   
                
                // If all airlines are registered, register flights
                if (this.num_registered == this.airlines.length) {
                    registerFlights();

                }
            });
    }

    async registerAirlines(callback) {
        let self = this;

        for (var i = 1 ; i < 5 ; i++) {
            var airline = self.airlines[i];
            // Register airline
            self.flightSuretyApp.methods
                .registerAirline(self.airlines[i])
                .send({from: self.airlines[0]});

        }

    }

    async registerFlights() {
        var curtime = new Date();
        for (var i = 0 ; i < this.flights.length ; i++) {

            this.flightSuretyApp.methods
            .registerFlight(this.flights[i].flight, this.flights[i].timestamp)
            .send({from: this.flights[i].airline});
        }
    }


}
