import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.initialize(callback);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = [];
        this.codes = ['AA', 'DL', 'JB', 'SP', 'UA'];
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

            this.listenToAirlineRegistrations();

            

            callback();
        });
    }

    async listenToAirlineRegistrations() {
        // Listen for airline registrations
        let self = this;
        self.flightSuretyApp.events.AirlineRegistered({
            fromBlock: 0
            }, function (error, result) {
                // If airline is approved, send ante
                if (result.returnValues.approved) {
                    self.web3.eth.sendTransaction(
                        {from: result.returnValues.airline,
                         value: self.web3.utils.toWei('10', 'ether')}
                    );
                }       
            });
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

    registerAirlines(callback) {
        let self = this;

        for (var i = 1 ; i < 5 ; i++) {
            var airline = self.airlines[i];
            // Register airline
            self.flightSuretyApp.methods
                .registerAirline(self.airlines[i])
                .send({from: self.airlines[0]}, (error, result) => {
                    callback(error,airline);
                });

        }



    }

}
