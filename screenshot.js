function fixPageBackground(page) {
    page.evaluate(function() {
        var style = document.createElement('style'),
            text = document.createTextNode('BODY { background-color: #fff }');
        style.setAttribute('type', 'text/css');
        style.appendChild(text);
        document.head.insertBefore(style, document.head.firstChild);
    });
}

function generateJSON() {
    console.log('generate json');
    var devicesScreens = new Object();
    for (var device in devices) {
        currentDevice = devices[device];
        devicesScreens[currentDevice.getDeviceName()] = currentDevice.getScreenshot();
    }
    return JSON.stringify(devicesScreens);
}

function updateTakenScreens() {
    takenScreens += 1;

    console.log('Rendered! Screenshots: ' + takenScreens);
    if (takenScreens >= devices.length) {
        page.close();
        page = require('webpage').create();
        page.open(serverUrl + 'resize?screenshots='+generateJSON()+'&domain='+domain, function() {
            usingPage = false;
            takenScreens = 0;
            takenScreensPaths = new Array();
            takingScreens = false;
            readServerResponse();
        });
    } else {
        usingPage = false;
    }
}

function takeScreenshot(device) {
    //unset previous device screenshot, because we reuse objects
    device.setScreenshot(null);

    takingScreens = true
    if (usingPage == true) {
        setTimeout(function () { takeScreenshot(device) }, 500);
        return;
    }

    var screenPath = screenshotsPath + domain + '_' + device.getDeviceName() + '.png';

    //set global variable to lock other takeScreenshot functions until
    //usingPage is false
    usingPage = true;

    page.close();
    page = require('webpage').create();

    //settings
    page.clipRect = { top: 0, left: 0, width: device.getWidth(), height: device.getHeight() };
    page.viewportSize = { width: device.getWidth(), height: device.getHeight() };
    page.settings.userAgent = device.getUserAgent()
    page.settings.resourceTimeout = 10000;

    page.onResourceError = function(resourceError) {
        page.reason = resourceError.errorString;
        page.reason_url = resourceError.url;
    };

    //timeout callback
    page.onResourceTimeout = function(e) {
        console.log(domain + ' timeout for device ' + device.getDeviceName());
        updateTakenScreens();
    };

    //open page
    page.open('http://'+domain+'/', function(status) {
        if (status != 'success') {
            updateTakenScreens();
            console.log('Can\'t open '+domain);
            console.log(
                "Error opening url \"" + page.reason_url
                + "\": " + page.reason
            );
        } else {
            fixPageBackground(page);
            console.log('Rendering ' + device.getDeviceName() + ' screenshot..');
            page.render(screenPath);
            device.setScreenshot(screenPath)
            updateTakenScreens();
        }
    });
}

function takeScreenshots() {
    takingScreenshots = true;
    console.log('Taking screenshot of ' + domain);
    takeScreenshot(iPhone);
    takeScreenshot(iPad);
    takeScreenshot(laptop);
}

function readServerResponse() {
    if (takingScreens == true) {
        setTimeout(function () { readServerResponse() }, 2000);
        return;
    }

    domain = null;

    page.close();
    page = require('webpage').create();

    page.settings.resourceTimeout = 10000;
    page.onResourceTimeout = function(e) {
        console.log('Server timeout.');
        setTimeout(function () { readServerResponse() }, 2000);
        return;
    };
    page.open(serverUrl + 'get_domain', function(status) {
        if (status != 'success') {
            //http request to the server failed
            console.log('ERROR: Communication to the server failed');
            setTimeout(function () { readServerResponse() }, 2000);
            return;
        } else {
            var serverResponse = page.evaluate(function () {
                return document.body.innerHTML
            });
            if (serverResponse == 'empty') {
                console.log('No domains left in the queue.');
                setTimeout(function () { readServerResponse() }, 2000);
                return;
            } else {
                domain = serverResponse;
                takeScreenshots(domain);
            }
        }
    });
}

function Device() {
    this.width = 0;
    this.height = 0;
    this.userAgent = '';
    this.deviceName = '';
    this.screenshotPath = null;

    this.setDeviceName = function (name) {
        this.deviceName = name;
    }

    this.getDeviceName = function () {
        return this.deviceName;
    }

    this.setWidth = function (width) {
        this.width = width;
    }

    this.getWidth = function () {
        return this.width;
    }

    this.setHeight = function (height) {
        this.height = height;
    }

    this.getHeight = function () {
        return this.height;
    }

    this.setUserAgent = function (userAgent) {
        this.userAgent = userAgent;
    }

    this.getUserAgent = function () {
        return this.userAgent;
    }

    this.setScreenshot = function (path) {
        this.screenshotPath = path;
    }

    this.getScreenshot = function () {
        return this.screenshotPath;
    }
}

var domain = null;
var takenScreens = 0;
var takingScreens = false;
var takenScreensPaths = new Array();
var usingPage = false;
var page = require('webpage').create();
var devices = new Array();

var iPhone = new Device();
iPhone.setDeviceName('iPhone');
iPhone.setWidth(640);
iPhone.setHeight(1136);
iPhone.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 5_0 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9A334 Safari/7534.48.3');
devices.push(iPhone);

var iPad = new Device();
iPad.setDeviceName('iPad');
iPad.setWidth(1024);
iPad.setHeight(768);
iPad.setUserAgent('Mozilla/5.0 (iPad; CPU OS 5_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B176 Safari/7534.48.3');
devices.push(iPad);

var laptop = new Device();
laptop.setDeviceName('laptop');
laptop.setWidth(1280);
laptop.setHeight(768);
laptop.setUserAgent('Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/30.0.1599.114 Chrome/30.0.1599.114 Safari/537.36');
devices.push(laptop);

var serverUrl = 'http://0.0.0.0:8088/';
var args = require('system').args;
var screenshotsPath = args[1]

readServerResponse();
