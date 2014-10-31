
var should = require("should");
var weatherNode = require("../../weather/weather.js");
var helper = require("../helper.js");
var nock = helper.nock;
var sinon = require("sinon");

describe('weather nodes', function() {
    
    var weatherDataTest = function(weatherdata){
        weatherdata.should.have.property("detail", "scattered clouds");
        weatherdata.should.have.property("tempk", "290.12");
        weatherdata.should.have.property("humidity", "63");
        weatherdata.should.have.property("maxtemp", "291.15");
        weatherdata.should.have.property("mintemp", "289.15");
        weatherdata.should.have.property("windspeed", "8.7");
        weatherdata.should.have.property("winddirection", "220");
        weatherdata.should.have.property("location", "London");
        weatherdata.should.have.property("sunrise", "1412748812");
        weatherdata.should.have.property("sunset", "1412788938");
        weatherdata.should.have.property("clouds", "40");
    }
    
    var locationDataTest = function(locationdata){
        locationdata.should.have.property("lon", "-0.13");
        locationdata.should.have.property("lat", "51.51");
    }
    
    before(function(done) {
        helper.startServer(done);
        if(nock){
            var scope = nock('http://api.openweathermap.org:80')
            .persist()
            
            //used to return normal data on a city/country call
            .get('/data/2.5/weather?q=london,england')
            .reply(200, {"coord":{"lon":-0.13,"lat":51.51},"sys":{"type":1,"id":5091,"message":0.0434,"country":"GB","sunrise":1412748812,"sunset":1412788938},"weather":[{"id":802,"main":"Clouds","description":"scattered clouds","icon":"03d"}],"base":"cmc stations","main":{"temp":290.12,"pressure":994,"humidity":63,"temp_min":289.15,"temp_max":291.15},"wind":{"speed":8.7,"deg":220,"var_beg":190,"var_end":250},"clouds":{"all":40},"dt":1412776848,"id":2643743,"name":"London","cod":200})
           
            //used to return a fail error    
            .get('/data/2.5/weather?q=fail,fail')
            .reply(200,{message:"Error: Not found city"})
            
            //used to return normal data on a lat/lon call    
            .get('/data/2.5/weather?lat=51.51&lon=-0.13')
            .reply(200, {"coord":{"lon":-0.13,"lat":51.51},"sys":{"type":1,"id":5091,"message":0.0434,"country":"GB","sunrise":1412748812,"sunset":1412788938},"weather":[{"id":802,"main":"Clouds","description":"scattered clouds","icon":"03d"}],"base":"cmc stations","main":{"temp":290.12,"pressure":994,"humidity":63,"temp_min":289.15,"temp_max":291.15},"wind":{"speed":8.7,"deg":220,"var_beg":190,"var_end":250},"clouds":{"all":40},"dt":1412776848,"id":2643743,"name":"London","cod":200})
            
            //used to return a slightly different data set to normality. Used solely in the inject node test.
            .get('/data/2.5/weather?q=test,test')
            .reply(200, {"coord":{"lon":-0.13,"lat":51.51},"sys":{"type":1,"id":5091,"message":0.0434,"country":"GB","sunrise":1412748812,"sunset":1412788938},"weather":[{"id":802,"main":"Different","description":"scattered clouds","icon":"03d"}],"base":"cmc stations","main":{"temp":290.12,"pressure":994,"humidity":63,"temp_min":289.15,"temp_max":291.15},"wind":{"speed":8.7,"deg":220,"var_beg":190,"var_end":250},"clouds":{"all":40},"dt":1412776848,"id":2643743,"name":"London","cod":200});
        
        } else {
            console.log("Nock is not available on the current build.");
        }
    });

    

    afterEach(function(done) {
        
        try {
            helper.unload();
            helper.stopServer(done);
        } catch (e) {
             var errorMessage = "" + e;
             errorMessage.should.be.exactly("Error: Not running");
             done();
        }
    });
    
    describe('input node', function() {
        if(nock){
            var scope;
            it('should output the new data when a change is detected in its received data', function(done) {
                helper.load(weatherNode,
                            [{id:"weatherNode1", type:"openweathermap in", city:"london", country:"england", wires:[["n3"]]},
                            {id:"n1", type:"helper", wires:[["weatherNode1"]]},
                            {id:"n3", type:"helper"}], 
                            function() {
                    //the easiest way to trigger the input node was to use a second helper node
                    //with an input into it. This allows new data to be triggered without having to 
                    //wait for the ping timer.
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var changeTime = false;
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    //This code forces the node to receive different weather info. In reality this will only happen when a different weather is returned from the same URL in the API.
                    //A trigger automatically happens when the node is deployed, so a single trigger here to receive different data is all that is neccessary.
                    n3.on('input', function(msg) {
                        var weatherdata = msg.payload;
                        var locationdata = msg.location;
                        //Ensuring that two different outputs are received in N3 before finishing.
                        if (changeTime === false){
                            weatherdata.should.have.property("weather", "Clouds");
                            changeTime = true;
                        } else if (changeTime === true){
                            weatherdata.should.have.property("weather", "Different");
                            done();
                        }
                        weatherDataTest(weatherdata);
                        locationDataTest(locationdata);
                    });
                    
                    n1.send({location:{city:"test", country:"test"}});
                });
            });
        
            it('should refuse to output data when no change is detected', function(done) {
                helper.load(weatherNode,
                            [{id:"weatherNode1", type:"openweathermap in", city:"london", country:"england", wires:[["n3"]]},
                            {id:"n1", type:"helper", wires:[["weatherNode1"]]},
                            {id:"n3", type:"helper"}], 
                            function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var calledAlready = false;
                    weatherNode1.should.have.property('id', 'weatherNode1');               
                    n3.on('input', function(msg) {
                        //this input function will only be run once. If it is run more than once it means the node has output when it shouldn't and will error.
                        try {
                            calledAlready.should.be.false;
                        } catch (err) {
                            done(new Error("The weather input node is outputting unchanged weather data."));
                        }
                        //this ensures that the input function is only called once
                        calledAlready = true;
                        var weatherdata = msg.payload;
                        var locationdata = msg.location;
                        weatherDataTest(weatherdata);
                        locationDataTest(locationdata);
                        done();
                    });
                    //the node autotriggers for the first send, these triggers should all be ignored.
                    n1.send({});
                    n1.send({});
                    n1.send({});
                    n1.send({});
                    n1.send({});                
                });
            });
        } 
    });
    
    describe('query node and polling function', function() {
        var scope;
     
        it('should refuse and node.error when the input payload has invalid lat or lon values', function(done) {
            helper.load(weatherNode,
                    [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                     {id:"weatherNode1", type:"openweathermap", wires:[["n3"]]},
                     {id:"n3", type:"helper"}],
                     function() {
                var n1 = helper.getNode("n1");
                var weatherNode1 = helper.getNode("weatherNode1");
                var n3 = helper.getNode("n3");
                var stub = sinon.stub(weatherNode1, 'warn', function(msg) {
                    msg.should.equal("Invalid lat/lon in input payload"); 
                });
                var stub2 = sinon.stub(weatherNode1, 'error', function(msg) {
                    msg.should.equal("Invalid location information provided");
                    stub.restore();
                    stub2.restore();
                    done();
                });
                weatherNode1.should.have.property('id', 'weatherNode1');
                n1.send({location:{lat: "fail", lon: "fail"}});
            });
        });
        
        if(nock){
                        
            it('should fetch city/country data based on node properties', function(done) {
                helper.load(weatherNode,
                            [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                             {id:"weatherNode1", type:"openweathermap", city: "london", country: "england", wires:[["n3"]]},
                             {id:"n3", type:"helper"}], 
                             function() {
                                                               
                                var n1 = helper.getNode("n1");
                                var weatherNode1 = helper.getNode("weatherNode1");
                                var n3 = helper.getNode("n3");
                                weatherNode1.should.have.property('id', 'weatherNode1');
                                n3.on('input', function(msg) {
                                    var weatherdata = msg.payload;
                                    var locationdata = msg.location;
                                    weatherDataTest(weatherdata);
                                    locationDataTest(locationdata);
                                    done();
                                });
                                
                                n1.send({});
                            });
                
            });
            
            it('should fetch coordinate data based on node properties', function(done) {
                helper.load(weatherNode,
                            [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                             {id:"weatherNode1", type:"openweathermap", lon:"-0.13", lat:"51.51", city:"", country:"", wires:[["n3"]]},
                             {id:"n3", type:"helper"}], 
                             function() {
                                                              
                                var n1 = helper.getNode("n1");
                                var weatherNode1 = helper.getNode("weatherNode1");
                                var n3 = helper.getNode("n3");
                                weatherNode1.should.have.property('id', 'weatherNode1');
                                n3.on('input', function(msg) {
                                    var weatherdata = msg.payload;
                                    var locationdata = msg.location;
                                    weatherDataTest(weatherdata);
                                    locationDataTest(locationdata);
                                    done();
                                });         
                                
                                n1.send({});                                
                            });
            });
            
            it('should fetch coordinate data based on payload lat/lon', function(done) {
                helper.load(weatherNode,
                            [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                             {id:"weatherNode1", type:"openweathermap", wires:[["n3"]]},
                             {id:"n3", type:"helper"}], 
                             function() {
                                                                
                                var n1 = helper.getNode("n1");
                                var weatherNode1 = helper.getNode("weatherNode1");
                                var n3 = helper.getNode("n3");
                                weatherNode1.should.have.property('id', 'weatherNode1');
                                n3.on('input', function(msg) {
                                    var weatherdata = msg.payload;
                                    var locationdata = msg.location;
                                    weatherDataTest(weatherdata);
                                    locationDataTest(locationdata);
                                    done();
                                });
                                
                                n1.send({location:{lon:"-0.13", lat:"51.51"}});                                
                            });
            });
            
            it('should fetch coordinate data based on payload city/country', function(done) {
                helper.load(weatherNode,
                            [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                             {id:"weatherNode1", type:"openweathermap", wires:[["n3"]]},
                             {id:"n3", type:"helper"}], 
                             function() {
                                                                
                                var n1 = helper.getNode("n1");
                                var weatherNode1 = helper.getNode("weatherNode1");
                                var n3 = helper.getNode("n3");
                                weatherNode1.should.have.property('id', 'weatherNode1');
                                n3.on('input', function(msg) {
                                    var weatherdata = msg.payload;
                                    var locationdata = msg.location;
                                    weatherDataTest(weatherdata);
                                    locationDataTest(locationdata);
                                    done();
                                });
                                
                                n1.send({location:{city:"london", country:"england"}});                                
                            });
            });
            
            it('should default to input payload city/country when input payload lat/lon is incorrect', function(done) {
                helper.load(weatherNode,
                        [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                         {id:"weatherNode1", type:"openweathermap", wires:[["n3"]]},
                         {id:"n3", type:"helper"}],
                         function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var stub = sinon.stub(weatherNode1, 'warn', function(msg) {
                        msg.should.equal("Invalid lat/lon in input payload");
                    });
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    n3.on('input', function(msg) {
                        var weatherdata = msg.payload;
                        var locationdata = msg.location;
                        weatherDataTest(weatherdata);
                        locationDataTest(locationdata);
                        stub.restore();
                        done();
                    });
                    
                    n1.send({location:{lat: "fail", lon: "fail", city:"london", country:"england"}});                    
                });
            });
            
            it('should default to node lat/lon when input payload information is incorrect', function(done) {
                helper.load(weatherNode,
                        [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                         {id:"weatherNode1", type:"openweathermap", lat:"51.51", lon:"-0.13", wires:[["n3"]]},
                         {id:"n3", type:"helper"}],
                         function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var warningNo = 0;
                    var stub = sinon.stub(weatherNode1, 'warn', function(msg) {
                        if (warningNo == 0){
                            msg.should.equal("Invalid lat/lon in input payload");
                        } else if (warningNo == 1) {
                            msg.should.equal("Invalid city/country in input payload, trying node lat/lon");
                        }
                        warningNo++;
                    });
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    n3.on('input', function(msg) {
                        var weatherdata = msg.payload;
                        var locationdata = msg.location;
                        weatherDataTest(weatherdata);
                        locationDataTest(locationdata);
                        stub.restore();
                        done();
                    });
                    
                    n1.send({location:{city:"fail", country:"fail", lat: "fail", lon: "fail",}});                    
                });
            });
            
            it('should default to node city/country when input payload information is incorrect', function(done) {
                helper.load(weatherNode,
                        [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                         {id:"weatherNode1", type:"openweathermap", city:"london", country: "england", wires:[["n3"]]},
                         {id:"n3", type:"helper"}],
                         function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var warningNo = 0;
                    var stub = sinon.stub(weatherNode1, 'warn', function(msg) {
                        if (warningNo == 0){
                            msg.should.equal("Invalid lat/lon in input payload");
                        } else if (warningNo == 1) {
                            msg.should.equal("Invalid city/country in input payload, trying node city/country");
                        }
                        warningNo++;
                    });
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    n3.on('input', function(msg) {
                        var weatherdata = msg.payload;
                        var locationdata = msg.location;
                        weatherDataTest(weatherdata);
                        locationDataTest(locationdata);
                        stub.restore();
                        done();
                    });
                    
                    n1.send({location:{city:"fail", country:"fail", lat: "fail", lon: "fail"}});
                });
            });
            
            it('should error when payload city/country is incorrect and no alternative is present', function(done) {
                helper.load(weatherNode,
                        [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                         {id:"weatherNode1", type:"openweathermap", wires:[["n3"]]},
                         {id:"n3", type:"helper"}],
                         function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var stub = sinon.stub(weatherNode1, 'error', function(msg) {
                            msg.should.equal("Invalid city/country in input payload");
                            stub.restore();
                            done();
                    });
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    
                    n1.send({location:{city:"fail", country:"fail"}});
                });
            });
            
            it('should error when node city/country is incorrect', function(done) {
                helper.load(weatherNode,
                        [{id:"n1", type:"helper", wires:[["weatherNode1"]]},
                         {id:"weatherNode1", type:"openweathermap", city:"fail", country:"fail", wires:[["n3"]]},
                         {id:"n3", type:"helper"}],
                         function() {
                    var n1 = helper.getNode("n1");
                    var weatherNode1 = helper.getNode("weatherNode1");
                    var n3 = helper.getNode("n3");
                    var stub = sinon.stub(weatherNode1, 'error', function(msg) {
                            msg.should.equal("Invalid city/country in node settings");
                            stub.restore();
                            done();
                    });
                    weatherNode1.should.have.property('id', 'weatherNode1');
                    
                    n1.send({});
                });
            });          
        }
    });    
});
