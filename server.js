"use strict";
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
//var dbClient = require('mongodb').MongoClient;
var assert = require('assert');


//import tessel
var av = require('tessel-av');
var camera = new av.Camera();

var tessel = require('tessel');
var climatelib = require('climate-si7020');
var climate = climatelib.use(tessel.port['A']);


app.get('/stream', (request, response) => {
    response.redirect(camera.url);
});

app.use(express.static(__dirname));


var url = 'mongodb://admin:123@ds145289.mlab.com:45289/eslab1db';
//var url = 'mongodb://derek:850211@ds145359.mlab.com:45359/eslab1_db';

var numUsers = 0;
var numGuests = 0;
const clientlist = [];

var db;
/*
dbClient.connect(url, function(err, tempdb) {
    db = tempdb;
});
*/

io.on('connection', function(socket) {
    //var profiles = db.collection('userProfile'); //user profiles
    //var records = db.collection('talkingRecord'); //talking records
    //var userpassword = "";

    socket.on('camera on', function() {

        console.log('camera on');
    });

    socket.on('camera off', function() {

        console.log('camera off');
    });

    socket.on('climate on', function() {
        myclimate();
        console.log('climate on');
    });

    socket.on('led on', function() {
        tessel.led[3].on();
        console.log('led 3 on');
    });

    socket.on('led off', function() {
        tessel.led[3].off();
        console.log('led 3 off');
    });

    socket.on('read led', function() {
        socket.emit('set led',{
          isOn: tessel.led[3].isOn
        });
    });

    socket.on('led switch', function() {
        tessel.led[3].toggle();
        io.emit('set led',{
          isOn: tessel.led[3].isOn
        });
        console.log('led 3 toggle');
    });

    socket.on('guest login', function() {
        numGuests += 1;
        if (numGuests == 1) { socket.username = "guest"; } else {
            socket.username = "guest";
            socket.username += numGuests; //guest,guest2,guest3...
        }
        socket.emit('set guestnum', numGuests);
        adduser();
    });

    socket.on('user login', function(profile) {
        checkuser(profile);
        /*
        findRecords(db, function(docs) {
            if (docs.length != 0) {
                for (var i in docs) {
                    addrecord(docs[i]);
                }
            }
        }); //end of findRecords
        */
    });

    socket.on('chat message', function(msg) { //receive msg from client
        console.log(socket.username + ":" + msg);
        var mytime = mygetTime();
        io.emit('chat message', {
            u_name: socket.username,
            u_word: msg,
            u_time: mytime
        }); //when 'chat message'
        //records.insert({ u_name: socket.username, u_word: msg, u_time: mytime }); //insert talking records to db.
    });

    socket.on('disconnect', function() {
        console.log(socket.username + " left.");
        io.emit('user left', {
            username: socket.username
        });
        removeuserlist(); //update userlist
        io.emit('update userlist', getuserlist());
    });

    //functions
    function myclimate() {
        climate.readTemperature('f', function(err, temp) {
            climate.readHumidity(function(err, humid) {
                socket.emit('update climate',{
                  Degree: temp.toFixed(1),
                  Humidity: humid.toFixed(1)
                });
                console.log('Degrees:', temp.toFixed(4) + 'F', 'Humidity:', humid.toFixed(4) + '%RH');
            });
        });
    };

    var checkuser = function(user) { //login
        var userlist = getuserlist();
        for (var i = 0; i < userlist.length; i += 1) {
            if (userlist[i] == user.username) {
                socket.emit('relogin');
            }
        }

        profiles.find({ username: user.username }).toArray(function(err, temp) {
            if (temp.length != 0) {
                userpassword = temp[0].password;
                if (userpassword == user.userpassword) {
                    socket.username = user.username;
                    console.log("user '" + socket.username + "' login sucessful");
                    adduser();
                } else {
                    console.log("wrong password");
                    socket.emit('wrong password');
                }
            } else { //new user, update user profile to the db
                //profiles.insert({ username: user.username, password: user.userpassword });
                socket.username = user.username;
                console.log("new user '" + socket.username + "' sign up");
                adduser();
            }
        });
    }; //end of checkuser


    var adduser = function() {
        console.log("new user:" + socket.username + " connected.");
        clientlist.push(socket);
        io.emit('add user', {
            username: socket.username
        });
        io.emit('update userlist', getuserlist());
    };

    var getuserlist = function() {
        const usersList = [];
        for (var i = 0; i < clientlist.length; i += 1) {
            usersList[i] = clientlist[i].username;
            //console.log(usersList[i]);
        }
        return usersList;
    };

    var removeuserlist = function() {
        for (var i = 0; i < clientlist.length; i += 1) {
            if (socket.username == clientlist[i].username) {
                clientlist.splice(i, 1);
            } //remove logout users
        }
    };

    /*
        var findRecords = function(db, callback) {
            records.find({}).toArray(function(err, docs) {
                callback(docs);
            });
        }; //get all records
    */
    var addrecord = function(data) {
        socket.emit('add record', {
            u_name: data.u_name,
            u_word: data.u_word,
            u_time: data.u_time
        });
    };

    var findsocket = function(name) {
        for (var i = 0; i < clientlist.length; i += 1) {
            if (name == clientlist[i].username) {
                return clientlist[i];
            }
        }
    };

    function mygetTime() {
        var Today = new Date();
        var str1 = Today.getFullYear() + "/" + (Today.getMonth() + 1) + "/" + Today.getDate();

        var myhour = Today.getHours() + 8; //jet lag +8hr for Taiwan
        var myminute = Today.getMinutes();
        var mysecond = Today.getSeconds();
        if (myhour >= 24) myhour = myhour - 24;

        if (myhour < 10) myhour = "0" + myhour;
        if (myminute < 10) myminute = "0" + myminute;
        if (mysecond < 10) mysecond = "0" + mysecond;

        var str2 = myhour + ":" + myminute + ":" + mysecond;
        return str1 + " " + str2;
    };
}); //end io

http.listen((process.env.PORT || 3000), function() {
    console.log('listening on *:3000');
});
