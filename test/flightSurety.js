
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
        console.log("Cannot set operating status");
        console.log(e);
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

  it(`(airline) first airline is registered by contract initialization`, async function () {

    let registered = await config.flightSuretyData.isRegistered(config.owner);

    assert.equal(registered, true, "First airline should be registered");

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];
    let registerSucceeded = true;

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {
        registerSucceeded = false;
        console.log(e);
    }


    // ASSERT
    assert.equal(registerSucceeded, false, "Airline should not be able to register another airline if it has not provided funding");

  });

  it('(airline) can register an Airline using registerAirline() after it is funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];
    let registerSucceeded = true;

    // ACT

    // Fund first airline
    try {
        await web3.eth.sendTransaction({
            from: config.firstAirline,
            to: config.flightSuretyApp.address,
            value: Web3.utils.toWei('10', 'ether')
        });
    }
    catch(e) {
        console.log(e);
    }


    // First airline should now be able to register another airline
    try {
        await config.flightSuretyApp.registerAirline(newAirline, {from: config.firstAirline});
    }
    catch(e) {
        registerSucceeded = false;
        console.log(e);
    }

    // ASSERT
    assert.equal(registerSucceeded, true, "Airline should  be able to register another airline if it has provided funding");

  });

 

});
