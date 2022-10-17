pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    mapping(address => bool) private authorizedContracts;

    struct Airline {
        address airlineAddress;
        uint256 numVotes;
        mapping(address => bool) voters;
        bool approved;
        bool canParticipate;
        uint256 funding;
    }


    mapping(address => Airline) private airlines;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;        
        address airline;
    }
    mapping(bytes32 => Flight) private flights;

    bytes32[] flightKeys;

    struct Policy {
        address insuree;
        uint256 price;
    }

    // Map registered flight keys to true
    mapping(bytes32 => bool) private registeredFlights;

    // Map flight key -> list of policies for this flight
    mapping(bytes32 => Policy[]) private policies;

    // Map passenger address -> unclaimed payout balance
    mapping(address => uint256) private payouts;

    uint256 numAirlines = 0;

    uint256 fundBalance = 0;

    uint256 constant buyInAmount  = 10 ether;

    

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event AirlineRegistered(address airline, bool approved);
    event PolicyPurchased(bytes32 flightKey, address insuree, uint256 price);
    event PolicyPaidOut(bytes32 flightKey, address insuree, uint256 payoutAmount);

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner and is registered as an airline
    */
    constructor
                                (
                                ) 
                                public
    {
        contractOwner = msg.sender;
        airlines[contractOwner].approved = true;
        airlines[contractOwner].numVotes = 0;
        airlines[contractOwner].airlineAddress = contractOwner;
        airlines[contractOwner].canParticipate = true;

    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     @dev Modifier that requires caller to be an authorized contract
      */
    modifier requireValidCaller()
    {
        require(authorizedContracts[msg.sender], "Caller is not an authorized contract");
        _;
    }

    /**
    * @dev Authorize a caller
    *
    */
    function authorizeCaller(address contractAddress)
    external
    requireContractOwner 
    {
        authorizedContracts[contractAddress] = true;
    }

    /**
    * @dev Deauthorize a caller
    *
    */
    function deauthorizeCaller(address contractAddress)
    external
    requireContractOwner 
    {
        delete authorizedContracts[contractAddress];
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }


    /**
    * @dev Is airline registered
    * @return A bool that is true if airline is approved.
    */
    function isRegistered(address airline) public view returns(bool) {
        return(airlines[airline].approved);
    }

    /**
    * @dev Is airline valid participant?
    * @return A bool that is true if airline is approved and has provided necessary funds
    */
    function isAirline(address airline) public view returns(bool) {
        return(airlines[airline].canParticipate);
    }


    /**
    * @dev Is this a registered flight?
    * @return A bool that is true if flight is registered and occurs in the future
    */
    function isFlight(
                        address airline, 
                        string flight,
                        uint256 timestamp
                    )
                    public
                    view
                    returns(bool)
    {
        return(registeredFlights[getFlightKey(airline, flight, timestamp)]);
    }

    function hasPayout
                        (
                            address insuree
                        )
                        external
                        view
                        requireValidCaller
                        returns(bool)
    {
        return(payouts[insuree] > 0);
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireValidCaller
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */   
    function registerAirline
                            (
                                address voter,
                                address nominee
                            )
                            external
                            requireValidCaller
                            requireIsOperational
                            returns (bool success, uint256 votes)
    {
        require((airlines[nominee].approved == false), "Airline already registered");
        require((airlines[nominee].voters[voter] == false), "Duplicate vote for this airline");
        airlines[nominee].voters[voter] = true;
        airlines[nominee].numVotes = airlines[nominee].numVotes.add(1);
        // See if this is first registration for this airline
        if (airlines[nominee].airlineAddress == nominee) {
            // Airline already in queue.  Must need a multivote.
            if (airlines[nominee].numVotes >= numAirlines.div(2)) {
                airlines[nominee].approved = true;
            }
        } else {
            // Airline not yet in queue. Add it and approve if
            // fewer than 5 airlines are registered
            airlines[nominee].airlineAddress = nominee;
            airlines[nominee].approved = (numAirlines < 5);
        }
        if (airlines[nominee].approved) {
            numAirlines = numAirlines.add(1);
        }
        emit AirlineRegistered(nominee, airlines[nominee].approved);
        return(airlines[nominee].approved, airlines[nominee].numVotes);
    }

       /**
    * @dev Register a future flight for insuring.
    *
    */  
    function registerFlight
                                (
                                    bytes32 flightKey
                                )
                                external
                                requireIsOperational 
                                requireValidCaller
    {
        registeredFlights[flightKey] = true;
    }
    


   /**
    * @dev Record purchased policy
    *
    */   
    function recordPolicy
                            (     
                                address airline,
                                string flight,
                                uint256 timestamp,
                                address insuree,
                                uint256 amount
                            )
                            external
                            requireValidCaller
                            requireIsOperational 
    {
        bytes32 flightKey = getFlightKey(airline, flight, timestamp);
        policies[flightKey].push(
            Policy(
                {
                    insuree: insuree,
                    price: amount
                }
        ));
        fundBalance = fundBalance.add(amount);
        emit PolicyPurchased(flightKey, insuree, amount);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    bytes32 flightKey
                                )
                                external
                                requireValidCaller
                                requireIsOperational
    {
        uint numPolicies = policies[flightKey].length;
        for (uint i = 0 ; i < numPolicies ; i++) {
            // Credit insuree 1.5 times price they paid.  Since we are using integers, multiply by
            // 3 then divide by 2 to calculate 1.5 x
            payouts[policies[flightKey][i].insuree] = payouts[policies[flightKey][i].insuree].add(policies[flightKey][i].price.mul(3).div(2));
            emit PolicyPaidOut(flightKey, policies[flightKey][i].insuree, payouts[policies[flightKey][i].insuree]);
        }
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                address insuree
                            )
                            external
                            requireIsOperational
                            requireValidCaller
                            returns (uint256)
    {
        require (payouts[insuree] > 0, "No funds to claim");
        require (fundBalance >= payouts[insuree], "Insufficient funds available");

        uint256 payoutDue = payouts[insuree];
        payouts[insuree] = 0;
        fundBalance = fundBalance.sub(payoutDue);
        return (payoutDue);

    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function recordAirlineFunding
                            ( 
                                address airline,
                                uint256 amount  
                            )
                            public
                            requireValidCaller
                            returns(bool)
    {
        require(amount > 0, "Invalid funding amount");
        airlines[airline].funding = airlines[airline].funding.add(amount);
        fundBalance = fundBalance.add(amount);

        if (airlines[airline].funding >= buyInAmount) {
            airlines[airline].canParticipate = true;
        }
        return(airlines[airline].canParticipate);
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        public
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }




}

