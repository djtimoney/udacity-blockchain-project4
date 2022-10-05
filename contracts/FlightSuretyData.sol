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
        mapping(address => uint256) voters;
        bool approved;
        bool canParticipate;
    }

    mapping(address => Airline) private airlines;

    uint256 numAirlines = 0;

    

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                ) 
                                public 
    {
        contractOwner = msg.sender;
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
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
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
                            returns (bool success, uint256 votes)
    {
        require(airlines[nominee].approved == false, "Airline already registered");
        require(airlines[nominee].voters[voter] == 0, "Duplicate vote for this airline");
        // See if this is first registration for this airline
        if (airlines[nominee].airlineAddress == nominee) {
            // Airline already in queue.  Must need a multivote.
            airlines[nominee].voters[voter] = 1;
            airlines[nominee].numVotes.add(1);
            if (airlines[nominee].numVotes >= numAirlines.div(2)) {
                airlines[nominee].approved = true;
            }
        } else {
            // Airline not yet in queue. Add it
            airlines[nominee].airlineAddress = nominee;
            airlines[nominee].numVotes = 1;
            airlines[nominee].voters[voter] = 1;
            airlines[nominee].approved = (numAirlines < 5);
        }
        return(airlines[nominee].approved, airlines[nominee].numVotes);
    }


   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (                             
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                            )
                            public
                            payable
    {
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}
