
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', displayFlightStatus, populateFlightInfo, () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            DOM.setLabel("oper-status", result);
            display("display-wrapper", 'Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        }, displayFlightStatus);
    

        // User-submitted transaction
        DOM.elid('toggle-oper-status').addEventListener('click', () => {
            let operStatus = DOM.getLabel('oper-status');
            let toggleStatus = true;
            if (operStatus == 'true') {
                toggleStatus = false;
            }
            contract.toggleOperStatus(operStatus, (error, result) => {
                DOM.setLabel("oper-status", result);
                display("display-wrapper", 'Operational Status', 'Toggle operational status', [ { label: 'Operational Status', error: error, value: result} ]);

            });
        });

        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.getSelectedValue('flight-dropdown');
            let flight_time = new Date();
            flight_time.setTime(flight.timestamp * 1000);
            console.log("Fetch flight status for flight : "+flight.flight + ","+flight_time.toString());
            // Write transaction
            contract.fetchFlightStatus(flight.airline, flight.flight, flight.timestamp, (error, result) => {
                let result_time = new Date();
                result_time.setTime(result.timestamp * 1000);
                let result_timestr = result_time.toLocaleString('en-US');
                display("display-wrapper", 'Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result_timestr} ]);
            });
        });

        DOM.elid('buy-insurance').addEventListener('click', () => {
            let flight = DOM.getSelectedValue('flight-dropdown');

            let passenger = DOM.getSelectedValue('passenger-dropdown');
            contract.buyInsurance(flight.airline, flight.flight, flight.timestamp, passenger, (error, result) => {
                let result_time = new Date();
                result_time.setTime(result.timestamp * 1000);
                let result_timestr = result_time.toLocaleString('en-US');
                display("display-wrapper", 'Insurance', 'Buy insurance', [ { label: 'Buy FlightSurety Insurance', error: error, value: result.flight + ' ' + result_timestr + ' for passenger '+result.passenger} ]);
            
            })

        });

        DOM.elid('collect-payout').addEventListener('click', () => {

            let passenger = DOM.getSelectedValue('passenger-dropdown');
            contract.collectPayout(passenger, (error, result) => {
                let result_time = new Date();
                result_time.setTime(result.timestamp * 1000);
                let result_timestr = result_time.toLocaleString('en-US');
                display("display-wrapper", 'Insurance', 'Collect payout', [ { label: 'Collect payout from FlightSurety Insurance', error: error, value: 'Passenger '+result.passenger} ]);
            
            })

        });

        // Populate flight numbers
        // contract.fetchFlightList(populateFlightInfo);
  
        // Populate passenger list
        let passengers = contract.getPassengers();
        for (var i = 0 ; i < passengers.length ; i++) {
            DOM.addOption('passenger-dropdown', 'Passenger '+(i+1), passengers[i]);
        }
    
    });
    

})();

function populateFlightInfo(flight) {

    console.log("Populating flight info: " +flight);
 

        let flight_time = new Date();
        flight_time.setTime(flight.timestamp * 1000);
        let label = flight.flight + " ["+flight_time.toLocaleString('en-US')+"]";
        let value = {};
        value.airline = flight.airline;
        value.flight = flight.flight;
        value.timestamp = flight.timestamp;

        DOM.addOption('flight-dropdown', label, value);
}

function displayFlightStatus(error, result) {
    display("display-wrapper", 'Oracles', 
    'Response from oracles', 
    [ { label: 'Flight Status',
        error: error,
         value: result.flight + ' ' + result.timestamp + ' : ' + result.statusCode
        } ]);
};

function display(elementname, title, description, results) {
    if (!elementname) {
        elementname="display-wrapper";
    }
    let displayDiv = DOM.elid(elementname);
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className:'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);

};







