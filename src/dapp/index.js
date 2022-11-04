
import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {

    let result = null;

    let contract = new Contract('localhost', displayFlightStatus,  () => {

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error,result);
            display("top-display-wrapper", 'Operational Status', 'Check if contract is operational', [ { label: 'Operational Status', error: error, value: result} ]);
        }, displayFlightStatus);
    

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let flight = DOM.getSelectedValue('flight-number');
            let flight_time = new Date();
            flight_time.setTime(flight.timestamp * 1000);
            console.log("Fetch flight status for flight : "+flight.flight + ","+flight_time.toString());
            // Write transaction
            contract.fetchFlightStatus(flight.flight, flight.timestamp, (error, result) => {
                let result_time = new Date();
                result_time.setTime(result.timestamp * 1000);
                display("display-wrapper", 'Oracles', 'Trigger oracles', [ { label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result_time} ]);
            });
        });

        // Populate flight numbers
        let flights = contract.getFlights();
        for (var i = 0 ; i < flights.length ; i++) {
            let flight_time = new Date();
            flight_time.setTime(flights[i].timestamp * 1000);
            let label = flights[i].flight + " "+flight_time.toString();
            let value = {};
            value.flight = flights[i].flight;
            value.timestamp = flights[i].timestamp;

            DOM.addOption('flight-number', label, value);
            DOM.addOption('insure-flight-number', label, value);
        }
    
    });
    

})();

function displayFlightStatus(error, result) {
    display("display-wrapper", 'Oracles', 
    'Trigger oracles', 
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







