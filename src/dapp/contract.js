import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

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

    async registerAirlines() {
        let self = this;

        for (var i = 1 ; i < self.airlines.length ; i++) {
            console.log("Registering airline["+i+"]:"+JSON.stringify(self.airlines[i]));
            console.log("Sending from: "+self.airlines[0]);
            
            // Register airline
            let req = {}
            req.registrar = self.airlines[0];
            req.airline = self.airlines[i];
            const resp = await fetch("http://localhost:3000/registerAirline/", {
                method: "POST",
                body : JSON.stringify(req),
                headers : {
                    'Content-Type': 'application/json'
                }

            });

            const respJson = await resp.json();

            console.log("Registration response: "+JSON.stringify(respJson));

        }

    }


}
