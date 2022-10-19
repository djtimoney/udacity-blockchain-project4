
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');
const Web3 = require('web3');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });




  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(operational status control) has correct initial isOperational() value`, async function () {

    // Get operating status
    let status =  await config.flightSuretyApp.isOperational();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(operational status control) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyApp.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
            
  });

  it(`(operational status control can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      
      try 
      {
          await config.flightSuretyApp.setOperatingStatus(false, {from: config.owner});
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not allowed for Contract Owner");
      
  });

  it(`(operational status control) can block access to functions using requireIsOperational when operating status is false`, async function () {

      try
      {
        await config.flightSuretyApp.setOperatingStatus(false, {from: config.owner});
      }
      catch(e) {
 
      }

      let reverted = false;
      try 
      {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyApp.setOperatingStatus(true, {from: config.owner});

  });

  it(`(airline contract initialization) first airline is registered by contract initialization`, async function () {

    let registered = await config.flightSuretyData.isRegistered(config.firstAirline);

    assert.equal(registered, true, "First airline should be registered");

  });

  it('(airline ante) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];
    let registerSucceeded = true;


    // ACT

    // First airline registers a new airline. This should work
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {
        registerSucceeded = false;
    }
    assert.equal(registerSucceeded, true, "First airline should be able to register others");

    // Airline just added should not be able to register another since it is unfunded
    try {
        await config.flightSuretyApp.registerAirline(accounts[3], {from: newAirline});
        registerSucceeded = true;
    }
    catch(e) 
    {
        registerSucceeded = false;
    }
    

    // ASSERT
    assert.equal(registerSucceeded, false, "Airline should not be able to register another airline if it has not provided funding");

  });

  it('(airline ante) can register an Airline using registerAirline() after it is funded', async () => {
    
    // ARRANGE
    let secondAirline = accounts[2];
    let newAirline = accounts[3];
    let registerSucceeded = true;

    // ACT

    // Fund second airline
    try {
        await web3.eth.sendTransaction({
            from: secondAirline,
            to: config.flightSuretyApp.address,
            value: Web3.utils.toWei('10', 'ether')
        });
    }
    catch(e) {
        console.log(e);
    }


    // Second airline should now be able to register another airline
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: secondAirline});
    }
    catch(e) {
        console.log(e);
        registerSucceeded = false;
    }

    // ASSERT
    assert.equal(registerSucceeded, true, "Airline should  be able to register another airline if it has provided funding");

  });

  it('(multiparty consensus) new airline requires vote after 5 are registered', async () => {
    
    // ARRANGE
    let mostRecentAirline = accounts[3];
    let registerSucceeded = true;

    let setupFailed = false;

    // Fund the last airline that was added
    try {
        await web3.eth.sendTransaction({
            from: mostRecentAirline,
            to: config.flightSuretyApp.address,
            value: Web3.utils.toWei('10', 'ether')
        });
        setupFailed = false;
    }
    catch(e) {
        setupFailed = true;
    }

    assert.equal(setupFailed, false, "Could not fund last airline added");

    // Now there are 3 funded airlines.  Add 2 more
    for (i = 4 ; i < 6 ; i++) {
        let airline = accounts[i];
        try {
            await config.flightSuretyApp.registerAirline(airline, {from: config.firstAirline});
            setupFailed = false;
        }
        catch(e) {
            setupFailed = true;
        }
        
        assert.equal(setupFailed, false, "Failed to register account "+airline+" as airline");

        try {
            await web3.eth.sendTransaction({
                from: airline,
                to: config.flightSuretyApp.address,
                value: Web3.utils.toWei('10', 'ether')
            });
            setupFailed = false;
        }
        catch(e) {
            setupFailed = true;
        }

        assert.equal(setupFailed, false, "Failed to fund account "+airline);

    }


    // ACT

    // Register a sixth airline.  registerAirline should not throw an exception,
    // but airline should not be approved yet.
    let newAirline = accounts[6]
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {
        registerSucceeded = false;
    }
    let airlineApproved = await config.flightSuretyData.isRegistered.call(newAirline);

    // ASSERT
    assert.equal(registerSucceeded, true, "registerFlight should not throw exception ");
    assert.equal(airlineApproved, false, "Airline should not be approved");

  });

  it('(multiparty consensus) Airline is not approved if only 1 airline voted for it', async () => {
    
    // ARRANGE
    let newAirline = accounts[7];
    let registerSucceeded = true;

    // ACT
    // There should be 5 flights registered ... so 3 votes should be required
    // for approval

    // First airline votes to register new airline
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
        registerSucceeded = true;
    }
    catch(e) {
        console.log(e);
        registerSucceeded = false;
    }

    let approved = await config.flightSuretyData.isRegistered.call(newAirline);


    // ASSERT
    assert.equal(registerSucceeded, true, "Airline should be able to register another airline if it has provided funding");
    assert.equal(approved, false, "New airline should not be approved after one vote");
  });

  it('(multiparty consensus) Airline is not approved if only 2 airlines voted for it', async () => {
    
    // ARRANGE
    let newAirline = accounts[7];
    let registerSucceeded = true;

    // ACT
    // There should be 5 flights registered ... so 3 votes should be required
    // for approval


    // Second airline votes to register new airline
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: accounts[2]});
        registerSucceeded = true;
    }
    catch(e) {
        registerSucceeded = false;
    }

    // ASSERT 

    let approved = await config.flightSuretyData.isRegistered.call(newAirline);

    assert.equal(registerSucceeded, true, "Airline should be able to register another airline if it has provided funding");
    assert.equal(approved, false, "New airline should not be approved after 2 votes");

  });


  it('(multiparty consensus) Airline is approved if 3 airlines voted for it', async () => {
    
    // ARRANGE
    let newAirline = accounts[7];
    let registerSucceeded = true;

    // ACT
    // There should be 5 flights registered ... so 3 votes should be required
    // for approval


    // Third airline votes to register new airline
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: accounts[3]});
        registerSucceeded = true;
    }
    catch(e) {
        registerSucceeded = false;
    }

    let approved = await config.flightSuretyData.isRegistered.call(newAirline);

    // ASSERT

    assert.equal(registerSucceeded, true, "Airline should be able to register another airline if it has provided funding");
    assert.equal(approved, true, "New airline should be approved");
    

  });

  it('(airline - flight data) Add flight for first airline', async () => {
    
    // ARRANGE
    let airline = config.firstAirline;
    let flightNum = "ONE0001";
    let flightAdded = true;
    let flightDate = new Date();
    flightDate.setDate(flightDate.getDate() + 7);
    let flightTimestamp = flightDate.getTime();

    // ACT
    try {
        await config.flightSuretyApp.registerFlight(flightNum, flightTimestamp, {from: airline});
    }
    catch(e)
    {
        flightAdded = false;
    }

     
    // ASSERT
    assert.equal(flightAdded, true, "Failed to add flight "+flightNum+" for airline "+airline);

  });

  it('(airline - flight data) Add flight for second airline', async () => {
    
    // ARRANGE
    let airline = accounts[2];
    let flightNum = "TWO0202";
    let flightAdded = true;
    let flightDate = new Date();
    flightDate.setDate(flightDate.getDate() + 8);
    let flightTimestamp = flightDate.getTime();

    // ACT
    try {
        await config.flightSuretyApp.registerFlight(flightNum, flightTimestamp, {from: airline});
    }
    catch(e)
    {
        flightAdded = false;
    }

     
    // ASSERT
    assert.equal(flightAdded, true, "Failed to add flight "+flightNum+" for airline "+airline);

  });

  it('(airline - flight data) Attempt to add flight for unregistered airline should fail', async () => {
    
    // ARRANGE
    let airline = accounts[6];
    let flightNum = "SIX0666";
    let flightAdded = true;
    let flightDate = new Date();
    flightDate.setDate(flightDate.getDate() + 6);
    let flightTimestamp = flightDate.getTime();

    // ACT
    try {
        await config.flightSuretyApp.registerFlight(flightNum, flightTimestamp, {from: airline});
    }
    catch(e)
    {
        flightAdded = false;
    }

     
    // ASSERT
    assert.equal(flightAdded, false, "Should not be able to add flight for unregistered airline");

  });

});
